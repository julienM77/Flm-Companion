use std::io::{Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream};
use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc, Mutex, OnceLock,
};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};
use std::sync::atomic::AtomicU32;

const PROXY_PORT: u16 = 52626;

struct ProxyHandle {
    stop: Arc<AtomicBool>,
    thread: JoinHandle<()>,
}

static PROXY: OnceLock<Mutex<Option<ProxyHandle>>> = OnceLock::new();
static FLM_PID: AtomicU32 = AtomicU32::new(0);
static METRICS: OnceLock<ApiMetricsState> = OnceLock::new();

struct ApiMetricsState {
    requests: AtomicU64,
    ttft_ms: AtomicU64,
    prompt_tokens: AtomicU64,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiMetrics {
    requests: u64,
    ttft_ms: Option<u64>,
    prompt_tokens: Option<u64>,
}

fn metrics() -> &'static ApiMetricsState {
    METRICS.get_or_init(|| ApiMetricsState {
        requests: AtomicU64::new(0),
        ttft_ms: AtomicU64::new(0),
        prompt_tokens: AtomicU64::new(0),
    })
}

fn proxy_state() -> &'static Mutex<Option<ProxyHandle>> {
    PROXY.get_or_init(|| Mutex::new(None))
}

#[tauri::command]
pub fn start_api_proxy(target_port: u16, model: String) -> Result<u16, String> {
    stop_api_proxy();
    metrics().requests.store(0, Ordering::Relaxed);
    metrics().ttft_ms.store(0, Ordering::Relaxed);
    metrics().prompt_tokens.store(0, Ordering::Relaxed);

    let listener = TcpListener::bind(("127.0.0.1", PROXY_PORT))
        .map_err(|e| format!("Could not bind companion API port {}: {}", PROXY_PORT, e))?;
    listener.set_nonblocking(true).map_err(|e| e.to_string())?;

    let stop = Arc::new(AtomicBool::new(false));
    let stop_thread = Arc::clone(&stop);
    let active_model = Arc::new(model);
    let thread = thread::spawn(move || {
        while !stop_thread.load(Ordering::Relaxed) {
            match listener.accept() {
                Ok((stream, _)) => {
                    let model = Arc::clone(&active_model);
                    thread::spawn(move || handle_connection(stream, target_port, &model));
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(50));
                }
                Err(_) => break,
            }
        }
    });

    *proxy_state().lock().map_err(|e| e.to_string())? = Some(ProxyHandle { stop, thread });
    Ok(PROXY_PORT)
}

#[tauri::command]
pub fn get_api_metrics() -> ApiMetrics {
    let state = metrics();
    let ttft_ms = state.ttft_ms.load(Ordering::Relaxed);
    let prompt_tokens = state.prompt_tokens.load(Ordering::Relaxed);
    ApiMetrics {
        requests: state.requests.load(Ordering::Relaxed),
        ttft_ms: (ttft_ms > 0).then_some(ttft_ms),
        prompt_tokens: (prompt_tokens > 0).then_some(prompt_tokens),
    }
}

#[tauri::command]
pub fn stop_api_proxy() {
    if let Ok(mut state) = proxy_state().lock() {
        if let Some(handle) = state.take() {
            handle.stop.store(true, Ordering::Relaxed);
            let _ = handle.thread.join();
        }
    }
}

#[tauri::command]
pub fn register_flm_process(pid: u32) {
    FLM_PID.store(pid, Ordering::Relaxed);
}

#[tauri::command]
pub fn stop_owned_flm_process() {
    let pid = FLM_PID.swap(0, Ordering::Relaxed);
    if pid == 0 { return; }

    #[cfg(windows)]
    let _ = std::process::Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .output();

    #[cfg(not(windows))]
    let _ = std::process::Command::new("kill")
        .args(["-TERM", &pid.to_string()])
        .output();
}

fn handle_connection(mut client: TcpStream, target_port: u16, model: &str) {
    let _ = client.set_read_timeout(Some(Duration::from_secs(10)));
    let Ok((request_head, body)) = read_request(&mut client) else { return };
    let Some((method, path, headers)) = parse_request_head(&request_head) else { return };

    if method == "OPTIONS" {
        let _ = write_response(&mut client, "204 No Content", "", true);
        return;
    }

    if method == "GET" && path == "/v1/models" {
        let body = format!(
            "{{\"object\":\"list\",\"data\":[{{\"id\":\"{}\",\"object\":\"model\",\"owned_by\":\"flm\"}}]}}",
            json_escape(model)
        );
        let _ = write_response(&mut client, "200 OK", &body, true);
        return;
    }

    let Ok(mut upstream) = TcpStream::connect(("127.0.0.1", target_port)) else {
        let _ = write_response(&mut client, "502 Bad Gateway", "FLM server unavailable", true);
        return;
    };

    let mut forwarded = format!("{} {} HTTP/1.1\r\n", method, path);
    for header in headers.lines() {
        let lower = header.to_ascii_lowercase();
        if !lower.starts_with("host:") && !lower.starts_with("connection:") {
            forwarded.push_str(header);
            forwarded.push_str("\r\n");
        }
    }
    forwarded.push_str("Host: 127.0.0.1\r\nConnection: close\r\n");
    forwarded.push_str(&format!("Content-Length: {}\r\n\r\n", body.len()));

    if upstream.write_all(forwarded.as_bytes()).is_err() || upstream.write_all(&body).is_err() {
        return;
    }
    metrics().requests.fetch_add(1, Ordering::Relaxed);
    relay_response(&mut upstream, &mut client);
    let _ = client.shutdown(Shutdown::Both);
}

fn relay_response(upstream: &mut TcpStream, client: &mut TcpStream) {
    let started = Instant::now();
    let Ok((response_headers, initial_body)) = read_headers(upstream) else { return };
    if client.write_all(&response_headers).is_err() { return; }

    let mut buffer = [0u8; 16 * 1024];
    let mut first_body_byte = false;
    let mut sample = initial_body.clone();
    if !initial_body.is_empty() {
        first_body_byte = true;
        metrics().ttft_ms.store(started.elapsed().as_millis() as u64, Ordering::Relaxed);
        if client.write_all(&initial_body).is_err() { return; }
    }
    loop {
        let Ok(read) = upstream.read(&mut buffer) else { return };
        if read == 0 { break; }
        if !first_body_byte {
            first_body_byte = true;
            metrics().ttft_ms.store(started.elapsed().as_millis() as u64, Ordering::Relaxed);
        }
        if sample.len() < 512 * 1024 {
            sample.extend_from_slice(&buffer[..read.min(512 * 1024 - sample.len())]);
        }
        if client.write_all(&buffer[..read]).is_err() { return; }
    }
    if let Some(tokens) = find_prompt_tokens(&sample) {
        metrics().prompt_tokens.store(tokens, Ordering::Relaxed);
    }
}

fn read_headers(stream: &mut TcpStream) -> std::io::Result<(Vec<u8>, Vec<u8>)> {
    let mut bytes = Vec::with_capacity(1024);
    let mut buffer = [0u8; 1024];
    loop {
        let read = stream.read(&mut buffer)?;
        if read == 0 { return Err(std::io::Error::new(std::io::ErrorKind::UnexpectedEof, "empty response")); }
        bytes.extend_from_slice(&buffer[..read]);
        if let Some(end) = bytes.windows(4).position(|window| window == b"\r\n\r\n") {
            return Ok((bytes[..end + 4].to_vec(), bytes[end + 4..].to_vec()));
        }
        if bytes.len() > 64 * 1024 { return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "response headers too large")); }
    }
}

fn find_prompt_tokens(bytes: &[u8]) -> Option<u64> {
    let text = std::str::from_utf8(bytes).ok()?;
    let marker = "\"prompt_tokens\"";
    let start = text.find(marker)? + marker.len();
    text[start..].split(':').nth(1)?.trim_start().split(|c: char| !c.is_ascii_digit()).next()?.parse().ok()
}

fn read_request(stream: &mut TcpStream) -> std::io::Result<(String, Vec<u8>)> {
    let mut bytes = Vec::with_capacity(4096);
    let mut buffer = [0u8; 1024];
    let header_end;
    loop {
        let read = stream.read(&mut buffer)?;
        if read == 0 { return Err(std::io::Error::new(std::io::ErrorKind::UnexpectedEof, "empty request")); }
        bytes.extend_from_slice(&buffer[..read]);
        if let Some(end) = bytes.windows(4).position(|window| window == b"\r\n\r\n") {
            header_end = end + 4;
            break;
        }
        if bytes.len() > 64 * 1024 { return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "request headers too large")); }
    }

    let head = String::from_utf8_lossy(&bytes[..header_end]).into_owned();
    let content_length = head.lines()
        .find_map(|line| {
            let (name, value) = line.split_once(':')?;
            name.eq_ignore_ascii_case("content-length").then_some(value.trim())
        })
        .and_then(|value| value.parse::<usize>().ok())
        .unwrap_or(0);
    let mut body = bytes[header_end..].to_vec();
    while body.len() < content_length {
        let read = stream.read(&mut buffer)?;
        if read == 0 { break; }
        body.extend_from_slice(&buffer[..read]);
    }
    body.truncate(content_length);
    Ok((head, body))
}

fn parse_request_head(head: &str) -> Option<(String, String, String)> {
    let mut lines = head.trim_end_matches("\r\n").split("\r\n");
    let request = lines.next()?;
    let mut parts = request.splitn(3, ' ');
    Some((parts.next()?.to_string(), parts.next()?.to_string(), lines.collect::<Vec<_>>().join("\r\n")))
}

fn write_response(stream: &mut TcpStream, status: &str, body: &str, close: bool) -> std::io::Result<()> {
    let connection = if close { "close" } else { "keep-alive" };
    write!(stream, "HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: *\r\nConnection: {}\r\n\r\n{}", status, body.len(), connection, body)
}

fn json_escape(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

import { Command, Child } from "@tauri-apps/plugin-shell";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { ConfigService } from "./config";

export interface FlmModel {
    name: string;
    size: string;
    modified: string;
    // Extended metadata
    realSize?: number;
    description?: string;
    family?: string;
    isThink?: boolean;
    isVlm?: boolean;
    contextLength?: number;
    quantization?: string;
    url?: string;
    parameterSize?: string;
}

interface ModelListJson {
    model_path: string;
    models: Record<string, Record<string, ModelJsonEntry>>;
}

interface ModelJsonEntry {
    name: string;
    url: string;
    modified_at: string;
    size: number;
    default_context_length: number;
    vlm?: boolean;
    details: {
        format: string;
        family: string;
        think: boolean;
        parameter_size: string;
        quantization_level: string;
    };
}

export interface FlmStatus {
    version: string;
    isInstalled: boolean;
}

export interface HardwareInfo {
    cpu: string;
    ram: string;
    npuDriver: string;
    npuName: string;
    sharedMemory: string;
}

export interface ServerOptions {
    pmode?: 'powersaver' | 'balanced' | 'performance' | 'turbo';
    ctxLen?: number;
    port?: number;
    asr?: boolean;
    embed?: boolean;
    socket?: number;
    qLen?: number;
    cors?: boolean;
    preemption?: boolean;
}

let serverProcess: Child | null = null;

function getDirectory(path: string): string {
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    if (lastSlash === -1) return ".";
    return path.substring(0, lastSlash);
}

export const FlmService = {
    /**
     * Get rich metadata from local JSON file
     */
    async getModelsMetadata(): Promise<Record<string, FlmModel>> {
        try {
            const config = await ConfigService.loadConfig();
            let flmPath = config.flmPath;

            // If path is not configured, try to detect it
            if (!flmPath || flmPath === "flm") {
                const detected = await this.findFlmPath();
                if (detected) {
                    flmPath = detected;
                }
            }

            // flmPath is the directory containing model_list.json
            let modelListPath = "model_list.json";
            if (flmPath && flmPath !== "flm") {
                const separator = flmPath.includes('\\') ? '\\' : '/';
                modelListPath = `${flmPath}${separator}model_list.json`;
            } else {
                // Fallback to default install location if just "flm" is configured
                modelListPath = "C:\\Program Files\\flm\\model_list.json";
            }

            const content = await readTextFile(modelListPath);
            const data: ModelListJson = JSON.parse(content);
            const metadata: Record<string, FlmModel> = {};

            for (const [family, variants] of Object.entries(data.models)) {
                for (const [tag, details] of Object.entries(variants)) {
                    const fullName = `${family}:${tag}`;

                    // Format size to GB/MB
                    const sizeBytes = details.size;
                    let sizeStr = "";
                    if (sizeBytes > 1024 * 1024 * 1024) {
                        sizeStr = `${(sizeBytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
                    } else {
                        sizeStr = `${(sizeBytes / (1024 * 1024)).toFixed(0)}MB`;
                    }

                    metadata[fullName] = {
                        name: fullName,
                        size: sizeStr,
                        modified: details.modified_at,
                        realSize: details.size,
                        description: details.name, // Using the descriptive name
                        family: details.details.family,
                        isThink: details.details.think,
                        isVlm: details.vlm || false,
                        contextLength: details.default_context_length,
                        quantization: details.details.quantization_level,
                        url: details.url,
                        parameterSize: details.details.parameter_size
                    };
                }
            }
            return metadata;
        } catch (error) {
            console.warn("Could not read model_list.json:", error);
            return {};
        }
    },

    /**
     * Check if FLM is installed and get version
     */
    async getVersion(): Promise<string> {
        try {
            const command = Command.create("flm", ["--version"]);

            const output = await command.execute();
            if (output.code === 0) {
                return output.stdout.trim().replace(/^FLM\s+/i, '');
            }
            return "Unknown";
        } catch (error) {
            console.error("Failed to get FLM version:", error);
            return "Not Found";
        }
    },

    /**
     * Get Hardware Information (CPU, RAM, NPU)
     */
    async getHardwareInfo(): Promise<HardwareInfo> {
        try {
            const script = `
                $cpu = (Get-CimInstance Win32_Processor).Name
                $ram = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
                $shared = [math]::Round($ram / 2, 1)
                
                $npuName = "Non détecté"
                $npuDriver = "N/A"

                # Search for NPU driver directly using CIM/WMI which contains the version
                $npuDriverInfo = Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceName -match 'NPU Compute Accelerator Device|Ryzen AI|Intel AI Boost' } | Select-Object -First 1

                if ($npuDriverInfo) {
                    $npuName = $npuDriverInfo.DeviceName
                    $npuDriver = $npuDriverInfo.DriverVersion
                }
                
                @{
                    cpu = $cpu
                    ram = "$ram GB"
                    sharedMemory = "$shared GB (Max)"
                    npuName = $npuName
                    npuDriver = $npuDriver
                } | ConvertTo-Json -Compress
            `;

            const command = Command.create("powershell", ["-Command", script]);
            const output = await command.execute();

            if (output.code === 0) {
                return JSON.parse(output.stdout);
            }
            throw new Error(output.stderr);
        } catch (e) {
            console.error("Failed to get hardware info", e);
            return {
                cpu: "Unknown",
                ram: "Unknown",
                sharedMemory: "Unknown",
                npuName: "Unknown",
                npuDriver: "Unknown"
            };
        }
    },

    /**
     * List models with optional filter
     * Parses output of `flm list`
     * @param filter 'all' | 'installed' | 'not-installed'
     */
    async listModels(filter: 'all' | 'installed' | 'not-installed' = 'installed'): Promise<FlmModel[]> {
        try {
            // 1. Get Metadata from JSON
            const metadata = await this.getModelsMetadata();

            // 2. Prepare CLI command based on filter
            // User instruction: use --filter installed or --filter not-installed
            const args = ["list", "--quiet"];
            if (filter !== 'all') {
                args.push("--filter", filter);
            }

            console.log(`[FLM] Executing: flm ${args.join(' ')}`);
            const command = Command.create("flm", args);
            const output = await command.execute();

            if (output.code !== 0) {
                console.error(`Failed to list models (filter=${filter}):`, output.stderr);
                return [];
            }

            const lines = output.stdout.split("\n").filter((l: string) => l.trim() !== "");
            const results: FlmModel[] = [];

            for (const line of lines) {
                // Clean up line (remove bullets, icons if any remain)
                // We assume the first part of the line is the model name
                const cleanLine = line.trim().replace(/^[-*+•>]\s+/, '');
                const parts = cleanLine.split(/\s+/);

                if (parts.length === 0) continue;

                const name = parts[0];

                // Basic validation to skip headers
                if (name === "NAME" || name.startsWith("---") || name.startsWith("Model")) continue;

                // If we have metadata for this model, use it
                if (metadata[name]) {
                    results.push(metadata[name]);
                } else {
                    // Fallback for models not in JSON (e.g. custom models)
                    let size = "-";
                    if (name.includes(':')) {
                        const split = name.split(':');
                        if (split.length > 1) {
                            size = split[split.length - 1];
                        }
                    }

                    results.push({
                        name: name,
                        size: size,
                        modified: "-"
                    });
                }
            }

            return results;
        } catch (error) {
            console.error("Failed to list models:", error);
            return [];
        }
    },

    /**
     * Start the FLM server
     */
    async startServer(modelName: string, options: ServerOptions, onLog: (log: string) => void): Promise<void> {
        if (serverProcess) {
            throw new Error("Server is already running");
        }

        try {
            const args = ["serve", modelName];

            if (options.pmode) args.push("--pmode", options.pmode);
            if (options.ctxLen && options.ctxLen > 0) args.push("--ctx-len", options.ctxLen.toString());
            if (options.port && options.port > 0) args.push("--port", options.port.toString());
            if (options.socket && options.socket > 0) args.push("--socket", options.socket.toString());
            if (options.qLen && options.qLen > 0) args.push("--q-len", options.qLen.toString());

            // Boolean flags that take 0 or 1
            if (options.asr !== undefined) args.push("--asr", options.asr ? "1" : "0");
            if (options.embed !== undefined) args.push("--embed", options.embed ? "1" : "0");
            if (options.cors !== undefined) args.push("--cors", options.cors ? "1" : "0");
            if (options.preemption !== undefined) args.push("--preemption", options.preemption ? "1" : "0");

            console.log(`[FLM] Starting server with args: ${args.join(' ')}`);
            onLog(`[SYSTEM] Executing: flm ${args.join(' ')}`);

            const command = Command.create("flm", args);

            command.on('close', (data: any) => {
                console.log(`command finished with code ${data.code} and signal ${data.signal}`);
                serverProcess = null;
                onLog(`[SYSTEM] Server stopped with code ${data.code}`);
            });

            command.on('error', (error: any) => {
                console.error(`command error: "${error}"`);
                onLog(`[ERROR] ${error}`);
            });

            command.stdout.on('data', (line: any) => {
                onLog(`[FLM] ${line}`);
            });

            command.stderr.on('data', (line: any) => {
                onLog(`[FLM ERR] ${line}`);
            });

            serverProcess = await command.spawn();
            onLog(`[SYSTEM] Server process started (PID: ${serverProcess.pid})`);

        } catch (error) {
            console.error("Failed to start server:", error);
            throw error;
        }
    },

    /**
     * Stop the FLM server
     */
    async stopServer(onLog?: (log: string) => void): Promise<void> {
        if (serverProcess) {
            try {
                if (onLog) onLog("[SYSTEM] Sending 'exit' command to server...");

                // Try to stop gracefully by sending "exit" command to stdin
                // Using \r\n to ensure it's recognized as a line break on all platforms/terminals
                const encoder = new TextEncoder();
                await serverProcess.write(encoder.encode("exit\r\n"));

                if (onLog) onLog("[SYSTEM] Exit command sent. Waiting for graceful shutdown...");

                // To be safe, we can set a timeout to force kill if it doesn't close
                setTimeout(async () => {
                    if (serverProcess) {
                        if (onLog) onLog("[SYSTEM] Server did not exit gracefully, forcing kill...");
                        console.log("Server did not exit gracefully, forcing kill...");
                        await serverProcess.kill();
                    }
                }, 5000); // 5 seconds timeout

            } catch (e) {
                console.error("Failed to write exit command, forcing kill", e);
                if (onLog) onLog(`[ERROR] Failed to write exit command: ${e}. Forcing kill...`);
                await serverProcess.kill();
            }
        }
    },

    /**
     * Pull a new model
     */
    async pullModel(modelName: string, onProgress: (data: string) => void): Promise<void> {
        return new Promise(async (resolve, reject) => {
            let errorOutput = "";
            try {
                const command = Command.create("flm", ["pull", modelName]);

                command.on('close', (data: any) => {
                    if (data.code === 0) {
                        resolve();
                    } else {
                        reject(new Error(errorOutput || `Process exited with code ${data.code}`));
                    }
                });

                command.on('error', (error: any) => {
                    reject(error);
                });

                command.stdout.on('data', (line: any) => {
                    onProgress(line.toString());
                });

                command.stderr.on('data', (line: any) => {
                    const text = line.toString();
                    errorOutput += text;
                    onProgress(text);
                });

                await command.spawn();
            } catch (error) {
                reject(error);
            }
        });
    },

    /**
     * Remove a model
     */
    async removeModel(modelName: string): Promise<void> {
        const command = Command.create("flm", ["remove", modelName]);
        const output = await command.execute();
        if (output.code !== 0) {
            throw new Error(output.stderr);
        }
    },

    /**
     * Start interactive chat session
     */
    async startChat(modelName: string, options: ServerOptions, onData: (data: { type: 'stdout' | 'stderr' | 'exit', content?: string, code?: number }) => void): Promise<void> {
        if (serverProcess) {
            throw new Error("A process is already running");
        }

        try {
            const args = ["run", modelName];

            if (options.pmode) args.push("--pmode", options.pmode);
            if (options.ctxLen && options.ctxLen > 0) args.push("--ctx-len", options.ctxLen.toString());
            // Note: run command might not support all server options like port/cors, but supports pmode, ctx-len etc.

            // Boolean flags
            if (options.asr !== undefined) args.push("--asr", options.asr ? "1" : "0");
            if (options.embed !== undefined) args.push("--embed", options.embed ? "1" : "0");

            console.log(`[FLM] Starting chat with args: ${args.join(' ')}`);

            const command = Command.create("flm", args);

            command.on('close', (data: any) => {
                serverProcess = null;
                onData({ type: 'exit', code: data.code });
            });

            command.on('error', (error: any) => {
                onData({ type: 'stderr', content: error.toString() });
            });

            command.stdout.on('data', (line: any) => {
                onData({ type: 'stdout', content: line });
            });

            command.stderr.on('data', (line: any) => {
                onData({ type: 'stderr', content: line });
            });

            serverProcess = await command.spawn();

        } catch (error) {
            console.error("Failed to start chat:", error);
            throw error;
        }
    },

    /**
     * Send message to chat session
     */
    async sendChatMessage(message: string): Promise<void> {
        if (!serverProcess) return;

        const encoder = new TextEncoder();
        // Add newline to simulate pressing Enter
        await serverProcess.write(encoder.encode(message + "\n"));
    },

    /**
     * Stop chat session
     */
    async stopChat(): Promise<void> {
        await this.stopServer(); // Re-use stopServer logic as it handles killing the process
    },

    /**
     * Try to find FLM executable path using PowerShell
     */
    async findFlmPath(): Promise<string | null> {
        try {
            // Use PowerShell to find the command location
            const command = Command.create("powershell", ["-Command", "(Get-Command flm -ErrorAction SilentlyContinue).Source"]);
            const output = await command.execute();

            if (output.code === 0 && output.stdout.trim()) {
                const fullPath = output.stdout.trim();
                // We want the directory, not the executable
                return getDirectory(fullPath);
            }
            return null;
        } catch (error) {
            console.error("Failed to find FLM path:", error);
            return null;
        }
    }
};

import { Command, Child } from "@tauri-apps/plugin-shell";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { ConfigService } from "./config";
import type { FlmModel, FlmStatus, HardwareInfo, ServerOptions } from "../types";
import { MODEL_LIST_FILENAME } from "../types";

// Ré-export des types pour la compatibilité
export type { FlmModel, FlmStatus, HardwareInfo, ServerOptions };

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

let serverProcess: Child | null = null;
let metadataCache: Record<string, FlmModel> | null = null;
let installedModelsCache: FlmModel[] | null = null;
let availableModelsCache: FlmModel[] | null = null;
let hardwareInfoCache: HardwareInfo | null = null;

function getDirectory(path: string): string {
    const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
    if (lastSlash === -1) return ".";
    return path.substring(0, lastSlash);
}

export const FlmService = {
    /**
     * Get rich metadata from local JSON file
     */
    async getModelsMetadata(forceRefresh = false): Promise<Record<string, FlmModel>> {
        if (metadataCache && !forceRefresh) {
            return metadataCache;
        }

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
            let modelListPath;
            if (flmPath && flmPath !== "flm") {
                const cleanPath = flmPath.replace(/[\\/]+$/, '');
                const separator = cleanPath.includes('\\') ? '\\' : '/';
                modelListPath = `${cleanPath}${separator}${MODEL_LIST_FILENAME}`;
            } else {
                // Fallback to default install location if just "flm" is configured
                modelListPath = `C:\\Program Files\\flm\\${MODEL_LIST_FILENAME}`;
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
                        description: details.name,
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
            metadataCache = metadata;
            return metadata;
        } catch (error) {
            console.warn(`Could not read ${MODEL_LIST_FILENAME}:`, error);
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
    async getHardwareInfo(forceRefresh = false): Promise<HardwareInfo> {
        if (hardwareInfoCache && !forceRefresh) {
            return hardwareInfoCache;
        }

        try {
            const script = `
                $cpu = (Get-CimInstance Win32_Processor).Name
                $mem = (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory
                $ram = [math]::Round($mem / 1GB, 1)
                $shared = [math]::Round($ram / 2, 1)
                $sharedBytes = [math]::Round($mem / 2, 0)
                
                $npuName = ""
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
                    ramTotalBytes = $mem
                    sharedMemory = "$shared GB (Max)"
                    sharedMemoryBytes = $sharedBytes
                    npuName = $npuName
                    npuDriver = $npuDriver
                } | ConvertTo-Json -Compress
            `;

            const command = Command.create("powershell", ["-Command", script]);
            const output = await command.execute();

            if (output.code === 0) {
                const info = JSON.parse(output.stdout);
                hardwareInfoCache = info;
                return info;
            }
            throw new Error(output.stderr);
        } catch (e) {
            console.error("Failed to get hardware info", e);
            return {
                cpu: "Unknown",
                ram: "Unknown",
                ramTotalBytes: 0,
                sharedMemory: "Unknown",
                sharedMemoryBytes: 0,
                npuName: "Unknown",
                npuDriver: "Unknown"
            };
        }
    },

    /**
     * List models with optional filter
     * Parses output of `flm list`
     * @param filter 'all' | 'installed' | 'not-installed'
     * @param forceRefresh Force refresh of the cache
     */
    async listModels(filter: 'all' | 'installed' | 'not-installed' = 'installed', forceRefresh = false): Promise<FlmModel[]> {
        if (filter === 'installed' && installedModelsCache && !forceRefresh) {
            return installedModelsCache;
        }
        if (filter === 'not-installed' && availableModelsCache && !forceRefresh) {
            return availableModelsCache;
        }

        try {
            const metadata = await this.getModelsMetadata();

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
                const cleanLine = line.trim().replace(/^[-*+•>]\s+/, '');
                const parts = cleanLine.split(/\s+/);

                if (parts.length === 0) continue;

                const name = parts[0];

                if (name === "NAME" || name.startsWith("---") || name.startsWith("Model")) continue;

                if (metadata[name]) {
                    results.push(metadata[name]);
                } else {
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

            if (filter === 'installed') {
                installedModelsCache = results;
            } else if (filter === 'not-installed') {
                availableModelsCache = results;
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
            const args = ["serve"];
            if (modelName) {
                args.push(modelName);
            }

            if (options.pmode) args.push("--pmode", options.pmode);
            if (options.ctxLen && options.ctxLen > 0) args.push("--ctx-len", options.ctxLen.toString());
            if (options.port && options.port > 0) args.push("--port", options.port.toString());
            if (options.host) args.push("--host", options.host);
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

                const encoder = new TextEncoder();
                await serverProcess.write(encoder.encode("exit\r\n"));

                if (onLog) onLog("[SYSTEM] Exit command sent. Waiting for graceful shutdown...");

                await new Promise<void>((resolve) => {
                    const timeoutId = setTimeout(() => {
                        if (serverProcess) {
                            if (onLog) onLog("[SYSTEM] Server did not exit gracefully, forcing kill...");
                            console.log("Server did not exit gracefully, forcing kill...");
                            serverProcess.kill().catch((e) => {
                                console.error("Error killing process:", e);
                            });
                        }
                        resolve();
                    }, 5000);

                    const intervalId = setInterval(() => {
                        if (!serverProcess) {
                            clearTimeout(timeoutId);
                            clearInterval(intervalId);
                            resolve();
                        }
                    }, 100);
                });

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
    pullModel(modelName: string, onProgress: (data: string) => void): Promise<void> {
        installedModelsCache = null;
        availableModelsCache = null;
        return new Promise((resolve, reject) => {
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

                command.spawn().catch(reject);
            } catch (error) {
                reject(error);
            }
        });
    },

    /**
     * Remove a model
     */
    async removeModel(modelName: string): Promise<void> {
        installedModelsCache = null;
        availableModelsCache = null;
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
        await serverProcess.write(encoder.encode(message + "\n"));
    },

    /**
     * Stop chat session
     */
    async stopChat(): Promise<void> {
        await this.stopServer();
    },

    /**
     * Try to find FLM executable path using PowerShell
     */
    async findFlmPath(): Promise<string | null> {
        try {
            const command = Command.create("powershell", ["-Command", "(Get-Command flm -ErrorAction SilentlyContinue).Source"]);
            const output = await command.execute();

            if (output.code === 0 && output.stdout.trim()) {
                const fullPath = output.stdout.trim();
                return getDirectory(fullPath);
            }
            return null;
        } catch (error) {
            console.error("Failed to find FLM path:", error);
            return null;
        }
    }
};

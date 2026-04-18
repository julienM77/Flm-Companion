import { Command } from "@tauri-apps/plugin-shell";
import { type } from "@tauri-apps/plugin-os";
import { invoke } from "@tauri-apps/api/core";

export interface SystemInfo {
    npuDriverVersion: string;
}

interface NpuStats {
    usage: number;
    memory_used: number;
    memory_total: number;
}

export const SystemService = {
    async getNpuDriverVersion(): Promise<string> {
        const osType = await type();

        if (osType === 'windows') {
            return this.getWindowsNpuDriverVersion();
        } else if (osType === 'linux') {
            return this.getLinuxNpuDriverVersion();
        }

        return "Non supporté";
    },

    async getWindowsNpuDriverVersion(): Promise<string> {
        try {
            const script = `
                $driver = Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceName -like "*IPU*" -or $_.DeviceName -like "*NPU*" } | Select-Object -First 1
                if ($driver) {
                    Write-Output $driver.DriverVersion
                } else {
                    Write-Output "Non détecté"
                }
            `;

            const command = Command.create("powershell", ["-NonInteractive", "-NoProfile", "-WindowStyle", "Hidden", "-Command", script]);
            const output = await command.execute();

            if (output.code === 0) {
                return output.stdout.trim() || "Non détecté";
            }
            return "Erreur";
        } catch (error) {
            console.error("Failed to get NPU driver:", error);
            return "Erreur";
        }
    },

    async getLinuxNpuDriverVersion(): Promise<string> {
        return "Not Implemented";
    },

    async getSystemStats(): Promise<{ memory: { used: number, total: number, percentage: number }, cpu: { usage: number }, npu: { usage: number, memory: number } }> {
        let memory = { used: 0, total: 0, percentage: 0 };
        let cpu = { usage: 0 };
        let npu = { usage: 0, memory: 0 };

        try {
            const stats = await invoke<{ memory_used_mb: number, memory_total_mb: number, memory_percentage: number, cpu_usage: number }>("get_system_stats");
            memory = {
                used: stats.memory_used_mb,
                total: stats.memory_total_mb,
                percentage: stats.memory_percentage
            };
            cpu = { usage: stats.cpu_usage };
        } catch (error) {
            console.error("Failed to get system stats:", error);
        }

        try {
            const npuStats = await invoke<NpuStats>("get_npu_info");
            npu = { usage: npuStats.usage, memory: npuStats.memory_used };
        } catch (error) {
            console.error("Failed to get NPU stats:", error);
        }

        return { memory, cpu, npu };
    }
};
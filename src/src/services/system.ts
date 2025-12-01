import { Command } from "@tauri-apps/plugin-shell";
import { type } from "@tauri-apps/plugin-os";

export interface SystemInfo {
    npuDriverVersion: string;
}

export const SystemService = {
    /**
     * Get the NPU Driver Version
     */
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
            // Command to find AMD IPU (Ryzen AI) driver
            // We look for "AMD IPU Device" or similar and get the DriverVersion
            const script = `
                $driver = Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceName -like "*IPU*" -or $_.DeviceName -like "*NPU*" } | Select-Object -First 1
                if ($driver) {
                    Write-Output $driver.DriverVersion
                } else {
                    Write-Output "Non détecté"
                }
            `;

            const command = Command.create("powershell", ["-Command", script]);
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
        // Placeholder for Linux implementation
        return "Not Implemented";
    },

    async getSystemStats(): Promise<{ memory: { used: number, total: number, percentage: number }, cpu: { usage: number }, npu: { usage: number, temperature: number, power: number } }> {
        try {
            // Get Memory and CPU Stats via PowerShell
            const script = `
                $os = Get-CimInstance Win32_OperatingSystem
                $total = $os.TotalVisibleMemorySize / 1024
                $free = $os.FreePhysicalMemory / 1024
                $used = $total - $free
                $memPercent = ($used / $total) * 100
                
                $cpu = Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select-Object -ExpandProperty Average
                
                "$([math]::Round($used, 2));$([math]::Round($total, 2));$([math]::Round($memPercent, 2));$cpu"
            `;

            const command = Command.create("powershell", ["-Command", script]);
            const output = await command.execute();

            let memory = { used: 0, total: 0, percentage: 0 };
            let cpu = { usage: 0 };

            if (output.code === 0) {
                const parts = output.stdout.trim().split(';');
                if (parts.length >= 4) {
                    memory = {
                        used: parseFloat(parts[0]),
                        total: parseFloat(parts[1]),
                        percentage: parseFloat(parts[2])
                    };
                    cpu = {
                        usage: parseFloat(parts[3])
                    };
                }
            }

            // Mock NPU Stats (Still mocked as no standard API exists yet)
            const npu = {
                usage: 0,
                temperature: 0,
                power: 0
            };

            return { memory, cpu, npu };
        } catch (error) {
            console.error("Failed to get system stats:", error);
            return {
                memory: { used: 0, total: 0, percentage: 0 },
                cpu: { usage: 0 },
                npu: { usage: 0, temperature: 0, power: 0 }
            };
        }
    }
};
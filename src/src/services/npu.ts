import { invoke } from "@tauri-apps/api/core";

export interface NpuStats {
    usage: number;
    memory_used: number;
    memory_total: number;
}

export const NpuService = {
    async getNpuInfo(): Promise<NpuStats> {
        try {
            const stats = await invoke<NpuStats>("get_npu_info");
            return stats;
        } catch (error) {
            console.error("Failed to get NPU info:", error);
            return {
                usage: 0,
                memory_used: 0,
                memory_total: 0
            };
        }
    }
};

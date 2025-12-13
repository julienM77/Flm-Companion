import type { FlmModel, HardwareInfo } from "../types";

export type PerformanceWarning = "none" | "warning" | "critical";

/**
 * Calcule la mémoire disponible réelle pour exécuter des modèles
 * en tenant compte de la RAM partagée du NPU et de la mémoire système
 */
export function getAvailableMemory(hardwareInfo: HardwareInfo | null): number {
    if (!hardwareInfo || !hardwareInfo.ramTotalBytes) {
        return 0;
    }

    const totalRam = hardwareInfo.ramTotalBytes;
    const sharedNpuMem = hardwareInfo.sharedMemoryBytes || 0;

    // Mémoire système réservée (environ 2GB pour l'OS Windows)
    const systemReserved = 2 * 1024 * 1024 * 1024;

    // RAM disponible = Total - Shared NPU - System Reserved
    return Math.max(0, totalRam - sharedNpuMem - systemReserved);
}

/**
 * Détermine le niveau d'avertissement de performance pour un modèle
 * basé sur sa taille et la mémoire disponible
 */
export function getPerformanceWarning(
    model: FlmModel,
    hardwareInfo: HardwareInfo | null
): PerformanceWarning {
    if (!model.realSize || !hardwareInfo || !hardwareInfo.ramTotalBytes) {
        return "none";
    }

    const availableMemory = getAvailableMemory(hardwareInfo);
    if (availableMemory === 0) {
        return "none";
    }

    const modelSize = model.realSize;

    // Critical: Le modèle ne pourra probablement pas se lancer
    // Modèle > 90% de la mémoire disponible
    if (modelSize > availableMemory * 0.9) {
        return "critical";
    }

    // Warning: Performances potentiellement dégradées
    // Modèle entre 70% et 90% de la mémoire disponible
    if (modelSize > availableMemory * 0.7) {
        return "warning";
    }

    return "none";
}

/**
 * Formate la mémoire disponible pour l'affichage
 */
export function formatAvailableMemory(hardwareInfo: HardwareInfo | null): string {
    const available = getAvailableMemory(hardwareInfo);
    if (available === 0) return "Unknown";

    const gb = available / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
}

import { FlmService } from './flm';
import { GithubService, ReleaseInfo } from './github';
import { ConfigService } from './config';

// Minimum FLM version required for the application to work
export const MINIMUM_FLM_VERSION = import.meta.env.VITE_MINIMUM_FLM_VERSION || '1.0.0';

const APP_REPO_NAME = import.meta.env.VITE_GIT_PROJECT_COMPANION || "julienM77/flm-companion";
const FLM_REPO_NAME = import.meta.env.VITE_GIT_PROJECT_FLM || "FastFlowLM/FastFlowLM";

export interface StartupCheckResult {
    flmInstalled: boolean;
    flmVersion: string;
    flmVersionValid: boolean;
    companionVersion: string;
    companionUpdateAvailable: boolean;
    companionLatestRelease: ReleaseInfo | null;
    flmUpdateAvailable: boolean;
    flmLatestRelease: ReleaseInfo | null;
}

export const StartupService = {
    /**
     * Vérifie si FLM est installé et récupère la version
     */
    async checkFlmInstallation(): Promise<{ installed: boolean; version: string; valid: boolean }> {
        try {
            const version = await FlmService.getVersion();

            const installed = version !== "Unknown";
            const valid = installed && this.isVersionValid(version, MINIMUM_FLM_VERSION);

            return {
                installed,
                version,
                valid
            };
        } catch (error) {
            console.error("Error checking FLM installation:", error);
            return {
                installed: false,
                version: "Unknown",
                valid: false
            };
        }
    },

    /**
     * Vérifie si une version est supérieure ou égale à la version minimale requise
     */
    isVersionValid(current: string, minimum: string): boolean {
        if (!current || current === "Not Found" || current === "Unknown") return false;

        const cleanCurrent = current.replace(/^v/, '');
        const cleanMinimum = minimum.replace(/^v/, '');

        const currentParts = cleanCurrent.split('.').map(Number);
        const minimumParts = cleanMinimum.split('.').map(Number);

        for (let i = 0; i < Math.max(currentParts.length, minimumParts.length); i++) {
            const c = currentParts[i] || 0;
            const m = minimumParts[i] || 0;

            if (c > m) return true;
            if (c < m) return false;
        }

        return true; // Equal versions
    },

    /**
     * Vérifie les mises à jour disponibles pour Companion
     */
    async checkCompanionUpdates(): Promise<{ updateAvailable: boolean; latestRelease: ReleaseInfo | null }> {
        try {
            // Debug mode: Use debug version if set
            let currentVersion: string;
            if (import.meta.env.VITE_DEBUG_COMPANION_VERSION) {
                currentVersion = import.meta.env.VITE_DEBUG_COMPANION_VERSION;
                console.warn(`[DEBUG] Using Companion version: ${currentVersion}`);
            } else {
                currentVersion = ConfigService.getAppVersion();
            }

            const latestRelease = await GithubService.getLatestRelease(APP_REPO_NAME);
            const updateAvailable = GithubService.isNewerVersion(currentVersion, latestRelease.tag_name);

            return {
                updateAvailable,
                latestRelease: updateAvailable ? latestRelease : null
            };
        } catch (error) {
            console.error("Error checking Companion updates:", error);
            return {
                updateAvailable: false,
                latestRelease: null
            };
        }
    },

    /**
     * Vérifie les mises à jour disponibles pour FLM
     * Note: currentVersion provient déjà de checkFlmInstallation qui gère le debug
     */
    async checkFlmUpdates(currentVersion: string): Promise<{ updateAvailable: boolean; latestRelease: ReleaseInfo | null }> {
        if (!currentVersion || currentVersion === "Not Found" || currentVersion === "Unknown") {
            return {
                updateAvailable: false,
                latestRelease: null
            };
        }

        try {
            console.log('[StartupService] Checking FLM updates...');
            const latestRelease = await GithubService.getLatestRelease(FLM_REPO_NAME);
            const updateAvailable = GithubService.isNewerVersion(currentVersion, latestRelease.tag_name);

            console.log(`[StartupService] FLM: current=${currentVersion}, latest=${latestRelease.tag_name}, updateAvailable=${updateAvailable}`);

            return {
                updateAvailable,
                latestRelease: updateAvailable ? latestRelease : null
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('403') || errorMessage.includes('rate limit')) {
                console.warn('[StartupService] GitHub API rate limit reached for FLM updates');
            } else {
                console.error('[StartupService] Error checking FLM updates:', error);
            }
            return {
                updateAvailable: false,
                latestRelease: null
            };
        }
    },

    /**
     * Effectue toutes les vérifications de démarrage
     */
    async performStartupChecks(): Promise<StartupCheckResult> {
        // Check FLM installation
        const flmCheck = await this.checkFlmInstallation();

        // Get current Companion version
        const companionVersion = ConfigService.getAppVersion();

        // If FLM is not installed, still fetch the latest release to allow installation
        if (!flmCheck.installed) {
            // Fetch latest FLM release for download button
            let flmLatestRelease: ReleaseInfo | null = null;
            try {
                console.log('[StartupService] FLM not installed, fetching latest release for installation...');
                flmLatestRelease = await GithubService.getLatestRelease(FLM_REPO_NAME);
                console.log('[StartupService] Latest FLM release for installation:', flmLatestRelease?.tag_name);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (errorMessage.includes('403') || errorMessage.includes('rate limit')) {
                    console.warn('[StartupService] GitHub API rate limit reached when fetching FLM release for installation');
                } else {
                    console.error('[StartupService] Error fetching latest FLM release:', error);
                }
            }

            return {
                flmInstalled: false,
                flmVersion: flmCheck.version,
                flmVersionValid: false,
                companionVersion,
                companionUpdateAvailable: false,
                companionLatestRelease: null,
                flmUpdateAvailable: false,
                flmLatestRelease: flmLatestRelease
            };
        }

        // Check updates in parallel
        const [companionUpdate, flmUpdate] = await Promise.all([
            this.checkCompanionUpdates(),
            this.checkFlmUpdates(flmCheck.version)
        ]);

        return {
            flmInstalled: flmCheck.installed,
            flmVersion: flmCheck.version,
            flmVersionValid: flmCheck.valid,
            companionVersion,
            companionUpdateAvailable: companionUpdate.updateAvailable,
            companionLatestRelease: companionUpdate.latestRelease,
            flmUpdateAvailable: flmUpdate.updateAvailable,
            flmLatestRelease: flmUpdate.latestRelease
        };
    }
};

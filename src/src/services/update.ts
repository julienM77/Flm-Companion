import { fetch } from '@tauri-apps/plugin-http';
import { writeFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { join, tempDir } from '@tauri-apps/api/path';
import { openPath } from '@tauri-apps/plugin-opener';
import { ReleaseInfo } from './github';
import { FlmService } from './flm';
import { type as osType } from '@tauri-apps/plugin-os';
import { invoke } from '@tauri-apps/api/core';

export interface UpdateCallbacks {
    onProgress?: (progress: number | null) => void;
    onInstalling?: () => void;
    onSuccess?: () => void;
    onError?: (error: string) => void;
}

export const UpdateService = {
    /**
     * Télécharge et installe une release (FLM ou Companion)
     * @param release La release à installer
     * @param exeName Nom du fichier exe à chercher dans les assets
     * @param callbacks Callbacks pour suivre la progression
     * @param monitorVersion Si true, surveille le changement de version FLM après installation
     */
    async downloadAndInstall(
        release: ReleaseInfo,
        exeName: string,
        callbacks: UpdateCallbacks = {},
        monitorVersion = false
    ): Promise<void> {
        const { onProgress, onInstalling, onSuccess, onError } = callbacks;

        try {
            // Find the installer asset
            // For Companion: looks for files starting with "Flm.Companion" or "Flm Companion" and ending with .exe
            // For FLM: looks for the exact exeName or any .exe file
            const platform = await osType();
            const isCompanion = exeName.toLowerCase().includes('flm-manager') || exeName.toLowerCase().includes('companion');
            const asset = release.assets.find(a => {
                if (a.name === exeName) return true; // Exact match
                if (platform === 'linux') {
                    if (isCompanion) return a.name.toLowerCase().endsWith('.appimage');
                    // The portable archive works on Fedora/Bazzite and does not
                    // require a distribution package manager or root access.
                    return a.name.toLowerCase().endsWith('_linux.tar.gz');
                }
                if (isCompanion) {
                    // Companion installer: flexible matching
                    return (a.name.startsWith('Flm.Companion') || a.name.startsWith('Flm Companion')) && a.name.endsWith('.exe');
                }
                // Fallback: any .exe file
                return a.name.endsWith('.exe');
            });
            if (!asset) {
                onError?.('Installer not found in release assets');
                return;
            }

            // Download with progress tracking
            onProgress?.(0);
            const response = await fetch(asset.browser_download_url);
            if (!response.ok) throw new Error('Download failed');
            if (!response.body) throw new Error('No response body');

            const contentLength = +response.headers.get('Content-Length')!;
            const reader = response.body.getReader();
            let receivedLength = 0;
            const chunks = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                chunks.push(value);
                receivedLength += value.length;
                if (contentLength) {
                    const progress = Math.round((receivedLength / contentLength) * 100);
                    onProgress?.(progress);
                }
            }

            // Combine chunks
            const allChunks = new Uint8Array(receivedLength);
            let position = 0;
            for (const chunk of chunks) {
                allChunks.set(chunk, position);
                position += chunk.length;
            }

            // Save to temp directory
            const filename = asset.name;
            await writeFile(filename, allChunks, { baseDir: BaseDirectory.Temp });

            // Launch the installer
            const tempDirPath = await tempDir();
            const absolutePath = await join(tempDirPath, filename);

            if (platform === 'linux' && !isCompanion) {
                onInstalling?.();
                await invoke('install_flm_linux', {
                    archivePath: absolutePath,
                    expectedVersion: release.tag_name
                });
                onProgress?.(null);
                onSuccess?.();
                return;
            }

            await openPath(absolutePath);

            // Reset progress
            onProgress?.(null);

            // Monitor installation if requested (for FLM)
            if (monitorVersion) {
                await this.monitorFlmInstallation(onInstalling, onSuccess, onError);
            } else {
                onSuccess?.();
            }

        } catch (error) {
            console.error('Error during download/install:', error);
            onError?.(error instanceof Error ? error.message : 'Download or installation failed');
        }
    },

    /**
     * Surveille l'installation de FLM en vérifiant le changement de version
     * @param onInstalling Appelé quand la surveillance commence
     * @param onSuccess Appelé quand l'installation est détectée comme terminée
     * @param onError Appelé en cas d'erreur
     */
    async monitorFlmInstallation(
        onInstalling?: () => void,
        onSuccess?: () => void,
        onError?: (error: string) => void
    ): Promise<void> {
        onInstalling?.();

        try {
            const startVersion = await FlmService.getVersion();
            console.log('[Update] Starting FLM installation monitoring. Current version:', startVersion);
            const maxAttempts = 90; // 3 minutes (more time for installation)
            let attempts = 0;
            let consecutiveChecks = 0;
            let consecutiveErrors = 0;

            return new Promise((resolve, reject) => {
                const interval = setInterval(async () => {
                    attempts++;
                    try {
                        const currentVer = await FlmService.getVersion();
                        console.log(`[Update] Check ${attempts}/${maxAttempts}: ${currentVer}`);
                        
                        // Reset error counter on successful check
                        consecutiveErrors = 0;
                        
                        // Check if version changed and is valid
                        if (currentVer !== startVersion && 
                            currentVer !== "Unknown" && 
                            currentVer !== "Loading..." &&
                            currentVer.match(/^\d+\.\d+/)) { // Verify it's a real version
                            consecutiveChecks++;
                            // Wait for 2 consecutive checks to confirm
                            if (consecutiveChecks >= 2) {
                                console.log('[Update] FLM installation completed. New version:', currentVer);
                                clearInterval(interval);
                                onSuccess?.();
                                resolve();
                            }
                        } else {
                            consecutiveChecks = 0; // Reset if version is not stable
                        }
                    } catch (e) {
                        console.error('Error checking version during monitoring:', e);
                        consecutiveChecks = 0;
                        consecutiveErrors++;
                        
                        // If too many consecutive errors, stop monitoring
                        if (consecutiveErrors >= 5) {
                            console.error('[Update] Too many consecutive errors, stopping monitoring');
                            clearInterval(interval);
                            const errorMsg = 'Failed to monitor installation progress';
                            onError?.(errorMsg);
                            reject(new Error(errorMsg));
                            return;
                        }
                    }

                    if (attempts >= maxAttempts) {
                        console.warn('[Update] Timeout reached, assuming installation completed');
                        clearInterval(interval);
                        // Timeout is not an error, installation might still be running
                        onSuccess?.();
                        resolve();
                    }
                }, 2000);
            });
        } catch (error) {
            console.error('[Update] Failed to start monitoring:', error);
            const errorMsg = 'Failed to start installation monitoring';
            onError?.(errorMsg);
            throw new Error(errorMsg);
        }
    }
};

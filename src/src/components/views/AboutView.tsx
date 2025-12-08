import { useState, useEffect } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { FlmService } from '../../services/flm';
import type { HardwareInfo } from '../../types';
import { GithubService, ReleaseInfo } from '../../services/github';
import { openUrl, openPath } from '@tauri-apps/plugin-opener';
import { fetch } from '@tauri-apps/plugin-http';
import { writeFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { tempDir } from '@tauri-apps/api/path';
import { exit } from '@tauri-apps/plugin-process';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from "../ui/scroll-area";
import { useTranslation } from "react-i18next";
import { ConfigService } from "../../services/config";
import { GithubIcon } from "../icons";

const APP_REPO_NAME = import.meta.env.VITE_GIT_PROJECT_COMPANION || "julienM77/flm-companion";
const FLM_REPO_NAME = import.meta.env.VITE_GIT_PROJECT_FLM || "FastFlowLM/FastFlowLM";
const APP_REPO_URL = `https://github.com/${APP_REPO_NAME}`;
const FLM_REPO_URL = `https://github.com/${FLM_REPO_NAME}`;
const AMD_URL = import.meta.env.VITE_AMD_URL ?? 'https://ryzenai.docs.amd.com/en/latest/inst.html#install-npu-drivers';

interface AboutViewProps {
    hardwareInfo: HardwareInfo | null;
    onRefreshHardware: () => Promise<void>;
}

export const AboutView = ({ hardwareInfo, onRefreshHardware }: AboutViewProps) => {
    // FLM State
    const [flmVersion, setFlmVersion] = useState<string>("Loading...");
    const [latestFlmRelease, setLatestFlmRelease] = useState<ReleaseInfo | null>(null);
    const [flmChangelog, setFlmChangelog] = useState<string | null>(null);
    const [loadingFlmUpdate, setLoadingFlmUpdate] = useState(false);
    const [flmUpdateError, setFlmUpdateError] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const [isRefreshingHardware, setIsRefreshingHardware] = useState(false);

    // Companion State
    const [companionVersion] = useState<string>(ConfigService.getAppVersion());
    const [latestCompanionRelease, setLatestCompanionRelease] = useState<ReleaseInfo | null>(null);
    const [companionChangelog, setCompanionChangelog] = useState<string | null>(null);
    const [loadingCompanionUpdate, setLoadingCompanionUpdate] = useState(false);
    const [companionUpdateError, setCompanionUpdateError] = useState<string | null>(null);
    const [isCompanionDownloading, setIsCompanionDownloading] = useState(false);
    const [companionDownloadProgress, setCompanionDownloadProgress] = useState<number | null>(null);

    const { t } = useTranslation();

    useEffect(() => {
        loadFlmVersion();
        // Load changelog for current companion version
        fetchCompanionChangelog(companionVersion);
    }, []);

    useEffect(() => {
        if (flmVersion && flmVersion !== "Loading..." && flmVersion !== "Unknown") {
            fetchFlmChangelog(flmVersion);
        }
    }, [flmVersion]);

    const loadFlmVersion = async () => {
        try {
            const ver = await FlmService.getVersion();
            setFlmVersion(ver);
        } catch {
            setFlmVersion("Unknown");
        }
    };

    // --- Companion Logic ---

    const checkCompanionUpdates = async () => {
        setLoadingCompanionUpdate(true);
        setCompanionUpdateError(null);
        try {
            const release = await GithubService.getLatestRelease(APP_REPO_NAME);
            setLatestCompanionRelease(release);
        } catch (e) {
            setCompanionUpdateError(t('about.error_check_updates'));
            console.error(e);
        } finally {
            setLoadingCompanionUpdate(false);
        }
    };

    const fetchCompanionChangelog = async (version: string) => {
        try {
            const release = await GithubService.getReleaseByTag(APP_REPO_NAME, version);
            setCompanionChangelog(release.body);
        } catch {
            console.log("Companion release note not found for this version");
        }
    };

    const handleCompanionUpdate = async () => {
        if (!latestCompanionRelease) return;

        // Find asset starting with "Flm Companion" or "Flm Manager" and ending with ".exe"
        // This handles version numbers in the filename automatically
        const asset = latestCompanionRelease.assets.find(a =>
            a.name.startsWith("Flm Companion") &&
            a.name.endsWith(".exe")
        );
        if (!asset) {
            setCompanionUpdateError(t('about.error_installer_not_found'));
            return;
        }

        setIsCompanionDownloading(true);
        setCompanionDownloadProgress(0);
        setCompanionUpdateError(null);

        try {
            const response = await fetch(asset.browser_download_url);
            if (!response.ok) throw new Error("Download failed");
            if (!response.body) throw new Error("No response body");

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
                    setCompanionDownloadProgress(Math.round((receivedLength / contentLength) * 100));
                }
            }

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
            const absolutePath = `${tempDirPath}${filename}`;
            await openPath(absolutePath);

            // Close the application to allow update
            await exit(0);

        } catch (e) {
            console.error(e);
            setCompanionUpdateError(t('about.error_download_install'));
        } finally {
            setIsCompanionDownloading(false);
            setCompanionDownloadProgress(null);
        }
    };

    // --- FLM Logic ---

    const checkFlmUpdates = async () => {
        setLoadingFlmUpdate(true);
        setFlmUpdateError(null);
        try {
            const release = await GithubService.getLatestRelease(FLM_REPO_NAME);
            setLatestFlmRelease(release);
        } catch (e) {
            setFlmUpdateError(t('about.error_check_updates'));
            console.error(e);
        } finally {
            setLoadingFlmUpdate(false);
        }
    };

    const fetchFlmChangelog = async (version: string) => {
        try {
            const release = await GithubService.getReleaseByTag(FLM_REPO_NAME, version);
            setFlmChangelog(release.body);
        } catch {
            console.log("FLM release note not found for this version");
        }
    };

    const handleFlmUpdate = async () => {
        if (!latestFlmRelease) return;

        const asset = latestFlmRelease.assets.find(a => a.name === "flm-setup.exe" || a.name.endsWith(".exe"));
        if (!asset) {
            setFlmUpdateError(t('about.error_installer_not_found'));
            return;
        }

        setIsDownloading(true);
        setDownloadProgress(0);
        setFlmUpdateError(null);

        try {
            const response = await fetch(asset.browser_download_url);
            if (!response.ok) throw new Error("Download failed");
            if (!response.body) throw new Error("No response body");

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
                    setDownloadProgress(Math.round((receivedLength / contentLength) * 100));
                }
            }

            const allChunks = new Uint8Array(receivedLength);
            let position = 0;
            for (const chunk of chunks) {
                allChunks.set(chunk, position);
                position += chunk.length;
            }

            // Save to temp directory
            const filename = asset.name;

            await writeFile(filename, allChunks, { baseDir: BaseDirectory.Temp });

            // Now launch it
            const tempDirPath = await tempDir();
            const absolutePath = `${tempDirPath}${filename}`;

            await openPath(absolutePath);

            // Start monitoring installation
            setIsInstalling(true);
            setFlmUpdateError(t('about.status_installing_full'));

            const startVersion = flmVersion;
            const maxAttempts = 60; // 2 minutes
            let attempts = 0;

            const interval = setInterval(async () => {
                attempts++;
                try {
                    const currentVer = await FlmService.getVersion();
                    // Check if version changed and is valid
                    if (currentVer !== startVersion && currentVer !== "Unknown" && currentVer !== "Loading...") {
                        setFlmVersion(currentVer);
                        setIsInstalling(false);
                        setFlmUpdateError(null);
                        clearInterval(interval);
                        // Refresh update status
                        checkFlmUpdates();
                    }
                } catch (e) { console.error(e); }

                if (attempts >= maxAttempts) {
                    setIsInstalling(false);
                    setFlmUpdateError(null);
                    clearInterval(interval);
                }
            }, 2000);

        } catch (e) {
            console.error(e);
            setFlmUpdateError(t('about.error_download_install'));
            setIsInstalling(false);
        } finally {
            setIsDownloading(false);
            setDownloadProgress(null);
        }
    };

    const handleRefreshHardware = async () => {
        setIsRefreshingHardware(true);
        try {
            await onRefreshHardware();
        } finally {
            setIsRefreshingHardware(false);
        }
    };

    const isFlmUpdateAvailable = latestFlmRelease && GithubService.isNewerVersion(flmVersion, latestFlmRelease.tag_name);
    const isCompanionUpdateAvailable = latestCompanionRelease && GithubService.isNewerVersion(companionVersion, latestCompanionRelease.tag_name);

    return (
        <ScrollArea className="h-full pr-4">
            <div className="space-y-8">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">{t('about.companion_app')}</h2>

                <div className="bg-card rounded-xl border shadow-sm overflow-hidden mb-8">
                    {/* App Version Row */}
                    <div className="flex items-center justify-between p-4 border-b last:border-0">
                        <span className="text-sm font-medium text-foreground">{t('about.version')}</span>
                        <div className="font-mono text-sm text-muted-foreground">v{companionVersion}</div>
                    </div>

                    {/* Source Code Row */}
                    <div className="flex items-center justify-between p-4 border-b last:border-0">
                        <span className="text-sm font-medium text-foreground">{t('about.source_code')}</span>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openUrl(APP_REPO_URL)}
                        >
                            <GithubIcon className="w-4 h-4 mr-2" />
                            {t('about.view_on_github')}
                        </Button>
                    </div>

                    {/* Companion Update Check Row */}
                    <div className="flex items-center justify-between p-4 border-b last:border-0">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{t('about.updates')}</span>
                            {latestCompanionRelease && (
                                <span className={`text-xs ${isCompanionUpdateAvailable ? 'text-yellow-500' : 'text-green-500'}`}>
                                    {isCompanionUpdateAvailable ? `${t('about.new_version')}${latestCompanionRelease.tag_name}` : t('about.up_to_date')}
                                </span>
                            )}
                            {companionUpdateError && <span className="text-xs text-destructive">{companionUpdateError}</span>}
                        </div>

                        <div className="flex gap-2">
                            {isCompanionUpdateAvailable && (
                                <Button
                                    size="sm"
                                    onClick={handleCompanionUpdate}
                                    disabled={isCompanionDownloading}
                                >
                                    {isCompanionDownloading ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                                            {companionDownloadProgress !== null ? `${companionDownloadProgress}%` : t('about.downloading')}
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-4 h-4 mr-2" />
                                            {t('about.update')}
                                        </>
                                    )}
                                </Button>
                            )}
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={checkCompanionUpdates}
                                disabled={loadingCompanionUpdate || isCompanionDownloading}
                            >
                                {loadingCompanionUpdate ? <RefreshCw className="w-4 h-4 animate-spin" /> : t('about.check')}
                            </Button>
                        </div>
                    </div>

                    {/* Companion Changelog Row */}
                    {companionChangelog && (
                        <div >
                            <Accordion type="single" collapsible>
                                <AccordionItem value="changelog" className="border-b-0">
                                    <AccordionTrigger className="px-4 py-4 hover:no-underline">
                                        <span className="text-sm font-medium text-foreground">{t('about.release_notes')} <span className="text-muted-foreground font-normal ml-2">(v{companionVersion})</span></span>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="px-4 pb-4 text-sm bg-muted/30 pt-2 prose prose-sm dark:prose-invert max-w-none max-h-[400px] overflow-y-auto prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-code:text-foreground">
                                            <ReactMarkdown>{companionChangelog}</ReactMarkdown>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{t('about.hardware')}</h2>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleRefreshHardware} disabled={isRefreshingHardware}>
                        <RefreshCw className={`h-3 w-3 ${isRefreshingHardware ? "animate-spin" : ""}`} />
                    </Button>
                </div>
                <div className="bg-card rounded-xl border shadow-sm overflow-hidden mb-8">
                    <div className="flex items-center justify-between p-4 border-b last:border-0">
                        <span className="text-sm font-medium text-foreground">{t('about.cpu')}</span>
                        <div className="font-mono text-sm text-muted-foreground">{hardwareInfo?.cpu || "..."}</div>
                    </div>
                    <div className="flex items-center justify-between p-4 border-b last:border-0">
                        <span className="text-sm font-medium text-foreground">{t('about.ram')}</span>
                        <div className="font-mono text-sm text-muted-foreground">{hardwareInfo?.ram || "..."}</div>
                    </div>
                    <div className="flex items-center justify-between p-4 border-b last:border-0">
                        <span className="text-sm font-medium text-foreground">{t('about.npu_shared')}</span>
                        <div className="font-mono text-sm text-muted-foreground">{hardwareInfo?.sharedMemory || "..."}</div>
                    </div>
                    <div className="flex items-center justify-between p-4 border-b last:border-0">
                        <span className="text-sm font-medium text-foreground">{t('about.npu')}</span>
                        <div className="flex flex-col items-end">
                            <div className="font-mono text-sm text-muted-foreground">{hardwareInfo?.npuName || t('about.not_detected')}</div>
                            {hardwareInfo?.npuDriver && (
                                <div className="text-xs text-muted-foreground">{t('about.driver')}{hardwareInfo.npuDriver}</div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-4 border-b last:border-0">
                        <span className="text-sm font-medium text-foreground">{t('about.amd_drivers')}</span>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openUrl(AMD_URL)}
                        >
                            {t('about.amd_site')}
                        </Button>
                    </div>
                </div>

                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">{t('about.fastflowlm')}</h2>
                <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
                    {/* FLM Version Row */}
                    <div className="flex items-center justify-between p-4 border-b last:border-0">
                        <span className="text-sm font-medium text-foreground">{t('about.installed_version')}</span>
                        <div className="font-mono text-sm text-muted-foreground">{flmVersion}</div>
                    </div>

                    {/* FLM GitHub Row */}
                    <div className="flex items-center justify-between p-4 border-b last:border-0">
                        <span className="text-sm font-medium text-foreground">{t('about.source_code')}</span>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openUrl(FLM_REPO_URL)}
                        >
                            <GithubIcon className="w-4 h-4 mr-2" />
                            {t('about.view_on_github')}
                        </Button>
                    </div>

                    {/* FLM Update Check Row */}
                    <div className="flex items-center justify-between p-4 border-b last:border-0">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{t('about.updates')}</span>
                            {latestFlmRelease && (
                                <span className={`text-xs ${isFlmUpdateAvailable ? 'text-yellow-500' : 'text-green-500'}`}>
                                    {isFlmUpdateAvailable ? `${t('about.new_version')}${latestFlmRelease.tag_name}` : t('about.up_to_date')}
                                </span>
                            )}
                            {flmUpdateError && <span className="text-xs text-destructive">{flmUpdateError}</span>}
                            {isDownloading && (
                                <div className="w-full bg-secondary h-1.5 mt-2 rounded-full overflow-hidden">
                                    <div
                                        className="bg-primary h-full transition-all duration-300"
                                        style={{ width: `${downloadProgress}%` }}
                                    />
                                </div>
                            )}
                        </div>

                        {isFlmUpdateAvailable ? (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleFlmUpdate}
                                disabled={isDownloading || isInstalling}
                            >
                                {isDownloading ? (
                                    <>
                                        <Download className="w-4 h-4 mr-2 animate-bounce" />
                                        {downloadProgress}%
                                    </>
                                ) : isInstalling ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                        {t('about.installing')}
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-4 h-4 mr-2" />
                                        {t('about.update')}
                                    </>
                                )}
                            </Button>
                        ) : (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={checkFlmUpdates}
                                disabled={loadingFlmUpdate}
                            >
                                {loadingFlmUpdate ? <RefreshCw className="w-4 h-4 animate-spin" /> : t('about.check')}
                            </Button>
                        )}
                    </div>

                    {/* FLM Changelog Row */}
                    {flmChangelog && (
                        <div >
                            <Accordion type="single" collapsible>
                                <AccordionItem value="changelog" className="border-b-0">
                                    <AccordionTrigger className="px-4 py-4 hover:no-underline">
                                        <span className="text-sm font-medium text-foreground">{t('about.release_notes')} <span className="text-muted-foreground font-normal ml-2">({flmVersion})</span></span>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="px-4 pb-4 text-sm bg-muted/30 pt-2 prose prose-sm dark:prose-invert max-w-none max-h-[400px] overflow-y-auto prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-code:text-foreground">
                                            <ReactMarkdown>{flmChangelog}</ReactMarkdown>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    )}
                </div>
            </div>
        </ScrollArea>
    );
};
import { useState, useEffect } from 'react';
import { RefreshCw, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import type { HardwareInfo } from '../../types';
import { GithubService, ReleaseInfo } from '../../services/github';
import { openUrl } from '@tauri-apps/plugin-opener';
import { exit } from '@tauri-apps/plugin-process';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from "../ui/scroll-area";
import { useTranslation } from "react-i18next";
import { ConfigService } from "../../services/config";
import { GithubIcon } from "../icons";
import { useAppContext } from "../../contexts/AppContext";
import { UpdateService } from "../../services/update";

const APP_REPO_NAME = import.meta.env.VITE_GIT_PROJECT_COMPANION || "julienM77/flm-companion";
const FLM_REPO_NAME = import.meta.env.VITE_GIT_PROJECT_FLM || "FastFlowLM/FastFlowLM";
const APP_REPO_URL = `https://github.com/${APP_REPO_NAME}`;
const FLM_REPO_URL = `https://github.com/${FLM_REPO_NAME}`;
const AMD_URL = import.meta.env.VITE_AMD_URL ?? 'https://ryzenai.docs.amd.com/en/latest/inst.html#install-npu-drivers';
const COMPANION_EXE_NAME = import.meta.env.VITE_COMPANION_EXE || "flm-manager.exe";
const FLM_EXE_NAME = import.meta.env.VITE_FLM_EXE || "flm-setup.exe";

interface AboutViewProps {
    hardwareInfo: HardwareInfo | null;
    onRefreshHardware: () => Promise<void>;
}

export const AboutView = ({ hardwareInfo, onRefreshHardware }: AboutViewProps) => {
    const { flmVersion, loadFlmVersion } = useAppContext();

    // FLM State
    const [latestFlmRelease, setLatestFlmRelease] = useState<ReleaseInfo | null>(null);
    const [flmChangelog, setFlmChangelog] = useState<string | null>(null);
    const [loadingFlmUpdate, setLoadingFlmUpdate] = useState(false);
    const [flmUpdateError, setFlmUpdateError] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const [isRefreshingHardware, setIsRefreshingHardware] = useState(false);

    // Companion State
    const companionVersion = import.meta.env.VITE_DEBUG_COMPANION_VERSION || ConfigService.getAppVersion();
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (flmVersion &&
            flmVersion !== "Loading..." &&
            flmVersion !== "Unknown" &&
            flmVersion !== "Not Found" &&
            flmVersion.match(/^\d+\.\d+/)) { // Ensure it's a valid version format
            fetchFlmChangelog(flmVersion);
        }
    }, [flmVersion]);

    // --- Companion Logic ---

    const checkCompanionUpdates = async () => {
        setLoadingCompanionUpdate(true);
        setCompanionUpdateError(null);
        try {
            console.log('[AboutView] Checking Companion updates...');
            const release = await GithubService.getLatestRelease(APP_REPO_NAME);
            console.log('[AboutView] Latest Companion release:', release.tag_name);
            setLatestCompanionRelease(release);
        } catch (e) {
            console.error('[AboutView] Error checking Companion updates:', e);
            const errorMessage = e instanceof Error ? e.message : String(e);
            // Check if it's a rate limit error
            if (errorMessage.includes('403') || errorMessage.includes('rate limit')) {
                setCompanionUpdateError(t('about.error_rate_limit'));
            } else {
                setCompanionUpdateError(t('about.error_check_updates'));
            }
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

        setIsCompanionDownloading(true);
        setCompanionDownloadProgress(0);
        setCompanionUpdateError(null);

        await UpdateService.downloadAndInstall(
            latestCompanionRelease,
            COMPANION_EXE_NAME,
            {
                onProgress: (progress) => setCompanionDownloadProgress(progress),
                onSuccess: async () => {
                    // Close the application to allow update
                    await exit(0);
                },
                onError: (error) => {
                    setIsCompanionDownloading(false);
                    setCompanionDownloadProgress(null);
                    setCompanionUpdateError(error === 'Installer not found in release assets'
                        ? t('about.error_installer_not_found')
                        : t('about.error_download_install')
                    );
                }
            },
            false // No monitoring for Companion (app will exit)
        );
    };

    // --- FLM Logic ---

    const checkFlmUpdates = async () => {
        setLoadingFlmUpdate(true);
        setFlmUpdateError(null);
        try {
            console.log('[AboutView] Checking FLM updates...');
            const release = await GithubService.getLatestRelease(FLM_REPO_NAME);
            console.log('[AboutView] Latest FLM release:', release.tag_name);
            setLatestFlmRelease(release);
        } catch (e) {
            console.error('[AboutView] Error checking FLM updates:', e);
            const errorMessage = e instanceof Error ? e.message : String(e);
            // Check if it's a rate limit error
            if (errorMessage.includes('403') || errorMessage.includes('rate limit')) {
                setFlmUpdateError(t('about.error_rate_limit'));
            } else {
                setFlmUpdateError(t('about.error_check_updates'));
            }
        } finally {
            setLoadingFlmUpdate(false);
        }
    };

    const fetchFlmChangelog = async (version: string) => {
        try {
            console.log('[AboutView] Fetching FLM changelog for version:', version);
            const release = await GithubService.getReleaseByTag(FLM_REPO_NAME, version);
            if (release && release.body) {
                console.log('[AboutView] FLM changelog loaded successfully');
                setFlmChangelog(release.body);
            } else {
                console.warn('[AboutView] FLM release found but no body content');
                setFlmChangelog(null);
            }
        } catch (error) {
            console.error('[AboutView] FLM release note not found for version:', version, error);
            setFlmChangelog(null);
        }
    };

    const handleFlmUpdate = async () => {
        if (!latestFlmRelease) return;

        setIsDownloading(true);
        setDownloadProgress(0);
        setFlmUpdateError(null);

        await UpdateService.downloadAndInstall(
            latestFlmRelease,
            FLM_EXE_NAME,
            {
                onProgress: (progress) => setDownloadProgress(progress),
                onInstalling: () => {
                    setIsDownloading(false);
                    setIsInstalling(true);
                    setFlmUpdateError(t('about.status_installing_full'));
                },
                onSuccess: async () => {
                    setIsInstalling(false);
                    setDownloadProgress(null);
                    setFlmUpdateError(null);
                    await loadFlmVersion(true);
                    // Refresh update status
                    checkFlmUpdates();
                },
                onError: (error) => {
                    setIsDownloading(false);
                    setIsInstalling(false);
                    setDownloadProgress(null);
                    setFlmUpdateError(error === 'Installer not found in release assets'
                        ? t('about.error_installer_not_found')
                        : t('about.error_download_install')
                    );
                }
            },
            true // Monitor FLM version change
        );
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
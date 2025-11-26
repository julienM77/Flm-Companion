import { useState, useEffect } from 'react';
import { Github, RefreshCw, Download } from 'lucide-react';
import { Button } from './ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { FlmService, HardwareInfo } from '../services/flm';
import { openUrl, openPath } from '@tauri-apps/plugin-opener';
import { fetch } from '@tauri-apps/plugin-http';
import { writeFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { tempDir } from '@tauri-apps/api/path';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from "./ui/scroll-area";
import { useTranslation } from "react-i18next";

const APP_VERSION = "0.1.0";
const APP_REPO_URL = "https://github.com/julienM77/flm-companion";

const FLM_REPO_URL = "https://github.com/FastFlowLM/FastFlowLM";

interface Asset {
    name: string;
    browser_download_url: string;
    size: number;
}

interface ReleaseInfo {
    tag_name: string;
    body: string;
    html_url: string;
    assets: Asset[];
}

export const AboutView = () => {
    const [flmVersion, setFlmVersion] = useState<string>("Loading...");
    const [latestFlmVersion, setLatestFlmVersion] = useState<string | null>(null);
    const [latestRelease, setLatestRelease] = useState<ReleaseInfo | null>(null);
    const [changelog, setChangelog] = useState<string | null>(null);
    const [loadingUpdate, setLoadingUpdate] = useState(false);
    const [updateError, setUpdateError] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);
    const { t } = useTranslation();

    useEffect(() => {
        loadFlmVersion();
        loadHardwareInfo();
    }, []);

    useEffect(() => {
        if (flmVersion && flmVersion !== "Loading..." && flmVersion !== "Unknown") {
            fetchChangelog(flmVersion);
        }
    }, [flmVersion]);

    const loadFlmVersion = async () => {
        try {
            const ver = await FlmService.getVersion();
            setFlmVersion(ver);
        } catch (e) {
            setFlmVersion("Unknown");
        }
    };

    const loadHardwareInfo = async () => {
        const info = await FlmService.getHardwareInfo();
        setHardwareInfo(info);
    };

    const checkForUpdates = async () => {
        setLoadingUpdate(true);
        setUpdateError(null);
        try {
            const response = await fetch("https://api.github.com/repos/FastFlowLM/FastFlowLM/releases/latest");
            if (!response.ok) throw new Error("Failed to fetch latest release");
            const data: ReleaseInfo = await response.json();
            setLatestRelease(data);
            setLatestFlmVersion(data.tag_name);
        } catch (e) {
            setUpdateError("Impossible de vérifier les mises à jour");
            console.error(e);
        } finally {
            setLoadingUpdate(false);
        }
    };

    const handleUpdate = async () => {
        if (!latestRelease) return;

        const asset = latestRelease.assets.find(a => a.name === "flm-setup.exe" || a.name.endsWith(".exe"));
        if (!asset) {
            setUpdateError("Installeur non trouvé dans la release");
            return;
        }

        setIsDownloading(true);
        setDownloadProgress(0);
        setUpdateError(null);

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
            setUpdateError("Installation en cours...");

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
                        setUpdateError(null);
                        clearInterval(interval);
                        // Refresh update status
                        checkForUpdates();
                    }
                } catch (e) { console.error(e); }

                if (attempts >= maxAttempts) {
                    setIsInstalling(false);
                    setUpdateError(null);
                    clearInterval(interval);
                }
            }, 2000);

        } catch (e) {
            console.error(e);
            setUpdateError("Erreur lors du téléchargement ou de l'installation");
            setIsInstalling(false);
        } finally {
            setIsDownloading(false);
            setDownloadProgress(null);
        }
    };

    const fetchChangelog = async (version: string) => {
        try {
            // Handle version format (e.g. 0.9.20 vs v0.9.20)
            const tag = version.startsWith('v') ? version : `v${version}`;
            const response = await fetch(`https://api.github.com/repos/FastFlowLM/FastFlowLM/releases/tags/${tag}`);
            if (response.ok) {
                const data: ReleaseInfo = await response.json();
                setChangelog(data.body);
            } else {
                // Fallback or just ignore if tag not found
                console.log("Release note not found for this version");
            }
        } catch (e) {
            console.error("Failed to fetch changelog", e);
        }
    };

    const isUpdateAvailable = latestFlmVersion && flmVersion && latestFlmVersion !== flmVersion && latestFlmVersion !== `v${flmVersion}`;

    return (
        <ScrollArea className="h-full pr-4">
            <div className="space-y-8">
                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">{t('about.companion_app')}</h2>

                <div className="bg-card rounded-xl border shadow-sm overflow-hidden mb-8">
                    {/* App Version Row */}
                    <div className="flex items-center justify-between p-4 border-b last:border-0">
                        <span className="text-sm font-medium text-foreground">{t('about.version')}</span>
                        <div className="font-mono text-sm text-muted-foreground">{APP_VERSION}</div>
                    </div>

                    {/* Source Code Row */}
                    <div className="flex items-center justify-between p-4 border-b last:border-0">
                        <span className="text-sm font-medium text-foreground">{t('about.source_code')}</span>
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openUrl(APP_REPO_URL)}
                        >
                            <Github className="w-4 h-4 mr-2" />
                            {t('about.view_on_github')}
                        </Button>
                    </div>
                </div>

                <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">{t('about.hardware')}</h2>
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
                            onClick={() => openUrl("https://ryzenai.docs.amd.com/en/latest/inst.html#install-npu-drivers")}
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
                            <Github className="w-4 h-4 mr-2" />
                            {t('about.view_on_github')}
                        </Button>
                    </div>

                    {/* Update Check Row */}
                    <div className="flex items-center justify-between p-4 border-b last:border-0">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-foreground">{t('about.updates')}</span>
                            {latestFlmVersion && (
                                <span className={`text-xs ${isUpdateAvailable ? 'text-yellow-500' : 'text-green-500'}`}>
                                    {isUpdateAvailable ? `${t('about.new_version')}${latestFlmVersion}` : t('about.up_to_date')}
                                </span>
                            )}
                            {updateError && <span className="text-xs text-destructive">{updateError}</span>}
                            {isDownloading && (
                                <div className="w-full bg-secondary h-1.5 mt-2 rounded-full overflow-hidden">
                                    <div
                                        className="bg-primary h-full transition-all duration-300"
                                        style={{ width: `${downloadProgress}%` }}
                                    />
                                </div>
                            )}
                        </div>

                        {isUpdateAvailable ? (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleUpdate}
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
                                onClick={checkForUpdates}
                                disabled={loadingUpdate}
                            >
                                {loadingUpdate ? <RefreshCw className="w-4 h-4 animate-spin" /> : t('about.check')}
                            </Button>
                        )}
                    </div>

                    {/* Changelog Row */}
                    {changelog && (
                        <div >
                            <Accordion type="single" collapsible>
                                <AccordionItem value="changelog" className="border-b-0">
                                    <AccordionTrigger className="px-4 py-4 hover:no-underline">
                                        <span className="text-sm font-medium text-foreground">{t('about.release_notes')} <span className="text-muted-foreground font-normal ml-2">({flmVersion})</span></span>
                                    </AccordionTrigger>
                                    <AccordionContent>
                                        <div className="px-4 pb-4 text-sm bg-muted/30 pt-2 prose prose-sm dark:prose-invert max-w-none max-h-[400px] overflow-y-auto prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-code:text-foreground">
                                            <ReactMarkdown>{changelog}</ReactMarkdown>
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
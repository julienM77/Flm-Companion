import { useState } from 'react';
import { Download, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { useTranslation } from 'react-i18next';
import { ReleaseInfo } from '../../services/github';
import { openUrl } from '@tauri-apps/plugin-opener';
import { exit } from '@tauri-apps/plugin-process';
import ReactMarkdown from 'react-markdown';
import { ScrollArea } from "../ui/scroll-area";
import { UpdateService } from '../../services/update';

const APP_REPO_NAME = import.meta.env.VITE_GIT_PROJECT_COMPANION || "julienM77/flm-companion";
const APP_REPO_URL = `https://github.com/${APP_REPO_NAME}`;
const FLM_REPO_NAME = import.meta.env.VITE_GIT_PROJECT_FLM || "FastFlowLM/FastFlowLM";
const FLM_REPO_URL = `https://github.com/${FLM_REPO_NAME}`;
const COMPANION_EXE_NAME = import.meta.env.VITE_COMPANION_EXE || "flm-manager.exe";
const FLM_EXE_NAME = import.meta.env.VITE_FLM_EXE || "flm-setup.exe";

interface UpdateAvailableDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInstallComplete?: () => Promise<void>;  // Callback after successful installation
    companionUpdate: {
        available: boolean;
        release: ReleaseInfo | null;
        currentVersion: string;
    } | null;
    flmUpdate: {
        available: boolean;
        release: ReleaseInfo | null;
        currentVersion: string;
    } | null;
}

export const UpdateAvailableDialog = ({ open, onOpenChange, onInstallComplete, companionUpdate, flmUpdate }: UpdateAvailableDialogProps) => {
    const { t } = useTranslation();

    // Companion update states
    const [isCompanionDownloading, setIsCompanionDownloading] = useState(false);
    const [companionDownloadProgress, setCompanionDownloadProgress] = useState<number | null>(null);
    const [companionDownloadError, setCompanionDownloadError] = useState<string | null>(null);

    // FLM update states
    const [isFlmDownloading, setIsFlmDownloading] = useState(false);
    const [flmDownloadProgress, setFlmDownloadProgress] = useState<number | null>(null);
    const [flmDownloadError, setFlmDownloadError] = useState<string | null>(null);

    const handleCompanionUpdate = async () => {
        if (!companionUpdate?.release) return;

        setIsCompanionDownloading(true);
        setCompanionDownloadProgress(0);
        setCompanionDownloadError(null);

        await UpdateService.downloadAndInstall(
            companionUpdate.release,
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
                    setCompanionDownloadError(error === 'Installer not found in release assets'
                        ? t('startup.error_installer_not_found')
                        : t('startup.error_download_install')
                    );
                }
            },
            false // No monitoring for Companion (app will exit)
        );
    };

    const handleFlmUpdate = async () => {
        if (!flmUpdate?.release) return;

        setIsFlmDownloading(true);
        setFlmDownloadProgress(0);
        setFlmDownloadError(null);

        await UpdateService.downloadAndInstall(
            flmUpdate.release,
            FLM_EXE_NAME,
            {
                onProgress: (progress) => setFlmDownloadProgress(progress),
                onInstalling: () => {
                    setIsFlmDownloading(false);
                },
                onSuccess: async () => {
                    setFlmDownloadProgress(null);
                    setFlmDownloadError(null);
                    // Reload version info before closing
                    if (onInstallComplete) {
                        await onInstallComplete();
                    }
                    // Close dialog after successful installation
                    onOpenChange(false);
                },
                onError: (error) => {
                    setIsFlmDownloading(false);
                    setFlmDownloadProgress(null);
                    setFlmDownloadError(error === 'Installer not found in release assets'
                        ? t('startup.error_installer_not_found')
                        : t('startup.error_download_install')
                    );
                }
            },
            true // Monitor FLM version change
        );
    };

    const hasUpdates = (companionUpdate?.available || flmUpdate?.available);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[80vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <RefreshCw className="h-5 w-5" />
                        {t('startup.updates_available')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('startup.updates_available_desc')}
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="max-h-[50vh] pr-4">
                    <div className="space-y-4">
                        {/* Companion Update */}
                        {companionUpdate?.available && companionUpdate.release && (
                            <div className="border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h3 className="font-semibold">{t('startup.companion_update')}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {t('startup.current_version')}: {companionUpdate.currentVersion} → {companionUpdate.release.tag_name}
                                        </p>
                                    </div>
                                </div>

                                {companionUpdate.release.body && (
                                    <Accordion type="single" collapsible className="mb-3">
                                        <AccordionItem value="changelog" className="border-0">
                                            <AccordionTrigger className="py-2 hover:no-underline">
                                                <span className="text-sm font-medium">{t('about.release_notes')}</span>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="p-3 bg-muted/30 rounded text-xs prose prose-sm dark:prose-invert max-w-none max-h-[200px] overflow-y-auto prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-code:text-foreground">
                                                    <ReactMarkdown>{companionUpdate.release.body}</ReactMarkdown>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                )}

                                {companionDownloadProgress !== null && (
                                    <div className="mt-3">
                                        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                            <div
                                                className="bg-primary h-full transition-all duration-300"
                                                style={{ width: `${companionDownloadProgress}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-center text-muted-foreground mt-1">
                                            {companionDownloadProgress}%
                                        </p>
                                    </div>
                                )}

                                {companionDownloadError && (
                                    <div className="mt-2 bg-destructive/10 border border-destructive/20 rounded p-2">
                                        <p className="text-xs text-destructive">{companionDownloadError}</p>
                                    </div>
                                )}

                                <div className="flex gap-2 mt-3">
                                    <Button
                                        onClick={handleCompanionUpdate}
                                        disabled={isCompanionDownloading}
                                        className="flex-1"
                                        size="sm"
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        {isCompanionDownloading ? t('startup.downloading') : t('startup.update_companion')}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => openUrl(APP_REPO_URL)}
                                        size="sm"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )}

                        {/* FLM Update */}
                        {flmUpdate?.available && flmUpdate.release && (
                            <div className="border rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <div>
                                        <h3 className="font-semibold">{t('startup.flm_update')}</h3>
                                        <p className="text-sm text-muted-foreground">
                                            {t('startup.current_version')}: {flmUpdate.currentVersion} → {flmUpdate.release.tag_name}
                                        </p>
                                    </div>
                                </div>

                                {flmUpdate.release.body && (
                                    <Accordion type="single" collapsible className="mb-3">
                                        <AccordionItem value="changelog" className="border-0">
                                            <AccordionTrigger className="py-2 hover:no-underline">
                                                <span className="text-sm font-medium">{t('about.release_notes')}</span>
                                            </AccordionTrigger>
                                            <AccordionContent>
                                                <div className="p-3 bg-muted/30 rounded text-xs prose prose-sm dark:prose-invert max-w-none max-h-[200px] overflow-y-auto prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-code:text-foreground">
                                                    <ReactMarkdown>{flmUpdate.release.body}</ReactMarkdown>
                                                </div>
                                            </AccordionContent>
                                        </AccordionItem>
                                    </Accordion>
                                )}

                                {flmDownloadProgress !== null && (
                                    <div className="mt-3">
                                        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                                            <div
                                                className="bg-primary h-full transition-all duration-300"
                                                style={{ width: `${flmDownloadProgress}%` }}
                                            />
                                        </div>
                                        <p className="text-xs text-center text-muted-foreground mt-1">
                                            {flmDownloadProgress}%
                                        </p>
                                    </div>
                                )}

                                {flmDownloadError && (
                                    <div className="mt-2 bg-destructive/10 border border-destructive/20 rounded p-2">
                                        <p className="text-xs text-destructive">{flmDownloadError}</p>
                                    </div>
                                )}

                                <div className="flex gap-2 mt-3">
                                    <Button
                                        onClick={handleFlmUpdate}
                                        disabled={isFlmDownloading}
                                        className="flex-1"
                                        size="sm"
                                    >
                                        <Download className="w-4 h-4 mr-2" />
                                        {isFlmDownloading ? t('startup.downloading') : t('startup.update_flm')}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => openUrl(FLM_REPO_URL)}
                                        size="sm"
                                    >
                                        <ExternalLink className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        {t('startup.remind_later')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

import { useState } from 'react';
import { Download, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { useTranslation } from 'react-i18next';
import { openUrl } from '@tauri-apps/plugin-opener';
import { ReleaseInfo } from '../../services/github';
import { MINIMUM_FLM_VERSION } from '../../services/startup';
import { UpdateService } from '../../services/update';

const FLM_REPO_NAME = import.meta.env.VITE_GIT_PROJECT_FLM || "FastFlowLM/FastFlowLM";
const FLM_REPO_URL = `https://github.com/${FLM_REPO_NAME}`;
const FLM_EXE_NAME = import.meta.env.VITE_FLM_EXE || "flm-setup.exe";

interface FlmInstallDialogProps {
    open: boolean;
    flmRelease: ReleaseInfo | null;
    onInstallComplete?: () => void;
}

export const FlmInstallDialog = ({ open, flmRelease, onInstallComplete }: FlmInstallDialogProps) => {
    const { t } = useTranslation();
    const [isDownloading, setIsDownloading] = useState(false);
    const [isInstalling, setIsInstalling] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
    const [downloadError, setDownloadError] = useState<string | null>(null);

    const handleDownloadInstall = async () => {
        if (!flmRelease) return;

        setIsDownloading(true);
        setDownloadProgress(0);
        setDownloadError(null);

        await UpdateService.downloadAndInstall(
            flmRelease,
            FLM_EXE_NAME,
            {
                onProgress: (progress) => setDownloadProgress(progress),
                onInstalling: () => {
                    setIsDownloading(false);
                    setIsInstalling(true);
                },
                onSuccess: () => {
                    setIsInstalling(false);
                    setDownloadProgress(null);
                    onInstallComplete?.();
                },
                onError: (error) => {
                    setIsDownloading(false);
                    setIsInstalling(false);
                    setDownloadProgress(null);
                    setDownloadError(error === 'Installer not found in release assets'
                        ? t('startup.error_installer_not_found')
                        : t('startup.error_download_install')
                    );
                }
            },
            true // Monitor FLM version change
        );
    };

    return (
        <Dialog open={open} modal>
            <DialogContent
                className="sm:max-w-md"
                onPointerDownOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-destructive/10 rounded-lg">
                            <AlertTriangle className="h-6 w-6 text-destructive" />
                        </div>
                        <DialogTitle className="text-xl">{t('startup.flm_required')}</DialogTitle>
                    </div>
                    <DialogDescription className="pt-4">
                        {t('startup.flm_not_installed_desc', { minVersion: MINIMUM_FLM_VERSION })}
                    </DialogDescription>
                </DialogHeader>

                {downloadProgress !== null && (
                    <div className="py-4">
                        <div className="w-full bg-secondary h-2 rounded-full overflow-hidden">
                            <div
                                className="bg-primary h-full transition-all duration-300"
                                style={{ width: `${downloadProgress}%` }}
                            />
                        </div>
                        <p className="text-xs text-center text-muted-foreground mt-2">
                            {t('startup.downloading')} {downloadProgress}%
                        </p>
                    </div>
                )}

                {downloadError && (
                    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                        <p className="text-sm text-destructive">{downloadError}</p>
                    </div>
                )}

                <DialogFooter className="flex-col sm:flex-col gap-2">
                    {flmRelease && (
                        <Button
                            onClick={handleDownloadInstall}
                            disabled={isDownloading || isInstalling}
                            className="w-full"
                        >
                            {isDownloading && <Download className="w-4 h-4 mr-2" />}
                            {isInstalling && <RefreshCw className="w-4 h-4 mr-2 animate-spin" />}
                            {!isDownloading && !isInstalling && <Download className="w-4 h-4 mr-2" />}
                            {isDownloading ? t('startup.downloading') : isInstalling ? t('about.installing') : t('startup.download_install_flm')}
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        onClick={() => openUrl(FLM_REPO_URL)}
                        className="w-full"
                        disabled={isDownloading || isInstalling}
                    >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        {t('startup.visit_github')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

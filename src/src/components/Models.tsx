import { RefreshCw, Trash2, Download, HardDrive, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { FlmService, FlmModel } from "../services/flm";
import { SystemService } from "../services/system";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose
} from "./ui/dialog";
import { ScrollArea } from "./ui/scroll-area";
import { useTranslation, Trans } from "react-i18next";
import { GenericAlertDialog } from "./GenericAlertDialog";

interface ModelsProps {
    installedModels: FlmModel[];
    onRefresh: () => void;
}

export const Models = ({ installedModels, onRefresh }: ModelsProps) => {
    const { t } = useTranslation();
    // const [installedModels, setInstalledModels] = useState<FlmModel[]>([]); // Removed in favor of props
    const [availableModels, setAvailableModels] = useState<FlmModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
    const [downloadProgress, setDownloadProgress] = useState<number>(0);
    const [downloadStatus, setDownloadStatus] = useState<string>("");
    const [totalMemory, setTotalMemory] = useState<number>(0);
    const [alertOpen, setAlertOpen] = useState(false);
    const [alertMessage, setAlertMessage] = useState("");

    const loadModels = async (force = false) => {
        setLoading(true);

        // Load models first to show them quickly
        try {
            const available = await FlmService.listModels('not-installed', force);
            setAvailableModels(available);
            console.log("Available models:", available);
        } catch (error) {
            console.error("Failed to load models:", error);
        }

        setLoading(false);

        // Load system stats in background for memory warnings
        try {
            const stats = await SystemService.getSystemStats();
            setTotalMemory(stats.memory.total * 1024 * 1024); // Convert MB to Bytes
        } catch (error) {
            console.error("Failed to load system stats:", error);
        }
    };

    useEffect(() => {
        loadModels();
    }, []);

    const handleDelete = async (name: string) => {
        try {
            setLoading(true);
            await FlmService.removeModel(name);
            onRefresh();
            await loadModels(true);
        } catch (e) {
            setAlertMessage(t('models.error_delete') + e);
            setAlertOpen(true);
            setLoading(false);
        }
    };

    const handleDownload = async (modelName: string) => {
        if (downloadingModel) return;
        console.log("Starting download for model:", modelName);
        setDownloadingModel(modelName);
        setDownloadProgress(0);
        setDownloadStatus("Starting download...");

        let totalFiles = 1;
        let baseProgress = 0;
        let currentFileProgress = 0;

        try {
            await FlmService.pullModel(modelName, (data) => {
                // Clean data (remove [FLM] prefix if present)
                const cleanData = data.replace(/^\[FLM\]\s+/, '').trim();

                // 1. Check for "Downloading X/Y" to set total files and current file index
                const fileCountMatch = cleanData.match(/Downloading (\d+)\/(\d+):/);
                if (fileCountMatch) {
                    const current = parseInt(fileCountMatch[1]);
                    const total = parseInt(fileCountMatch[2]);
                    totalFiles = total;
                    // Base progress is the progress of completed files
                    baseProgress = ((current - 1) / total) * 100;
                    currentFileProgress = 0;
                    setDownloadStatus(`Downloading file ${current}/${total}...`);
                }

                // 2. Check for "Overall progress: P%" (Sync point)
                const overallMatch = cleanData.match(/Overall progress:\s*([\d.]+)%/);
                if (overallMatch) {
                    baseProgress = parseFloat(overallMatch[1]);
                    currentFileProgress = 0;
                }

                // 3. Check for "Downloading: P%" (Current file progress)
                const downloadingMatch = cleanData.match(/Downloading:\s*([\d.]+)%/);
                if (downloadingMatch) {
                    currentFileProgress = parseFloat(downloadingMatch[1]);
                }

                // Calculate total progress
                // If we are downloading file X, total = base + (fileProgress / totalFiles)
                const totalProgress = Math.min(100, baseProgress + (currentFileProgress / totalFiles));
                setDownloadProgress(Math.round(totalProgress));

                // Update status text for non-progress lines
                if (!cleanData.startsWith("Downloading:") && !cleanData.startsWith("Overall progress:") && cleanData.length > 0) {
                    setDownloadStatus(cleanData.substring(0, 50) + (cleanData.length > 50 ? "..." : ""));
                }
            });

            setDownloadStatus("Download complete!");
            setDownloadProgress(100);
            setTimeout(() => {
                setDownloadingModel(null);
                setDownloadProgress(0);
                setDownloadStatus("");
                onRefresh();
                loadModels(true);
            }, 1000);
        } catch (error) {
            setDownloadStatus(`Error: ${error}`);
            setTimeout(() => setDownloadingModel(null), 3000);
        }
    };

    const isInstalled = (name: string) => installedModels.some(m => m.name === name);
    const isTooLarge = (model: FlmModel) => {
        if (!totalMemory || !model.realSize) return false;
        // Warning if model size > 90% of total RAM
        return model.realSize > (totalMemory * 0.9);
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{t('models.title')}</h2>
                    <p className="text-muted-foreground text-sm">{t('models.subtitle')}</p>
                </div>
                <Button
                    variant="secondary"
                    onClick={() => { onRefresh(); loadModels(true); }}
                    disabled={loading || !!downloadingModel}
                    className="gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
                >
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                    {t('models.refresh')}
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                {/* Installed Models */}
                <div className="flex flex-col space-y-3 h-auto lg:h-full">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 px-1">
                        <HardDrive size={16} />
                        {t('models.installed_title')}
                    </h3>
                    <Card className="bg-card border-border overflow-hidden flex-1 flex flex-col shadow-sm min-h-0">
                        <CardContent className="p-0 flex-1 h-full relative">
                            <ScrollArea className="h-[calc(50vh-130px)] lg:h-[calc(100vh-200px)]">
                                {installedModels.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground italic">
                                        {t('models.no_installed_models')}
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border">
                                        {installedModels.map((model) => (
                                            <div key={model.name} className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors group">
                                                <div>
                                                    <div className="font-medium text-foreground flex items-center gap-2 text-sm">
                                                        {model.name}
                                                        {model.isThink && (
                                                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-purple-500/10 text-purple-400 border-purple-500/20">
                                                                THINK
                                                            </Badge>
                                                        )}
                                                        {isTooLarge(model) && (
                                                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                                                                {t('models.badge_memory')}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                                                        <span>{model.size}</span>
                                                        <span>{model.modified !== "-" ? new Date(model.modified).toLocaleDateString() : "-"}</span>
                                                        {model.quantization && <span className="text-muted-foreground">| {model.quantization}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                                <Info size={16} />
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle className="flex items-center gap-2">
                                                                    {model.name}
                                                                    {model.isThink && <Badge variant="secondary">THINK</Badge>}
                                                                </DialogTitle>
                                                                <DialogDescription>{t('models.dialog_info_desc')}</DialogDescription>
                                                            </DialogHeader>
                                                            <div className="grid gap-3 py-4">
                                                                <div className="grid grid-cols-3 items-center gap-4">
                                                                    <span className="text-sm font-medium text-muted-foreground">{t('models.info_family')}</span>
                                                                    <span className="col-span-2 text-sm font-mono">{model.family || t('models.info_unknown')}</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 items-center gap-4">
                                                                    <span className="text-sm font-medium text-muted-foreground">{t('models.info_parameters')}</span>
                                                                    <span className="col-span-2 text-sm font-mono">{model.parameterSize || "?"} ({model.size})</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 items-center gap-4">
                                                                    <span className="text-sm font-medium text-muted-foreground">{t('models.info_quantization')}</span>
                                                                    <span className="col-span-2 text-sm font-mono">{model.quantization || t('models.info_unknown')}</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 items-center gap-4">
                                                                    <span className="text-sm font-medium text-muted-foreground">{t('models.info_context')}</span>
                                                                    <span className="col-span-2 text-sm font-mono">{model.contextLength || "?"} tokens</span>
                                                                </div>
                                                                {model.url && (
                                                                    <div className="grid grid-cols-3 items-center gap-4">
                                                                        <span className="text-sm font-medium text-muted-foreground">{t('models.info_source')}</span>
                                                                        <a href={model.url.split('/resolve/')[0]} target="_blank" rel="noopener noreferrer" className="col-span-2 text-sm text-blue-500 hover:underline truncate block">
                                                                            HuggingFace ↗
                                                                        </a>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>

                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button
                                                                variant="destructive"
                                                                size="icon"
                                                                disabled={!!downloadingModel}
                                                                className="h-8 w-8"
                                                                title={t('models.delete')}
                                                            >
                                                                <Trash2 size={16} />
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle>{t('models.delete_confirm_title')}</DialogTitle>
                                                                <DialogDescription>
                                                                    <Trans i18nKey="models.delete_confirm_desc" values={{ name: model.name }}>
                                                                        Cette action est irréversible. Le modèle <span className="font-mono text-foreground">{model.name}</span> sera définitivement supprimé de votre disque.
                                                                    </Trans>
                                                                </DialogDescription>
                                                            </DialogHeader>
                                                            <DialogFooter>
                                                                <DialogClose asChild>
                                                                    <Button variant="outline">{t('common.cancel')}</Button>
                                                                </DialogClose>
                                                                <Button variant="destructive" onClick={() => handleDelete(model.name)}>
                                                                    {t('models.delete')}
                                                                </Button>
                                                            </DialogFooter>
                                                        </DialogContent>
                                                    </Dialog>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>

                {/* Available Models */}
                <div className="flex flex-col space-y-3 h-auto lg:h-full">
                    <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2 px-1">
                        <Download size={16} />
                        {t('models.available_title')}
                    </h3>
                    <Card className="bg-card border-border overflow-hidden flex-1 flex flex-col shadow-sm min-h-0">
                        <CardContent className="p-0 flex-1 h-full relative">
                            <ScrollArea className="h-[calc(50vh-130px)] lg:h-[calc(100vh-200px)]">
                                <div className="divide-y divide-border">
                                    {availableModels.map((model) => {
                                        const installed = isInstalled(model.name);
                                        const isDownloading = downloadingModel === model.name;
                                        return (
                                            <div key={model.name} className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
                                                <div>
                                                    <div className="font-medium text-foreground flex items-center gap-2 text-sm">
                                                        {model.name}
                                                        {model.isThink && (
                                                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 bg-purple-500/10 text-purple-400 border-purple-500/20">
                                                                THINK
                                                            </Badge>
                                                        )}
                                                        {isTooLarge(model) && (
                                                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                                                                {t('models.badge_memory')}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-0.5 flex gap-2">
                                                        <span>{model.size}</span>
                                                        {model.quantization && <span>| {model.quantization}</span>}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Dialog>
                                                        <DialogTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                                <Info size={16} />
                                                            </Button>
                                                        </DialogTrigger>
                                                        <DialogContent>
                                                            <DialogHeader>
                                                                <DialogTitle className="flex items-center gap-2">
                                                                    {model.name}
                                                                    {model.isThink && <Badge variant="secondary">THINK</Badge>}
                                                                </DialogTitle>
                                                                <DialogDescription>{t('models.dialog_info_desc')}</DialogDescription>
                                                            </DialogHeader>
                                                            <div className="grid gap-3 py-4">
                                                                <div className="grid grid-cols-3 items-center gap-4">
                                                                    <span className="text-sm font-medium text-muted-foreground">{t('models.info_family')}</span>
                                                                    <span className="col-span-2 text-sm font-mono">{model.family || t('models.info_unknown')}</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 items-center gap-4">
                                                                    <span className="text-sm font-medium text-muted-foreground">{t('models.info_parameters')}</span>
                                                                    <span className="col-span-2 text-sm font-mono">{model.parameterSize || "?"} ({model.size})</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 items-center gap-4">
                                                                    <span className="text-sm font-medium text-muted-foreground">{t('models.info_quantization')}</span>
                                                                    <span className="col-span-2 text-sm font-mono">{model.quantization || t('models.info_unknown')}</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 items-center gap-4">
                                                                    <span className="text-sm font-medium text-muted-foreground">{t('models.info_context')}</span>
                                                                    <span className="col-span-2 text-sm font-mono">{model.contextLength || "?"} tokens</span>
                                                                </div>
                                                                {model.url && (
                                                                    <div className="grid grid-cols-3 items-center gap-4">
                                                                        <span className="text-sm font-medium text-muted-foreground">{t('models.info_source')}</span>
                                                                        <a href={model.url.split('/resolve/')[0]} target="_blank" rel="noopener noreferrer" className="col-span-2 text-sm text-blue-500 hover:underline truncate block">
                                                                            HuggingFace ↗
                                                                        </a>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </DialogContent>
                                                    </Dialog>

                                                    {isDownloading ? (
                                                        <div className="flex flex-col items-end gap-1 min-w-[140px]">
                                                            <div className="flex justify-end w-full text-xs">
                                                                <span className="text-blue-400 font-medium">{downloadProgress}%</span>
                                                            </div>
                                                            <div className="w-full bg-secondary rounded-full h-1.5">
                                                                <div
                                                                    className={`h-1.5 rounded-full transition-all duration-300 ${downloadStatus.includes("Error") ? "bg-red-500" : "bg-blue-500"}`}
                                                                    style={{ width: `${downloadProgress}%` }}
                                                                ></div>
                                                            </div>
                                                            <div className="text-[10px] text-muted-foreground truncate max-w-[140px] text-right">
                                                                {downloadStatus}
                                                            </div>
                                                        </div>
                                                    ) : installed ? (
                                                        <Button
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => handleDownload(model.name)}
                                                            disabled={!!downloadingModel}
                                                            className="h-8 w-8 border-border bg-muted/50 text-green-500 hover:border-green-900 hover:text-green-400 hover:bg-green-900/10"
                                                            title={t('models.reinstall')}
                                                        >
                                                            <RefreshCw size={16} />
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            size="icon"
                                                            onClick={() => handleDownload(model.name)}
                                                            disabled={!!downloadingModel}
                                                            className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90"
                                                            title={t('models.download')}
                                                        >
                                                            <Download size={16} />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {availableModels.length === 0 && (
                                        <div className="p-8 text-center text-muted-foreground italic">
                                            {t('models.no_available_models')}
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </div>
            </div>
            <GenericAlertDialog
                open={alertOpen}
                onOpenChange={setAlertOpen}
                description={alertMessage}
            />
        </div>
    );
};
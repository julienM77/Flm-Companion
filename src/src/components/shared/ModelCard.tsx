import { RefreshCw, Trash2, Download, Brain, Eye, Layers, Mic, AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogClose,
} from "../ui/dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "../ui/tooltip";
import { useTranslation, Trans } from "react-i18next";
import { ModelInfoDialog } from "./ModelInfoDialog";
import type { FlmModel } from "../../types";
import type { PerformanceWarning } from "../../lib/performance";
import { formatDate } from "../../lib/formatters";

interface ModelCardProps {
    model: FlmModel;
    performanceWarning?: PerformanceWarning;
    isInstalled?: boolean;
    isDownloading?: boolean;
    downloadProgress?: number;
    downloadStatus?: string;
    onDownload?: (modelName: string) => void;
    onDelete?: (modelName: string) => void;
    disabled?: boolean;
}

/**
 * Reusable card component for displaying a model
 * Used in Models.tsx for both installed and available models
 */
export function ModelCard({
    model,
    performanceWarning = "none",
    isInstalled = false,
    isDownloading = false,
    downloadProgress = 0,
    downloadStatus = "",
    onDownload,
    onDelete,
    disabled = false,
}: ModelCardProps) {
    const { t } = useTranslation();

    return (
        <div className="p-4 flex items-center justify-between hover:bg-accent/50 transition-colors group">
            <div>
                <div className="font-medium text-foreground flex items-center gap-2 text-sm">
                    {model.name}
                    {model.isThink && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge
                                    variant="secondary"
                                    className="px-1.5 py-0.5 h-5 bg-purple-500/10 text-purple-400 border border-purple-500/30"
                                >
                                    <Brain size={12} />
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{t("models.badge_think_tooltip")}</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                    {model.isVlm && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge
                                    variant="secondary"
                                    className="px-1.5 py-0.5 h-5 bg-blue-500/10 text-blue-400 border border-blue-500/30"
                                >
                                    <Eye size={12} />
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{t("models.badge_vlm_tooltip")}</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                    {model.isEmbed && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge
                                    variant="secondary"
                                    className="px-1.5 py-0.5 h-5 bg-green-500/10 text-green-400 border border-green-500/30"
                                >
                                    <Layers size={12} />
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{t("models.badge_embed_tooltip")}</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                    {model.isAudio && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge
                                    variant="secondary"
                                    className="px-1.5 py-0.5 h-5 bg-orange-500/10 text-orange-400 border border-orange-500/30"
                                >
                                    <Mic size={12} />
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{t("models.badge_audio_tooltip")}</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                    {performanceWarning === "warning" && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge
                                    variant="secondary"
                                    className="px-1.5 py-0.5 h-5 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30"
                                >
                                    <AlertTriangle size={12} />
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{t("models.badge_performance_warning_tooltip")}</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                    {performanceWarning === "critical" && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge
                                    variant="secondary"
                                    className="px-1.5 py-0.5 h-5 bg-red-500/10 text-red-400 border border-red-500/30"
                                >
                                    <XCircle size={12} />
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{t("models.badge_performance_critical_tooltip")}</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>
                <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                    <span>{model.size}</span>
                    {model.modified && model.modified !== "-" && (
                        <span>{formatDate(model.modified)}</span>
                    )}
                    {model.quantization && (
                        <span className="text-muted-foreground">| {model.quantization}</span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-1">
                {/* Info Dialog */}
                <ModelInfoDialog model={model} performanceWarning={performanceWarning} />

                {/* Download Progress */}
                {isDownloading && (
                    <DownloadProgress progress={downloadProgress} status={downloadStatus} />
                )}

                {/* Action Buttons */}
                {!isDownloading && onDownload && (
                    <>
                        {isInstalled ? (
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => onDownload(model.name)}
                                disabled={disabled}
                                className="h-8 w-8 border-border bg-muted/50 text-green-500 hover:border-green-900 hover:text-green-400 hover:bg-green-900/10"
                                title={t("models.reinstall")}
                            >
                                <RefreshCw size={16} />
                            </Button>
                        ) : (
                            <Button
                                size="icon"
                                onClick={() => onDownload(model.name)}
                                disabled={disabled}
                                className="h-8 w-8 bg-primary text-primary-foreground hover:bg-primary/90"
                                title={t("models.download")}
                            >
                                <Download size={16} />
                            </Button>
                        )}
                    </>
                )}

                {/* Delete Button */}
                {onDelete && (
                    <DeleteModelDialog
                        modelName={model.name}
                        onConfirm={() => onDelete(model.name)}
                        disabled={disabled}
                    />
                )}
            </div>
        </div>
    );
}

function DownloadProgress({
    progress,
    status,
}: {
    progress: number;
    status: string;
}) {
    return (
        <div className="flex flex-col items-end gap-1 min-w-[140px]">
            <div className="flex justify-end w-full text-xs">
                <span className="text-blue-400 font-medium">{progress}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-1.5">
                <div
                    className={`h-1.5 rounded-full transition-all duration-300 ${status.includes("Error") ? "bg-red-500" : "bg-blue-500"
                        }`}
                    style={{ width: `${progress}%` }}
                />
            </div>
            <div className="text-[10px] text-muted-foreground truncate max-w-[140px] text-right">
                {status}
            </div>
        </div>
    );
}

function DeleteModelDialog({
    modelName,
    onConfirm,
    disabled,
}: {
    modelName: string;
    onConfirm: () => void;
    disabled?: boolean;
}) {
    const { t } = useTranslation();

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    variant="destructive"
                    size="icon"
                    disabled={disabled}
                    className="h-8 w-8"
                    title={t("models.delete")}
                >
                    <Trash2 size={16} />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t("models.delete_confirm_title")}</DialogTitle>
                    <DialogDescription>
                        <Trans
                            i18nKey="models.delete_confirm_desc"
                            values={{ name: modelName }}
                            components={{ 1: <span className="font-mono text-foreground" /> }}
                        />
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">{t("common.cancel")}</Button>
                    </DialogClose>
                    <Button variant="destructive" onClick={onConfirm}>
                        {t("models.delete")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

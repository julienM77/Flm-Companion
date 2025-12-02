import { RefreshCw, Trash2, Download } from "lucide-react";
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
import { useTranslation, Trans } from "react-i18next";
import { ModelInfoDialog } from "./ModelInfoDialog";
import type { FlmModel } from "../../types";
import { formatDate } from "../../lib/formatters";

interface ModelCardProps {
    model: FlmModel;
    isTooLarge?: boolean;
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
    isTooLarge = false,
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
                        <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 h-5 bg-purple-500/10 text-purple-400 border-purple-500/20"
                        >
                            {t("models.badge_think")}
                        </Badge>
                    )}
                    {model.isVlm && (
                        <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0 h-5 bg-blue-500/10 text-blue-400 border-blue-500/20"
                        >
                            {t("models.badge_vlm")}
                        </Badge>
                    )}
                    {isTooLarge && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                            {t("models.badge_memory")}
                        </Badge>
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
                <ModelInfoDialog model={model} />

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

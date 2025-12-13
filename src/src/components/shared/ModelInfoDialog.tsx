import { Info, Brain, Eye, Layers, Mic, AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "../ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../ui/dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "../ui/tooltip";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import type { FlmModel } from "../../types";
import type { PerformanceWarning } from "../../lib/performance";

interface ModelInfoDialogProps {
    model: FlmModel;
    performanceWarning?: PerformanceWarning;
    trigger?: React.ReactNode;
}

/**
 * Reusable dialog component to display model information
 * Used in Models.tsx for both installed and available models
 */
export function ModelInfoDialog({ model, performanceWarning = "none", trigger }: ModelInfoDialogProps) {
    const { t } = useTranslation();

    return (
        <Dialog>
            <DialogTrigger asChild>
                {trigger || (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                        <Info size={16} />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 flex-wrap">
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
                    </DialogTitle>
                    <DialogDescription>{t("models.dialog_info_desc")}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                    <ModelInfoRow
                        label={t("models.info_family")}
                        value={model.family || t("models.info_unknown")}
                    />
                    <ModelInfoRow
                        label={t("models.info_parameters")}
                        value={`${model.parameterSize || "?"} (${model.size})`}
                    />
                    <ModelInfoRow
                        label={t("models.info_quantization")}
                        value={model.quantization || t("models.info_unknown")}
                    />
                    <ModelInfoRow
                        label={t("models.info_context")}
                        value={`${model.contextLength || "?"} tokens`}
                    />
                    {model.url && (
                        <div className="grid grid-cols-3 items-center gap-4">
                            <span className="text-sm font-medium text-muted-foreground">
                                {t("models.info_source")}
                            </span>
                            <a
                                href={model.url.split("/resolve/")[0]}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="col-span-2 text-sm text-blue-500 hover:underline truncate block"
                            >
                                HuggingFace ↗
                            </a>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

function ModelInfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="grid grid-cols-3 items-center gap-4">
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
            <span className="col-span-2 text-sm font-mono">{value}</span>
        </div>
    );
}

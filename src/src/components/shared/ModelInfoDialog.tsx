import { Info } from "lucide-react";
import { Badge } from "../ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import type { FlmModel } from "../../types";

interface ModelInfoDialogProps {
    model: FlmModel;
    trigger?: React.ReactNode;
}

/**
 * Reusable dialog component to display model information
 * Used in Models.tsx for both installed and available models
 */
export function ModelInfoDialog({ model, trigger }: ModelInfoDialogProps) {
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
                    <DialogTitle className="flex items-center gap-2">
                        {model.name}
                        {model.isThink && <Badge variant="secondary">{t("models.badge_think")}</Badge>}
                        {model.isVlm && <Badge variant="secondary">{t("models.badge_vlm")}</Badge>}
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

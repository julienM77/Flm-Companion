import { useState } from "react";
import { Save } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useTranslation } from "react-i18next";
import type { ServerOptions } from "../../types";

interface SavePresetDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    selectedModel: string;
    options: ServerOptions;
    onSave: (name: string) => Promise<void>;
}

export const SavePresetDialog = ({
    open,
    onOpenChange,
    selectedModel,
    options,
    onSave,
}: SavePresetDialogProps) => {
    const { t } = useTranslation();
    const [presetName, setPresetName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!presetName.trim()) return;

        setIsSaving(true);
        try {
            await onSave(presetName.trim());
            setPresetName("");
            onOpenChange(false);
        } catch (error) {
            console.error("Failed to save preset:", error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{t('server.save_preset')}</DialogTitle>
                    <DialogDescription>
                        {t('server.save_preset_description')}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="preset-name">{t('server.preset_name')}</Label>
                        <Input
                            id="preset-name"
                            placeholder={t('server.preset_name_placeholder')}
                            value={presetName}
                            onChange={(e) => setPresetName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && presetName.trim()) {
                                    handleSave();
                                }
                            }}
                        />
                    </div>

                    <div className="rounded-lg bg-muted p-4 space-y-2">
                        <h4 className="text-sm font-medium text-foreground">{t('server.configuration_summary')}</h4>
                        <div className="text-sm text-muted-foreground space-y-1">
                            <div><span className="font-medium">{t('server.model')}:</span> {selectedModel || t('server.no_model')}</div>
                            <div><span className="font-medium">{t('server.performance_mode')}:</span> {options.pmode || "performance"}</div>
                            <div><span className="font-medium">{t('server.port')}:</span> {options.port || 52625}</div>
                            {options.asr && <div className="text-yellow-500">• {t('server.asr_enabled')}</div>}
                            {options.embed && <div className="text-blue-500">• {t('server.embed_enabled')}</div>}
                            {options.cors && <div className="text-green-500">• {t('server.cors_enabled')}</div>}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                        {t('common.cancel')}
                    </Button>
                    <Button onClick={handleSave} disabled={!presetName.trim() || isSaving}>
                        <Save className="w-4 h-4 mr-2" />
                        {isSaving ? t('common.saving') : t('common.save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

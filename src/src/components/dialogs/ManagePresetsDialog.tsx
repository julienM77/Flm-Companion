import { useState, useEffect } from "react";
import { Trash2, Bookmark } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { ScrollArea } from "../ui/scroll-area";
import { useTranslation } from "react-i18next";
import { ConfigService } from "../../services/config";
import type { ServerPreset, PresetsConfig } from "../../types";
import { getPresetDisplayName } from "../../lib/presets";

interface ManagePresetsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPresetDeleted: () => void;
}

export const ManagePresetsDialog = ({
    open,
    onOpenChange,
    onPresetDeleted,
}: ManagePresetsDialogProps) => {
    const { t } = useTranslation();
    const [presetsConfig, setPresetsConfig] = useState<PresetsConfig | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            loadPresets();
        }
    }, [open]);

    const loadPresets = async () => {
        setIsLoading(true);
        try {
            const config = await ConfigService.getPresetsConfig();
            setPresetsConfig(config);
        } catch (error) {
            console.error("Failed to load presets:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (presetId: string) => {
        setDeletingId(presetId);
        try {
            await ConfigService.deleteUserPreset(presetId);
            await loadPresets();
            onPresetDeleted();
        } catch (error) {
            console.error("Failed to delete preset:", error);
        } finally {
            setDeletingId(null);
        }
    };

    const renderPreset = (preset: ServerPreset, canDelete: boolean) => (
        <div key={preset.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
            <div className="flex items-center gap-3 flex-1">
                <Bookmark className="w-4 h-4 text-muted-foreground" />
                <div className="flex-1">
                    <div className="text-sm font-medium text-foreground">
                        {getPresetDisplayName(preset, t)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        {preset.model ? preset.model : t('server.no_model')}
                        {preset.options.asr && ' • ASR'}
                        {preset.options.embed && ' • Embed'}
                    </div>
                </div>
            </div>
            {canDelete && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(preset.id)}
                    disabled={deletingId === preset.id}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            )}
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{t('server.manage_presets')}</DialogTitle>
                    <DialogDescription>
                        {t('server.manage_presets_description')}
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
                    </div>
                ) : (
                    <ScrollArea className="max-h-[400px] pr-4">
                        <div className="space-y-4">
                            {presetsConfig && presetsConfig.system.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2 px-1">
                                        {t('server.system_presets')}
                                    </h4>
                                    <div className="space-y-2">
                                        {presetsConfig.system.map(preset => renderPreset(preset, false))}
                                    </div>
                                </div>
                            )}

                            {presetsConfig && presetsConfig.user.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-muted-foreground mb-2 px-1">
                                        {t('server.user_presets')}
                                    </h4>
                                    <div className="space-y-2">
                                        {presetsConfig.user.map(preset => renderPreset(preset, true))}
                                    </div>
                                </div>
                            )}

                            {presetsConfig && presetsConfig.user.length === 0 && (
                                <div className="text-center py-8">
                                    <Bookmark className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                                    <p className="text-sm text-muted-foreground">
                                        {t('server.no_user_presets')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}
            </DialogContent>
        </Dialog>
    );
};

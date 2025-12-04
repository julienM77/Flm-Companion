import { useTranslation } from "react-i18next";
import { useState, useEffect } from "react";
import type { ServerStatus } from "../../types";
import { DEFAULT_PRESETS_CONFIG } from "../../types";
import { ServerStatusIndicator } from "../shared/ServerStatusBadge";
import { isPresetId, findPresetById, getPresetDisplayName } from "../../lib/presets";
import { FlmService } from "../../services/flm";

interface StatusBarProps {
    serverStatus: ServerStatus;
    selectedModel: string;
    version: string;
}

export const StatusBar = ({ serverStatus, selectedModel, version }: StatusBarProps) => {
    const { t } = useTranslation();
    const [flmVersion, setFlmVersion] = useState<string>("");

    useEffect(() => {
        FlmService.getVersion().then(ver => {
            if (ver && ver !== "Not Found" && ver !== "Unknown") {
                setFlmVersion(ver);
            }
        });
    }, []);

    // Get display name for the selected model/preset
    const getSelectionDisplayName = (): string => {
        if (!selectedModel) return "";
        if (isPresetId(selectedModel)) {
            const preset = findPresetById(selectedModel, DEFAULT_PRESETS_CONFIG);
            return preset ? getPresetDisplayName(preset, t) : selectedModel;
        }
        return selectedModel;
    };

    const selectionName = getSelectionDisplayName();

    const statusLabel = serverStatus === "running"
        ? t('status_bar.server_online')
        : serverStatus === "starting"
            ? t('status_bar.starting')
            : t('status_bar.server_stopped');

    const fullStatusLabel = selectionName
        ? `${statusLabel} (${selectionName})`
        : statusLabel;

    return (
        <div className="h-8 bg-card border-t border-border flex items-center justify-between px-4 text-[11px] select-none">
            <div className="flex items-center gap-4">
                <ServerStatusIndicator status={serverStatus} label={fullStatusLabel} />
            </div>

            <div className="flex items-center gap-4 text-muted-foreground">
                <span>Companion v{version}</span>
                {flmVersion && (
                    <>
                        <span className="text-border">|</span>
                        <span>FLM {flmVersion}</span>
                    </>
                )}
            </div>
        </div>
    );
};

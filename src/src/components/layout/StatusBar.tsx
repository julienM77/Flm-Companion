import { useTranslation } from "react-i18next";
import type { ServerStatus } from "../../types";
import { ServerStatusIndicator } from "../shared/ServerStatusBadge";

interface StatusBarProps {
    serverStatus: ServerStatus;
    version: string;
}

export const StatusBar = ({ serverStatus, version }: StatusBarProps) => {
    const { t } = useTranslation();

    const statusLabel = serverStatus === "running"
        ? t('status_bar.server_online')
        : serverStatus === "starting"
            ? t('status_bar.starting')
            : t('status_bar.server_stopped');

    return (
        <div className="h-8 bg-card border-t border-border flex items-center justify-between px-4 text-[11px] select-none">
            <div className="flex items-center gap-4">
                <ServerStatusIndicator status={serverStatus} label={statusLabel} />
            </div>

            <div className="flex items-center gap-4 text-muted-foreground">
                <span>v{version}</span>
            </div>
        </div>
    );
};

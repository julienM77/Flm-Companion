import { useTranslation } from "react-i18next";

interface StatusBarProps {
    serverStatus: "stopped" | "running" | "starting";
    version: string;
}

export const StatusBar = ({ serverStatus, version }: StatusBarProps) => {
    const { t } = useTranslation();
    return (
        <div className="h-8 bg-card border-t border-border flex items-center justify-between px-4 text-[11px] select-none">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${serverStatus === "running" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" :
                        serverStatus === "starting" ? "bg-yellow-500 animate-pulse" :
                            "bg-red-500"
                        }`} />
                    <span className={`font-medium ${serverStatus === "running" ? "text-green-500" :
                        serverStatus === "starting" ? "text-yellow-500" :
                            "text-muted-foreground"
                        }`}>
                        {serverStatus === "running" ? t('status_bar.server_online') :
                            serverStatus === "starting" ? t('status_bar.starting') :
                                t('status_bar.server_stopped')}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-4 text-muted-foreground">
                {/* <div className="h-3 w-[1px] bg-border" /> */}
                <span>v{version}</span>
            </div>
        </div>
    );
};

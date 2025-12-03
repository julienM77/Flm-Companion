import { Badge } from "../ui/badge";
import type { ServerStatus } from "../../types";

interface ServerStatusBadgeProps {
    status: ServerStatus;
    labels?: {
        running: string;
        starting: string;
        stopped: string;
    };
    showIndicator?: boolean;
    className?: string;
}

const statusConfig = {
    running: {
        variant: "default" as const,
        colorClass: "bg-green-500/10 text-green-500 border-green-500/20",
        indicatorClass: "bg-green-500 animate-pulse",
    },
    starting: {
        variant: "secondary" as const,
        colorClass: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
        indicatorClass: "bg-yellow-500 animate-bounce",
    },
    stopped: {
        variant: "destructive" as const,
        colorClass: "bg-red-500/10 text-red-500 border-red-500/20",
        indicatorClass: "bg-red-500",
    },
};

/**
 * Reusable badge component for displaying server status
 * Used in DashboardView, ServerView, and StatusBar
 */
export function ServerStatusBadge({
    status,
    labels,
    showIndicator = true,
    className = "",
}: ServerStatusBadgeProps) {
    const config = statusConfig[status];
    const defaultLabels = {
        running: "Online",
        starting: "Starting...",
        stopped: "Stopped",
    };
    const displayLabels = labels || defaultLabels;

    return (
        <Badge
            variant={config.variant}
            className={`px-3 py-1 text-xs font-medium flex items-center gap-2 ${config.colorClass} ${className}`}
        >
            {showIndicator && (
                <div className={`w-1.5 h-1.5 rounded-full ${config.indicatorClass}`} />
            )}
            {displayLabels[status]}
        </Badge>
    );
}

/**
 * Smaller status indicator dot for StatusBar
 */
export function ServerStatusIndicator({
    status,
    label,
}: {
    status: ServerStatus;
    label: string;
}) {
    const config = statusConfig[status];

    return (
        <div className="flex items-center gap-2">
            <div
                className={`w-1.5 h-1.5 rounded-full ${config.indicatorClass} ${status === "running" ? "shadow-[0_0_8px_rgba(34,197,94,0.6)]" : ""
                    }`}
            />
            <span
                className={`font-medium ${status === "running"
                    ? "text-green-500"
                    : status === "starting"
                        ? "text-yellow-500"
                        : "text-muted-foreground"
                    }`}
            >
                {label}
            </span>
        </div>
    );
}

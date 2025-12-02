import { useEffect, useRef } from "react";
import { Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useTranslation } from "react-i18next";
import { getLogColorClass } from "../../lib/formatters";

interface LogsViewerProps {
    logs: string[];
    title?: string;
    showLineCount?: boolean;
    emptyMessage?: string;
    className?: string;
    autoScroll?: boolean;
}

/**
 * Reusable component for displaying log output
 * Used in ServerView and can be used standalone
 */
export function LogsViewer({
    logs,
    title,
    showLineCount = true,
    emptyMessage,
    className = "",
    autoScroll = true,
}: LogsViewerProps) {
    const { t } = useTranslation();
    const logsEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (autoScroll) {
            logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [logs, autoScroll]);

    const displayTitle = title || t("server.logs_title");
    const displayEmptyMessage = emptyMessage || t("server.waiting_logs");

    return (
        <Card
            className={`bg-muted border-border flex flex-col overflow-hidden shadow-inner ${className}`}
        >
            <CardHeader className="bg-card px-4 py-3 border-b border-border flex flex-row justify-between items-center space-y-0">
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Terminal size={16} className="text-muted-foreground" />
                    {displayTitle}
                </CardTitle>
                {showLineCount && (
                    <span className="text-xs text-muted-foreground">
                        {logs.length} {t("server.lines")}
                    </span>
                )}
            </CardHeader>
            <CardContent className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-1">
                {logs.length === 0 ? (
                    <div className="text-muted-foreground text-center mt-20 italic">
                        {displayEmptyMessage}
                    </div>
                ) : (
                    logs.map((log, i) => (
                        <div key={i} className={`break-all ${getLogColorClass(log)}`}>
                            {log}
                        </div>
                    ))
                )}
                <div ref={logsEndRef} />
            </CardContent>
        </Card>
    );
}

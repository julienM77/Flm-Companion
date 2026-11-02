import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Activity, Play, Pause } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { UsageChart } from "./UsageChart";
import { InfoTooltip } from "./InfoTooltip";
import { SystemService } from "../../services/system";

interface SystemStats {
    memory: { used: number; total: number; percentage: number; flmProcess: number };
    cpu: { usage: number };
    npu: { usage: number; memory: number };
}

interface ResourceMonitorProps {
    refreshInterval?: number; // milliseconds, default 2000
    maxDataPoints?: number;   // number of historical points to keep
    showCpu?: boolean;        // Show CPU stats (future)
    onStats?: (stats: SystemStats) => void;
}

export const ResourceMonitor = ({
    refreshInterval = 2000,
    maxDataPoints = 30,
    showCpu = false,
    onStats,
}: ResourceMonitorProps) => {
    const { t } = useTranslation();
    const [stats, setStats] = useState<SystemStats>({
        memory: { used: 0, total: 0, percentage: 0, flmProcess: 0 },
        cpu: { usage: 0 },
        npu: { usage: 0, memory: 0 }
    });
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [isMonitoring, setIsMonitoring] = useState(true);

    // Store history using refs for performance
    const npuHistoryRef = useRef<number[]>([]);
    const intervalRef = useRef<number | null>(null);
    const [npuHistory, setNpuHistory] = useState<number[]>([]);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const newStats = await SystemService.getSystemStats();

                // Add new data points and keep only maxDataPoints
                npuHistoryRef.current = [...npuHistoryRef.current, newStats.npu.usage].slice(-maxDataPoints);

                setStats(newStats);
                setNpuHistory([...npuHistoryRef.current]);
                onStats?.(newStats);
                setLastUpdate(new Date());
                setIsLoading(false);
            } catch (error) {
                console.error("Failed to fetch system stats:", error);
                setIsLoading(false);
            }
        };

        // Clear any existing interval
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }

        if (!isMonitoring) {
            return;
        }

        // Initial fetch
        fetchStats();

        // Setup polling
        intervalRef.current = window.setInterval(fetchStats, refreshInterval);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [refreshInterval, maxDataPoints, isMonitoring]);

    return (
        <Card className="bg-muted border-border flex flex-col overflow-hidden shadow-inner">
            <CardHeader className="bg-card px-4 py-3 border-b border-border flex flex-row justify-between items-center space-y-0 shrink-0">
                <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Activity size={16} className="text-muted-foreground" />
                    {t('performance.resource_monitor')}
                </CardTitle>
                {/* Empty div to match LogsViewer header height */}
                <div className="h-7"></div>
            </CardHeader>
            <CardContent className="p-4 space-y-6">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <div className="text-sm text-muted-foreground">
                            {t('common.loading')}...
                        </div>
                    </div>
                ) : (
                    <>
                        {/* NPU Usage */}
                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <span className="text-sm font-medium">{t("performance.npu_usage")}</span>
                                <span className={`text-xs font-semibold ${isMonitoring ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground'}`}>
                                    {isMonitoring ? `${stats.npu.usage.toFixed(1)}%` : "--%"}
                                </span>
                            </div>
                            <div className={isMonitoring ? '' : 'opacity-30'}>
                                <UsageChart
                                    history={isMonitoring ? npuHistory : []}
                                    maxDataPoints={maxDataPoints}
                                    color="#8b5cf6"
                                    height={80}
                                />
                            </div>
                            {isMonitoring && stats.npu.usage === 0 && npuHistory.every(v => v === 0) && (
                                <p className="text-xs text-muted-foreground mt-2 text-center">
                                    {t("performance.idle")}
                                </p>
                            )}
                        </div>

                        {/* Optional: CPU Usage (for future) */}
                        {showCpu && stats.cpu.usage > 0 && (
                            <div className="pt-4 border-t">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">CPU</span>
                                    <span className="font-semibold">{stats.cpu.usage.toFixed(1)}%</span>
                                </div>
                            </div>
                        )}

                        {/* Last update timestamp and monitoring control */}
                        <div className="space-y-2 pt-4">
                            <div className="flex items-center justify-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsMonitoring(!isMonitoring)}
                                    className="h-7 text-xs"
                                >
                                    {isMonitoring ? (
                                        <>
                                            <Pause className="w-3 h-3 mr-1" />
                                            {t('performance.stop_monitoring')}
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-3 h-3 mr-1" />
                                            {t('performance.start_monitoring')}
                                        </>
                                    )}
                                </Button>
                                <InfoTooltip text={t('performance.monitoring_info')} />
                            </div>
                            <div className="text-xs text-center text-muted-foreground">
                                {isMonitoring
                                    ? `${t('performance.last_update')}: ${lastUpdate.toLocaleTimeString()}`
                                    : t('performance.monitoring_stopped')
                                }
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Cpu } from "lucide-react";

interface NpuUsageChartProps {
    usage: number;    // %
    memory: number;   // GB
}

export const NpuUsageChart = ({ usage, memory }: NpuUsageChartProps) => {
    const { t } = useTranslation();

    const barColor = useMemo(() => {
        if (usage >= 90) return "bg-purple-600";
        if (usage >= 50) return "bg-purple-500";
        return "bg-purple-400";
    }, [usage]);

    const isActive = usage > 0 || memory > 0;

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{t('performance.npu_usage')}</span>
                </div>
                <span className={`text-sm font-semibold ${isActive ? 'text-purple-500' : 'text-muted-foreground'}`}>
                    {usage > 0 ? `${usage.toFixed(1)}%` : t('performance.idle')}
                </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-secondary h-3 rounded-full overflow-hidden">
                <div
                    className={`${barColor} h-full transition-all duration-500 ease-out`}
                    style={{ width: `${usage}%` }}
                />
            </div>

            {/* NPU details */}
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                    {isActive ? t('performance.compute') : t('performance.not_detected')}
                </span>
                {memory > 0 && (
                    <span>{memory.toFixed(2)} GB {t('performance.shared_memory')}</span>
                )}
            </div>
        </div>
    );
};

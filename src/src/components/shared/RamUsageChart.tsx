import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MemoryStick } from "lucide-react";

interface RamUsageChartProps {
    used: number;      // MB
    total: number;     // MB
    percentage: number; // %
}

export const RamUsageChart = ({ used, total, percentage }: RamUsageChartProps) => {
    const { t } = useTranslation();

    const barColor = useMemo(() => {
        if (percentage >= 90) return "bg-destructive";
        if (percentage >= 70) return "bg-orange-500";
        return "bg-primary";
    }, [percentage]);

    const textColor = useMemo(() => {
        if (percentage >= 90) return "text-destructive";
        if (percentage >= 70) return "text-orange-500";
        return "text-primary";
    }, [percentage]);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <MemoryStick className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{t('performance.ram_usage')}</span>
                </div>
                <span className={`text-sm font-semibold ${textColor}`}>
                    {percentage.toFixed(1)}%
                </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-secondary h-3 rounded-full overflow-hidden">
                <div
                    className={`${barColor} h-full transition-all duration-500 ease-out`}
                    style={{ width: `${percentage}%` }}
                />
            </div>

            {/* Memory details */}
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>{(used / 1024).toFixed(2)} GB {t('performance.used')}</span>
                <span>{(total / 1024).toFixed(2)} GB {t('performance.total')}</span>
            </div>
        </div>
    );
};

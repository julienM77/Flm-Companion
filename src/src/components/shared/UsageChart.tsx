import { useMemo } from "react";

interface UsageChartProps {
    history: number[]; // Array of usage percentages (0-100)
    maxDataPoints?: number;
    height?: number;
    color?: string;
    label?: string;
}

export const UsageChart = ({
    history,
    maxDataPoints = 30,
    height = 60,
    color = "#8b5cf6",
    label
}: UsageChartProps) => {
    const { points, areaPoints } = useMemo(() => {
        const data = history.slice(-maxDataPoints);
        const width = 100;
        const padding = 2;
        const chartHeight = height - padding * 2;

        // Si on a moins de points que maxDataPoints, on décale vers la droite
        const actualDataPoints = data.length;
        const step = width / (maxDataPoints - 1);
        const startOffset = width - (actualDataPoints - 1) * step;

        const linePoints = data.map((value, index) => {
            const x = startOffset + index * step;
            const y = chartHeight - (value / 100) * chartHeight + padding;
            return `${x},${y}`;
        }).join(' ');

        // Pour l'aire, on commence depuis le bas à gauche du premier point
        const firstX = startOffset;
        const areaPointsStr = `${firstX},${height} ${linePoints} ${startOffset + (actualDataPoints - 1) * step},${height}`;

        return { points: linePoints, areaPoints: areaPointsStr };
    }, [history, maxDataPoints, height]);

    const currentValue = history[history.length - 1] || 0;

    const fillColor = useMemo(() => {
        if (currentValue >= 90) return "#ef4444";
        if (currentValue >= 70) return "#f97316";
        return color;
    }, [currentValue, color]);

    return (
        <div className="w-full">
            {label && (
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">{label}</span>
                    <span className="text-xs font-semibold" style={{ color: fillColor }}>
                        {currentValue.toFixed(1)}%
                    </span>
                </div>
            )}
            <div className="w-full border rounded-md overflow-hidden bg-background/50">
                <svg
                    viewBox={`0 0 100 ${height}`}
                    className="w-full"
                    preserveAspectRatio="none"
                    style={{ height: `${height}px` }}
                >
                    {/* Border rectangle */}
                    <rect
                        x="0.5"
                        y="0.5"
                        width="99"
                        height={height - 1}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="0.5"
                        opacity="0.1"
                        className="text-muted-foreground"
                    />

                    {/* Grid lines */}
                    <line x1="0" y1={height / 2} x2="100" y2={height / 2}
                        stroke="currentColor"
                        strokeWidth="0.3"
                        opacity="0.15"
                        className="text-muted-foreground"
                    />

                    {/* Area under the line */}
                    {history.length > 1 && (
                        <polygon
                            points={areaPoints}
                            fill={fillColor}
                            opacity="0.2"
                        />
                    )}

                    {/* Line chart */}
                    {history.length > 1 && (
                        <polyline
                            points={points}
                            fill="none"
                            stroke={fillColor}
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                        />
                    )}
                </svg>
            </div>
        </div>
    );
};

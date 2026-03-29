import { useState, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { Payload } from "recharts/types/component/DefaultLegendContent";

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

const tooltipStyle = {
  backgroundColor: "var(--tooltip-bg, #1f2937)",
  border: "1px solid var(--tooltip-border, #374151)",
  borderRadius: "0.375rem",
  color: "var(--tooltip-text, #e5e7eb)",
};

interface TimelineChartProps {
  data: Record<string, string | number>[];
  dataKeys: string[];
  height?: number | string;
}

function CustomTooltip({ active, payload, label, highlighted }: {
  active?: boolean;
  payload?: Payload<number, string>[];
  label?: string;
  highlighted?: string | null;
}) {
  if (!active || !payload?.length) return null;
  const showTotal = payload.length > 1;
  const total = showTotal ? payload.reduce((sum, e) => sum + (Number(e.value) || 0), 0) : 0;
  return (
    <div style={tooltipStyle} className="px-3 py-2 text-sm shadow-lg">
      <div className="mb-1 font-medium">{label}</div>
      {payload.map((entry) => {
        const dimmed = highlighted && highlighted !== entry.dataKey;
        return (
          <div
            key={entry.dataKey}
            className="flex items-center justify-between gap-4"
            style={{ opacity: dimmed ? 0.35 : 1, fontWeight: highlighted === entry.dataKey ? 600 : 400 }}
          >
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="font-mono tabular-nums">{entry.value}</span>
          </div>
        );
      })}
      {showTotal && (
        <div className="flex items-center justify-between gap-4 border-t border-gray-600 mt-1 pt-1 font-medium">
          <span>Total</span>
          <span className="font-mono tabular-nums">{total}</span>
        </div>
      )}
    </div>
  );
}

export default function TimelineChart({ data, dataKeys, height = 400 }: TimelineChartProps) {
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const handleLegendClick = useCallback((entry: Payload) => {
    const key = entry.dataKey as string;
    setHighlighted((prev) => (prev === key ? null : key));
  }, []);

  const handleAreaClick = useCallback((dataKey: string) => {
    setHighlighted((prev) => (prev === dataKey ? null : dataKey));
  }, []);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="date" tick={{ fill: "#9ca3af" }} />
        <YAxis tick={{ fill: "#9ca3af" }} />
        <Tooltip
          wrapperStyle={{ zIndex: 10 }}
          content={<CustomTooltip highlighted={highlighted} />}
        />
        <Legend
          verticalAlign="bottom"
          wrapperStyle={{ paddingTop: 12, maxHeight: 60, overflowY: "auto", cursor: "pointer" }}
          onClick={handleLegendClick}
          formatter={(value: string) => (
            <span style={{ opacity: highlighted && highlighted !== value ? 0.3 : 1 }}>
              {value}
            </span>
          )}
        />
        {dataKeys.map((v, i) => (
          <Area
            key={v}
            type="monotone"
            dataKey={v}
            stackId="1"
            fill={COLORS[i % COLORS.length]}
            stroke={COLORS[i % COLORS.length]}
            fillOpacity={!highlighted || highlighted === v ? 0.6 : 0.05}
            strokeOpacity={!highlighted || highlighted === v ? 1 : 0.1}
            style={{ cursor: "pointer" }}
            onClick={() => handleAreaClick(v)}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

export { COLORS };

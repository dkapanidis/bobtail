import { useEffect, useState } from "react";
import { fetchGroupBy, fetchTimeseries } from "../api/client";
import type { WidgetConfig, GroupByResult, TimeseriesPoint } from "../types";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fillMissingDates(
  data: TimeseriesPoint[],
  start: string,
  end: string,
): TimeseriesPoint[] {
  const allDates: string[] = [];
  const current = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  while (current <= endDate) {
    allDates.push(formatDate(current));
    current.setDate(current.getDate() + 1);
  }
  const dataMap = new Map(data.map((p) => [p.date, p]));
  return allDates.map((d) => dataMap.get(d) || { date: d, values: {} });
}
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  Legend,
} from "recharts";

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

const tooltipStyle = {
  contentStyle: {
    backgroundColor: "var(--tooltip-bg, #1f2937)",
    border: "1px solid var(--tooltip-border, #374151)",
    borderRadius: "0.375rem",
    color: "var(--tooltip-text, #e5e7eb)",
  },
};

export default function DashboardWidget({ config }: { config: WidgetConfig }) {
  const [data, setData] = useState<GroupByResult[]>([]);
  const [tsData, setTsData] = useState<TimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<7 | 30>(7);

  useEffect(() => {
    const params = { kind: config.query.kind, groupBy: config.query.groupBy };

    if (config.type === "timeseries") {
      const now = new Date();
      const start = new Date(now);
      start.setDate(start.getDate() - range);
      const startStr = formatDate(start);
      const endStr = formatDate(now);
      fetchTimeseries({ ...params, start: startStr, end: endStr })
        .then((ts) => setTsData(fillMissingDates(ts, startStr, endStr)))
        .finally(() => setLoading(false));
    } else {
      fetchGroupBy(params)
        .then(setData)
        .finally(() => setLoading(false));
    }
  }, [config.query.kind, config.query.groupBy, config.type, range]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
        <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  if (config.type === "counter") {
    const value =
      config.counterMode === "distinct"
        ? data.length
        : data.reduce((sum, r) => sum + r.count, 0);
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className={`text-3xl font-bold ${config.color || "text-blue-600"}`}>
          {value}
        </div>
        <div className="text-sm text-gray-500 mt-1">{config.title}</div>
      </div>
    );
  }

  if (config.type === "bar") {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">{config.title}</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="value" tick={{ fill: "#9ca3af" }} />
            <YAxis tick={{ fill: "#9ca3af" }} />
            <Tooltip cursor={{ fill: "rgba(55, 65, 81, 0.5)" }} {...tooltipStyle} />
            <Bar dataKey="count" fill={config.barColor || "#3b82f6"} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (config.type === "table") {
    const maxCount = data[0]?.count || 1;
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">{config.title}</h3>
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
            <tr>
              <th className="px-4 py-3">{config.query.groupBy}</th>
              <th className="px-4 py-3 text-right">Count</th>
              <th className="px-4 py-3">Distribution</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={r.value} className="border-b border-gray-100 dark:border-gray-700">
                <td className="px-4 py-2 font-mono">{r.value}</td>
                <td className="px-4 py-2 text-right font-mono">{r.count}</td>
                <td className="px-4 py-2">
                  <div
                    className="h-4 rounded"
                    style={{
                      width: `${(r.count / maxCount) * 100}%`,
                      backgroundColor: COLORS[i % COLORS.length],
                      minWidth: "4px",
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (config.type === "timeseries") {
    const allValues = [...new Set(tsData.flatMap((p) => Object.keys(p.values)))].sort();
    const chartData = tsData.map((p) => {
      const row: Record<string, string | number> = { date: p.date };
      for (const v of allValues) {
        row[v] = p.values[v] || 0;
      }
      return row;
    });

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{config.title}</h3>
          <div className="flex items-center gap-1">
            {([7, 30] as const).map((r) => (
              <button
                key={r}
                className={`px-2 py-1 rounded text-xs ${
                  range === r
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200"
                }`}
                onClick={() => setRange(r)}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="date" tick={{ fill: "#9ca3af" }} />
              <YAxis tick={{ fill: "#9ca3af" }} />
              <Tooltip {...tooltipStyle} />
              <Legend />
              {allValues.map((v, i) => (
                <Area
                  key={v}
                  type="monotone"
                  dataKey={v}
                  stackId="1"
                  fill={COLORS[i % COLORS.length]}
                  stroke={COLORS[i % COLORS.length]}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-12 text-center text-gray-400">No time-series data</div>
        )}
      </div>
    );
  }

  return null;
}

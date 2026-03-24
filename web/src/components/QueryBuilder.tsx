import { useEffect, useState, useCallback } from "react";
import {
  fetchFilterOptions,
  fetchKeys,
  fetchGroupBy,
  fetchTimeseries,
} from "../api/client";
import type { QueryParams } from "../api/client";
import type {
  FilterOptions,
  GroupByResult,
  TimeseriesPoint,
} from "../types";
import FilterInput from "./FilterInput";
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

const FILTER_OPS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "!=" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "like", label: "LIKE" },
];

type ViewMode = "table" | "bar" | "timeseries";

export default function QueryBuilder() {
  const [options, setOptions] = useState<FilterOptions>({
    clusters: [],
    namespaces: [],
    kinds: [],
  });
  const [keys, setKeys] = useState<string[]>([]);
  const [kind, setKind] = useState("");
  const [groupBy, setGroupBy] = useState("");
  const [filterKey, setFilterKey] = useState("");
  const [filterOp, setFilterOp] = useState("eq");
  const [filterValue, setFilterValue] = useState("");
  const [interval, setInterval] = useState("day");
  const [view, setView] = useState<ViewMode>("bar");

  const [groupByResults, setGroupByResults] = useState<GroupByResult[]>([]);
  const [timeseriesResults, setTimeseriesResults] = useState<TimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchFilterOptions().then(setOptions);
  }, []);

  useEffect(() => {
    if (kind) {
      fetchKeys(kind).then(setKeys);
      setGroupBy("");
      setFilterKey("");
    } else {
      setKeys([]);
    }
  }, [kind]);

  const runQuery = useCallback(() => {
    if (!kind || !groupBy) return;

    const params: QueryParams = { kind, groupBy };
    if (filterKey && filterValue) {
      params.filterKey = filterKey;
      params.filterOp = filterOp;
      params.filterValue = filterValue;
    }
    params.interval = interval;

    setLoading(true);
    Promise.all([fetchGroupBy(params), fetchTimeseries(params)])
      .then(([gb, ts]) => {
        setGroupByResults(gb);
        setTimeseriesResults(ts);
      })
      .finally(() => setLoading(false));
  }, [kind, groupBy, filterKey, filterOp, filterValue, interval]);

  // Auto-run when key params change
  useEffect(() => {
    if (kind && groupBy) {
      runQuery();
    }
  }, [runQuery]);

  // Build timeseries chart data: [{date, value1: count, value2: count, ...}]
  const allValues = [
    ...new Set(timeseriesResults.flatMap((p) => Object.keys(p.values))),
  ].sort();

  const chartData = timeseriesResults.map((p) => {
    const row: Record<string, string | number> = { date: p.date };
    for (const v of allValues) {
      row[v] = p.values[v] || 0;
    }
    return row;
  });

  return (
    <div className="space-y-6">
      {/* Query controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-4">
        <h3 className="text-lg font-semibold">Query Builder</h3>

        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Kind</label>
            <FilterInput
              label="kind"
              value={kind}
              options={options.kinds}
              onChange={setKind}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Group By
            </label>
            <FilterInput
              label="key"
              value={groupBy}
              options={keys}
              onChange={setGroupBy}
            />
          </div>
        </div>

        {/* Optional filter */}
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Filter Key (optional)
            </label>
            <FilterInput
              label="filter key"
              value={filterKey}
              options={keys}
              onChange={setFilterKey}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Op</label>
            <select
              className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:border-gray-600"
              value={filterOp}
              onChange={(e) => setFilterOp(e.target.value)}
            >
              {FILTER_OPS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Value</label>
            <input
              className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:border-gray-600 w-44"
              placeholder="Filter value..."
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              Interval
            </label>
            <select
              className="border rounded px-3 py-1.5 text-sm bg-white dark:bg-gray-700 dark:border-gray-600"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
            >
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
              <option value="month">Monthly</option>
            </select>
          </div>
        </div>
      </div>

      {/* View toggle + results */}
      {kind && groupBy && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex gap-2">
            {(["bar", "table", "timeseries"] as ViewMode[]).map((m) => (
              <button
                key={m}
                className={`px-3 py-1.5 rounded text-sm ${
                  view === m
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
                onClick={() => setView(m)}
              >
                {m === "bar" ? "Bar Chart" : m === "table" ? "Table" : "Timeline"}
              </button>
            ))}
            {loading && (
              <span className="text-sm text-gray-400 ml-auto">Loading...</span>
            )}
          </div>

          <div className="p-4">
            {view === "table" && (
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">{groupBy}</th>
                    <th className="px-4 py-3 text-right">Count</th>
                    <th className="px-4 py-3">Distribution</th>
                  </tr>
                </thead>
                <tbody>
                  {groupByResults.map((r, i) => {
                    const maxCount = groupByResults[0]?.count || 1;
                    return (
                      <tr
                        key={r.value}
                        className="border-b border-gray-100 dark:border-gray-700"
                      >
                        <td className="px-4 py-2 font-mono">{r.value}</td>
                        <td className="px-4 py-2 text-right font-mono">
                          {r.count}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-4 rounded"
                              style={{
                                width: `${(r.count / maxCount) * 100}%`,
                                backgroundColor: COLORS[i % COLORS.length],
                                minWidth: "4px",
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {groupByResults.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-gray-400"
                      >
                        No results
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}

            {view === "bar" && (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={groupByResults}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="value" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            )}

            {view === "timeseries" && (
              <>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <AreaChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
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
                  <div className="py-12 text-center text-gray-400">
                    No time-series data yet. Timeline populates as ingestion
                    runs over multiple days.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

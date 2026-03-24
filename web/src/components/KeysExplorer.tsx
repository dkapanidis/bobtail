import { useEffect, useState, useRef } from "react";
import { fetchKeyValues, fetchFilterOptions, fetchKeys } from "../api/client";
import type { KeyValueEntry, FilterOptions } from "../types";
import FilterInput from "./FilterInput";
import type { FilterInputHandle } from "./FilterInput";
import DatePicker from "./DatePicker";

const OPS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "!=" },
  { value: "gt", label: ">" },
  { value: "gte", label: ">=" },
  { value: "lt", label: "<" },
  { value: "lte", label: "<=" },
  { value: "like", label: "~" },
];

interface Props {
  onSelectResource: (id: number) => void;
}

export default function KeysExplorer({ onSelectResource }: Props) {
  const [options, setOptions] = useState<FilterOptions>({
    clusters: [],
    namespaces: [],
    kinds: [],
    names: [],
  });
  const [asOf, setAsOf] = useState("");
  const [allKeys, setAllKeys] = useState<string[]>([]);
  const [entries, setEntries] = useState<KeyValueEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    key: "",
    value: "",
    op: "eq",
    kind: "",
    cluster: "",
    namespace: "",
    name: "",
  });
  const [valueFilterOpen, setValueFilterOpen] = useState(false);

  const refs = {
    cluster: useRef<FilterInputHandle>(null),
    namespace: useRef<FilterInputHandle>(null),
    kind: useRef<FilterInputHandle>(null),
    name: useRef<FilterInputHandle>(null),
    key: useRef<FilterInputHandle>(null),
  };
  const valueWrapperRef = useRef<HTMLDivElement>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFilterOptions().then(setOptions);
    fetchKeys().then(setAllKeys);
  }, []);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (filters.key) params.key = filters.key;
    if (filters.value) {
      params.value = filters.value;
      params.op = filters.op;
    }
    if (filters.kind) params.kind = filters.kind;
    if (filters.cluster) params.cluster = filters.cluster;
    if (filters.namespace) params.namespace = filters.namespace;
    if (filters.name) params.name = filters.name;
    if (asOf) params.asOf = asOf;
    fetchKeyValues(params)
      .then(setEntries)
      .finally(() => setLoading(false));
  }, [filters, asOf]);

  // Close value filter on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (valueWrapperRef.current && !valueWrapperRef.current.contains(e.target as Node)) {
        setValueFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const hasFilters = Object.values(filters).some(
    (v) => v !== "" && v !== "eq",
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
        <DatePicker value={asOf} onChange={setAsOf} />
        {hasFilters && (
          <button
            className="text-xs text-gray-500 hover:text-red-500 ml-auto"
            onClick={() =>
              setFilters({
                key: "",
                value: "",
                op: "eq",
                kind: "",
                cluster: "",
                namespace: "",
                name: "",
              })
            }
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
            <tr>
              <ThFilter label="Cluster" value={filters.cluster} onToggle={() => refs.cluster.current?.toggle()}>
                <FilterInput ref={refs.cluster} label="cluster" value={filters.cluster} options={options.clusters} onChange={(v) => setFilters((f) => ({ ...f, cluster: v }))} compact />
              </ThFilter>
              <ThFilter label="Namespace" value={filters.namespace} onToggle={() => refs.namespace.current?.toggle()}>
                <FilterInput ref={refs.namespace} label="namespace" value={filters.namespace} options={options.namespaces} onChange={(v) => setFilters((f) => ({ ...f, namespace: v }))} compact />
              </ThFilter>
              <ThFilter label="Kind" value={filters.kind} onToggle={() => refs.kind.current?.toggle()}>
                <FilterInput ref={refs.kind} label="kind" value={filters.kind} options={options.kinds} onChange={(v) => setFilters((f) => ({ ...f, kind: v }))} compact />
              </ThFilter>
              <ThFilter label="Name" value={filters.name} onToggle={() => refs.name.current?.toggle()}>
                <FilterInput ref={refs.name} label="name" value={filters.name} options={options.names} onChange={(v) => setFilters((f) => ({ ...f, name: v }))} compact />
              </ThFilter>
              <ThFilter label="Key" value={filters.key} onToggle={() => refs.key.current?.toggle()}>
                <FilterInput ref={refs.key} label="key" value={filters.key} options={allKeys} onChange={(v) => setFilters((f) => ({ ...f, key: v }))} compact />
              </ThFilter>
              {/* Value column with custom op+value dropdown */}
              <th className="px-4 py-3 relative" ref={valueWrapperRef}>
                <span
                  className="flex items-center gap-1.5 cursor-pointer hover:text-blue-500 select-none"
                  onClick={() => {
                    setValueFilterOpen((o) => {
                      if (!o) setTimeout(() => valueInputRef.current?.focus(), 0);
                      return !o;
                    });
                  }}
                >
                  Value
                  {filters.value ? (
                    <span className="text-blue-500 normal-case font-normal text-xs truncate max-w-[6rem]">
                      ({OPS.find((o) => o.value === filters.op)?.label} {filters.value})
                    </span>
                  ) : (
                    <svg className="w-3 h-3 text-gray-400 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  )}
                </span>
                {valueFilterOpen && (
                  <div className="absolute z-20 mt-1 left-0 min-w-[14rem] bg-white dark:bg-gray-700 border dark:border-gray-600 rounded shadow-lg p-2 space-y-2">
                    <div className="flex gap-1 items-center">
                      <select
                        className="border rounded px-1 py-1 text-xs bg-white dark:bg-gray-700 dark:border-gray-600"
                        value={filters.op}
                        onChange={(e) => setFilters((f) => ({ ...f, op: e.target.value }))}
                      >
                        {OPS.map((op) => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                      <input
                        ref={valueInputRef}
                        className="flex-1 border rounded px-2 py-1 text-xs font-mono bg-white dark:bg-gray-700 dark:border-gray-600 placeholder:text-gray-400 min-w-0"
                        placeholder="e.g. 14"
                        value={filters.value}
                        onChange={(e) => setFilters((f) => ({ ...f, value: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setValueFilterOpen(false);
                          if (e.key === "Enter") setValueFilterOpen(false);
                        }}
                      />
                    </div>
                    {filters.value && (
                      <button
                        className="text-xs text-gray-400 hover:text-red-500"
                        onClick={() => {
                          setFilters((f) => ({ ...f, value: "", op: "eq" }));
                          setValueFilterOpen(false);
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </th>
              <th className="px-4 py-3">First Seen</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr
                key={`${e.resourceId}-${e.key}-${i}`}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                onClick={() => onSelectResource(e.resourceId)}
              >
                <td className="px-4 py-2 text-xs">{e.cluster}</td>
                <td className="px-4 py-2 text-xs">{e.namespace}</td>
                <td className="px-4 py-2">
                  <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded text-xs font-medium">
                    {e.kind}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono text-xs">{e.name}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-500">
                  {e.key}
                </td>
                <td className="px-4 py-2 font-mono text-xs font-semibold">
                  {e.value}
                  {e.valueInt !== undefined && (
                    <span className="ml-1 text-green-600 font-normal">(int)</span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-gray-500">
                  {new Date(e.firstSeen).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {entries.length === 0 && !loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  {hasFilters
                    ? "No matching key-values found"
                    : "Enter a key to start exploring"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="p-3 text-xs text-gray-400 border-t border-gray-200 dark:border-gray-700 flex justify-between">
        <span>
          {entries.length} entries shown
          {loading && " (loading...)"}
        </span>
        <span>Click a row to view resource details</span>
      </div>
    </div>
  );
}

function ThFilter({
  label,
  value,
  onToggle,
  children,
}: {
  label: string;
  value: string;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <th className="px-4 py-3 relative">
      <span
        className="flex items-center gap-1.5 cursor-pointer hover:text-blue-500 select-none"
        onClick={onToggle}
      >
        {label}
        {value ? (
          <span className="text-blue-500 normal-case font-normal text-xs truncate max-w-[6rem]">({value})</span>
        ) : (
          <svg
            className="w-3 h-3 text-gray-400 opacity-40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
        )}
      </span>
      {children}
    </th>
  );
}

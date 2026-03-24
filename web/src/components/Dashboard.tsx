import type { WidgetConfig } from "../types";
import DashboardWidget from "./DashboardWidget";

const WIDGETS: WidgetConfig[] = [
  // Counters
  {
    id: "total-resources",
    type: "counter",
    title: "Total Resources",
    query: { kind: "*", groupBy: "kind" },
    counterMode: "total",
    color: "text-blue-600",
  },
  {
    id: "resource-kinds",
    type: "counter",
    title: "Resource Kinds",
    query: { kind: "*", groupBy: "kind" },
    counterMode: "distinct",
    color: "text-green-600",
  },
  {
    id: "clusters",
    type: "counter",
    title: "Clusters",
    query: { kind: "*", groupBy: "cluster" },
    counterMode: "distinct",
    color: "text-purple-600",
  },
  // Bar charts
  {
    id: "by-kind",
    type: "bar",
    title: "By Kind",
    query: { kind: "*", groupBy: "kind" },
    barColor: "#3b82f6",
  },
  {
    id: "by-cluster",
    type: "bar",
    title: "By Cluster",
    query: { kind: "*", groupBy: "cluster" },
    barColor: "#8b5cf6",
  },
];

export default function Dashboard() {
  const counters = WIDGETS.filter((w) => w.type === "counter");
  const charts = WIDGETS.filter((w) => w.type !== "counter");

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {counters.map((w) => (
          <DashboardWidget key={w.id} config={w} />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {charts.map((w) => (
          <DashboardWidget key={w.id} config={w} />
        ))}
      </div>
    </div>
  );
}

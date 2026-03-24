import { useState, useCallback } from "react";
import type { WidgetConfig } from "../types";
import DashboardWidget from "./DashboardWidget";
import WidgetEditor from "./WidgetEditor";

const STORAGE_KEY = "dashboard-widgets";

const DEFAULT_WIDGETS: WidgetConfig[] = [
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

function loadWidgets(): WidgetConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return DEFAULT_WIDGETS;
}

function saveWidgets(widgets: WidgetConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
}

export default function Dashboard() {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(loadWidgets);
  const [editing, setEditing] = useState(false);
  const [editorTarget, setEditorTarget] = useState<WidgetConfig | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const persist = useCallback((updated: WidgetConfig[]) => {
    setWidgets(updated);
    saveWidgets(updated);
  }, []);

  function handleDelete(id: string) {
    persist(widgets.filter((w) => w.id !== id));
  }

  function handleMove(id: string, direction: -1 | 1) {
    const idx = widgets.findIndex((w) => w.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= widgets.length) return;
    const copy = [...widgets];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    persist(copy);
  }

  function handleSave(widget: WidgetConfig) {
    if (editorTarget) {
      persist(widgets.map((w) => (w.id === editorTarget.id ? widget : w)));
    } else {
      persist([...widgets, widget]);
    }
    setShowEditor(false);
    setEditorTarget(null);
  }

  function handleReset() {
    persist(DEFAULT_WIDGETS);
  }

  const counters = widgets.filter((w) => w.type === "counter");
  const charts = widgets.filter((w) => w.type !== "counter");

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-3">
        {editing && (
          <>
            <button
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={() => {
                setEditorTarget(null);
                setShowEditor(true);
              }}
            >
              + Add widget
            </button>
            <button
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-red-500"
              onClick={handleReset}
            >
              Reset to defaults
            </button>
          </>
        )}
        <button
          className={`px-3 py-1.5 text-sm rounded ${
            editing
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
          }`}
          onClick={() => setEditing(!editing)}
        >
          {editing ? "Done" : "Edit"}
        </button>
      </div>

      {/* Counters */}
      {counters.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {counters.map((w) => (
            <WidgetWrapper
              key={w.id}
              widget={w}
              editing={editing}
              onEdit={() => { setEditorTarget(w); setShowEditor(true); }}
              onDelete={() => handleDelete(w.id)}
              onMoveUp={() => handleMove(w.id, -1)}
              onMoveDown={() => handleMove(w.id, 1)}
            >
              <DashboardWidget config={w} />
            </WidgetWrapper>
          ))}
        </div>
      )}

      {/* Charts */}
      {charts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {charts.map((w) => (
            <WidgetWrapper
              key={w.id}
              widget={w}
              editing={editing}
              onEdit={() => { setEditorTarget(w); setShowEditor(true); }}
              onDelete={() => handleDelete(w.id)}
              onMoveUp={() => handleMove(w.id, -1)}
              onMoveDown={() => handleMove(w.id, 1)}
            >
              <DashboardWidget config={w} />
            </WidgetWrapper>
          ))}
        </div>
      )}

      {widgets.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          No widgets. Click "Edit" then "+ Add widget" to get started.
        </div>
      )}

      {/* Editor modal */}
      {showEditor && (
        <WidgetEditor
          widget={editorTarget ?? undefined}
          onSave={handleSave}
          onCancel={() => { setShowEditor(false); setEditorTarget(null); }}
        />
      )}
    </div>
  );
}

function WidgetWrapper({
  widget,
  editing,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
  children,
}: {
  widget: WidgetConfig;
  editing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  children: React.ReactNode;
}) {
  if (!editing) return <>{children}</>;

  return (
    <div className="relative group">
      <div className="absolute -top-2 -right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          className="w-7 h-7 flex items-center justify-center rounded bg-gray-700 text-gray-300 hover:bg-gray-600 text-xs shadow"
          onClick={onMoveUp}
          title="Move left"
        >
          ←
        </button>
        <button
          className="w-7 h-7 flex items-center justify-center rounded bg-gray-700 text-gray-300 hover:bg-gray-600 text-xs shadow"
          onClick={onMoveDown}
          title="Move right"
        >
          →
        </button>
        <button
          className="w-7 h-7 flex items-center justify-center rounded bg-blue-600 text-white hover:bg-blue-700 text-xs shadow"
          onClick={onEdit}
          title="Edit"
        >
          E
        </button>
        <button
          className="w-7 h-7 flex items-center justify-center rounded bg-red-600 text-white hover:bg-red-700 text-xs shadow"
          onClick={onDelete}
          title="Delete"
        >
          X
        </button>
      </div>
      <div className="ring-1 ring-dashed ring-blue-500/50 rounded-lg">
        {children}
      </div>
    </div>
  );
}

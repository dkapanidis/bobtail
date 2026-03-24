import { useState, useRef } from "react";
import Dashboard from "./components/Dashboard";
import ResourceTable from "./components/ResourceTable";
import ResourceDetail from "./components/ResourceDetail";
import QueryBuilder from "./components/QueryBuilder";
import KeysExplorer from "./components/KeysExplorer";

type View = "dashboard" | "resources" | "detail" | "keys" | "query";

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [selectedResource, setSelectedResource] = useState<number | null>(null);
  const previousView = useRef<View>("resources");

  function goToDetail(id: number, from: View) {
    previousView.current = from;
    setSelectedResource(id);
    setView("detail");
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <nav className="bg-white dark:bg-gray-800 shadow mb-6">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-6">
          <h1 className="text-xl font-bold text-blue-600">K8s Statistics</h1>
          {(
            [
              ["dashboard", "Dashboard"],
              ["resources", "Resources"],
              ["keys", "Keys"],
              ["query", "Query"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              className={`text-sm ${
                view === v || (v === "resources" && view === "detail")
                  ? "font-semibold text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => {
                setView(v);
                if (v === "resources") setSelectedResource(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 pb-8">
        {view === "dashboard" && <Dashboard />}
        {view === "resources" && (
          <ResourceTable onSelect={(id) => goToDetail(id, "resources")} />
        )}
        {view === "keys" && (
          <KeysExplorer onSelectResource={(id) => goToDetail(id, "keys")} />
        )}
        {view === "detail" && selectedResource && (
          <ResourceDetail
            resourceId={selectedResource}
            onBack={() => {
              setView(previousView.current);
              setSelectedResource(null);
            }}
          />
        )}
        {view === "query" && <QueryBuilder />}
      </main>
    </div>
  );
}

export default App;

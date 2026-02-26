import { useApp } from "../context/AppContext";
import { open } from "@tauri-apps/plugin-dialog";

export default function SettingsPage() {
  const { settings, setSettings, setPage } = useApp();

  const handleBrowse = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Download Directory",
    });
    if (selected && typeof selected === "string") {
      setSettings({ ...settings, out_dir: selected });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Settings</h1>
          <button
            onClick={() => setPage("albums")}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
          >
            Done
          </button>
        </div>
      </div>

      {/* Settings form */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-md space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Output directory
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.out_dir}
                onChange={(e) =>
                  setSettings({ ...settings, out_dir: e.target.value })
                }
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleBrowse}
                className="px-4 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700 transition whitespace-nowrap"
              >
                Browse...
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Default: ~/Downloads/kidplan-albums/
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delay between requests (ms)
            </label>
            <input
              type="number"
              value={settings.delay_ms}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  delay_ms: Math.max(0, parseInt(e.target.value) || 0),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min={0}
              step={50}
            />
            <p className="text-xs text-gray-400 mt-1">
              Adds a delay between image downloads to avoid overloading the
              server. Default: 200ms.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max images per album
            </label>
            <input
              type="number"
              value={settings.limit_per_album}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  limit_per_album: Math.max(
                    0,
                    parseInt(e.target.value) || 0
                  ),
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              min={0}
            />
            <p className="text-xs text-gray-400 mt-1">
              Set to 0 for no limit.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

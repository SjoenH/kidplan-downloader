import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useLanguage } from "../i18n/LanguageContext";
import { open } from "@tauri-apps/plugin-dialog";
import { getName, getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { checkForUpdates } from "../utils/updater";
import type { Language } from "../i18n/translations";

export default function SettingsPage() {
  const { settings, setSettings } = useApp();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [appVersion, setAppVersion] = useState<string>("");
  const [appName, setAppName] = useState<string>("");

  useEffect(() => {
    const loadAppInfo = async () => {
      try {
        const version = await getVersion();
        const name = await getName();
        setAppVersion(version);
        setAppName(name);
      } catch (err) {
        console.error("Failed to load app info:", err);
      }
    };
    loadAppInfo();
  }, []);

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

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true);
    try {
      await checkForUpdates();
    } finally {
      setCheckingUpdates(false);
    }
  };

  const handleViewReleases = async () => {
    await openUrl("https://github.com/SjoenH/kidplan-downloader/releases");
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t.settingsTitle}</h1>
          <button
            onClick={() => navigate("/albums")}
            className="px-4 py-2 text-sm bg-blue-600 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-700 transition-colors font-medium"
          >
            {t.done}
          </button>
        </div>
      </div>

      {/* Settings form */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-md space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.language}
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent text-gray-900 dark:text-gray-100"
            >
              <option value="en">{t.english}</option>
              <option value="no">{t.norwegian}</option>
            </select>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              {t.languageHelp}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.outputDirectory}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.out_dir}
                onChange={(e) =>
                  setSettings({ ...settings, out_dir: e.target.value })
                }
                className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent text-gray-900 dark:text-gray-100"
              />
              <button
                onClick={handleBrowse}
                className="px-4 py-2.5 text-sm bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors whitespace-nowrap font-medium"
              >
                {t.browse}
              </button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              {t.outputDirHelp}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.delayBetweenRequests}
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
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent text-gray-900 dark:text-gray-100"
              min={0}
              step={50}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              {t.delayHelp}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t.maxImagesPerAlbum}
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
              className="w-full px-4 py-2.5 bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent text-gray-900 dark:text-gray-100"
              min={0}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              {t.maxImagesHelp}
            </p>
          </div>

          <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
            <button
              onClick={handleCheckUpdates}
              disabled={checkingUpdates}
              className="w-full px-4 py-2.5 text-sm bg-gray-600 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {checkingUpdates ? t.checkingForUpdates : t.checkForUpdates}
            </button>
          </div>

          {/* App Info */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-800">
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-gray-300 font-medium">
                <span>{appName}</span>
                {appVersion && (
                  <>
                    <span>•</span>
                    <span>v{appVersion}</span>
                  </>
                )}
              </div>
              <button
                onClick={handleViewReleases}
                className="text-xs text-blue-600 dark:text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors underline"
              >
                View releases on GitHub
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useApp } from "../context/AppContext";
import type { DownloadProgress, DownloadResult } from "../types";

export default function DownloadPage() {
  const {
    albums,
    selectedAlbumIds,
    settings,
    progressLog,
    addProgress,
    clearProgress,
    result,
    setResult,
    isDownloading,
    setIsDownloading,
    setPage,
  } = useApp();

  const logEndRef = useRef<HTMLDivElement>(null);
  const hasAutoStarted = useRef(false);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [progressLog]);

  // Auto-start download on page load if albums are selected
  useEffect(() => {
    if (!hasAutoStarted.current && selectedAlbumIds.size > 0 && !isDownloading && !result) {
      hasAutoStarted.current = true;
      handleStart();
    }
  }, []);

  const handleStart = async () => {
    const selectedAlbums = albums.filter((a) => selectedAlbumIds.has(a.id));
    console.log("[FRONTEND] handleStart called, selectedAlbums:", selectedAlbums.length);
    if (selectedAlbums.length === 0) {
      console.log("[FRONTEND] No albums, returning early");
      return;
    }

    console.log("[FRONTEND] Clearing progress and setting isDownloading=true");
    clearProgress();
    setResult(null);
    setIsDownloading(true);

    console.log("[FRONTEND] About to listen for download-progress events...");
    const unlisten = await listen<DownloadProgress>(
      "download-progress",
      (event) => {
        console.log("[FRONTEND] Progress event received:", event.payload);
        addProgress(event.payload);
      }
    );
    console.log("[FRONTEND] Event listener registered");

    try {
      console.log("[FRONTEND] About to invoke start_download with albums:", selectedAlbums.map(a => ({id: a.id, title: a.title})));
      console.log("[FRONTEND] Settings:", settings);
      const res = await invoke<DownloadResult>("start_download", {
        albums: selectedAlbums,
        settings,
      });
      console.log("[FRONTEND] invoke returned:", res);
      setResult(res);
    } catch (err) {
      console.error("[FRONTEND] invoke threw error:", err);
      setResult({
        total_albums: selectedAlbums.length,
        total_images: 0,
        skipped: 0,
        failed: 0,
      });
      addProgress({
        album_title: "Error",
        album_index: 0,
        album_total: 0,
        image_index: 0,
        image_total: 0,
        filename: "",
        status: `Error: ${err}`,
      });
    } finally {
      console.log("[FRONTEND] invoke completed (success or error), cleaning up");
      setIsDownloading(false);
      unlisten();
    }
  };

  const handleCancel = async () => {
    console.log("[FRONTEND] Cancel clicked");
    try {
      await invoke("cancel_download");
    } catch (err) {
      console.error("[FRONTEND] cancel_download error:", err);
    }
    // Force stop the UI state
    setIsDownloading(false);
  };

  const lastProgress = progressLog[progressLog.length - 1];
  const downloadedCount = progressLog.filter(
    (p) => p.status === "downloaded"
  ).length;
  const skippedCount = progressLog.filter(
    (p) => p.status.startsWith("skipped")
  ).length;
  const failedCount = progressLog.filter((p) =>
    p.status.startsWith("failed")
  ).length;

  const hasStarted = progressLog.length > 0 || result != null;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              {isDownloading
                ? "Downloading..."
                : result
                ? "Download Complete"
                : "Ready to Download"}
            </h1>
            <p className="text-sm text-gray-500">
              {hasStarted
                ? `${downloadedCount} downloaded, ${skippedCount} skipped${
                    failedCount > 0 ? `, ${failedCount} failed` : ""
                  }`
                : `${selectedAlbumIds.size} albums selected`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage("albums")}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition"
            >
              Back to Albums
            </button>
            {isDownloading ? (
              <button
                onClick={handleCancel}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition"
              >
                Cancel
              </button>
            ) : (
              <>
                {failedCount > 0 && result && (
                  <button
                    onClick={handleStart}
                    className="px-4 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 transition"
                  >
                    Retry Failed ({failedCount})
                  </button>
                )}
                <button
                  onClick={handleStart}
                  disabled={selectedAlbumIds.size === 0}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {result ? "Download Again" : "Start Download"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Overall progress */}
      {lastProgress && isDownloading && (
        <div className="bg-white border-b border-gray-100 px-6 py-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-700 font-medium truncate">
              {lastProgress.album_title}
            </span>
            <span className="text-gray-400 shrink-0 ml-2">
              Album {lastProgress.album_index}/{lastProgress.album_total}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{
                width: `${
                  lastProgress.album_total > 0
                    ? (lastProgress.album_index / lastProgress.album_total) *
                      100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Result summary */}
      {result && !isDownloading && (
        <div className="mx-6 mt-4 bg-green-50 border border-green-200 rounded-md p-4">
          <h3 className="font-medium text-green-800 mb-2">
            Download finished
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm text-green-700">
            <div>Albums: {result.total_albums}</div>
            <div>Downloaded: {result.total_images}</div>
            <div>Skipped: {result.skipped}</div>
            <div>Failed: {result.failed}</div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasStarted && !isDownloading && (
        <div className="flex items-center justify-center flex-1">
          <p className="text-gray-400">
            Click "Start Download" to begin
          </p>
        </div>
      )}

      {/* Log */}
      {hasStarted && (
        <div className="flex-1 overflow-y-auto px-6 py-4 font-mono text-xs">
          {progressLog.map((p, i) => (
            <div
              key={i}
              className={`py-0.5 ${
              p.status === "downloaded"
                ? "text-green-700"
                : p.status.startsWith("skipped")
                ? "text-yellow-600"
                : p.status.startsWith("failed")
                ? "text-red-600"
                : p.status.startsWith("scanning")
                ? "text-blue-600 font-medium"
                : "text-gray-600"
              }`}
            >
              [{p.album_index}/{p.album_total}] {p.album_title} &mdash;{" "}
              {p.filename ? `${p.filename}: ` : ""}
              {p.status}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  );
}

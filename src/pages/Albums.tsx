import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useLanguage } from "../i18n/LanguageContext";
import type { Album } from "../types";

export default function AlbumsPage() {
  const {
    albums,
    setAlbums,
    selectedAlbumIds,
    toggleAlbum,
    selectAllAlbums,
    deselectAllAlbums,
  } = useApp();
  
  const navigate = useNavigate();
  
  const { t } = useLanguage();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (albums.length > 0) return;
    loadAlbums();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAlbums = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await invoke<Album[]>("fetch_albums");
      setAlbums(result);
    } catch (err) {
      setError(String(err));
    }
    setLoading(false);
  };

  const selectedCount = selectedAlbumIds.size;
  const allSelected = selectedCount === albums.length && albums.length > 0;

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{t.albums}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {albums.length} {t.albumsFound}
              {selectedCount > 0 && ` \u00B7 ${selectedCount} ${t.selected}`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate("/settings")}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              {t.settings}
            </button>
            <button
              onClick={() => navigate("/download")}
              disabled={selectedCount === 0}
              className="px-4 py-2 text-sm bg-blue-600 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {t.download} ({selectedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-3 flex items-center gap-4">
        <button
          onClick={allSelected ? deselectAllAlbums : selectAllAlbums}
          className="text-sm text-blue-600 dark:text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
          disabled={albums.length === 0}
        >
          {allSelected ? t.deselectAll : t.selectAll}
        </button>
        <span className="text-gray-300 dark:text-gray-700">|</span>
        <button
          onClick={loadAlbums}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          disabled={loading}
        >
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 text-sm rounded-lg p-3 border border-red-200 dark:border-red-900">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && albums.length === 0 && (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 dark:border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-500 dark:text-gray-400">{t.fetchingAlbums}</p>
          </div>
        </div>
      )}

      {/* Album list */}
      {!loading && albums.length === 0 && !error && (
        <div className="flex items-center justify-center flex-1">
          <p className="text-gray-400 dark:text-gray-500">{t.noAlbumsFound}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-2">
          {albums.map((album) => (
            <label
              key={album.id}
              className={`flex items-center p-4 bg-white dark:bg-gray-900 border rounded-lg cursor-pointer transition-all ${
                selectedAlbumIds.has(album.id)
                  ? "border-blue-500 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30"
                  : "border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedAlbumIds.has(album.id)}
                onChange={() => toggleAlbum(album.id)}
                className="mr-3 h-4 w-4 rounded border-gray-300 dark:border-gray-700 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1 min-w-0">
                <span className="text-gray-900 dark:text-gray-100 text-sm font-medium truncate block">
                  {album.title}
                </span>
              </div>
              {album.image_count != null && (
                <span className="text-gray-400 dark:text-gray-500 text-xs ml-2 shrink-0">
                  {album.image_count} {t.images}
                </span>
              )}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

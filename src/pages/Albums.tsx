import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useApp } from "../context/AppContext";
import type { Album } from "../types";

export default function AlbumsPage() {
  const {
    albums,
    setAlbums,
    selectedAlbumIds,
    toggleAlbum,
    selectAllAlbums,
    deselectAllAlbums,
    setPage,
  } = useApp();

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
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Albums</h1>
            <p className="text-sm text-gray-500">
              {albums.length} albums found
              {selectedCount > 0 && ` \u00B7 ${selectedCount} selected`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPage("settings")}
              className="px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition"
            >
              Settings
            </button>
            <button
              onClick={() => setPage("download")}
              disabled={selectedCount === 0}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Download ({selectedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border-b border-gray-100 px-6 py-2 flex items-center gap-3">
        <button
          onClick={allSelected ? deselectAllAlbums : selectAllAlbums}
          className="text-sm text-blue-600 hover:text-blue-800"
          disabled={albums.length === 0}
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
        <span className="text-gray-300">|</span>
        <button
          onClick={loadAlbums}
          className="text-sm text-gray-500 hover:text-gray-700"
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 text-red-700 text-sm rounded p-3">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && albums.length === 0 && (
        <div className="flex items-center justify-center flex-1">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-gray-500">Fetching albums...</p>
          </div>
        </div>
      )}

      {/* Album list */}
      {!loading && albums.length === 0 && !error && (
        <div className="flex items-center justify-center flex-1">
          <p className="text-gray-400">No albums found</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-2">
          {albums.map((album) => (
            <label
              key={album.id}
              className={`flex items-center p-3 bg-white border rounded-md cursor-pointer transition ${
                selectedAlbumIds.has(album.id)
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="checkbox"
                checked={selectedAlbumIds.has(album.id)}
                onChange={() => toggleAlbum(album.id)}
                className="mr-3 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div className="flex-1 min-w-0">
                <span className="text-gray-800 text-sm font-medium truncate block">
                  {album.title}
                </span>
              </div>
              {album.image_count != null && (
                <span className="text-gray-400 text-xs ml-2 shrink-0">
                  {album.image_count} images
                </span>
              )}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

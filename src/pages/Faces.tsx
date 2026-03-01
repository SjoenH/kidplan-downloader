import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useApp } from "../context/AppContext";
import type { FaceCluster, Face, FaceProcessingProgress } from "../types";

// Helper function to convert thumbnail bytes to data URL
async function thumbnailToDataUrl(path: string): Promise<string> {
  try {
    const bytes = await invoke<number[]>("read_thumbnail", { path });
    const uint8Array = new Uint8Array(bytes);
    const blob = new Blob([uint8Array], { type: "image/jpeg" });
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error("[FACES] Failed to load thumbnail:", path, err);
    throw err;
  }
}

export default function FacesPage() {
  const navigate = useNavigate();
  const { settings } = useApp();

  const [clusters, setClusters] = useState<FaceCluster[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedCluster, setSelectedCluster] = useState<number | null>(null);
  const [clusterFaces, setClusterFaces] = useState<Face[]>([]);
  const [editingLabel, setEditingLabel] = useState<number | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState<FaceProcessingProgress | null>(null);
  const [clustering, setClustering] = useState(false);
  const [thumbnailUrls, setThumbnailUrls] = useState<Map<string, string>>(new Map());
  const [localThreshold, setLocalThreshold] = useState(settings.clustering_threshold || 0.6);

  useEffect(() => {
    loadClusters();

    // Listen for face processing progress
    const unlisten = listen<FaceProcessingProgress>("face-processing-progress", (event) => {
      setScanProgress(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const loadClusters = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await invoke<FaceCluster[]>("get_face_clusters");
      console.log('[FACES] Loaded clusters:', result);
      
      // Log to backend for file logging
      await invoke('log_frontend_message', { 
        message: `[FACES] Loaded ${result.length} clusters` 
      });
      
      // Load thumbnails as data URLs
      const newThumbnailUrls = new Map<string, string>();
      for (const cluster of result) {
        if (cluster.sample_thumbnail_path) {
          try {
            const dataUrl = await thumbnailToDataUrl(cluster.sample_thumbnail_path);
            newThumbnailUrls.set(cluster.sample_thumbnail_path, dataUrl);
            console.log('[FACES] Loaded thumbnail for cluster', cluster.id);
          } catch (err) {
            console.error('[FACES] Failed to load thumbnail for cluster', cluster.id, err);
          }
        }
      }
      setThumbnailUrls(newThumbnailUrls);
      
      result.forEach((cluster, idx) => {
        const info = {
          id: cluster.id,
          face_count: cluster.face_count,
          thumbnail_path: cluster.sample_thumbnail_path,
        };
        console.log(`[FACES] Cluster ${idx}:`, info);
        
        // Log to backend
        invoke('log_frontend_message', { 
          message: `[FACES] Cluster ${idx}: ${JSON.stringify(info)}` 
        });
      });
      
      setClusters(result);
    } catch (err) {
      console.error('[FACES] Error loading clusters:', err);
      await invoke('log_frontend_message', { 
        message: `[FACES] Error loading clusters: ${String(err)}` 
      });
      setError(String(err));
    }
    setLoading(false);
  };

  const handleClusterClick = async (clusterId: number) => {
    try {
      const faces = await invoke<Face[]>("get_cluster_faces", { clusterId });
      
      // Load thumbnails for all faces
      const newThumbnailUrls = new Map(thumbnailUrls);
      for (const face of faces) {
        if (face.thumbnail_path && !newThumbnailUrls.has(face.thumbnail_path)) {
          try {
            const dataUrl = await thumbnailToDataUrl(face.thumbnail_path);
            newThumbnailUrls.set(face.thumbnail_path, dataUrl);
          } catch (err) {
            console.error('[FACES] Failed to load face thumbnail', face.id, err);
          }
        }
      }
      setThumbnailUrls(newThumbnailUrls);
      
      setClusterFaces(faces);
      setSelectedCluster(clusterId);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleLabelSave = async (clusterId: number) => {
    if (!labelInput.trim()) {
      setEditingLabel(null);
      return;
    }

    try {
      await invoke("assign_face_label", { clusterId, label: labelInput.trim() });
      await loadClusters();
      setEditingLabel(null);
      setLabelInput("");
    } catch (err) {
      setError(String(err));
    }
  };

  const handleClearData = async () => {
    if (!confirm("Are you sure you want to clear all face data? This cannot be undone.")) {
      return;
    }

    try {
      await invoke("clear_face_data");
      setClusters([]);
      setClusterFaces([]);
      setSelectedCluster(null);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleRecluster = async () => {
    setClustering(true);
    setError("");
    
    try {
      console.log('[FACES] Starting re-clustering with threshold', localThreshold);
      await invoke('log_frontend_message', { 
        message: `[FACES] Starting re-clustering with threshold ${localThreshold}` 
      });
      
      const clusters = await invoke<FaceCluster[]>("cluster_faces", { threshold: localThreshold });
      
      console.log('[FACES] Re-clustering complete, created', clusters.length, 'clusters');
      await invoke('log_frontend_message', { 
        message: `[FACES] Re-clustering complete, created ${clusters.length} clusters` 
      });
      
      // Reload clusters
      await loadClusters();
    } catch (err) {
      console.error('[FACES] Re-clustering error:', err);
      await invoke('log_frontend_message', { 
        message: `[FACES] Re-clustering error: ${String(err)}` 
      });
      setError(String(err));
    }
    
    setClustering(false);
  };

  const handleScanForFaces = async () => {
    try {
      // Open directory picker
      const directory = await open({
        directory: true,
        multiple: false,
        title: "Select photo directory to scan",
      });

      if (!directory) {
        return; // User cancelled
      }

      setScanning(true);
      setScanProgress(null);
      setError("");

      // Start scanning
      const facesFound = await invoke<number>("process_directory_faces", {
        directoryPath: directory,
      });

      setScanning(false);
      setScanProgress(null);

      // Show success message
      alert(`Scan complete! Found ${facesFound} new faces.`);

      // Re-cluster faces with threshold from settings
      const threshold = settings.clustering_threshold || 0.6;
      await invoke("cluster_faces", { threshold });

      // Reload clusters
      await loadClusters();
    } catch (err) {
      setScanning(false);
      setScanProgress(null);
      setError(String(err));
    }
  };

  // If viewing a specific cluster
  if (selectedCluster !== null) {
    return (
      <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
        {/* Header */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => setSelectedCluster(null)}
                className="text-sm text-blue-600 dark:text-blue-500 hover:text-blue-700 dark:hover:text-blue-400 mb-2"
              >
                ← Back to all faces
              </button>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {clusters.find((c) => c.id === selectedCluster)?.label || "Unnamed Person"}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {clusterFaces.length} photos
              </p>
            </div>
          </div>
        </div>

        {/* Photo Grid */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {clusterFaces.map((face) => {
              // Get unique photos (group by image_path)
              const photoPath = face.image_path;
              const thumbnailSrc = thumbnailUrls.get(face.thumbnail_path);

              return (
                <div
                  key={face.id}
                  className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                  onClick={() => {
                    // TODO: Open lightbox with full image
                    console.log("Open photo:", photoPath);
                  }}
                >
                  {thumbnailSrc ? (
                    <img
                      src={thumbnailSrc}
                      alt={`Face ${face.id}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl">
                      👤
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-xs text-white truncate">
                      {photoPath.split("/").pop()}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Main clusters view
  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Face Groups
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {clusters.length} {clusters.length === 1 ? "person" : "people"} found
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleScanForFaces}
              disabled={scanning || clustering}
              className="px-4 py-2 text-sm bg-blue-600 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {scanning ? "Scanning..." : "Scan for Faces"}
            </button>
            <button
              onClick={handleRecluster}
              disabled={scanning || clustering}
              className="px-4 py-2 text-sm bg-green-600 dark:bg-green-600 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {clustering ? "Clustering..." : "Re-cluster"}
            </button>
            <button
              onClick={handleClearData}
              className="px-4 py-2 text-sm text-red-600 dark:text-red-500 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
              disabled={clusters.length === 0}
            >
              Clear All Data
            </button>
            <button
              onClick={() => navigate("/albums")}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Back to Albums
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          <button
            onClick={loadClusters}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
          
          {/* Clustering Threshold Slider */}
          <div className="flex-1 max-w-md">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Clustering:
              </label>
              <input
                type="range"
                min="0.3"
                max="0.8"
                step="0.05"
                value={localThreshold}
                onChange={(e) => setLocalThreshold(parseFloat(e.target.value))}
                className="flex-1"
              />
              <span className="text-sm font-semibold text-blue-600 dark:text-blue-500 w-12 text-center">
                {localThreshold.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-1">
              <span>Strict (more groups)</span>
              <span>Loose (fewer groups)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mt-4 bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 text-sm rounded-lg p-3 border border-red-200 dark:border-red-900">
          {error}
        </div>
      )}

      {/* Scanning Progress */}
      {scanning && scanProgress && (
        <div className="mx-6 mt-4 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 text-sm rounded-lg p-4 border border-blue-200 dark:border-blue-900">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Scanning for faces...</span>
            <span className="text-xs">
              {scanProgress.current} / {scanProgress.total}
            </span>
          </div>
          <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-2 mb-2">
            <div
              className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(scanProgress.current / scanProgress.total) * 100}%` }}
            ></div>
          </div>
          <p className="text-xs truncate text-blue-600 dark:text-blue-400">
            {scanProgress.image_path}
          </p>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500 dark:text-gray-400">Loading face groups...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !scanning && clusters.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md">
            <div className="text-6xl mb-4">👥</div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              No faces found
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Download albums with face processing enabled, or click "Scan for Faces" to process existing photos.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={handleScanForFaces}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-700 transition-colors"
              >
                Scan for Faces
              </button>
              <button
                onClick={() => navigate("/settings")}
                className="px-4 py-2 bg-gray-600 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-700 dark:hover:bg-gray-700 transition-colors"
              >
                Go to Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clusters Grid */}
      {!loading && !scanning && clusters.length > 0 && (
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {clusters.map((cluster) => {
              const isEditing = editingLabel === cluster.id;

              return (
                <div
                  key={cluster.id}
                  className="flex flex-col items-center group"
                >
                  {/* Face Thumbnail */}
                  <div
                    className="relative aspect-square w-full rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all mb-3"
                    onClick={() => handleClusterClick(cluster.id)}
                  >
                    {cluster.sample_thumbnail_path && thumbnailUrls.get(cluster.sample_thumbnail_path) ? (
                      <img
                        src={thumbnailUrls.get(cluster.sample_thumbnail_path)}
                        alt={cluster.label || "Face group"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          const path = cluster.sample_thumbnail_path || '';
                          console.error('[FACES] Failed to load image:', path);
                          console.error('[FACES] Image error:', e);
                          
                          // Log to backend
                          invoke('log_frontend_message', { 
                            message: `[FACES] Image load FAILED - Path: ${path}` 
                          });
                        }}
                        onLoad={() => {
                          const path = cluster.sample_thumbnail_path || '';
                          console.log('[FACES] Image loaded successfully:', path);
                          
                          // Log to backend
                          invoke('log_frontend_message', { 
                            message: `[FACES] Image load SUCCESS - Path: ${path}` 
                          });
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-6xl">
                        👤
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
                      {cluster.face_count}
                    </div>
                  </div>

                  {/* Label */}
                  {isEditing ? (
                    <div className="w-full">
                      <input
                        type="text"
                        value={labelInput}
                        onChange={(e) => setLabelInput(e.target.value)}
                        onBlur={() => handleLabelSave(cluster.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleLabelSave(cluster.id);
                          } else if (e.key === "Escape") {
                            setEditingLabel(null);
                            setLabelInput("");
                          }
                        }}
                        autoFocus
                        placeholder="Enter name"
                        className="w-full px-2 py-1 text-sm text-center border border-blue-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        console.log('[FACES] Label button clicked for cluster', cluster.id);
                        invoke('log_frontend_message', { 
                          message: `[FACES] Label button clicked for cluster ${cluster.id}` 
                        });
                        setEditingLabel(cluster.id);
                        setLabelInput(cluster.label || "");
                      }}
                      className="w-full text-sm text-center text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-500 font-medium transition-colors truncate px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      {cluster.label || "Click to name"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

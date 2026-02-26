import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type {
  Credentials,
  Kindergarten,
  Album,
  DownloadSettings,
  DownloadProgress,
  DownloadResult,
  AppPage,
} from "../types";
import { checkForUpdates } from "../utils/updater";

interface AppContextType {
  // Navigation
  page: AppPage;
  setPage: (page: AppPage) => void;

  // Auth
  credentials: Credentials | null;
  setCredentials: (creds: Credentials) => void;
  kindergartens: Kindergarten[];
  setKindergartens: (kids: Kindergarten[]) => void;
  selectedKid: Kindergarten | null;
  setSelectedKid: (kid: Kindergarten | null) => void;

  // Albums
  albums: Album[];
  setAlbums: (albums: Album[]) => void;
  selectedAlbumIds: Set<string>;
  toggleAlbum: (id: string) => void;
  selectAllAlbums: () => void;
  deselectAllAlbums: () => void;

  // Settings
  settings: DownloadSettings;
  setSettings: (settings: DownloadSettings) => void;

  // Download
  progressLog: DownloadProgress[];
  addProgress: (p: DownloadProgress) => void;
  clearProgress: () => void;
  result: DownloadResult | null;
  setResult: (r: DownloadResult | null) => void;
  isDownloading: boolean;
  setIsDownloading: (v: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<AppPage>("login");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [kindergartens, setKindergartens] = useState<Kindergarten[]>([]);
  const [selectedKid, setSelectedKid] = useState<Kindergarten | null>(null);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbumIds, setSelectedAlbumIds] = useState<Set<string>>(
    new Set()
  );
  const [settings, setSettings] = useState<DownloadSettings>({
    out_dir: "kidplan-albums",
    delay_ms: 200,
    limit_per_album: 0,
  });
  const [progressLog, setProgressLog] = useState<DownloadProgress[]>([]);
  const [result, setResult] = useState<DownloadResult | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  // Check for updates on app startup
  useEffect(() => {
    const checkUpdates = async () => {
      try {
        await checkForUpdates();
      } catch (err) {
        console.error("Update check failed:", err);
      }
    };
    
    checkUpdates();
  }, []);

  const toggleAlbum = useCallback((id: string) => {
    setSelectedAlbumIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllAlbums = useCallback(() => {
    setSelectedAlbumIds(new Set(albums.map((a) => a.id)));
  }, [albums]);

  const deselectAllAlbums = useCallback(() => {
    setSelectedAlbumIds(new Set());
  }, []);

  const addProgress = useCallback((p: DownloadProgress) => {
    setProgressLog((prev) => [...prev, p]);
  }, []);

  const clearProgress = useCallback(() => {
    setProgressLog([]);
  }, []);

  return (
    <AppContext.Provider
      value={{
        page,
        setPage,
        credentials,
        setCredentials,
        kindergartens,
        setKindergartens,
        selectedKid,
        setSelectedKid,
        albums,
        setAlbums,
        selectedAlbumIds,
        toggleAlbum,
        selectAllAlbums,
        deselectAllAlbums,
        settings,
        setSettings,
        progressLog,
        addProgress,
        clearProgress,
        result,
        setResult,
        isDownloading,
        setIsDownloading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

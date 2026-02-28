import { MemoryRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import LoginPage from "./pages/Login";
import AlbumsPage from "./pages/Albums";
import DownloadPage from "./pages/Download";
import SettingsPage from "./pages/Settings";
import ProtectedRoute from "./components/ProtectedRoute";
import PageTransition from "./components/PageTransition";

export default function App() {
  return (
    <AppProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<PageTransition><LoginPage /></PageTransition>} />
          <Route 
            path="/albums" 
            element={
              <ProtectedRoute>
                <PageTransition><AlbumsPage /></PageTransition>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/download" 
            element={
              <ProtectedRoute>
                <PageTransition><DownloadPage /></PageTransition>
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/settings" 
            element={
              <ProtectedRoute>
                <PageTransition><SettingsPage /></PageTransition>
              </ProtectedRoute>
            } 
          />
        </Routes>
      </MemoryRouter>
    </AppProvider>
  );
}

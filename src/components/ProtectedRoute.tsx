import { Navigate } from "react-router-dom";
import { useApp } from "../context/AppContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { credentials } = useApp();

  // If not authenticated, redirect to login
  if (!credentials) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isTeacherAuthenticated } from "../lib/auth";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();

  if (!isTeacherAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}


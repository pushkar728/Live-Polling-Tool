import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

// Wraps pages that need a logged-in user (creating/managing polls).
// Voting and viewing results stay public, so they're NOT wrapped in this.
export default function RequireAuth({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

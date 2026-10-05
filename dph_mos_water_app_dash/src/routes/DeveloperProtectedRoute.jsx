import { Navigate } from "react-router-dom";

export default function DeveloperProtectedRoute({ children }) {
  const user = JSON.parse(localStorage.getItem("loggedInUser"));

  if (!user) return <Navigate to="/" replace />;

  if (user.role !== "DEVELOPER" || user.module !== "developer") {
    return <Navigate to="/" replace />;
  }

  return children;
}

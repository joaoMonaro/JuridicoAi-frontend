import { getAuthSession } from "@/features/auth/auth-session";
import { CreateCasePage } from "@/pages/CreateCasePage";
import { CaseWorkspacePage } from "@/pages/CaseWorkspacePage";
import { LoginPage } from "@/pages/LoginPage";

const LOGIN_PATH = "/login";
const CREATE_CASE_PATH = "/casos/novo";
const CASE_WORKSPACE_PATH = /^\/casos\/([0-9a-f-]{36})$/i;

export function AppRouter() {
  const currentPath = window.location.pathname;

  if (currentPath === LOGIN_PATH) {
    return <LoginPage />;
  }

  const workspaceMatch = currentPath.match(CASE_WORKSPACE_PATH);

  if ((currentPath === CREATE_CASE_PATH || workspaceMatch) && !getAuthSession()) {
    const redirect = encodeURIComponent(`${currentPath}${window.location.search}`);
    window.history.replaceState(null, "", `${LOGIN_PATH}?redirect=${redirect}`);
    return <LoginPage />;
  }

  if (workspaceMatch) {
    return <CaseWorkspacePage caseId={workspaceMatch[1]} />;
  }

  if (currentPath === CREATE_CASE_PATH) {
    return <CreateCasePage />;
  }

  window.history.replaceState(null, "", LOGIN_PATH);
  return <LoginPage />;
}

import { CreateCasePage } from "@/pages/CreateCasePage";
import { CaseWorkspacePage } from "@/pages/CaseWorkspacePage";

const CREATE_CASE_PATH = "/casos/novo";
const CASE_WORKSPACE_PATH = /^\/casos\/([0-9a-f-]{36})$/i;

export function AppRouter() {
  const workspaceMatch = window.location.pathname.match(CASE_WORKSPACE_PATH);

  if (workspaceMatch) {
    return <CaseWorkspacePage caseId={workspaceMatch[1]} />;
  }

  if (window.location.pathname !== CREATE_CASE_PATH) {
    window.history.replaceState(null, "", CREATE_CASE_PATH);
  }

  return <CreateCasePage />;
}

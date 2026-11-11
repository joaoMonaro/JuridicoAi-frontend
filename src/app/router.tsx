import { lazy, Suspense } from "react";

import { useAppLocation } from "@/app/navigation";
import { getAuthSession } from "@/features/auth/auth-session";
import { CreateCasePage } from "@/pages/CreateCasePage";
import { CasesPage } from "@/pages/CasesPage";
import { CaseWorkspacePage } from "@/pages/CaseWorkspacePage";
import { LoginPage } from "@/pages/LoginPage";

const LOGIN_PATH = "/login";
const CASES_PATH = "/casos";
const CREATE_CASE_PATH = "/casos/novo";
const CASE_WORKSPACE_PATH = /^\/casos\/([0-9a-f-]{36})(?:\/(dados))?$/i;
const AssistantReviewSandboxPage = import.meta.env.DEV ? lazy(() => import("@/pages/AssistantReviewSandboxPage")) : null;

export function AppRouter() {
  const currentLocation = useAppLocation();
  const currentUrl = new URL(currentLocation, window.location.origin);
  const currentPath = currentUrl.pathname;
  const session = getAuthSession();

  if (AssistantReviewSandboxPage && currentPath === "/dev/revisao-peca") {
    return <Suspense fallback={<p>Carregando revisão...</p>}><AssistantReviewSandboxPage /></Suspense>;
  }

  if (currentPath === LOGIN_PATH) {
    if (session) {
      window.history.replaceState(null, "", CASES_PATH);
      return <CasesPage />;
    }
    return <LoginPage />;
  }

  const workspaceMatch = currentPath.match(CASE_WORKSPACE_PATH);

  if ((currentPath === CASES_PATH || currentPath === CREATE_CASE_PATH || workspaceMatch) && !session) {
    const redirect = encodeURIComponent(`${currentPath}${currentUrl.search}`);
    window.history.replaceState(null, "", `${LOGIN_PATH}?redirect=${redirect}`);
    return <LoginPage />;
  }

  if (workspaceMatch) {
    return <CaseWorkspacePage caseId={workspaceMatch[1]} section={workspaceMatch[2] === "dados" ? "dados" : "pecas"} />;
  }

  if (currentPath === CASES_PATH) {
    return <CasesPage />;
  }

  if (currentPath === CREATE_CASE_PATH) {
    return <CreateCasePage />;
  }

  if (session) {
    window.history.replaceState(null, "", CASES_PATH);
    return <CasesPage />;
  }

  window.history.replaceState(null, "", LOGIN_PATH);
  return <LoginPage />;
}

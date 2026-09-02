import type { ReactNode } from "react";

import { AppSidebar } from "@/components/shared/app-sidebar";
import type { AppSidebarSection } from "@/components/shared/app-sidebar";
import { AppTopbar } from "@/components/shared/app-topbar";

type AppLayoutProps = {
  children: ReactNode;
  sidebarActive?: AppSidebarSection;
};

export function AppLayout({ children, sidebarActive = "pecas" }: AppLayoutProps) {
  return (
    <div className="flex h-screen min-h-[620px] min-w-[1024px] flex-col overflow-hidden bg-background text-foreground">
      <AppTopbar />
      <div className="flex min-h-0 flex-1">
        <AppSidebar active={sidebarActive} />
        <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

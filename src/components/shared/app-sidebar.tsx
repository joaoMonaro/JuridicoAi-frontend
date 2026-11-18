import {
  BriefcaseBusiness,
  Database,
  FileStack,
  LayoutTemplate,
  Moon,
  Sun,
} from "lucide-react";

import { navigate } from "@/app/navigation";
import { useAppTheme } from "@/lib/app-theme";
import { cn } from "@/lib/utils";

export type AppSidebarSection = "dados" | "pecas" | "casos" | "modelos";

interface AppSidebarProps {
  active?: AppSidebarSection;
  onData?: () => void;
  onPecas?: () => void;
  onTemplates?: () => void;
}

export function AppSidebar({ active = "pecas", onData, onPecas, onTemplates }: AppSidebarProps) {
  const { theme, toggleTheme } = useAppTheme();
  const inCase = Boolean(onData || onPecas);

  const navigation = inCase
    ? [
        { id: "dados" as const, label: "Dados", icon: Database, onClick: onData },
        { id: "pecas" as const, label: "Peças", icon: FileStack, onClick: onPecas },
        { id: "modelos" as const, label: "Modelos", icon: LayoutTemplate, onClick: onTemplates },
      ]
    : [
        { id: "casos" as const, label: "Casos", icon: BriefcaseBusiness, onClick: () => navigate("/casos") },
        { id: "modelos" as const, label: "Modelos", icon: LayoutTemplate, onClick: onTemplates },
      ];

  const themeLabel = theme === "dark" ? "Tema claro" : "Tema escuro";
  const themeAriaLabel = theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro";

  return (
    <aside
      className="hidden min-h-0 w-14 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-1.5 py-3 md:flex min-[1400px]:w-52 min-[1400px]:px-2.5"
      aria-label="Navegação principal"
    >
      <nav className="flex flex-1 flex-col gap-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              type="button"
              className={cn(
                "flex h-9 w-full items-center justify-center rounded-md px-0 text-left text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring min-[1400px]:justify-start min-[1400px]:gap-2.5 min-[1400px]:px-3",
                isActive && "bg-sidebar-accent font-medium text-sidebar-primary shadow-[inset_2px_0_0_var(--sidebar-primary)]",
              )}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              title={item.label}
              onClick={item.onClick}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span className="hidden min-[1400px]:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border pt-2">
        <button
          type="button"
          className="flex h-9 w-full items-center justify-center rounded-md px-0 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring min-[1400px]:justify-start min-[1400px]:gap-2.5 min-[1400px]:px-3"
          aria-label={themeAriaLabel}
          title={themeAriaLabel}
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun className="size-4 shrink-0" aria-hidden="true" /> : <Moon className="size-4 shrink-0" aria-hidden="true" />}
          <span className="hidden min-[1400px]:inline">{themeLabel}</span>
        </button>
      </div>
    </aside>
  );
}

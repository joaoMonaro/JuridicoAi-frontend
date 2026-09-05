import {
  FileStack,
  FolderClosed,
  Gavel,
  LayoutTemplate,
  ListChecks,
  Scale,
  Settings,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navigation = [
  { id: "pecas", label: "Peças", icon: FileStack },
  { id: "jurisprudencia", label: "Jurisprudência", icon: Scale },
  { id: "modelos", label: "Modelos", icon: LayoutTemplate },
  { id: "pastas", label: "Pastas", icon: FolderClosed },
  { id: "audiencias", label: "Audiências", icon: Gavel },
  { id: "tarefas", label: "Tarefas", icon: ListChecks },
  { id: "clientes", label: "Clientes", icon: Users },
] as const;

export type AppSidebarSection = "pecas" | "casos" | "modelos";

interface AppSidebarProps { active?: AppSidebarSection; onTemplates?: () => void }

export function AppSidebar({ active = "pecas", onTemplates }: AppSidebarProps) {
  return (
    <aside className="hidden min-h-0 w-16 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-2 py-4 md:flex min-[1400px]:w-56 min-[1400px]:px-3" aria-label="Navegação principal">
      <nav className="flex flex-1 flex-col gap-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          const className = cn(
            "flex h-9 w-full items-center justify-center rounded-md px-0 text-left text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring min-[1400px]:justify-start min-[1400px]:gap-3 min-[1400px]:px-3",
            isActive && "bg-sidebar-accent text-sidebar-primary shadow-[inset_2px_0_0_var(--sidebar-primary)]",
          );

          if ("href" in item) {
            return (
              <a key={item.id} className={className} aria-current={isActive ? "page" : undefined} title={item.label} aria-label={item.label}>
                <Icon className="size-4" aria-hidden="true" />
                <span className="hidden min-[1400px]:inline">{item.label}</span>
              </a>
            );
          }

          return (
          <button
            key={item.id}
            type="button"
            className={className}
            aria-current={isActive ? "page" : undefined}
            aria-label={item.label}
            title={item.label}
            onClick={item.id === "modelos" ? onTemplates : undefined}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="hidden min-[1400px]:inline">{item.label}</span>
          </button>
          );
        })}
      </nav>

      <button
        type="button"
        className="flex h-9 items-center justify-center rounded-md px-0 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring min-[1400px]:justify-start min-[1400px]:gap-3 min-[1400px]:px-3"
        aria-label="Configurações"
        title="Configurações"
      >
        <Settings className="size-4" aria-hidden="true" />
        <span className="hidden min-[1400px]:inline">Configurações</span>
      </button>
    </aside>
  );
}

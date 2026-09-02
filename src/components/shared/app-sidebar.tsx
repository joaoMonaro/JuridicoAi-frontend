import {
  BriefcaseBusiness,
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
  { id: "casos", label: "Casos", icon: BriefcaseBusiness, href: "/casos" },
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
    <aside className="flex min-h-0 w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4" aria-label="Navegação principal">
      <nav className="flex flex-1 flex-col gap-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === active;
          const className = cn(
            "flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            isActive && "bg-sidebar-accent text-sidebar-primary shadow-[inset_2px_0_0_var(--sidebar-primary)]",
          );

          if ("href" in item) {
            return (
              <a key={item.id} href={item.href} className={className} aria-current={isActive ? "page" : undefined}>
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </a>
            );
          }

          return (
          <button
            key={item.id}
            type="button"
            className={className}
            aria-current={isActive ? "page" : undefined}
            onClick={item.id === "modelos" ? onTemplates : undefined}
          >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </button>
          );
        })}
      </nav>

      <button
        type="button"
        className="flex h-9 items-center gap-3 rounded-md px-3 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      >
        <Settings className="size-4" aria-hidden="true" />
        Configurações
      </button>
    </aside>
  );
}

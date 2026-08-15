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
  { label: "Peças", icon: FileStack, active: true },
  { label: "Casos", icon: BriefcaseBusiness, active: false },
  { label: "Jurisprudência", icon: Scale, active: false },
  { label: "Modelos", icon: LayoutTemplate, active: false },
  { label: "Pastas", icon: FolderClosed, active: false },
  { label: "Audiências", icon: Gavel, active: false },
  { label: "Tarefas", icon: ListChecks, active: false },
  { label: "Clientes", icon: Users, active: false },
] as const;

interface AppSidebarProps { active?: "pecas" | "modelos"; onTemplates?: () => void }

export function AppSidebar({ active = "pecas", onTemplates }: AppSidebarProps) {
  return (
    <aside className="flex min-h-0 w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 py-4" aria-label="Navegação principal">
      <nav className="flex flex-1 flex-col gap-1">
        {navigation.map(({ label, icon: Icon }) => {
          const isActive = label === "Peças" ? active === "pecas" : label === "Modelos" && active === "modelos";
          return (
          <button
            key={label}
            type="button"
            className={cn(
              "flex h-9 w-full items-center gap-3 rounded-md px-3 text-left text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
              isActive && "bg-sidebar-accent text-sidebar-primary shadow-[inset_2px_0_0_var(--sidebar-primary)]",
            )}
            aria-current={isActive ? "page" : undefined}
            onClick={label === "Modelos" ? onTemplates : undefined}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
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

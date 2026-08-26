import { useEffect, useMemo } from "react";
import {
  BarChart3,
  ClipboardCheck,
  Factory,
  FolderKanban,
  LayoutDashboard,
  Network,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";

export type SidebarItem = {
  id: string;
  label: string;
  icon?: string;
};

type Props = {
  brand?: string;
  items: SidebarItem[];
  activeId: string;
  onSelect: (id: string) => void;
};

/** Obsolete expansion preferences — cleared so they cannot affect layout. */
const OBSOLETE_STORAGE_KEYS = [
  "aios-dashboard-sidebar-expanded",
  "aios-dashboard-sidebar-mode",
] as const;

const ICON_BY_ROUTE: Record<string, LucideIcon> = {
  "command-center": LayoutDashboard,
  review: ClipboardCheck,
  "fcc-production": Factory,
  "fcc-portfolio": FolderKanban,
  "fcc-strategy": Target,
  "fcc-governance": ShieldCheck,
  "fcc-advisor": Sparkles,
  "fcc-reports": BarChart3,
  home: Network,
  settings: Settings,
};

/** Short labels for the narrow icon+label rail. Full names stay in a11y/tooltips. */
const RAIL_LABEL_BY_ROUTE: Record<string, string> = {
  "command-center": "Mission",
  review: "Review",
  "fcc-production": "Production",
  "fcc-portfolio": "Portfolio",
  "fcc-strategy": "Strategy",
  "fcc-governance": "Governance",
  "fcc-advisor": "Advisor",
  "fcc-reports": "Reports",
  home: "Operations",
  settings: "Settings",
};

const MAIN_IDS = [
  "command-center",
  "review",
  "fcc-production",
  "fcc-portfolio",
  "fcc-strategy",
  "fcc-governance",
  "fcc-advisor",
  "fcc-reports",
] as const;

const BOTTOM_IDS = ["home", "settings"] as const;

function clearObsoleteSidebarPreferences(): void {
  try {
    for (const key of OBSOLETE_STORAGE_KEYS) {
      window.localStorage.removeItem(key);
    }
  } catch {
    /* ignore */
  }
}

function NavButton({
  item,
  activeId,
  onSelect,
}: {
  item: SidebarItem;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const Icon = ICON_BY_ROUTE[item.id] ?? LayoutDashboard;
  const railLabel = RAIL_LABEL_BY_ROUTE[item.id] ?? item.label;
  const isActive = activeId === item.id;

  return (
    <button
      type="button"
      className="ds-sidebar-item"
      aria-current={isActive ? "page" : undefined}
      aria-label={item.label}
      title={item.label}
      onClick={() => onSelect(item.id)}
    >
      <span className="ds-sidebar-item-icon" aria-hidden>
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <span className="ds-sidebar-item-label">{railLabel}</span>
    </button>
  );
}

export function Sidebar({ brand = "A", items, activeId, onSelect }: Props) {
  useEffect(() => {
    clearObsoleteSidebarPreferences();
  }, []);

  const byId = useMemo(() => {
    const map = new Map<string, SidebarItem>();
    for (const item of items) map.set(item.id, item);
    return map;
  }, [items]);

  const mainItems = useMemo(
    () =>
      MAIN_IDS.map((id) => byId.get(id)).filter((item): item is SidebarItem =>
        Boolean(item),
      ),
    [byId],
  );

  const bottomItems = useMemo(
    () =>
      BOTTOM_IDS.map((id) => byId.get(id)).filter((item): item is SidebarItem =>
        Boolean(item),
      ),
    [byId],
  );

  const leftovers = useMemo(() => {
    const used = new Set<string>([...MAIN_IDS, ...BOTTOM_IDS]);
    return items.filter((item) => !used.has(item.id));
  }, [items]);

  return (
    <nav
      className="ds-sidebar is-rail"
      aria-label="AIOS founder navigation"
      data-mode="rail"
    >
      <div className="ds-sidebar-top">
        <div className="ds-sidebar-brand" aria-hidden>
          {brand}
        </div>
      </div>

      <div className="ds-sidebar-main" role="group" aria-label="Primary">
        {mainItems.map((item, index) => (
          <div key={item.id} className="ds-sidebar-slot">
            {index === 3 ? (
              <div className="ds-sidebar-divider" aria-hidden />
            ) : null}
            <NavButton item={item} activeId={activeId} onSelect={onSelect} />
          </div>
        ))}
        {leftovers.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            activeId={activeId}
            onSelect={onSelect}
          />
        ))}
      </div>

      <div className="ds-sidebar-bottom" role="group" aria-label="System">
        <div className="ds-sidebar-divider" aria-hidden />
        {bottomItems.map((item) => (
          <NavButton
            key={item.id}
            item={item}
            activeId={activeId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </nav>
  );
}

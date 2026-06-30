import { Outlet, NavLink } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Settings,
  Layers,
  Box,
  Cpu,
  Database,
  FileCode2,
  ShieldCheck,
  FolderKanban,
  BarChart3,
  HeartPulse,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from "lucide-react";
import { ThemeToggle } from "../features/theme/ThemeToggle";
import {
  NAV_PATH_TO_KEY,
  NAV_KEY_TO_PATH,
  FALLBACK_PRIORITY,
  useSidebarNav,
  type NavItemKey,
} from "../features/nav/config";
import { invoke } from "@tauri-apps/api/core";

type NavStatus = 'Beta' | 'Soon' | 'Ready' | 'Disabled';

interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  navKey: NavItemKey;
  status?: NavStatus;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { icon: LayoutDashboard, label: 'AI 工作台', path: '/', navKey: 'dashboard' },
      { icon: BarChart3, label: 'Analytics', path: '/analytics', navKey: 'analytics', status: 'Beta' },
      { icon: HeartPulse, label: 'Health Check', path: '/health', navKey: 'health', status: 'Beta' },
    ],
  },
  {
    label: 'Assets',
    items: [
      { icon: Layers, label: 'Skills', path: '/skills', navKey: 'skills', status: 'Beta' },
      { icon: Cpu, label: 'Agents', path: '/agents', navKey: 'agents', status: 'Beta' },
      { icon: Box, label: 'MCP', path: '/mcp', navKey: 'mcp', status: 'Beta' },
      { icon: Database, label: 'Memory', path: '/memory', navKey: 'memory', status: 'Beta' },
      { icon: FileCode2, label: 'Knowledge', path: '/knowledge', navKey: 'knowledge', status: 'Beta' },
    ],
  },
  {
    label: 'Work',
    items: [
      { icon: FolderKanban, label: 'Projects', path: '/projects', navKey: 'projects', status: 'Beta' },
      { icon: ShieldCheck, label: 'Proposals', path: '/proposals', navKey: 'proposals', status: 'Beta' },
    ],
  },
];

const badgeClass: Record<NavStatus, string> = {
  Beta: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  Soon: 'bg-muted text-muted-foreground/60',
  Ready: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Disabled: 'bg-destructive/10 text-destructive',
};

export default function AppShell() {
  const { visible, collapsed, saveCollapsed, loading } = useSidebarNav();
  const location = useLocation();
  const navigate = useNavigate();

  // Responsive: on mount, if collapsed setting does not exist, default to collapsed for window < 1200px
  useEffect(() => {
    if (loading) return;
    const checkResponsive = async () => {
      try {
        const raw = await invoke<string | null>('get_setting', { key: 'sidebar_collapsed' });
        if (raw === null && window.innerWidth < 1200) {
          saveCollapsed(true);
        }
      } catch {}
    };
    checkResponsive();
  }, [loading, saveCollapsed]);

  // Navigate fallback if current page gets hidden
  useEffect(() => {
    if (loading) return;
    if (location.pathname === '/settings') return;
    const currentKey = NAV_PATH_TO_KEY[location.pathname];
    if (currentKey && visible.has(currentKey)) return;
    const fallback = FALLBACK_PRIORITY.find(k => visible.has(k));
    if (fallback) {
      navigate(NAV_KEY_TO_PATH[fallback]);
    }
  }, [visible, loading, location.pathname, navigate]);

  // Filter groups
  const filteredGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => visible.has(item.navKey)),
    }))
    .filter(group => group.items.length > 0);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden selection:bg-primary/30 transition-colors duration-200">
      <aside
        className={`bg-sidebar border-r border-border flex flex-col h-full flex-shrink-0 transition-[width] duration-200 ease-in-out ${
          collapsed ? 'w-[72px]' : 'w-[280px]'
        }`}
      >
        {/* Header Branding Area */}
        <div className={`p-4 flex flex-col gap-4 ${collapsed ? 'items-center' : 'items-stretch'} shrink-0 border-b border-border/50`}>
          <div className="flex items-center justify-between min-w-0">
            {!collapsed ? (
              <div className="min-w-0">
                <h1 className="text-sm font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent truncate">
                  NoNo Harness
                </h1>
                <p className="text-[9px] text-muted-foreground/50 tracking-wide">Local · v0.1</p>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-[10px] text-primary shrink-0 select-none">
                NH
              </div>
            )}

            {!collapsed && (
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => saveCollapsed(true)}
                  className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title="收起侧边栏"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
                <ThemeToggle />
              </div>
            )}
          </div>

          {collapsed && (
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => saveCollapsed(false)}
                className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="展开侧边栏"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
              <ThemeToggle />
            </div>
          )}
        </div>

        {/* Navigation list */}
        <nav className="flex-1 py-4 overflow-y-auto space-y-4 px-3 select-none">
          {filteredGroups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <div className="px-3 mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/40">
                  {group.label}
                </div>
              )}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    title={collapsed ? `${item.label}${item.status ? ` · ${item.status}` : ''}` : ''}
                    className={({ isActive }) =>
                      `flex items-center rounded-lg transition-all duration-200 ${
                        collapsed
                          ? `justify-center w-10 h-10 mx-auto ${
                              isActive
                                ? 'bg-accent text-accent-foreground shadow-sm ring-1 ring-border/50'
                                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                            }`
                          : `gap-3 px-3 py-2 text-sm font-medium ${
                              isActive
                                ? 'bg-accent text-accent-foreground shadow-sm ring-1 ring-border/50'
                                : item.status === 'Soon'
                                  ? 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/30'
                                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                            }`
                      }`
                    }
                  >
                    <item.icon className="w-[18px] h-[18px] shrink-0" />
                    {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                    {!collapsed && item.status && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium leading-none ${badgeClass[item.status]}`}>
                        {item.status}
                      </span>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Settings at the bottom */}
        <div className={`p-3 border-t border-border flex ${collapsed ? 'justify-center' : 'justify-stretch'} shrink-0 select-none`}>
          <NavLink
            to="/settings"
            title={collapsed ? "Settings" : ""}
            className={({ isActive }) =>
              `flex items-center rounded-lg transition-all duration-200 ${
                collapsed
                  ? `justify-center w-10 h-10 mx-auto ${
                      isActive
                        ? 'bg-accent text-accent-foreground shadow-sm ring-1 ring-border/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    }`
                  : `gap-3 px-3 py-2 text-sm font-medium w-full ${
                      isActive
                        ? 'bg-accent text-accent-foreground shadow-sm ring-1 ring-border/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                    }`
              }`
            }
          >
            <Settings className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && <span className="flex-1 truncate">Settings</span>}
          </NavLink>
        </div>
      </aside>

      <main className="flex-1 min-w-0 bg-background/50 relative transition-colors duration-200">
        <Outlet />
      </main>
    </div>
  );
}

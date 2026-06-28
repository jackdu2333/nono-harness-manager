import { Outlet, NavLink } from "react-router-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { LayoutDashboard, Settings, Layers, Box, Cpu, Database, FileCode2, ShieldCheck, FolderKanban, BarChart3, HeartPulse, type LucideIcon } from "lucide-react";
import { ThemeToggle } from "../features/theme/ThemeToggle";
import {
  NAV_PATH_TO_KEY,
  NAV_KEY_TO_PATH,
  FALLBACK_PRIORITY,
  useSidebarNav,
  type NavItemKey,
} from "../features/nav/config";

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

// 子需求: 左侧菜单栏信息架构 — 分组 + status badge + 视觉弱化
const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', path: '/', navKey: 'dashboard' },
      { icon: BarChart3, label: 'Analytics', path: '/analytics', navKey: 'analytics', status: 'Soon' },
      { icon: HeartPulse, label: 'Health Check', path: '/health', navKey: 'health', status: 'Soon' },
    ],
  },
  {
    label: 'Assets',
    items: [
      { icon: Layers, label: 'Skills', path: '/skills', navKey: 'skills', status: 'Beta' },
      { icon: Cpu, label: 'Agents', path: '/agents', navKey: 'agents', status: 'Beta' },
      { icon: Box, label: 'MCP', path: '/mcp', navKey: 'mcp', status: 'Beta' },
      { icon: Database, label: 'Memory', path: '/memory', navKey: 'memory', status: 'Soon' },
      { icon: FileCode2, label: 'Knowledge', path: '/knowledge', navKey: 'knowledge', status: 'Soon' },
    ],
  },
  {
    label: 'Work',
    items: [
      { icon: FolderKanban, label: 'Projects', path: '/projects', navKey: 'projects', status: 'Soon' },
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
  const { visible, loading } = useSidebarNav();
  const location = useLocation();
  const navigate = useNavigate();

  // 当前页面被隐藏时自动跳转到第一个可见页面
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

  // 按配置过滤 navGroups
  const filteredGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => visible.has(item.navKey)),
    }))
    .filter(group => group.items.length > 0);

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden selection:bg-primary/30 transition-colors duration-200">
      <aside className="w-64 bg-sidebar border-r border-border flex flex-col h-full flex-shrink-0 transition-colors duration-200">
        <div className="p-6 flex items-center justify-between">
          <div className="min-w-0">
            <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent truncate">
              NoNo Harness
            </h1>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5 tracking-wide">Local · v0.1</p>
          </div>
          <ThemeToggle />
        </div>

        <nav className="flex-1 px-4 overflow-y-auto">
          {filteredGroups.map((group, groupIdx) => (
            <div key={group.label} className={groupIdx > 0 ? 'mt-4' : ''}>
              <div className="px-4 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-accent text-accent-foreground shadow-sm ring-1 ring-border/50'
                          : item.status === 'Soon'
                            ? 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/30'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                      }`
                    }
                  >
                    <item.icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.status && (
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

        <div className="p-4 border-t border-border">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-accent text-accent-foreground shadow-sm ring-1 ring-border/50'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`
            }
          >
            <Settings className="w-[18px] h-[18px]" />
            Settings
          </NavLink>
        </div>
      </aside>

      <main className="flex-1 min-w-0 bg-background/50 relative transition-colors duration-200">
        <Outlet />
      </main>
    </div>
  );
}

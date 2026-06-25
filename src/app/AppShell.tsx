import { Outlet, NavLink } from "react-router-dom";
import { LayoutDashboard, Settings, Layers, Box, Cpu, Database, FileCode2, ShieldCheck, FolderKanban, BarChart3, HeartPulse } from "lucide-react";
import { ThemeToggle } from "../features/theme/ThemeToggle";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: Cpu, label: "Agents", path: "/agents" },
  { icon: Layers, label: "Skills", path: "/skills" },
  { icon: Box, label: "MCP", path: "/mcp" },
  { icon: ShieldCheck, label: "Proposals", path: "/proposals" },
  { icon: Database, label: "Memory", path: "/memory" },
  { icon: FileCode2, label: "Knowledge", path: "/knowledge" },
  { icon: FolderKanban, label: "Projects", path: "/projects" },
  { icon: BarChart3, label: "Analytics", path: "/analytics" },
  { icon: HeartPulse, label: "Health Check", path: "/health" },
];

export default function AppShell() {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden selection:bg-primary/30 transition-colors duration-200">
      <aside className="w-64 bg-sidebar border-r border-border flex flex-col h-full flex-shrink-0 transition-colors duration-200">
        <div className="p-6 flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent truncate">
            NoNo Harness
          </h1>
          <ThemeToggle />
        </div>
        
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive 
                    ? "bg-accent text-accent-foreground shadow-sm ring-1 ring-border/50" 
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-border space-y-2">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive 
                  ? "bg-accent text-accent-foreground shadow-sm ring-1 ring-border/50" 
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`
            }
          >
            <Settings className="w-5 h-5" />
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

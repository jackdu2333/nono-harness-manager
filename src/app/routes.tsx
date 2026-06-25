import { Routes, Route } from "react-router-dom";
import AppShell from "./AppShell";

import SkillsPage from "../pages/Skills";
import AgentsPage from "../pages/Agents";
import SettingsPage from "../pages/Settings";

import McpPage from "../pages/Mcp";

const Placeholder = ({ title }: { title: string }) => (
  <div className="p-8 flex flex-col items-center justify-center h-full text-muted-foreground">
    <h2 className="text-2xl font-semibold mb-2 text-foreground">{title}</h2>
    <p>Coming Soon...</p>
  </div>
);

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />}>
        <Route index element={<Placeholder title="Dashboard" />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="mcp" element={<McpPage />} />
        <Route path="memory" element={<Placeholder title="Memory" />} />
        <Route path="knowledge" element={<Placeholder title="Knowledge" />} />
        <Route path="projects" element={<Placeholder title="Projects" />} />
        <Route path="analytics" element={<Placeholder title="Analytics" />} />
        <Route path="health" element={<Placeholder title="Health Check" />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

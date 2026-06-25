import { Routes, Route } from "react-router-dom";
import AppShell from "./AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import SkillsPage from "../pages/Skills";
import AgentsPage from "../pages/Agents";
import SettingsPage from "../pages/Settings";
import ProposalsPage from "../pages/Proposals";
import MemoryPage from "../pages/Memory";
import KnowledgePage from "../pages/Knowledge";
import ProjectsPage from "../pages/Projects";
import AnalyticsPage from "../pages/Analytics";
import HealthPage from "../pages/Health";

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
        <Route index element={<ErrorBoundary><Placeholder title="Dashboard" /></ErrorBoundary>} />
        <Route path="agents" element={<ErrorBoundary><AgentsPage /></ErrorBoundary>} />
        <Route path="skills" element={<SkillsPage />} />
        <Route path="mcp" element={<McpPage />} />
        <Route path="proposals" element={<ErrorBoundary><ProposalsPage /></ErrorBoundary>} />
        <Route path="memory" element={<ErrorBoundary><MemoryPage /></ErrorBoundary>} />
        <Route path="knowledge" element={<ErrorBoundary><KnowledgePage /></ErrorBoundary>} />
        <Route path="projects" element={<ErrorBoundary><ProjectsPage /></ErrorBoundary>} />
        <Route path="analytics" element={<ErrorBoundary><AnalyticsPage /></ErrorBoundary>} />
        <Route path="health" element={<ErrorBoundary><HealthPage /></ErrorBoundary>} />
        <Route path="settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
      </Route>
    </Routes>
  );
}

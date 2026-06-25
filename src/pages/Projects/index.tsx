import { useEffect, useMemo, useState } from 'react';
import { FolderOpen, Link2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { listAgents } from '@/features/agents/api';
import { listMcpServers } from '@/features/mcp/api';
import { listSkills } from '@/features/skills/api';
import {
  addProject,
  bindProjectResource,
  listKnowledgeBases,
  listMemorySources,
  listProjectBindings,
  listProjects,
  openLocalPath,
} from '@/features/local-assets/api';
import type { AssetOverview, ProjectBinding } from '@/features/local-assets/types';

interface BindableResource {
  id: string;
  name: string;
  type: string;
}

function formatTime(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '未记录';
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<AssetOverview[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bindings, setBindings] = useState<ProjectBinding[]>([]);
  const [resources, setResources] = useState<BindableResource[]>([]);
  const [name, setName] = useState('');
  const [path, setPath] = useState('/Users/jackdu/Documents/AGENT');
  const [description, setDescription] = useState('');
  const [resourceType, setResourceType] = useState('skill');
  const [resourceId, setResourceId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => projects.find(project => project.id === selectedId) ?? null,
    [projects, selectedId],
  );

  const filteredResources = useMemo(
    () => resources.filter(resource => resource.type === resourceType),
    [resources, resourceType],
  );

  const refreshResources = async () => {
    const [agents, skills, mcpServers, memories, knowledgeBases] = await Promise.all([
      listAgents(),
      listSkills(),
      listMcpServers(),
      listMemorySources(),
      listKnowledgeBases(),
    ]);
    setResources([
      ...agents.map(agent => ({ id: agent.id, name: agent.name, type: 'agent' })),
      ...skills.map(skill => ({ id: skill.id, name: skill.name, type: 'skill' })),
      ...mcpServers.map(server => ({ id: server.id, name: server.name, type: 'mcp_server' })),
      ...memories.map(memory => ({ id: memory.id, name: memory.name, type: 'memory_source' })),
      ...knowledgeBases.map(base => ({ id: base.id, name: base.name, type: 'knowledge_base' })),
    ]);
  };

  const refresh = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextProjects = await listProjects();
      setProjects(nextProjects);
      await refreshResources();
      const nextSelected = selectedId ?? nextProjects[0]?.id ?? null;
      setSelectedId(nextSelected);
      setBindings(nextSelected ? await listProjectBindings(nextSelected) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    setResourceId(filteredResources[0]?.id ?? '');
  }, [resourceType, resources.length]);

  const createProject = async () => {
    if (!name.trim()) return;
    setError(null);
    setIsLoading(true);
    try {
      const created = await addProject(name.trim(), path.trim() || null, description.trim() || null);
      setName('');
      setDescription('');
      const nextProjects = await listProjects();
      setProjects(nextProjects);
      setSelectedId(created.id);
      setBindings(await listProjectBindings(created.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const selectProject = async (id: string) => {
    setSelectedId(id);
    setError(null);
    try {
      setBindings(await listProjectBindings(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const bindResource = async () => {
    if (!selectedId || !resourceId) return;
    setError(null);
    try {
      await bindProjectResource(selectedId, resourceType, resourceId);
      setBindings(await listProjectBindings(selectedId));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="h-full overflow-auto bg-background p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">按项目组织 Agent、Skills、MCP、Memory 与 Knowledge。</p>
        </div>
        <Button variant="outline" onClick={refresh} disabled={isLoading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          刷新
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <section className="mb-5 grid grid-cols-[220px_1fr_1fr_auto] gap-3">
        <Input value={name} onChange={event => setName(event.target.value)} placeholder="项目名称" />
        <Input value={path} onChange={event => setPath(event.target.value)} placeholder="代码仓库或项目目录" />
        <Input value={description} onChange={event => setDescription(event.target.value)} placeholder="项目说明" />
        <Button onClick={createProject} disabled={isLoading || !name.trim()}>添加项目</Button>
      </section>

      <div className="grid grid-cols-[360px_1fr] gap-5">
        <section className="min-h-[520px] border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-semibold">项目</div>
          {projects.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">尚未添加项目。</div>
          ) : (
            projects.map(project => (
              <button
                key={project.id}
                onClick={() => selectProject(project.id)}
                className={`block w-full border-b border-border px-4 py-3 text-left last:border-b-0 ${
                  selectedId === project.id ? 'bg-accent' : 'hover:bg-muted/60'
                }`}
              >
                <div className="truncate text-sm font-medium text-foreground">{project.name}</div>
                <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{project.path ?? '未绑定路径'}</div>
                <div className="mt-2 text-xs text-muted-foreground">更新：{formatTime(project.updated_at)}</div>
              </button>
            ))
          )}
        </section>

        <section className="min-h-[520px] border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-foreground">{selected?.name ?? '项目资源'}</div>
              <div className="mt-1 text-xs text-muted-foreground">{selected?.description ?? '选择项目后绑定资源。'}</div>
            </div>
            {selected?.path && (
              <Button variant="outline" size="sm" onClick={() => openLocalPath(selected.path!)}>
                <FolderOpen className="mr-2 h-4 w-4" />
                Finder
              </Button>
            )}
          </div>

          <div className="flex gap-2 border-b border-border px-4 py-3">
            <select
              value={resourceType}
              onChange={event => setResourceType(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="agent">Agent</option>
              <option value="skill">Skill</option>
              <option value="mcp_server">MCP</option>
              <option value="memory_source">Memory</option>
              <option value="knowledge_base">Knowledge</option>
            </select>
            <select
              value={resourceId}
              onChange={event => setResourceId(event.target.value)}
              className="h-9 min-w-[260px] rounded-md border border-input bg-background px-3 text-sm"
            >
              {filteredResources.map(resource => (
                <option key={resource.id} value={resource.id}>{resource.name}</option>
              ))}
            </select>
            <Button onClick={bindResource} disabled={!selectedId || !resourceId}>
              <Link2 className="mr-2 h-4 w-4" />
              绑定
            </Button>
          </div>

          {bindings.length === 0 ? (
            <div className="px-4 py-6 text-sm text-muted-foreground">当前项目尚未绑定资源。</div>
          ) : (
            <div className="max-h-[560px] overflow-auto">
              {bindings.map(binding => (
                <div key={binding.id} className="grid grid-cols-[150px_1fr_180px] gap-4 border-b border-border px-4 py-3 text-sm">
                  <div className="text-muted-foreground">{binding.resource_type}</div>
                  <div className="truncate text-foreground">{binding.resource_name ?? binding.resource_id}</div>
                  <div className="text-muted-foreground">{formatTime(binding.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

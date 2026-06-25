#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const manifestPath = new URL('../src-tauri/Cargo.toml', import.meta.url).pathname;

function runCli(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('cargo', ['run', '--quiet', '--manifest-path', manifestPath, '--bin', 'harness_cli', '--', ...args], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('close', code => {
      if (code === 0) {
        resolve(stdout ? JSON.parse(stdout) : {});
      } else {
        reject(new Error(stderr || `harness_cli exited with ${code}`));
      }
    });
  });
}

function respond(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}

function fail(id, error) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message: error.message } })}\n`);
}

const tools = [
  {
    name: 'harness_list_resources',
    description: 'List Harness resources. Read-only.',
    inputSchema: {
      type: 'object',
      properties: { resource_type: { type: 'string', enum: ['skill', 'mcp_server'] } },
    },
  },
  {
    name: 'harness_get_resource_context',
    description: 'Get safe, redacted context for one Harness resource. Read-only.',
    inputSchema: {
      type: 'object',
      required: ['resource_type', 'resource_id'],
      properties: {
        resource_type: { type: 'string', enum: ['skill', 'mcp_server'] },
        resource_id: { type: 'string' },
      },
    },
  },
  {
    name: 'harness_create_proposal',
    description: 'Create a pending intelligence proposal. Does not apply changes.',
    inputSchema: {
      type: 'object',
      required: ['resource_type', 'resource_id', 'proposal_type', 'proposed_changes'],
      properties: {
        resource_type: { type: 'string', enum: ['skill', 'mcp_server'] },
        resource_id: { type: 'string' },
        proposal_type: { type: 'string' },
        proposed_changes: { type: 'object' },
      },
    },
  },
];

async function handle(request) {
  const { id, method, params = {} } = request;
  try {
    if (method === 'initialize') {
      respond(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'nono-harness-manager', version: '0.1.0' },
      });
      return;
    }

    if (method === 'tools/list') {
      respond(id, { tools });
      return;
    }

    if (method === 'tools/call') {
      const { name, arguments: input = {} } = params;
      let result;
      if (name === 'harness_list_resources') {
        result = await runCli(['list', input.resource_type].filter(Boolean));
      } else if (name === 'harness_get_resource_context') {
        result = await runCli(['context', input.resource_type, input.resource_id]);
      } else if (name === 'harness_create_proposal') {
        result = await runCli([
          'propose',
          input.resource_type,
          input.resource_id,
          input.proposal_type,
          JSON.stringify(input.proposed_changes),
        ]);
      } else {
        throw new Error(`Unknown tool: ${name}`);
      }
      respond(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
      return;
    }

    respond(id, {});
  } catch (error) {
    fail(id, error);
  }
}

const rl = createInterface({ input: process.stdin });
rl.on('line', line => {
  if (!line.trim()) return;
  handle(JSON.parse(line));
});

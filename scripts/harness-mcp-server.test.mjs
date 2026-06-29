import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function callServer(messages) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/harness-mcp-server.mjs'], {
      cwd: projectRoot,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(stderr || `MCP server exited with ${code}`));
        return;
      }

      const responses = stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => JSON.parse(line));
      resolve(responses);
    });

    for (const message of messages) {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    }
    child.stdin.end();
  });
}

test('handles initialized notification without response and responds to ping', async () => {
  const responses = await callServer([
    { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
    { jsonrpc: '2.0', method: 'notifications/initialized', params: {} },
    { jsonrpc: '2.0', id: 2, method: 'ping', params: {} },
  ]);

  assert.equal(responses.length, 2);
  assert.equal(responses[0].id, 1);
  assert.equal(responses[1].id, 2);
  assert.deepEqual(responses[1].result, {});
});

test('exposes agent as a supported MCP resource type', async () => {
  const responses = await callServer([
    { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
  ]);

  const tools = responses[0].result.tools;
  for (const toolName of [
    'harness_list_resources',
    'harness_get_resource_context',
    'harness_create_proposal',
  ]) {
    const tool = tools.find(item => item.name === toolName);
    assert.ok(tool, `${toolName} should be listed`);
    assert.ok(
      tool.inputSchema.properties.resource_type.enum.includes('agent'),
      `${toolName} should support agent resources`,
    );
  }
});

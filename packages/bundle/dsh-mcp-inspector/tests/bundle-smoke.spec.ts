/**
 * Bundle smoke test for @yeisme/dsh-mcp-inspector.
 *
 * Asserts the re-exported client plugin surface that the browser entry
 * ships. The ModuleLoader banner face is validated by check:bundles;
 * behavior lives in @yeisme/dsh-client-ui-mcp-inspector and is covered by
 * its own suite. Reaches the client source through a relative import so
 * the banner does not execute outside the loader.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  apply,
  inject,
  McpInspectorView,
  name,
  deriveMcpActivity,
  splitMcpToolName,
  filterCatalog,
} from '../../../client/ui-mcp-inspector/src/client/index.ts';

describe('dsh-mcp-inspector bundle entry', () => {
  it('re-exports the client plugin surface', () => {
    expect(apply).toBeTypeOf('function');
    expect(McpInspectorView).toBeDefined();
    expect(deriveMcpActivity).toBeTypeOf('function');
    expect(splitMcpToolName).toBeTypeOf('function');
    expect(name).toBe('client-ui-mcp-inspector');
    expect(filterCatalog).toBeTypeOf('function');
  });

  it('declares the slot and locale injects', () => {
    expect(inject).toEqual(['slots', 'locale']);
  });

  it('ships a self-contained Host face so the toolHub Remote is not dropped', () => {
    const entry = resolve(process.cwd(), 'lib/index.js');
    const built = readFileSync(entry, 'utf8');
    expect(built).toContain('ToolHubRemoteService');
    expect(built).not.toMatch(/from ["']@yeisme\/dsh-tool-hub-host["']/u);
    expect(built).toMatch(/from ["']@deepseek-ai\/dsh-typert-protocol["']/u);
    expect(built).not.toMatch(/^\s*@Remote\b/mu);
    expect(() => execFileSync(process.execPath, ['--check', entry], { stdio: 'pipe' })).not.toThrow();
  });
});

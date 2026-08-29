/**
 * Bind the live slash runtime to a Cordis-like context.
 * Missing pane, commands, or conversation seams fail closed.
 */

import {
  createSlashRuntime,
  syncInspectRegistrations,
  type HostCommandProjection,
  type SlashHostCommands,
  type SlashPaneWorkbench,
  type SlashPluginRecord,
  type SlashRuntime,
} from '@yeisme/dsh-client-ui-command-experience-core';

export interface SlashBindContext {
  get(name: string): unknown;
  provide?(name: string, value: unknown): void;
  registry?: { keys?: () => Iterable<unknown> };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function asPaneWorkbench(value: unknown): SlashPaneWorkbench | undefined {
  if (!isRecord(value) || !isRecord(value.views) || !isRecord(value.commands)) return undefined;
  if (typeof value.views.snapshot !== 'function' || typeof value.views.subscribe !== 'function') return undefined;
  if (typeof value.commands.snapshot !== 'function' || typeof value.commands.subscribe !== 'function') return undefined;
  if (typeof value.commands.execute !== 'function' || typeof value.openView !== 'function') return undefined;
  return value as unknown as SlashPaneWorkbench;
}

function pluginRecords(ctx: SlashBindContext): SlashPluginRecord[] {
  const fromGet = ctx.get('plugins');
  if (Array.isArray(fromGet)) {
    return fromGet.map((item): SlashPluginRecord => {
      if (typeof item === 'string') return { id: item };
      if (isRecord(item) && typeof item.id === 'string') {
        return { id: item.id, ...(typeof item.status === 'string' ? { status: item.status } : {}) };
      }
      return { id: 'unknown' };
    }).filter((item) => item.id !== 'unknown');
  }
  // Official plugin inventory seam: the cordis loader's entry table is the
  // same source @deepseek-ai/dsh-host-plugin-inventory projects. Surface
  // probes (`/mcp`, `/skills`) and `/plugins` depend on it.
  const loaderEntries = (ctx as { readonly loader?: { readonly entries?: () => Iterable<unknown> } }).loader?.entries?.();
  if (loaderEntries !== undefined) {
    const records: SlashPluginRecord[] = [];
    for (const entry of loaderEntries) {
      if (!isRecord(entry)) continue;
      if (typeof entry.id === 'string' && entry.id.length > 0) {
        records.push({ id: entry.id, ...(typeof entry.phase === 'string' ? { status: entry.phase } : {}) });
      }
      if (typeof entry.name === 'string' && entry.name.length > 0 && entry.name !== entry.id) {
        records.push({ id: entry.name });
      }
    }
    if (records.length > 0) return records;
  }
  const keys = ctx.registry?.keys?.();
  if (keys === undefined) return [];
  return [...keys]
    .filter((id): id is string => typeof id === 'string')
    .map((id) => ({ id, status: 'loaded' }));
}

function hasPlugin(ctx: SlashBindContext, fragment: string): boolean {
  return pluginRecords(ctx).some((plugin) => plugin.id.includes(fragment));
}

function asHostCommands(value: unknown): SlashHostCommands | undefined {
  if (!isRecord(value) || typeof value.list !== 'function') return undefined;
  const list = value.list.bind(value) as (agent?: unknown) => readonly { readonly name: string; readonly description: string; readonly input?: { readonly hint?: string } }[];
  const subscribe = typeof value.subscribe === 'function'
    ? (listener: () => void): (() => void) => (value.subscribe as (listener: () => void) => () => void)(listener)
    : undefined;
  const execute = typeof value.execute === 'function'
    ? (name: string, input: string): unknown => (value.execute as (agent: unknown, line: string, signal: AbortSignal) => unknown)({}, `/${name} ${input}`.trim(), new AbortController().signal)
    : undefined;
  return {
    snapshot: () => {
      try {
        return list({}).map((command): HostCommandProjection => ({
          name: command.name,
          description: command.description,
          ...(command.input?.hint === undefined ? {} : { inputHint: command.input.hint }),
        }));
      } catch {
        return [];
      }
    },
    ...(subscribe === undefined ? {} : { subscribe }),
    ...(execute === undefined ? {} : { execute }),
  };
}

export function bindSlashRuntime(ctx: SlashBindContext): { readonly runtime: SlashRuntime; readonly dispose: () => void } {
  const paneWorkbench = asPaneWorkbench(ctx.get('paneWorkbench'));
  const hostCommands = asHostCommands(ctx.get('commands'));
  const runtime = createSlashRuntime({
    ...(paneWorkbench === undefined ? {} : { paneWorkbench }),
    ...(hostCommands === undefined ? {} : { hostCommands }),
    conversationViews: {
      has: (id) => id === 'mcp-inspector' && hasPlugin(ctx, 'mcp-inspector'),
      activate: (id) => {
        const conversation = ctx.get('conversation');
        if (isRecord(conversation) && typeof conversation.setActiveView === 'function') {
          (conversation.setActiveView as (id: string) => void)(id);
          return true;
        }
        const layout = ctx.get('layout');
        if (isRecord(layout) && typeof layout.setConversationView === 'function') {
          (layout.setConversationView as (id: string) => void)(id);
          return true;
        }
        return false;
      },
    },
    plugins: () => pluginRecords(ctx),
  });
  ctx.provide?.('slashDirectory', runtime);
  const commands = ctx.get('commands');
  const unbindCommands = isRecord(commands) && typeof commands.register === 'function'
    ? syncInspectRegistrations(runtime, (definition) => {
      // Yield to any name the official registry already serves: duplicates
      // throw hard, and a hot-plug bundle must never fail another plugin.
      if (typeof (commands as { find?: unknown }).find === 'function'
        && ((commands as { find: (agent: unknown, name: string) => unknown }).find({}, definition.name)) !== undefined) {
        return () => {};
      }
      try {
        return (commands.register as (input: {
          readonly name: string;
          readonly description: string;
          readonly input?: { readonly hint: string };
          readonly recordInput: false;
          readonly handler: (invocation: { readonly rawInput: string }) => { readonly kind: 'success' | 'error'; readonly text: string };
        }) => () => void)({
          name: definition.name,
          description: definition.description,
          ...(definition.inputHint === undefined ? {} : { input: { hint: definition.inputHint } }),
          recordInput: false,
          handler: (invocation) => definition.handler(invocation.rawInput),
        });
      } catch {
        return () => {};
      }
    })
    : () => {};

  return {
    runtime,
    dispose: () => {
      unbindCommands();
      runtime.dispose();
    },
  };
}

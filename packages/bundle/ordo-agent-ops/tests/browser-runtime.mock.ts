/**
 * Test-only façade for DSH browser factory externals. Published `./client`
 * entries are loader handoffs, so plain Vitest cannot import them as Node ESM.
 * This fixture implements only the public seats that Ordo Agent Ops consumes.
 */

import { Service, type Context } from '@deepseek-ai/cordis'
import { createElement, type ComponentProps } from 'react'

type Listener = () => void

export function createSnapshotStore<T>(initial: T) {
  let snapshot = initial
  const listeners = new Set<Listener>()
  return {
    getSnapshot: (): T => snapshot,
    set: (next: T): void => {
      snapshot = next
      for (const listener of [...listeners]) listener()
    },
    subscribe: (listener: Listener): (() => void) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

type StoredSlotEntry = {
  readonly name: string
  readonly inject?: unknown
  readonly component?: unknown
  readonly [key: string]: unknown
}

/** Minimal slot registry with caller-fiber ownership, matching the DSH service contract used here. */
export class SlotRegistry extends Service {
  private readonly entriesByName = new Map<string, StoredSlotEntry[]>()

  constructor(ctx: Context) {
    super(ctx, 'slots')
  }

  register(entry: StoredSlotEntry, component?: unknown): () => void {
    const rows = this.entriesByName.get(entry.name) ?? []
    this.entriesByName.set(entry.name, rows)
    const stored = { ...entry, component }
    const remove = (): void => {
      const index = rows.indexOf(stored)
      if (index >= 0) rows.splice(index, 1)
    }
    this.ctx.effect(() => remove, `test slot: ${entry.name}`)
    rows.push(stored)
    return remove
  }

  inject(_name: string, callback: () => (() => void) | void): () => void {
    return callback() ?? (() => undefined)
  }

  entries(name: string): readonly StoredSlotEntry[] {
    return this.entriesByName.get(name) ?? []
  }
}

export class LocaleRuntime {
  constructor(_ctx: Context) {}

  register(_namespace: string, _dictionaries: unknown): () => void {
    return () => undefined
  }
}

const icon = (name: string) => (props: ComponentProps<'svg'> & { readonly size?: number }) =>
  createElement('svg', { ...props, 'data-test-icon': name, width: props.size, height: props.size })

export const IconAgentPresetOutline16 = icon('agent')
export const IconRefreshOutline16 = icon('refresh')
export const IconWarningOutline16 = icon('warning')
export const StateDot = ({ state }: { readonly state: string }) =>
  createElement('span', { 'data-test-state-dot': state })

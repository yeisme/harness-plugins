/**
 * Workbench Command Palette.
 *
 * A lightweight, accessible command runner. It receives Workbench commands
 * from the registry, groups them by module, tracks recently used commands,
 * filters by query, and supports keyboard navigation.
 * It does not execute commands itself; execution is delegated to the owner.
 *
 * @module @yeisme/dsh-workbench-core/client
 */

import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import type { WorkbenchCommandV1 } from '../types.ts'

export interface CommandPaletteProps {
  commands: readonly WorkbenchCommandV1[]
  onRunCommand: (commandId: string) => void
  onClose: () => void
  /** Optional display labels for module groups. */
  groupLabels?: Record<string, string> | undefined
  /** Optional localized recent-commands heading. */
  recentLabel?: string | undefined
}

interface CommandSection {
  label: string
  commands: readonly WorkbenchCommandV1[]
}

const styles: Record<'overlay' | 'panel' | 'input' | 'list' | 'item' | 'active' | 'group' | 'empty', CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, zIndex: 1000, display: 'grid', placeItems: 'start center', paddingTop: 80, background: 'color-mix(in srgb, var(--dsh-color-layer, #0b0f14) 60%, transparent)' },
  panel: { width: 'min(520px, calc(100vw - 32px))', display: 'grid', gap: 4, padding: 8, borderRadius: 8, border: '1px solid var(--dsh-color-border, #3d4550)', background: 'var(--dsh-color-layer, #18202b)' },
  input: { minHeight: 32, padding: '0 8px', borderRadius: 6, border: '1px solid var(--dsh-color-border, #3d4550)', background: 'transparent', color: 'inherit' },
  list: { display: 'grid', gap: 2, maxHeight: 280, overflow: 'auto' },
  item: { display: 'flex', alignItems: 'center', gap: 8, minHeight: 30, padding: '0 8px', borderRadius: 6, borderWidth: 1, borderStyle: 'solid', borderColor: 'transparent', background: 'transparent', color: 'inherit', textAlign: 'left', cursor: 'pointer' },
  active: { borderColor: 'var(--dsh-color-border, #3d4550)', background: 'var(--dsh-color-layer-2, #202b38)' },
  group: { padding: '6px 8px 2px', fontSize: 11, fontWeight: 600, opacity: 0.68, textTransform: 'uppercase', letterSpacing: 0.04 },
  empty: { padding: 8, opacity: 0.72 },
}

function groupCommands(
  commands: readonly WorkbenchCommandV1[],
  groupLabels: Record<string, string> | undefined,
): CommandSection[] {
  const groups = new Map<string, WorkbenchCommandV1[]>()
  for (const command of commands) {
    const label = groupLabels?.[command.moduleId] ?? command.moduleId
    const list = groups.get(label) ?? []
    list.push(command)
    groups.set(label, list)
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, list]) => ({ label, commands: list }))
}

function buildSections(
  filtered: readonly WorkbenchCommandV1[],
  recentIds: readonly string[],
  groupLabels: Record<string, string> | undefined,
  showRecent: boolean,
): CommandSection[] {
  if (!showRecent || recentIds.length === 0) {
    return groupCommands(filtered, groupLabels)
  }
  const recent = new Set(recentIds)
  const recentCommands = filtered.filter(command => recent.has(command.id))
  const rest = filtered.filter(command => !recent.has(command.id))
  const sections: CommandSection[] = []
  if (recentCommands.length > 0) sections.push({ label: 'Recent', commands: recentCommands })
  sections.push(...groupCommands(rest, groupLabels))
  return sections
}

/** Accessible command palette with query filter, grouping, and recent use. */
export function CommandPalette({ commands, onRunCommand, onClose, groupLabels, recentLabel = 'Recent' }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [recentIds, setRecentIds] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length === 0) return commands
    return commands.filter(command => command.title.toLowerCase().includes(q) || command.id.toLowerCase().includes(q))
  }, [commands, query])

  const sections = useMemo(
    () => buildSections(filtered, recentIds, groupLabels, query.trim().length === 0),
    [filtered, recentIds, groupLabels, query],
  )

  const optionCommands = useMemo(
    () => sections.flatMap(section => section.commands),
    [sections],
  )

  const markRecent = (commandId: string): void => {
    setRecentIds(ids => [commandId, ...ids.filter(id => id !== commandId)].slice(0, 8))
  }

  const run = (commandId: string): void => {
    markRecent(commandId)
    onRunCommand(commandId)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(index => Math.min(index + 1, Math.max(optionCommands.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(index => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter' && optionCommands[activeIndex] !== undefined) {
      event.preventDefault()
      run(optionCommands[activeIndex]!.id)
    }
  }

  return (
    <div style={styles.overlay} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div style={styles.panel} role="dialog" aria-modal="true" aria-label="Workbench commands" onKeyDown={handleKeyDown}>
        <input
          ref={inputRef}
          style={styles.input}
          autoFocus
          placeholder="Type a command…"
          value={query}
          onChange={event => { setQuery(event.target.value); setActiveIndex(0) }}
        />
        <div style={styles.list} role="listbox" aria-label="Commands">
          {optionCommands.length === 0 && <div style={styles.empty}>No commands match.</div>}
          {sections.map(section => (
            <div key={section.label}>
              <div style={styles.group} role="presentation">{section.label === 'Recent' ? recentLabel : section.label}</div>
              {section.commands.map(command => {
                const globalIndex = optionCommands.findIndex(candidate => candidate.id === command.id)
                return (
                  <button
                    key={command.id}
                    type="button"
                    role="option"
                    aria-selected={globalIndex === activeIndex}
                    style={globalIndex === activeIndex ? { ...styles.item, ...styles.active } : styles.item}
                    onMouseEnter={() => { setActiveIndex(globalIndex) }}
                    onClick={() => { run(command.id) }}
                  >
                    <span>{command.title}</span>
                    {command.shortcutHint !== undefined && <span style={{ opacity: 0.6 }}>{command.shortcutHint}</span>}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default CommandPalette

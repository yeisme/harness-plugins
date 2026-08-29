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

import { useMemo, useState, type KeyboardEvent } from 'react'
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface } from '@yeisme/dsh-client-ui-surface'
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

const styles = `
[data-dsh-command-palette]{width:min(520px,calc(100vw - 32px));min-height:0}
[data-dsh-command-palette] .wcp-body{display:grid;gap:4px;padding:8px}
[data-dsh-command-palette] .wcp-list{display:grid;gap:2px;max-height:280px;overflow:auto}
[data-dsh-command-palette] .wcp-item{display:flex;width:100%;justify-content:space-between;text-align:left}
[data-dsh-command-palette] .wcp-item[aria-selected='true']{background:var(--vk-fill-selected);border-color:var(--vk-border-l2)}
[data-dsh-command-palette] .wcp-group{padding:6px 8px 2px;color:var(--vk-text-tertiary);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
[data-dsh-command-palette] .wcp-shortcut{opacity:.6}
[data-dsh-command-palette] .wcp-empty{padding:8px;color:var(--vk-text-tertiary)}
`

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
    <Modal open onClose={onClose} title="Workbench commands" closeLabel="Close command palette" headless>
      <Surface kind="dialog" data-dsh-command-palette onKeyDown={handleKeyDown}>
        <style>{styles}</style>
        <div className="wcp-body">
        <Input
          autoFocus
          placeholder="Type a command…"
          value={query}
          onChange={event => { setQuery(event.target.value); setActiveIndex(0) }}
        />
        <div className="wcp-list" role="listbox" aria-label="Commands">
          {optionCommands.length === 0 && <div className="wcp-empty">No commands match.</div>}
          {sections.map(section => (
            <div key={section.label}>
              <div className="wcp-group" role="presentation">{section.label === 'Recent' ? recentLabel : section.label}</div>
              {section.commands.map(command => {
                const globalIndex = optionCommands.findIndex(candidate => candidate.id === command.id)
                return (
                  <Button
                    key={command.id}
                    type="button"
                    size="sm"
                    variant="toolbar"
                    className="wcp-item"
                    role="option"
                    aria-selected={globalIndex === activeIndex}
                    onMouseEnter={() => { setActiveIndex(globalIndex) }}
                    onClick={() => { run(command.id) }}
                  >
                    <span>{command.title}</span>
                    {command.shortcutHint !== undefined && <span className="wcp-shortcut">{command.shortcutHint}</span>}
                  </Button>
                )
              })}
            </div>
          ))}
        </div>
        </div>
      </Surface>
    </Modal>
  )
}

export default CommandPalette

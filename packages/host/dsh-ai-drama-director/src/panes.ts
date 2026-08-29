/**
 * Director client registration: command group, first-support panes,
 * secondary panes, default preset, and dispose.
 */

export const DRAMA_COMMAND_GROUP = 'drama' as const

export const DRAMA_FIRST_SUPPORT_PANES = ['Context', 'Review', 'Run'] as const
export const DRAMA_SECONDARY_PANES = ['Story', 'Visual', 'Audio'] as const
export const DRAMA_SHOW_CONTROL_PANES = ['ShowBoard', 'ReviewInbox', 'AssetWall', 'Delivery'] as const

export type DramaPaneId = typeof DRAMA_FIRST_SUPPORT_PANES[number] | typeof DRAMA_SECONDARY_PANES[number]
export type DramaShowControlPaneId = typeof DRAMA_SHOW_CONTROL_PANES[number]

export interface DramaCommandEntryV1 {
  readonly id: string
  readonly label: string
  readonly disabled: boolean
  readonly reason?: string
}

export interface DramaPaneViewV1 {
  readonly id: DramaPaneId
  readonly visible: boolean
  readonly kind: 'first-support' | 'secondary'
  readonly title: string
}

export interface DramaPresetV1 {
  readonly id: 'director'
  readonly visible: readonly DramaPaneId[]
  readonly secondary: readonly DramaPaneId[]
  readonly openInWorkbench: boolean
}

export interface DramaShowControlPresetV1 {
  readonly id: 'show-control'
  readonly visible: readonly ['ShowBoard', 'ReviewInbox', 'Run', 'Delivery']
  readonly secondary: readonly ['AssetWall']
  readonly openInWorkbench: false
}

export interface DramaClientRegistrationV1 {
  readonly commandGroup: typeof DRAMA_COMMAND_GROUP
  readonly commands: readonly DramaCommandEntryV1[]
  readonly panes: readonly DramaPaneViewV1[]
  readonly preset: DramaPresetV1 | undefined
  readonly disposed: boolean
}

export function createDirectorPreset(): DramaPresetV1 {
  return {
    id: 'director',
    visible: [...DRAMA_FIRST_SUPPORT_PANES],
    secondary: [...DRAMA_SECONDARY_PANES],
    openInWorkbench: true,
  }
}

export function createShowControlPreset(): DramaShowControlPresetV1 {
  return {
    id: 'show-control',
    visible: ['ShowBoard', 'ReviewInbox', 'Run', 'Delivery'],
    secondary: ['AssetWall'],
    openInWorkbench: false,
  }
}

export function createDramaCommandGroup(capabilityAvailable: boolean, showControlAvailable = false): readonly DramaCommandEntryV1[] {
  const reason = capabilityAvailable ? undefined : 'missing drama owner projection'
  const showControlReason = showControlAvailable ? undefined : 'missing show-control owner projection'
  return [
    { id: '/drama', label: 'Drama', disabled: false },
    { id: '/drama help', label: 'Help', disabled: false },
    { id: '/drama open', label: 'Open', disabled: !capabilityAvailable, reason },
    { id: '/drama review', label: 'Review', disabled: !capabilityAvailable, reason },
    { id: '/drama evidence', label: 'Evidence', disabled: !capabilityAvailable, reason },
    { id: '/drama handoff', label: 'Open in Workbench', disabled: !capabilityAvailable, reason },
    { id: '/drama show', label: 'Show Control', disabled: !showControlAvailable, reason: showControlReason },
    { id: '/drama inbox', label: 'Review Inbox', disabled: !showControlAvailable, reason: showControlReason },
    { id: '/drama assets', label: 'Asset Wall', disabled: !showControlAvailable, reason: showControlReason },
    { id: '/drama delivery', label: 'Delivery', disabled: !showControlAvailable, reason: showControlReason },
  ]
}

export function createDramaPaneViews(openSecondary: readonly DramaPaneId[] = []): readonly DramaPaneViewV1[] {
  const opened = new Set(openSecondary)
  return [
    ...DRAMA_FIRST_SUPPORT_PANES.map((id) => ({
      id,
      visible: true,
      kind: 'first-support' as const,
      title: id,
    })),
    ...DRAMA_SECONDARY_PANES.map((id) => ({
      id,
      visible: opened.has(id),
      kind: 'secondary' as const,
      title: id,
    })),
  ]
}

export function shouldExpandToShowControlRoom(capabilityAvailable = false): boolean {
  return capabilityAvailable
}

export class DramaClientRegistry {
  private registration: DramaClientRegistrationV1
  private listeners = new Set<() => void>()

  constructor(capabilityAvailable = false) {
    this.registration = {
      commandGroup: DRAMA_COMMAND_GROUP,
      commands: createDramaCommandGroup(capabilityAvailable),
      panes: createDramaPaneViews(),
      preset: createDirectorPreset(),
      disposed: false,
    }
  }

  getSnapshot(): DramaClientRegistrationV1 {
    return this.registration
  }

  openSecondary(id: typeof DRAMA_SECONDARY_PANES[number]): void {
    if (this.registration.disposed) return
    const visible = this.registration.panes.filter((pane) => pane.visible).map((pane) => pane.id)
    this.registration = {
      ...this.registration,
      panes: createDramaPaneViews([...visible.filter((item) => item !== 'Context' && item !== 'Review' && item !== 'Run'), id]),
    }
    this.emit()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  dispose(): void {
    // Notify remaining listeners before clearing
    this.emit()
    this.listeners.clear()
    this.registration = {
      commandGroup: DRAMA_COMMAND_GROUP,
      commands: [],
      panes: [],
      preset: undefined,
      disposed: true,
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

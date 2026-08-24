import { createElement, type SVGProps } from 'react'

export type WorkbenchIconName =
  | 'add'
  | 'close'
  | 'maximize'
  | 'restore'
  | 'more'
  | 'pin'
  | 'unpin'
  | 'split'
  | 'move'
  | 'workspace'
  | 'document'
  | 'file'
  | 'media'
  | 'terminal'
  | 'search'
  | 'git'
  | 'git-branch'
  | 'folder'
  | 'window'
  | 'agents'
  | 'font-decrease'
  | 'font-increase'

const PATHS: Record<WorkbenchIconName, string> = {
  add: 'M12 5v14M5 12h14',
  close: 'm6 6 12 12M18 6 6 18',
  maximize: 'M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4',
  restore: 'M8 8h12v12H8zM4 16V4h12',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  pin: 'm8 4 8 8m-9-5-3 3 5 5 3-3m-8 8 5-5',
  unpin: 'm5 5 14 14M9 4l7 7m-8-4-3 3 5 5 3-3m-8 8 5-5',
  split: 'M12 4v16M4 8h16M4 8a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4M4 16a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4',
  move: 'M5 9h14M12 4l5 5-5 5M19 15H5m7 5-5-5 5-5',
  workspace: 'M4 5h16v14H4zM8 5v14M8 9h12',
  document: 'M7 3h7l4 4v14H7zM14 3v5h4M10 12h5M10 16h5',
  file: 'M6 3h8l4 4v14H6zM14 3v5h4',
  media: 'M5 5h14v14H5zM8 15l3-3 2 2 2-3 2 4',
  terminal: 'm5 7 5 5-5 5M12 17h7',
  search: 'm20 20-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z',
  git: 'M12 3v18M7 8l5-5 5 5M7 16l5 5 5-5',
  'git-branch': 'M6 3v12M6 15a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3M6 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  folder: 'M4 5h6l2 2h8v12H4z',
  window: 'M4 5h16v14H4zM4 9h16',
  agents: 'M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 20a4 4 0 0 1 8 0M12 20a4 4 0 0 1 8 0',
  'font-decrease': 'M5 18h6M8 6v12M14 10h7M14 14h5',
  'font-increase': 'M4 18h8M8 6v12M15 12h6M18 9v6',
}

export interface WorkbenchIconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  readonly name: WorkbenchIconName
  readonly size?: number
}

/** Small, semantic stroke icon set used by Pane chrome controls. */
export function WorkbenchIcon({ name, size = 16, strokeWidth = 1.8, ...props }: WorkbenchIconProps) {
  return createElement('svg', {
    ...props,
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': props['aria-label'] === undefined ? true : undefined,
    focusable: false,
  }, createElement('path', { d: PATHS[name] }))
}

export function WorkbenchIconLabel({ name, label, ...props }: WorkbenchIconProps & { readonly label: string }) {
  return createElement('span', { className: 'pwr-icon-label' },
    createElement(WorkbenchIcon, { name, ...props }),
    createElement('span', { className: 'pwr-sr-only' }, label),
  )
}

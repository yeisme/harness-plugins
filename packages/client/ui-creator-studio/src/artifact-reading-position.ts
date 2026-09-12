import { useLayoutEffect, useRef, type SyntheticEvent } from 'react'

type Position = { top: number; left: number; selection?: readonly [number, number, 'forward' | 'backward' | 'none'] }
const slots = {
  source: '[data-creator-artifact-editor] textarea',
  preview: '[data-creator-artifact-preview]',
  before: '[data-creator-artifact-text-compare] [data-side="before"]',
  after: '[data-creator-artifact-text-compare] [data-side="after"]',
} as const

/** View-local reading state; never restores focus or persists owner content. */
export function useArtifactReadingPosition(identity: string, epoch: string, ready: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  const positions = useRef(new Map<string, Partial<Record<keyof typeof slots, Position>>>())
  const savedEpoch = useRef(epoch)
  const capture = (event: SyntheticEvent): void => {
    const target = event.target
    if (!(target instanceof HTMLElement) || !ref.current?.contains(target)) return
    for (const [slot, selector] of Object.entries(slots)) {
      if (!target.matches(selector)) continue
      const position: Position = { top: target.scrollTop, left: target.scrollLeft }
      if (target instanceof HTMLTextAreaElement) position.selection = [target.selectionStart, target.selectionEnd, target.selectionDirection]
      positions.current.set(identity, { ...positions.current.get(identity), [slot]: position })
    }
  }
  useLayoutEffect(() => {
    if (savedEpoch.current !== epoch) { positions.current.clear(); savedEpoch.current = epoch }
    if (!ready) return
    const saved = positions.current.get(identity)
    for (const [slot, selector] of Object.entries(slots)) {
      const element = ref.current?.querySelector<HTMLElement>(selector)
      if (element === null || element === undefined) continue
      const position = saved?.[slot as keyof typeof slots]
      if (element instanceof HTMLTextAreaElement) {
        const selection = position?.selection ?? [0, 0, 'none'] as const
        element.setSelectionRange(...selection)
      }
      element.scrollTop = position?.top ?? 0
      element.scrollLeft = position?.left ?? 0
    }
  }, [identity, epoch, ready])
  return { ref, onScrollCapture: capture, onSelectCapture: capture }
}

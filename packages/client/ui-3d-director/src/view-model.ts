import type { SurfacePhase } from '@yeisme/dsh-client-ui-surface'
import type { StatusTone } from '@yeisme/dsh-client-ui-visual-kit'
import type { Scene3DSaveStatus, Scene3DViewState } from './scene3d-controller.js'

/** Map controller state to the shared Surface phase vocabulary. */
export function scene3DSurfacePhase(state: Scene3DViewState): SurfacePhase {
  if (state.status === 'loading') return 'loading'
  if (state.status === 'missing') return 'empty'
  if (state.status === 'unavailable' || state.status === 'forbidden') return 'disabled'
  if (state.status === 'invalid' || state.status === 'error') return 'error'
  if (state.saveStatus === 'conflict' || state.saveStatus === 'unknown') return 'stale'
  return 'success'
}

export function scene3DSaveTone(saveStatus: Scene3DSaveStatus): StatusTone {
  switch (saveStatus) {
    case 'clean': return 'positive'
    case 'dirty': return 'info'
    case 'saving': return 'info'
    case 'conflict': return 'critical'
    case 'unknown': return 'critical'
    case 'error': return 'critical'
  }
}

export const SCENE_3D_SAVE_LABELS: Readonly<Record<Scene3DSaveStatus, string>> = {
  clean: 'Saved',
  dirty: 'Unsaved draft',
  saving: 'Saving…',
  conflict: 'Revision conflict — frozen',
  unknown: 'Save outcome unknown — reconcile required',
  error: 'Save failed',
}

/** Whether the export control may run; blocked exports stay visible with their reason. */
export function scene3DExportAvailability(state: Scene3DViewState): { readonly disabled: boolean; readonly reason?: string } {
  const document = state.document
  if (state.status !== 'ready' || document === undefined) return { disabled: true, reason: 'No scene is loaded.' }
  if (state.frozen) return { disabled: true, reason: 'Writes and exports are frozen until the revision conflict is reconciled.' }
  if (state.export.status === 'exporting') return { disabled: true, reason: 'An export is already running.' }
  if (!document.capabilityReport.export.ready) {
    return { disabled: true, reason: 'Export is blocked by capability gaps; see the gap list below.' }
  }
  return { disabled: false }
}

import { useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { statusTone } from '@yeisme/dsh-client-ui-visual-kit'
import type { GenerationChangeSetV1 } from '@yeisme/dsh-pane-protocol'
import type {
  Scene3DChangeSetActionOutcome,
  Scene3DChangeSetPreviewResult,
  Scene3DController,
  Scene3DViewState,
} from './scene3d-controller.js'

export interface ChangeSetPanelProps {
  readonly state: Scene3DViewState
  readonly controller: Scene3DController
}

interface RowAvailability {
  readonly disabled: boolean
  readonly reason?: string
}

const NO_CONTROLS_REASON = 'The host does not expose change-set controls; the list stays read-only.'
const FROZEN_REASON = 'Writes are frozen until the revision conflict is reconciled.'

function actionOutcomeText(outcome: Scene3DChangeSetActionOutcome): string {
  switch (outcome.status) {
    case 'accepted': return `Accepted — committed as revision ${outcome.version}.`
    case 'rejected': return 'Rejected — the audited record stays.'
    case 'rolled_back': return `Rolled back — the prior revision was restored as revision ${outcome.version}.`
    case 'conflict': return `Revision conflict at revision ${outcome.version}; writes are frozen until reconciled.`
    case 'failed': return outcome.reason
  }
}

function previewText(preview: Scene3DChangeSetPreviewResult): ReactNode {
  if (preview.status !== 'ready') {
    return <p className="d3d-reason" role="status">{preview.reason}</p>
  }
  const { changeSet, currentVersion, baseRevisionRetained } = preview
  return <div className="d3d-preview" data-changeset-preview="">
    <div className="d3d-preview-row"><span className="d3d-preview-key">summary</span><span>{changeSet.operationSummary}</span></div>
    <div className="d3d-preview-row"><span className="d3d-preview-key">inputs</span><span>{changeSet.inputRefs.length === 0 ? 'none' : changeSet.inputRefs.join(', ')}</span></div>
    <div className="d3d-preview-row"><span className="d3d-preview-key">patch digest</span><span>{changeSet.patchDigest}</span></div>
    <div className="d3d-preview-row"><span className="d3d-preview-key">base revision</span><span>{changeSet.baseVersion} (scene is at {currentVersion}{baseRevisionRetained ? ', base retained' : ', base not retained'})</span></div>
    {changeSet.previewRef === undefined ? null : <div className="d3d-preview-row"><span className="d3d-preview-key">preview</span><span>{changeSet.previewRef}</span></div>}
  </div>
}

/**
 * Auditable generation change-set review: status badges (statusTone + text),
 * a read-only preview comparison (summary/inputs/patch digest/base revision),
 * and server-authored accept/reject/rollback controls. Availability derives
 * from the owner-recorded status and refs; every disabled control explains
 * itself, and nothing auto-retries.
 */
export function ChangeSetPanel(props: ChangeSetPanelProps): ReactNode {
  const { state, controller } = props
  const [busyRef, setBusyRef] = useState<string | undefined>(undefined)
  const [preview, setPreview] = useState<{ readonly changeSetRef: string; readonly result: Scene3DChangeSetPreviewResult } | undefined>(undefined)
  const [notice, setNotice] = useState<{ readonly changeSetRef: string; readonly text: string } | undefined>(undefined)

  if (state.changeSetsStatus === 'unavailable') {
    return <div className="vk-empty"><strong>Change sets unavailable</strong><p>The generation change-set log failed the contract or the channel; the scene itself is unaffected.</p></div>
  }
  if (state.changeSets.length === 0) {
    return <div className="vk-empty"><strong>No generation change sets</strong><p>The generation owner has not recorded any change set for this scene.</p></div>
  }

  const controlsAvailable = controller.changeSetControlsAvailable

  const availability = (changeSet: GenerationChangeSetV1, action: 'accept' | 'reject' | 'rollback'): RowAvailability => {
    if (!controlsAvailable) return { disabled: true, reason: NO_CONTROLS_REASON }
    if (busyRef !== undefined) return { disabled: true, reason: 'Another change-set action is in flight.' }
    if (action === 'reject') {
      return changeSet.status === 'pending' || changeSet.status === 'preview'
        ? { disabled: false }
        : { disabled: true, reason: `Only pending or preview change sets can be rejected; this one is ${changeSet.status}.` }
    }
    if (state.frozen) return { disabled: true, reason: FROZEN_REASON }
    if (action === 'accept') {
      if (changeSet.status !== 'pending' && changeSet.status !== 'preview') {
        return { disabled: true, reason: `Only pending or preview change sets can be accepted; this one is ${changeSet.status}.` }
      }
      if (changeSet.artifactRef === undefined) {
        return { disabled: true, reason: 'The generation owner recorded no artifact ref for this change set.' }
      }
      return { disabled: false }
    }
    if (changeSet.status !== 'accepted') return { disabled: true, reason: 'Only accepted change sets can be rolled back.' }
    if (changeSet.rollbackRef === undefined) return { disabled: true, reason: 'The owner recorded no rollback pointer for this change set.' }
    if (state.dirty) return { disabled: true, reason: 'Save or discard the local draft before rolling back.' }
    return { disabled: false }
  }

  const run = async (changeSet: GenerationChangeSetV1, action: 'accept' | 'reject' | 'rollback'): Promise<void> => {
    setBusyRef(changeSet.changeSetRef)
    setNotice(undefined)
    try {
      const outcome = action === 'accept'
        ? await controller.acceptChangeSet(changeSet.changeSetRef)
        : action === 'reject'
          ? await controller.rejectChangeSet(changeSet.changeSetRef)
          : await controller.rollbackChangeSet(changeSet.changeSetRef)
      setNotice({ changeSetRef: changeSet.changeSetRef, text: actionOutcomeText(outcome) })
    } finally {
      setBusyRef(undefined)
    }
  }

  const showPreview = async (changeSet: GenerationChangeSetV1): Promise<void> => {
    if (preview?.changeSetRef === changeSet.changeSetRef) {
      setPreview(undefined)
      return
    }
    setBusyRef(changeSet.changeSetRef)
    setNotice(undefined)
    try {
      const result = await controller.previewChangeSet(changeSet.changeSetRef)
      setPreview({ changeSetRef: changeSet.changeSetRef, result })
    } finally {
      setBusyRef(undefined)
    }
  }

  return <ul className="d3d-changesets">
    {state.changeSets.map(changeSet => {
      const accept = availability(changeSet, 'accept')
      const reject = availability(changeSet, 'reject')
      const rollback = availability(changeSet, 'rollback')
      return <li key={changeSet.changeSetRef} className="d3d-changeset">
        <div className="d3d-changeset-head">
          <span className="d3d-changeset-status" role="status">
            <span className="vk-dot" data-tone={statusTone(changeSet.status)} aria-hidden="true" />
            {changeSet.status}
          </span>
          <span className="d3d-changeset-summary">{changeSet.operationSummary}</span>
          <span className="vk-muted">base rev {changeSet.baseVersion}</span>
        </div>
        {changeSet.reason === undefined ? null : <p className="d3d-reason">{changeSet.reason}</p>}
        <div className="d3d-changeset-actions">
          <Button type="button" size="sm" variant="toolbar"
            disabled={!controlsAvailable || busyRef !== undefined}
            title={controlsAvailable ? undefined : NO_CONTROLS_REASON}
            aria-expanded={preview?.changeSetRef === changeSet.changeSetRef}
            onClick={() => void showPreview(changeSet)}>Preview</Button>
          <Button type="button" size="sm" variant="toolbar"
            disabled={accept.disabled} title={accept.reason}
            onClick={() => void run(changeSet, 'accept')}>Accept</Button>
          <Button type="button" size="sm" variant="toolbar"
            disabled={reject.disabled} title={reject.reason}
            onClick={() => void run(changeSet, 'reject')}>Reject</Button>
          <Button type="button" size="sm" variant="toolbar"
            disabled={rollback.disabled} title={rollback.reason}
            onClick={() => void run(changeSet, 'rollback')}>Rollback</Button>
        </div>
        {notice?.changeSetRef === changeSet.changeSetRef ? <p className="d3d-reason" role="status">{notice.text}</p> : null}
        {preview?.changeSetRef === changeSet.changeSetRef ? previewText(preview.result) : null}
      </li>
    })}
  </ul>
}

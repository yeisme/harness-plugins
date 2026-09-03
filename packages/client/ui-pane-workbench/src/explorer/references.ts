import { createElement, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'

export const COMPOSER_REFERENCE_CAPABILITY_V1 = 'ComposerReferenceCapabilityV1' as const
export type ComposerReferenceKindV1 = 'file-preview' | 'selection-anchor'
export type ComposerReferenceFreshnessV1 = 'fresh' | 'stale' | 'frozen'

export interface ComposerReferenceV1 {
  readonly id: string
  readonly kind: ComposerReferenceKindV1
  readonly owner: string
  readonly ref: string
  readonly version: string
  readonly label: string
  readonly scope: string
  readonly digest: string
  readonly freshness: ComposerReferenceFreshnessV1
  readonly currentVersion?: string
  readonly quote?: string
  readonly window?: { readonly start: number; readonly end: number }
  readonly anchor?: unknown
}

export interface ComposerReferenceSnapshotV1 {
  readonly capability: typeof COMPOSER_REFERENCE_CAPABILITY_V1
  readonly revision: number
  readonly active?: ComposerReferenceV1
  readonly pinned: readonly ComposerReferenceV1[]
  readonly sent: readonly ComposerReferenceV1[]
  readonly sendAvailable: boolean
  readonly sendReason?: string
}

export type ComposerReferenceDispatchV1 =
  | { readonly type: 'replace_active'; readonly reference: ComposerReferenceV1; readonly expectedRevision?: number }
  | { readonly type: 'pin'; readonly id: string; readonly expectedRevision?: number }
  | { readonly type: 'unpin'; readonly id: string; readonly expectedRevision?: number }
  | { readonly type: 'clear'; readonly id?: string; readonly expectedRevision?: number }
  | { readonly type: 'mark_stale'; readonly ref: string; readonly version: string }
  | { readonly type: 'mark_all_stale' }
  /** 4.5「查看当前版本」：以 host 重解析出的新 reference 原位替换 stale 项。 */
  | { readonly type: 'refresh'; readonly id: string; readonly reference: ComposerReferenceV1; readonly expectedRevision?: number }
  | { readonly type: 'redirect'; readonly oldRef: string; readonly newRef: string }
  | { readonly type: 'freeze_sent'; readonly ids: readonly string[]; readonly expectedRevision?: number }
  | { readonly type: 'set_send_capability'; readonly available: boolean; readonly reason?: string }

export interface ComposerReferenceDispatchResultV1 {
  readonly ok: boolean
  readonly snapshot: ComposerReferenceSnapshotV1
  readonly reason?: string
}

export interface ComposerReferenceCapabilityV1 {
  snapshot(): ComposerReferenceSnapshotV1
  subscribe(listener: () => void): () => void
  dispatch(intent: ComposerReferenceDispatchV1): ComposerReferenceDispatchResultV1
}

function initialSnapshot(): ComposerReferenceSnapshotV1 {
  return { capability: COMPOSER_REFERENCE_CAPABILITY_V1, revision: 0, pinned: [], sent: [], sendAvailable: false, sendReason: 'structured conversation send capability is unavailable' }
}

export class ComposerReferenceController implements ComposerReferenceCapabilityV1 {
  private current = initialSnapshot()
  private readonly listeners = new Set<() => void>()

  snapshot(): ComposerReferenceSnapshotV1 { return this.current }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  dispatch(intent: ComposerReferenceDispatchV1): ComposerReferenceDispatchResultV1 {
    if ('expectedRevision' in intent && intent.expectedRevision !== undefined && intent.expectedRevision !== this.current.revision) return { ok: false, snapshot: this.current, reason: 'reference snapshot revision is stale' }
    let next = this.current
    if (intent.type === 'replace_active') next = { ...next, active: intent.reference }
    else if (intent.type === 'pin') {
      const target = [next.active, ...next.pinned].find(item => item?.id === intent.id)
      if (target === undefined) return { ok: false, snapshot: next, reason: 'reference is unavailable' }
      if (next.pinned.some(item => item.id === target.id)) return { ok: true, snapshot: next }
      if (next.pinned.length >= 8) return { ok: false, snapshot: next, reason: 'maximum of eight pinned references reached' }
      next = { ...next, pinned: [...next.pinned, target] }
    } else if (intent.type === 'unpin') next = { ...next, pinned: next.pinned.filter(item => item.id !== intent.id) }
    else if (intent.type === 'clear') next = { ...next, active: intent.id === undefined || next.active?.id === intent.id ? undefined : next.active, pinned: intent.id === undefined ? [] : next.pinned.filter(item => item.id !== intent.id) }
    else if (intent.type === 'mark_stale') {
      const stale = (item: ComposerReferenceV1): ComposerReferenceV1 => item.ref === intent.ref && item.version !== intent.version ? { ...item, currentVersion: intent.version, freshness: 'stale' } : item
      next = { ...next, active: next.active === undefined ? undefined : stale(next.active), pinned: next.pinned.map(stale) }
    } else if (intent.type === 'redirect') {
      const redirect = (item: ComposerReferenceV1): ComposerReferenceV1 => item.ref === intent.oldRef && item.freshness !== 'frozen' ? { ...item, ref: intent.newRef } : item
      next = { ...next, active: next.active === undefined ? undefined : redirect(next.active), pinned: next.pinned.map(redirect) }
    } else if (intent.type === 'mark_all_stale') {
      const stale = (item: ComposerReferenceV1): ComposerReferenceV1 => item.freshness === 'frozen' ? item : { ...item, freshness: 'stale' }
      next = { ...next, active: next.active === undefined ? undefined : stale(next.active), pinned: next.pinned.map(stale) }
    } else if (intent.type === 'refresh') {
      // 原位替换：同一 id 可同时在 active 与 pinned（两处都刷新）；
      // 不新增、不触碰 frozen sent 快照；无命中拒绝。
      const inActive = next.active?.id === intent.id
      const inPinned = next.pinned.some(item => item.id === intent.id)
      if (!inActive && !inPinned) return { ok: false, snapshot: next, reason: 'reference is unavailable' }
      next = {
        ...next,
        active: inActive ? intent.reference : next.active,
        pinned: next.pinned.map(item => item.id === intent.id ? intent.reference : item),
      }
    } else if (intent.type === 'freeze_sent') {
      const ids = new Set(intent.ids)
      const freeze = (item: ComposerReferenceV1): ComposerReferenceV1 => ids.has(item.id) ? { ...item, freshness: 'frozen' } : item
      next = { ...next, active: next.active === undefined ? undefined : freeze(next.active), pinned: next.pinned.map(freeze), sent: [...next.sent, ...[next.active, ...next.pinned].filter((item): item is ComposerReferenceV1 => item !== undefined && ids.has(item.id)).map(freeze)] }
    } else if (intent.type === 'set_send_capability') next = { ...next, sendAvailable: intent.available, ...(intent.available ? { sendReason: undefined } : { sendReason: intent.reason ?? 'structured conversation send capability is unavailable' }) }
    if (next === this.current) return { ok: true, snapshot: next }
    this.current = { ...next, revision: this.current.revision + 1 }
    for (const listener of this.listeners) listener()
    return { ok: true, snapshot: this.current }
  }
}

let sharedController: ComposerReferenceController | undefined
export function getComposerReferenceController(): ComposerReferenceController {
  sharedController ??= new ComposerReferenceController()
  return sharedController
}
export function attachComposerReferenceController(controller: ComposerReferenceController): () => void {
  sharedController = controller
  return () => { if (sharedController === controller) sharedController = undefined }
}

export interface ComposerReferenceDockProps {
  readonly controller?: ComposerReferenceCapabilityV1
  readonly onCopy?: (reference: ComposerReferenceV1) => void
  /**
   * 4.5「查看当前版本」的 host 解析面：把 stale 引用重解析为当前版本的
   * 新 reference（owner inspect 真值）。缺席时按钮如实禁用，不伪造刷新。
   */
  readonly onViewCurrent?: (reference: ComposerReferenceV1) => Promise<ComposerReferenceV1 | undefined>
}

export function ComposerReferenceDock(props: ComposerReferenceDockProps): ReactNode {
  const controller = props.controller ?? getComposerReferenceController()
  const [snapshot, setSnapshot] = useState(() => controller.snapshot())
  const [resolving, setResolving] = useState<string | undefined>(undefined)
  useEffect(() => controller.subscribe(() => setSnapshot(controller.snapshot())), [controller])
  const viewCurrent = async (reference: ComposerReferenceV1): Promise<void> => {
    if (props.onViewCurrent === undefined) return
    setResolving(reference.id)
    try {
      const refreshed = await props.onViewCurrent(reference)
      if (refreshed !== undefined) controller.dispatch({ type: 'refresh', id: reference.id, reference: refreshed, expectedRevision: controller.snapshot().revision })
    } finally {
      setResolving(undefined)
    }
  }
  // 同一 id 可同时在 active 与 pinned：去重（active 优先），避免重复 chip/重复 key。
  const references = useMemo(() => {
    const byId = new Map<string, ComposerReferenceV1>()
    for (const item of [snapshot.active, ...snapshot.pinned]) {
      if (item !== undefined && !byId.has(item.id)) byId.set(item.id, item)
    }
    return [...byId.values()]
  }, [snapshot.active, snapshot.pinned])
  if (references.length === 0) return null
  return createElement('div', { className: 'pwr-composer-reference-dock', 'data-composer-reference-capability': COMPOSER_REFERENCE_CAPABILITY_V1, role: 'group', 'aria-label': '文件与选区引用' },
    ...references.map(reference => createElement('span', { key: reference.id, className: `pwr-reference-chip pwr-reference-${reference.freshness}`, 'data-reference-id': reference.id },
      createElement('span', null, reference.label),
      reference.freshness === 'stale' ? createElement('span', { title: `资源已变化${reference.currentVersion === undefined ? '' : `（当前 ${reference.currentVersion}）`}` }, ' stale') : null,
      reference.freshness === 'stale'
        ? createElement('span', { 'data-reference-view-current': reference.id, title: props.onViewCurrent === undefined ? 'host 解析面不可用' : '查看当前版本' },
          createElement(Button, {
            type: 'button', size: 'sm', variant: 'toolbar',
            disabled: props.onViewCurrent === undefined || resolving === reference.id,
            onClick: () => { void viewCurrent(reference) },
          }, resolving === reference.id ? '解析中…' : '查看当前版本'))
        : null,
      createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => props.onCopy?.(reference) }, '复制'),
      snapshot.pinned.some(item => item.id === reference.id)
        ? createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => { controller.dispatch({ type: 'unpin', id: reference.id, expectedRevision: controller.snapshot().revision }) } }, '取消固定')
        : createElement(Button, { type: 'button', size: 'sm', variant: 'toolbar', onClick: () => { controller.dispatch({ type: 'pin', id: reference.id, expectedRevision: controller.snapshot().revision }) } }, '固定'),
    )),
    snapshot.sendAvailable ? null : createElement('span', { role: 'status', className: 'pwr-reference-send-blocked' }, snapshot.sendReason ?? '结构化引用发送不可用'),
  )
}

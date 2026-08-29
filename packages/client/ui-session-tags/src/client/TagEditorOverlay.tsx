/**
 * 可访问的标签编辑器 overlay（纯 props 组件；无 ctx、无订阅机制）。
 *
 * 可访问性合同（spec + a11y 测试钉住）：
 * - `role="dialog"` + `aria-modal="true"` + `aria-labelledby`；
 * - Escape 取消（零写入）并还原焦点；
 * - 冲突/错误经 `aria-live="polite"` 的 status 区播报；
 * - 打开时焦点进入输入框，关闭时焦点回到触发元素（hub 负责）；
 * - 保存中（busy）禁用保存/取消之外的变更入口。
 *
 * @module @yeisme/dsh-client-ui-session-tags/client/TagEditorOverlay
 */

import { useSyncExternalStore } from 'react'
import { Button, Input, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  Surface,
  SurfaceActionBar,
  SurfaceContextBar,
  SurfaceState,
} from '@yeisme/dsh-client-ui-surface'
import { sessionTagsOverlayStyles } from './styles.ts'

export interface TagEditorOverlayLabels {
  readonly title: string
  readonly inputLabel: string
  readonly add: string
  readonly save: string
  readonly cancel: string
  readonly removeLabel: (tag: string) => string
  readonly suggestionsTitle: string
  readonly conflictNotice: string
  readonly errorNotice: string
  readonly busy: string
}

/** overlay 组件 props（数据与动作全部由注入面提供）。 */
export interface TagEditorOverlayProps {
  readonly state: {
    readonly open: boolean
    readonly sessionId: string
    readonly draft: readonly string[]
    readonly input: string
    readonly phase: 'editing' | 'saving' | 'conflict' | 'error'
    readonly message?: string
    readonly reasons?: readonly string[]
    readonly authoritative?: readonly string[] | null
  }
  readonly suggestions: readonly string[]
  readonly labels: TagEditorOverlayLabels
  readonly onToggleTag: (tag: string) => void
  readonly onSetInput: (input: string) => void
  readonly onAddInput: () => void
  readonly onSave: () => void
  readonly onCancel: () => void
}

/** 默认英文文案（宿主可本地化注入）。 */
export const TAG_EDITOR_OVERLAY_LABELS_EN: TagEditorOverlayLabels = {
  title: 'Manage tags',
  inputLabel: 'New tag',
  add: 'Add tag',
  save: 'Save',
  cancel: 'Cancel',
  removeLabel: tag => `Remove tag ${tag}`,
  suggestionsTitle: 'Existing tags',
  conflictNotice: 'Tags changed elsewhere. Updated tags are shown; review and save again.',
  errorNotice: 'Cannot save tags.',
  busy: 'Saving tags…',
}

/**
 * 标签编辑器 overlay。`state.open === false` 时不渲染任何内容
 *（shell.overlay 列表 seat 常驻注册，空闲零输出）。
 */
export function TagEditorOverlay(props: TagEditorOverlayProps): JSX.Element | null {
  const { state, suggestions, labels } = props
  if (!state.open) return null
  const busy = state.phase === 'saving'
  const conflicts = state.phase === 'conflict'
  const errored = state.phase === 'error'
  const unaddedSuggestions = suggestions.filter(tag => !state.draft.includes(tag))

  return (
    <Modal open onClose={props.onCancel} title={labels.title} headless>
      <Surface kind="dialog" className="session-tags-editor" data-session-tags="editor">
        <style>{sessionTagsOverlayStyles}</style>
        <SurfaceContextBar title={labels.title} />
        <div className="ys-body">

        {state.draft.length > 0
          ? (
            <ul className="session-tags-draft" aria-label={labels.title}>
              {state.draft.map(tag => (
                <li key={tag} className="session-tags-chip">
                  <span>{tag}</span>
                  <Button
                    type="button"
                    aria-label={labels.removeLabel(tag)}
                    disabled={busy}
                    onClick={() => props.onToggleTag(tag)}
                  >
                    ×
                  </Button>
                </li>
              ))}
            </ul>
          )
          : <p className="session-tags-empty">—</p>}

        <div className="session-tags-entry ys-field">
          <Input
            type="text"
            aria-label={labels.inputLabel}
            value={state.input}
            disabled={busy}
            onChange={event => props.onSetInput(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') {
                event.preventDefault()
                props.onAddInput()
              }
            }}
            autoFocus
          />
          <Button type="button" disabled={busy} onClick={props.onAddInput}>{labels.add}</Button>
        </div>

        {unaddedSuggestions.length > 0
          ? (
            <div className="session-tags-suggestions">
              <p>{labels.suggestionsTitle}</p>
              <ul>
                {unaddedSuggestions.map(tag => (
                  <li key={tag}>
                    <Button type="button" disabled={busy} onClick={() => props.onToggleTag(tag)}>
                      {tag}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )
          : null}

        <div role="status" aria-live="polite" className="session-tags-feedback">
          {busy ? <SurfaceState phase="loading" title={labels.busy} /> : null}
          {conflicts
            ? (
              <p className="session-tags-conflict">
                {labels.conflictNotice}
                {state.authoritative !== undefined && state.authoritative !== null
                  ? ` (${state.authoritative.join(', ')})`
                  : ''}
              </p>
            )
            : null}
          {errored
            ? (
              <p className="session-tags-error">
                {labels.errorNotice}
                {state.reasons !== undefined && state.reasons.length > 0
                  ? ` (${state.reasons.join(', ')})`
                  : state.message !== undefined && state.message !== 'invalid-tag-input'
                    ? ` ${state.message}`
                    : ''}
              </p>
            )
            : null}
        </div>
        </div>
        <SurfaceActionBar className="session-tags-actions">
          <Button type="button" variant="primary" className="primary" disabled={busy} onClick={props.onSave}>
            {labels.save}
          </Button>
          <Button type="button" disabled={busy} onClick={props.onCancel}>
            {labels.cancel}
          </Button>
        </SurfaceActionBar>
      </Surface>
    </Modal>
  )
}

/** 编辑器 hub + 文案 → shell.overlay 条目组件（常驻注册，空闲零渲染）。 */
export function createTagEditorOverlayEntry(
  editor: {
    getSnapshot(): TagEditorOverlayProps['state']
    subscribe(listener: () => void): () => void
    suggestions(): readonly string[]
    toggleTag(tag: string): void
    setInput(input: string): void
    addFreeInput(): void
    save(): Promise<void>
    cancel(): void
  },
  labels?: TagEditorOverlayLabels,
): () => JSX.Element | null {
  const dictionary = labels ?? TAG_EDITOR_OVERLAY_LABELS_EN
  return function SessionTagsEditorOverlayEntry(): JSX.Element | null {
    const state = useSyncExternalStore(
      listener => editor.subscribe(listener),
      () => editor.getSnapshot(),
      () => editor.getSnapshot(),
    )
    return (
      <TagEditorOverlay
        state={state}
        suggestions={editor.suggestions()}
        labels={dictionary}
        onToggleTag={tag => { editor.toggleTag(tag) }}
        onSetInput={input => { editor.setInput(input) }}
        onAddInput={() => { editor.addFreeInput() }}
        onSave={() => { void editor.save() }}
        onCancel={() => { editor.cancel() }}
      />
    )
  }
}

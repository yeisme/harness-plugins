/**
 * Edit as Branch：用户消息气泡上的内联编辑器与保存动作。
 *
 * 保存只提交 typed intent；编辑器不直接持有 fork/prompt 业务状态。
 * a11y（6.4）：group 语义、describedby 关联、autofocus、saving 状态公告、
 * 取消/成功后焦点回到触发按钮、禁用原因 sr-only 呈现。
 * 附件边界（6.5）：非纯文本消息显式禁用（not-text），绝不静默丢弃附件
 * 后发出纯文本替换。
 *
 * @module @yeisme/dsh-client-ui-conversation-rewrite/edit
 */
import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { computeEditTarget, disableReasonKey } from './boundary.ts'
import type { ChatRewriteController } from './controller.ts'
import { NS, type ConversationRewriteKey } from './locales.ts'
import type { UserActionOwnerProps } from './seams.ts'

export type { UserActionOwnerProps }

export type EditActionProps = PropsRuntime<'conversation.chat.user-actions'> & PropsLocale<typeof NS>

export interface EditInlineEditorProps {
  readonly initialText: string
  readonly saving?: boolean
  readonly error?: string | null
  readonly saveLabel: string
  readonly cancelLabel: string
  readonly savingLabel: string
  readonly emptyLabel: string
  readonly placeholder?: string
  readonly hint?: string
  readonly onSave: (text: string) => void
  readonly onCancel: () => void
}

/** Screen-reader-only text style: visible to assistive tech, silent visually. */
const srOnlyStyle = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const

/** 纯展示的内联编辑器：保存/取消/Escape，空内容不提交。 */
export function EditInlineEditor({ initialText, saving, error, saveLabel, cancelLabel, savingLabel, emptyLabel, placeholder, hint, onSave, onCancel }: EditInlineEditorProps) {
  const [text, setText] = useState(initialText)
  const [empty, setEmpty] = useState(false)
  const hintId = useId()
  const emptyId = useId()
  const errorId = useId()
  const describedBy = [hint !== undefined ? hintId : undefined, empty ? emptyId : undefined, error !== undefined && error !== null ? errorId : undefined]
    .filter((id): id is string => id !== undefined)
    .join(' ') || undefined

  const handleSave = (): void => {
    if (text.trim().length === 0) {
      setEmpty(true)
      return
    }
    setEmpty(false)
    onSave(text)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
      return
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      handleSave()
    }
  }

  return (
    <div data-dsh-conversation-rewrite-edit role="group" aria-label={placeholder}>
      <textarea
        value={text}
        aria-label={placeholder}
        placeholder={placeholder}
        disabled={saving === true}
        autoFocus
        aria-describedby={describedBy}
        onChange={(event) => { setText(event.target.value); setEmpty(false) }}
        onKeyDown={handleKeyDown}
      />
      {empty && <span id={emptyId} role="alert">{emptyLabel}</span>}
      {error !== undefined && error !== null && <span id={errorId} role="alert">{error}</span>}
      <span id={hintId}>{hint}</span>
      {saving === true && <span role="status" style={srOnlyStyle}>{savingLabel}</span>}
      <span style={{ display: 'inline-flex', gap: 4 }}>
        <button type="button" disabled={saving === true} onClick={handleSave}>{saving === true ? savingLabel : saveLabel}</button>
        <button type="button" disabled={saving === true} onClick={onCancel}>{cancelLabel}</button>
      </span>
    </div>
  )
}

/** 注册时用 controller 闭包构造 slot 组件。 */
export function makeEditAction(controller: ChatRewriteController) {
  return function EditAction({ seq, useSession, sessionId, t }: EditActionProps) {
    const snapshot = useSession((value) => value)
    const state = useSyncExternalStore(controller.store.subscribe, controller.store.getSnapshot)
    const firstRound = controller.supportsFirstRound()
    const decision = useMemo(
      () => computeEditTarget(snapshot, seq, { firstRound }),
      [snapshot, seq, firstRound],
    )
    const [editing, setEditing] = useState(false)
    const triggerRef = useRef<HTMLButtonElement | null>(null)
    const activeKey = `edit:${seq}`
    const saving = state.phase === 'submitting' && state.activeKey === activeKey
    const error = state.phase === 'error' && state.activeKey === activeKey ? state.errorMessage : null

    useEffect(() => {
      if (state.phase === 'opened' && state.activeKey === activeKey) {
        setEditing(false)
        controller.reset()
        triggerRef.current?.focus()
      }
    }, [state.phase, state.activeKey, activeKey, controller])

    if (!editing) {
      const disabled = !decision.ok
      const disabledReason = !decision.ok ? t(disableReasonKey(decision.reason, 'edit') as ConversationRewriteKey) : undefined
      // 6.5：非纯文本消息（附件/图片）走显式禁用，原因 sr-only 呈现，不静默改写。
      return (
        <>
          <button
            ref={triggerRef}
            type="button"
            disabled={disabled}
            title={disabledReason}
            onClick={() => { if (decision.ok) setEditing(true) }}
          >
            {t('edit.trigger')}
          </button>
          {disabled && disabledReason !== undefined && (
            <span role="note" style={srOnlyStyle}>{disabledReason}</span>
          )}
        </>
      )
    }

    return (
      <EditInlineEditor
        initialText={decision.ok ? decision.target.text : ''}
        saving={saving}
        error={error}
        saveLabel={t('edit.save')}
        cancelLabel={t('edit.cancel')}
        savingLabel={t('edit.saving')}
        emptyLabel={t('edit.empty')}
        placeholder={t('edit.placeholder')}
        hint={t('edit.hint')}
        onSave={(text) => {
          if (decision.ok) void controller.run(sessionId, { ...decision.target, text })
        }}
        onCancel={() => {
          setEditing(false)
          requestAnimationFrame(() => { triggerRef.current?.focus() })
        }}
      />
    )
  }
}

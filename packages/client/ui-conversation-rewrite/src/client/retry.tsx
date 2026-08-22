/**
 * Retry as Branch：Assistant 动作条上的重试按钮与状态展示。
 *
 * @module @yeisme/dsh-client-ui-conversation-rewrite/retry
 */

import { useMemo, useSyncExternalStore } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { computeRetryTarget, disableReasonKey } from './boundary.ts'
import type { ChatRewriteController } from './controller.ts'
import { NS, type ConversationRewriteKey } from './locales.ts'

export interface RetryButtonProps {
  readonly disabled?: boolean
  readonly disabledReason?: string | undefined
  readonly loading?: boolean
  readonly error?: string | null
  readonly label: string
  readonly loadingLabel: string
  readonly onRetry?: (() => void) | undefined
}

/** Screen-reader-only text style: visible to assistive tech, silent visually. */
const srOnlyStyle = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' } as const

/** 纯展示的重试按钮：loading/error/disabled 均由父级计算。
 * a11y：禁用原因 sr-only 呈现（不只靠 title）、loading 以 role=status 公告。 */
export function RetryButton({ disabled, disabledReason, loading, error, label, loadingLabel, onRetry }: RetryButtonProps) {
  const title = disabled === true && disabledReason !== undefined ? disabledReason : undefined
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <button
        type="button"
        disabled={disabled === true || loading === true}
        aria-label={label}
        aria-busy={loading === true}
        title={title}
        onClick={() => { if (!disabled && !loading) onRetry?.() }}
      >
        {loading === true ? loadingLabel : label}
      </button>
      {disabled === true && disabledReason !== undefined && <span role="note" style={srOnlyStyle}>{disabledReason}</span>}
      {loading === true && <span role="status" style={srOnlyStyle}>{loadingLabel}</span>}
      {error !== undefined && error !== null && <span role="alert">{error}</span>}
    </span>
  )
}

export type RetryActionProps = PropsRuntime<'conversation.chat.assistant-actions'> & PropsLocale<typeof NS>

/** 注册时用 controller 闭包构造 slot 组件。 */
export function makeRetryAction(controller: ChatRewriteController) {
  return function RetryAction({ messageId, useSession, sessionId, t }: RetryActionProps) {
    const snapshot = useSession((value) => value)
    const state = useSyncExternalStore(controller.store.subscribe, controller.store.getSnapshot)
    const firstRound = controller.supportsFirstRound()
    const decision = useMemo(
      () => computeRetryTarget(snapshot, messageId, { firstRound }),
      [snapshot, messageId, firstRound],
    )

    const activeKey = `retry:${messageId}`
    const loading = state.phase === 'submitting' && state.activeKey === activeKey
    const error = state.phase === 'error' && state.activeKey === activeKey ? state.errorMessage : null
    const disabled = !decision.ok || loading
    const disabledReason = !decision.ok ? t(disableReasonKey(decision.reason, 'retry') as ConversationRewriteKey) : undefined

    return (
      <RetryButton
        disabled={disabled}
        disabledReason={disabledReason}
        loading={loading}
        error={error}
        label={t('retry.trigger')}
        loadingLabel={t('retry.loading')}
        onRetry={() => {
          if (decision.ok && sessionId !== undefined) void controller.run(sessionId, decision.target)
        }}
      />
    )
  }
}

/**
 * Retry as Branch：Assistant 动作条上的重试按钮与状态展示。
 *
 * @module @yeisme/dsh-client-ui-conversation-rewrite/retry
 */

import { useMemo, useSyncExternalStore } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Button, IconLoadingOutline16, IconRefreshOutline16, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface } from '@yeisme/dsh-client-ui-surface'
import { computeRetryTarget } from './boundary.ts'
import type { ChatRewriteController } from './controller.ts'
import { NS } from './locales.ts'

export interface RetryButtonProps {
  readonly disabled?: boolean
  readonly disabledReason?: string | undefined
  readonly loading?: boolean
  readonly error?: string | null
  readonly label: string
  readonly loadingLabel: string
  readonly onRetry?: (() => void) | undefined
}

const retryActionCss = `
[data-conversation-retry-surface] .cr-sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
[data-conversation-retry-action]{width:28px;height:28px;padding:6px;border-radius:28px;transition:background-color 120ms ease,color 120ms ease,transform 120ms ease}
[data-conversation-retry-action]:hover{background:var(--vk-fill-hover);color:var(--vk-text-secondary)}
[data-conversation-retry-action]:active{transform:scale(.92)}
[data-conversation-retry-action]:focus-visible{outline:2px solid var(--vk-focus-ring);outline-offset:2px}
[data-conversation-retry-action][aria-busy=true] svg{animation:yeisme-retry-spin .8s linear infinite}
@keyframes yeisme-retry-spin{to{transform:rotate(360deg)}}
`

/** 纯展示的重试按钮：loading/error/disabled 均由父级计算。
 * a11y：禁用原因 sr-only 呈现（不只靠 title）、loading 以 role=status 公告。 */
export function RetryButton({ disabled, disabledReason, loading, error, label, loadingLabel, onRetry }: RetryButtonProps) {
  const title = disabled === true && disabledReason !== undefined ? disabledReason : label
  return (
    <Surface kind="micro" data-conversation-retry-surface>
      <style>{retryActionCss}</style>
      <Tooltip label={label} side="bottom" delayMs={500} disabled={disabled === true}>
        <Button
          type="button"
          disabled={disabled === true || loading === true}
          aria-label={label}
          aria-busy={loading === true}
          title={title}
          data-conversation-retry-action
          onClick={() => { if (!disabled && !loading) onRetry?.() }}
        >
          {loading === true
            ? <IconLoadingOutline16 size={16} aria-hidden="true" />
            : <IconRefreshOutline16 size={16} aria-hidden="true" />}
        </Button>
      </Tooltip>
      {disabled === true && disabledReason !== undefined && <span role="note" className="cr-sr-only">{disabledReason}</span>}
      {loading === true && <span role="status" className="cr-sr-only">{loadingLabel}</span>}
      {error !== undefined && error !== null && <span role="alert">{error}</span>}
    </Surface>
  )
}

export type RetryActionProps = PropsRuntime<'conversation.chat.assistant-actions'> & PropsLocale<typeof NS>

/** 注册时用 controller 闭包构造 slot 组件。 */
export function makeRetryAction(controller: ChatRewriteController) {
  return function RetryAction({ messageId, useSession, sessionId, t }: RetryActionProps) {
    const snapshot = useSession((value) => value)
    const state = useSyncExternalStore(
      listener => controller.store.subscribe(listener),
      () => controller.store.getSnapshot(),
      () => controller.store.getSnapshot(),
    )
    const firstRound = controller.supportsFirstRound()
    const decision = useMemo(
      () => computeRetryTarget(snapshot, messageId, { firstRound }),
      [snapshot, messageId, firstRound],
    )

    const activeKey = `retry:${messageId}`
    const loading = state.phase === 'submitting' && state.activeKey === activeKey
    const error = state.phase === 'error' && state.activeKey === activeKey ? state.errorMessage : null

    // Never occupy the official message action row with a dead replacement.
    // Unsupported/first-round/stale targets leave the owner UI untouched.
    if (!decision.ok || sessionId === undefined) return null

    return (
      <RetryButton
        disabled={loading}
        loading={loading}
        error={error}
        label={t('retry.trigger')}
        loadingLabel={t('retry.loading')}
        onRetry={() => {
          void controller.run(sessionId, decision.target)
        }}
      />
    )
  }
}

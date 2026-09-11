/**
 * 缺失会话空态（dsh-url-session-v1 §3.3）：深链指向未知/已清理会话时，
 * 嵌在既有会话视图内的单一 State——不是新 pane、不是第二滚动容器。主操作
 * 「返回列表」清掉地址栏对该 id 的声称（URL 不再宣称该会话），焦点落在
 * 主按钮，不抢 composer。全 `--vk-*` token，无硬编码色。
 *
 * @module @yeisme/dsh-client-ui-url-session/client
 */

import { useEffect, useRef, type ReactElement } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { UrlSessionLabels } from './labels.ts'

export interface MissingSessionStateProps {
  readonly sessionId: string
  readonly labels: UrlSessionLabels
  readonly onBackToList: () => void
}

export function MissingSessionState({ sessionId, labels, onBackToList }: MissingSessionStateProps): ReactElement {
  const primary = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    primary.current?.focus()
  }, [])
  return (
    <section
      className="url-session-missing"
      data-dsh-url-session-missing={sessionId}
      role="region"
      aria-label={labels.missingTitle}
      style={{ display: 'grid', placeItems: 'center', gap: 12, padding: '32px 16px', width: '100%', maxWidth: 520, margin: '0 auto' }}
    >
      <h2 style={{ margin: 0, fontSize: 'var(--vk-font-strong, 16px)', fontWeight: 650, color: 'var(--vk-text-primary, inherit)' }}>{labels.missingTitle}</h2>
      <p style={{ margin: 0, color: 'var(--vk-text-tertiary, inherit)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', wordBreak: 'break-all' }}>
        {sessionId}
      </p>
      <span ref={primary} tabIndex={-1} style={{ display: 'inline-flex' }}><Button type="button" size="sm" variant="primary" onClick={onBackToList}>{labels.backToList}</Button></span>
    </section>
  )
}

export default MissingSessionState

/**
 * 会话链接菜单（dsh-url-session-v1 §3.4）：挂在会话头部动作区的官方 Menu。
 * 「复制会话链接」写 clipboard（链接只含 origin + SessionId，无 token）；
 * 「在新标签页打开」`noopener` 打开同源会话视图（打开视图 ≠ 发送消息）。
 * 无当前会话或非安全上下文时对应项 disabled + title 原因，绝不静默。
 *
 * @module @yeisme/dsh-client-ui-url-session/client
 */

import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Menu } from '@deepseek-ai/dsh-client-ui-primitives'
import type { UrlSessionLabels } from './labels.ts'

export type SessionLinkForm = 'canonical' | 'alias'

export interface SessionLinkMenuProps {
  readonly labels: UrlSessionLabels
  /** 当前会话链接；undefined = 无当前会话（菜单仍渲染，动作 disabled）。 */
  readonly link: string | undefined
  /** clipboard 不可用（非安全上下文等）时为 true：复制项 disabled + 原因。 */
  readonly clipboardAvailable: boolean
  readonly onCopy?: (link: string) => Promise<void> | void
  readonly onOpenTab?: (link: string) => void
}

export function SessionLinkMenu({ labels, link, clipboardAvailable, onCopy, onOpenTab }: SessionLinkMenuProps): ReactElement {
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState<string>()
  const trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) setNotice(undefined)
  }, [open])
  const copyDisabled = link === undefined || !clipboardAvailable
  const openDisabled = link === undefined
  const copyReason = link === undefined ? labels.noSessionReason : clipboardAvailable ? undefined : labels.clipboardUnavailableReason
  return (
    <span
      className="url-session-link-menu"
      data-dsh-url-session-link={link ?? ''}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
      onKeyDown={event => { if (event.key === 'Escape' && open) { setOpen(false); trigger.current?.focus() } }}
    >
      <Menu
        open={open}
        portal
        align="end"
        compact
        anchor={<button ref={trigger} type="button" className="vk-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => { setOpen((value: boolean) => !value) }}>{labels.menuTrigger}</button>}
        items={[
          { id: 'copy', label: <span title={copyReason}>{labels.copyLink}</span>, disabled: copyDisabled },
          { id: 'new-tab', label: <span title={openDisabled ? labels.noSessionReason : undefined}>{labels.openInNewTab}</span>, disabled: openDisabled },
        ]}
        onClose={() => setOpen(false)}
        onSelect={id => {
          setOpen(false)
          trigger.current?.focus()
          if (link === undefined) return
          if (id === 'copy' && clipboardAvailable) {
            const run = onCopy ?? (async () => { await navigator.clipboard.writeText(link) })
            void Promise.resolve(run(link)).then(
              () => setNotice(labels.copiedNotice),
              () => setNotice(labels.copyFailedReason),
            )
          }
          if (id === 'new-tab') (onOpenTab ?? (url => { window.open(url, '_blank', 'noopener,noreferrer') }))(link)
        }}
      />
      {notice === undefined ? null : <span role="status" style={{ color: 'var(--vk-text-tertiary, inherit)', fontSize: 'var(--vk-font-micro, 11px)' }}>{notice}</span>}
    </span>
  )
}

export default SessionLinkMenu

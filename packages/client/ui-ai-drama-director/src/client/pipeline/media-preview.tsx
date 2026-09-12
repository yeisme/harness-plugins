/**
 * PipelineMediaPreview：流水线画布/检查器的媒体缩略图与播放预览。
 *
 * - 三态诚实呈现：loading（role=status 骨架）、error（role=alert + 通用原因，
 *   不泄漏 resolver 异常细节）、unavailable（role=status + owner 有界原因）。
 * - 视频默认暂停（无 autoplay），仅在可见时加载（IntersectionObserver，
 *   无 IO 的环境按可见处理）。
 * - resolve→release 对称：卸载、条目变化、离开视口或媒体元素出错时释放
 *   当前访问句柄（blob/object URL 与解码缓存由 resolver.release 回收）；
 *   expiresAt 到期后自动重新解析（仅可见时），绝不复用过期 URL。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'
import type { PipelineMediaAccessResolver, PipelineMediaEntry, PipelineMediaResolution } from './media.js'

export type PipelineMediaTextKey = 'loading' | 'error' | 'unavailable'

const pipelineMediaZh: Record<PipelineMediaTextKey, string> = {
  loading: '正在加载媒体预览',
  error: '媒体预览加载失败',
  unavailable: '媒体预览不可用',
}
const pipelineMediaEn: Record<PipelineMediaTextKey, string> = {
  loading: 'Loading media preview',
  error: 'Media preview failed to load',
  unavailable: 'Media preview unavailable',
}
export const pipelineMediaText = { zh: pipelineMediaZh, en: pipelineMediaEn } as const
export type PipelineMediaTranslator = (key: PipelineMediaTextKey) => string

export interface PipelineMediaPreviewProps {
  readonly entry: PipelineMediaEntry
  readonly resolver: PipelineMediaAccessResolver
  readonly className?: string
  readonly t?: PipelineMediaTranslator
}

type PreviewState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'ready'; readonly resolution: Extract<PipelineMediaResolution, { status: 'ready' }> }
  | { readonly phase: 'error'; readonly reason: string }
  | { readonly phase: 'unavailable'; readonly reason: string }

const styles = buildPanelStyles({ scope: 'pipeline-media' }) + `
[data-pipeline-media]{display:flex;align-items:center;justify-content:center;min-height:92px;min-width:0;overflow:hidden;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md);color:var(--vk-text-secondary)}
[data-pipeline-media] .pipeline-media-frame{max-width:100%;max-height:100%;object-fit:contain;display:block}
[data-pipeline-media] .pipeline-media-state{display:flex;flex-direction:column;gap:var(--vk-gap-xs);padding:var(--vk-gap-md);text-align:center;font-size:var(--vk-font-small)}
[data-pipeline-media] .pipeline-media-reason{color:var(--vk-text-tertiary);word-break:break-word}
@media(prefers-reduced-motion:no-preference){[data-pipeline-media] .pipeline-media-frame{transition:opacity 140ms ease}}
`

export function PipelineMediaPreview({ entry, resolver, className, t = key => pipelineMediaZh[key] }: PipelineMediaPreviewProps): ReactNode {
  const rootRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const accessRef = useRef<Extract<PipelineMediaResolution, { status: 'ready' }> | undefined>(undefined)
  const [visible, setVisible] = useState(false)
  const [state, setState] = useState<PreviewState>({ phase: 'loading' })

  useEffect(() => {
    const element = rootRef.current
    if (element === null) return
    if (typeof IntersectionObserver !== 'function') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(entries => {
      setVisible(entries.some(item => item.isIntersecting))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const releaseCurrent = () => {
      const current = accessRef.current
      accessRef.current = undefined
      if (current !== undefined) resolver.release(current)
    }
    const load = async () => {
      setState({ phase: 'loading' })
      let resolution: PipelineMediaResolution
      try {
        resolution = await resolver.resolve(entry)
      } catch {
        if (active) setState({ phase: 'error', reason: t('error') })
        return
      }
      if (!active) {
        resolver.release(resolution)
        return
      }
      if (resolution.status !== 'ready') {
        releaseCurrent()
        setState({ phase: 'unavailable', reason: resolution.reason })
        return
      }
      releaseCurrent()
      accessRef.current = resolution
      setState({ phase: 'ready', resolution })
      const remaining = resolution.expiresAtMs - Date.now()
      timer = setTimeout(() => {
        if (active) void load()
      }, Math.min(Math.max(remaining, 0), 2_147_483_647))
    }
    void load()
    return () => {
      active = false
      if (timer !== undefined) clearTimeout(timer)
      releaseCurrent()
      videoRef.current?.pause()
    }
    // entry 标量身份决定重载；resolver/t 视为稳定注入。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, entry.ref, entry.version, entry.kind, resolver])

  const mediaError = () => {
    const current = accessRef.current
    accessRef.current = undefined
    if (current !== undefined) resolver.release(current)
    videoRef.current?.pause()
    setState({ phase: 'error', reason: t('error') })
  }

  return (
    <div ref={rootRef} className={className} data-pipeline-media="true" data-kind={entry.kind} data-phase={state.phase}>
      <style>{styles}</style>
      {state.phase === 'loading' && (
        <div className="pipeline-media-state vk-skeleton" role="status" aria-live="polite">{t('loading')}</div>
      )}
      {state.phase === 'error' && (
        <div className="pipeline-media-state" role="alert">{t('error')}</div>
      )}
      {state.phase === 'unavailable' && (
        <div className="pipeline-media-state" role="status">{t('unavailable')}<span className="pipeline-media-reason">{state.reason}</span></div>
      )}
      {state.phase === 'ready' && entry.kind === 'image' && (
        <img className="pipeline-media-frame" src={state.resolution.url} alt={entry.title} loading="lazy" onError={mediaError} />
      )}
      {state.phase === 'ready' && entry.kind === 'video' && (
        <video ref={videoRef} className="pipeline-media-frame nodrag nowheel" src={state.resolution.url} controls preload="metadata" aria-label={entry.title} onError={mediaError} />
      )}
    </div>
  )
}

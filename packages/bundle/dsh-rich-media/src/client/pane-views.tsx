/**
 * Rich Media pane views (V3 5.1, differentiation lane): registers
 * `workspace.media-library` (singleton navigator) and `workspace.media`
 * (per-resource content view) on the Pane Workbench V2 surface. Production
 * no longer contributes a second `sidebar.footer.action` workbench; the
 * legacy RichMediaWorkbench remains exported for stories only.
 *
 * @module @yeisme/dsh-rich-media/client
 */

import { useEffect, useState } from 'react'
import type { MediaRefV1 } from '../host/types.ts'
import { RichMediaCard } from './media-card.tsx'
import { MediaLibraryBody, type MediaLibraryStatus } from './media-library.tsx'
import { MediaLifecycleController } from './media-lifecycle.ts'
import { mediaRefToPreviewResource } from './preview/adapters.ts'
import type { ResourcePreviewHostV1 } from './preview/types.ts'

/** Minimal structural pane surface; avoids a hard dependency on the shell. */
export interface MediaPaneSurface {
  registerView(input: unknown): () => void
}

/** View-scoped props handed to local pane components. */
export interface PaneLocalProps {
  readonly view: { kind: string; resourceKey?: string | undefined }
  readonly projection?: unknown
  readonly retry: () => void
}

export interface MediaPaneViewDeps {
  /** Owner projection source for the library; absent renders the empty state. */
  listMedia?: (() => Promise<readonly MediaRefV1[]>) | undefined
  /** Owner-authorized preview host for per-resource access. */
  previewHost?: ResourcePreviewHostV1 | undefined
}

function statusOf(state: 'loading' | 'ready' | 'failed', count: number): MediaLibraryStatus {
  if (state === 'loading') return 'loading'
  if (state === 'failed') return 'error'
  return count === 0 ? 'empty' : 'ready'
}

/** Local factory for the singleton media library navigator. */
export function createMediaLibraryView(deps: MediaPaneViewDeps) {
  return function MediaLibraryPaneView(props: PaneLocalProps) {
    const [media, setMedia] = useState<readonly MediaRefV1[]>([])
    const [state, setState] = useState<'loading' | 'ready' | 'failed'>(deps.listMedia === undefined ? 'ready' : 'loading')
    useEffect(() => {
      if (deps.listMedia === undefined) return
      let live = true
      deps.listMedia().then(items => { if (live) { setMedia(items); setState('ready') } })
        .catch(() => { if (live) setState('failed') })
      return () => { live = false }
    }, [deps.listMedia, props.view.resourceKey])
    return (
      <MediaLibraryBody
        items={media}
        status={statusOf(state, media.length)}
        onRetry={props.retry}
      />
    )
  }
}

/** Local factory for one per-resource media content view. */
export function createMediaResourceView(deps: MediaPaneViewDeps) {
  return function MediaResourcePaneView(props: PaneLocalProps) {
    const projection = props.projection as { media?: MediaRefV1 } | undefined
    const media = projection?.media
    const [url, setUrl] = useState<string | undefined>(undefined)
    const [state, setState] = useState<'idle' | 'resolving' | 'ready' | 'error'>('idle')
    const [lifecycle] = useState(() => new MediaLifecycleController())
    useEffect(() => {
      if (media === undefined || deps.previewHost === undefined) return
      let live = true
      const resource = mediaRefToPreviewResource(media)
      setState('resolving')
      lifecycle.recordAccess()
      deps.previewHost.resolveAccess(resource).then(access => {
        if (!live) { access?.release(); return }
        if (access === undefined) { setState('error'); return }
        setUrl(access.url)
        setState('ready')
        lifecycle.applyVisibility(true)
      }).catch(() => { if (live) setState('error') })
      return () => {
        live = false
        lifecycle.applyVisibility(false)
      }
    }, [media, deps.previewHost, lifecycle])
    if (media === undefined) return <p role="status">Waiting for a media projection.</p>
    if (state === 'error') {
      return <p role="alert">Preview unavailable. <button type="button" onClick={props.retry}>Retry</button></p>
    }
    return <RichMediaCard media={media} src={url} />
  }
}

/** Register both media pane views; returns disposers. */
export function registerMediaPaneViews(pane: MediaPaneSurface, deps: MediaPaneViewDeps = {}): () => void {
  const disposeLibrary = pane.registerView({
    descriptor: {
      kind: 'workspace.media-library',
      label: 'Media Library',
      componentKey: 'media-library',
      role: 'navigator',
      preferredRegion: 'right',
      retention: 'keep-alive',
      singleton: true,
    },
    component: createMediaLibraryView(deps),
  })
  const disposeMedia = pane.registerView({
    descriptor: {
      kind: 'workspace.media',
      label: 'Media',
      componentKey: 'media-resource',
      role: 'content',
      preferredRegion: 'right',
      retention: 'snapshot',
      singleton: false,
    },
    component: createMediaResourceView(deps),
  })
  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    disposeLibrary()
    disposeMedia()
  }
}

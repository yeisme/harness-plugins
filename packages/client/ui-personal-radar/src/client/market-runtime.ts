import { createElement } from 'react'
import { createMarketReadingController, createMarketCatchupController, createMarketDetailController, createMarketCompareController, createMarketEvidenceTimelineController, createMarketReviewController, type RadarMarketHostFace } from '@yeisme/dsh-personal-radar'
import { MarketReadingView } from './market-view.js'
import { createMarketActionsController } from './market-actions.js'
import { createMarketQuestionController, type MarketQuestionSessionsFace } from './market-question.js'
import type { MarketEvidenceSourceOpener } from './market-detail-view.js'
import type { RadarPaneWorkbenchFace } from './probe.js'

export type { RadarMarketHostFace } from '@yeisme/dsh-personal-radar'
export async function mountRadarMarket(pane: RadarPaneWorkbenchFace, host: RadarMarketHostFace, sessions?: MarketQuestionSessionsFace) {
  const controller = createMarketReadingController(host.load.bind(host))
  const catchup = host.loadCatchup ? createMarketCatchupController(host.loadCatchup.bind(host)) : undefined
  const detail = host.loadSignal ? createMarketDetailController(host.loadSignal.bind(host)) : undefined
  const compare = host.loadCompare ? createMarketCompareController(host.loadCompare.bind(host)) : undefined
  const evidence = host.loadEvidence ? createMarketEvidenceTimelineController(host.loadEvidence.bind(host)) : undefined
  // Weekly review needs both the bounded discovery list and the bound read;
  // an owner exposing only one stays honestly without the review entry.
  const review = host.loadReviewIndex && host.loadReview
    ? createMarketReviewController(host.loadReviewIndex.bind(host), host.loadReview.bind(host)) : undefined
  const actions = createMarketActionsController(host, () => { void controller.refresh() })
  const question = createMarketQuestionController(sessions)
  // Safe source-open is host-owned navigation: without the seam the detail view
  // shows the stable source_open_unavailable reason and never a raw URL.
  const openSource: MarketEvidenceSourceOpener | undefined = typeof host.openEvidenceSource === 'function'
    ? async (contextRef, item) => host.openEvidenceSource!(contextRef, item, new AbortController().signal)
    : undefined
  const context = (ref: string | null) => { controller.setContext(ref); catchup?.setContext(ref); detail?.setContext(ref); compare?.setContext(ref); evidence?.setContext(ref); review?.setContext(ref); void controller.refresh() }
  const disposers: (() => void)[] = []
  try {
    disposers.push(host.subscribeContext(context))
    disposers.push(host.subscribePolicy(() => { controller.invalidatePolicy(); catchup?.invalidatePolicy(); detail?.invalidatePolicy(); compare?.invalidatePolicy(); evidence?.invalidatePolicy(); review?.invalidatePolicy() }))
    context(host.contextRef())
    // Capability gate: a deterministic missing/foreign capability shows the
    // owner's disabled reason up front; transient unavailability keeps the
    // per-read honest error states instead of a permanent notice.
    let capability: { status: 'reader_only' | 'mismatch'; reason: string } | undefined
    if (typeof host.probeCapability === 'function') {
      const probed = await host.probeCapability()
      if (probed.status === 'reader_only' || probed.status === 'mismatch') capability = { status: probed.status, reason: probed.reason }
    }
    disposers.push(pane.registerView({ descriptor: { kind: 'drama-radar.market', label: host.locale === 'en' ? 'Market changes' : '市场变化',
      componentKey: 'radarMarket', role: 'content', preferredRegion: 'either', retention: 'recreate', singleton: true },
    component: () => createElement(MarketReadingView, { controller, ...(detail ? { detail } : {}), ...(catchup ? { catchup } : {}), ...(compare ? { compare } : {}), ...(evidence ? { evidence } : {}),
      ...(review ? { review } : {}), ...(openSource ? { openSource } : {}),
      ...(actions.snapshot().available ? { actions } : {}), ...(sessions !== undefined ? { question } : {}), ...(capability !== undefined ? { capability } : {}), ...(host.locale ? { locale: host.locale } : {}) }) }))
    if (pane.registerCommand) disposers.push(pane.registerCommand({ descriptor: { id: 'drama.radar.market',
      label: host.locale === 'en' ? 'Market changes' : '市场变化' }, execute: () => pane.openView({ kind: 'drama-radar.market' }) }))
  } catch {
    controller.dispose()
    catchup?.dispose()
    detail?.dispose()
    compare?.dispose()
    evidence?.dispose()
    review?.dispose()
    actions.dispose()
    question.dispose()
    for (const dispose of disposers.reverse()) dispose()
    throw new Error('market_mount_failed')
  }
  let disposed = false
  return { controller, dispose() {
    if (disposed) return
    disposed = true
    controller.dispose()
    catchup?.dispose()
    detail?.dispose()
    compare?.dispose()
    evidence?.dispose()
    review?.dispose()
    actions.dispose()
    question.dispose()
    for (const dispose of disposers.reverse()) dispose()
  } }
}
export function isRadarMarketHost(input: unknown): input is RadarMarketHostFace {
  const row = input as Partial<RadarMarketHostFace> | null
  return !!row && row.schema === 'dsh.radar.market-host.v1' && typeof row.load === 'function' &&
    typeof row.contextRef === 'function' && typeof row.subscribeContext === 'function' && typeof row.subscribePolicy === 'function'
}

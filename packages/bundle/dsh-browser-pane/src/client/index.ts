import type { Context } from '@deepseek-ai/cordis'
import { createElement } from 'react'
import {
  BROWSER_PANE_CLIENT_EXPERIMENTAL, BROWSER_PANE_CLIENT_VIEW_KIND,
  BrowserPaneProviderView,
  browserEn, browserPseudoLong, browserPseudoRtl, browserZh, defaultBrowserPaneTranslator,
  deriveBrowserPaneView, gateBrowserPaneSurfaces, reduceBrowserPane,
  type BrowserPaneKey, type BrowserPaneTranslator, type BrowserViewportTransportV1,
} from '@yeisme/dsh-client-ui-browser-pane'
import {
  DSH_BROWSER_PANE_HOST_CONTEXT_KEY,
  type BrowserAutomationBindingV1, type BrowserAutomationProviderV1, type BrowserPaneHostV1,
} from '@yeisme/dsh-browser-host'
import {
  DSH_BROWSER_AUTOMATION_BINDING_CONTEXT_KEY, DSH_BROWSER_AUTOMATION_PROVIDER_CONTEXT_KEY, applyBrowserPaneRegistration,
} from '../registration.js'

export { BROWSER_PANE_CLIENT_VIEW_KIND, BROWSER_PANE_CLIENT_EXPERIMENTAL, deriveBrowserPaneView, gateBrowserPaneSurfaces, reduceBrowserPane }
export const name = 'dsh-browser-pane/client'
export const inject: readonly string[] = ['paneWorkbench']
const NS = 'browserPane'

function get(ctx: Context, key: string): unknown {
  try { return (ctx as unknown as { get?(name: never): unknown }).get?.(key as never) } catch { return undefined }
}

function providerFrom(ctx: Context): BrowserAutomationProviderV1 | undefined {
  const direct = get(ctx, DSH_BROWSER_AUTOMATION_PROVIDER_CONTEXT_KEY) as BrowserAutomationProviderV1 | undefined
  if (direct !== undefined && typeof direct.discoverSessions === 'function' && typeof direct.openSession === 'function') return direct
  const host = get(ctx, DSH_BROWSER_PANE_HOST_CONTEXT_KEY) as BrowserPaneHostV1 | undefined
  if (host === undefined || typeof host.listSessions !== 'function') return undefined
  return { id: 'browser-pane-host', discoverSessions: () => host.listSessions(), openSession: async sessionRef => (await host.listSessions()).includes(sessionRef) ? host : undefined }
}

function translatorFrom(ctx: Context): { readonly t: BrowserPaneTranslator; readonly dispose: () => void } {
  const locale = get(ctx, 'locale') as { register?(ns: string, tables: unknown): () => void; bind?(ns: string): ((key: BrowserPaneKey, params?: Readonly<Record<string, string | number>>) => string) } | undefined
  const dispose = locale?.register?.(NS, { zh: browserZh, en: browserEn, 'pseudo-long': browserPseudoLong, 'pseudo-rtl': browserPseudoRtl }) ?? (() => {})
  return { t: locale?.bind?.(NS) ?? defaultBrowserPaneTranslator, dispose }
}

/** Real browser entry: registers the React view and command in the client Pane registry. */
export async function apply(ctx: Context): Promise<() => void> {
  const pane = get(ctx, 'paneWorkbench') as { registerView(input: unknown): () => void; registerCommand(input: unknown): () => void; openView?(request: unknown): void } | undefined
  const transport = get(ctx, 'dsh.browserViewportTransport') as BrowserViewportTransportV1 | undefined
  const binding = get(ctx, DSH_BROWSER_AUTOMATION_BINDING_CONTEXT_KEY) as BrowserAutomationBindingV1 | undefined
  const locale = translatorFrom(ctx)
  const provider = providerFrom(ctx)
  const registration = await applyBrowserPaneRegistration({ pane, provider, binding, viewportTransport: transport, viewportTransportAvailable: transport !== undefined, labels: { open: locale.t('title') }, translator: locale.t, component: () => createElement(BrowserPaneProviderView, { provider, binding, transport, t: locale.t }) })
  return () => { registration.dispose(); locale.dispose() }
}

const BrowserPaneClientPlugin = { name, inject, apply }
export default BrowserPaneClientPlugin

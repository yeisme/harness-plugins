/**
 * DSH Web template-registry client entry (tasks 3.1/3.2).
 *
 * Real wiring: the 模板目录 and 引导编译 panes register into the Pane
 * Workbench runtime via `registerView`, and the /template command entries
 * via `registerCommand`. Every dependency is probed first: without the
 * official pane slot or the `templateRegistryHost` Remote the plugin
 * registers nothing beyond a probe-only face carrying the disabled reason —
 * no private DOM, no iframe, no fork fallback, no polling.
 *
 * The disposer is exact and symmetric; a second apply on a mounted context
 * is a no-op and after dispose apply rebuilds cleanly (HMR-safe).
 *
 * @module @yeisme/dsh-client-ui-template-registry/client
 */

import { createElement, type ReactNode } from 'react'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { TemplateCatalogView } from './catalog-view.js'
import { TemplateCompileView } from './compile-view.js'
import { createTemplateCatalogController } from './catalog-controller.js'
import { createTemplateCompileController } from './compile-controller.js'
import {
  probeTemplateRegistryClient,
  type TemplateRegistryClientProbeResultV1,
  type TemplateRegistryLocale,
} from './seam.js'

export const TEMPLATE_REGISTRY_VIEW_KINDS = {
  catalog: 'template-registry.catalog',
  compile: 'template-registry.compile',
} as const

export interface TemplateRegistryCommandSpec {
  readonly id: string
  readonly labelZh: string
  readonly labelEn: string
  readonly hint: string
}

export const TEMPLATE_REGISTRY_COMMAND_SPECS: readonly TemplateRegistryCommandSpec[] = [
  { id: 'template.registry.catalog', labelZh: '模板目录', labelEn: 'Template catalog', hint: '/template catalog' },
  { id: 'template.registry.compile', labelZh: '引导编译', labelEn: 'Guided compile', hint: '/template compile' },
] as const

/** Face provided on the context for other panes/tests (`templateRegistryPane`). */
export interface TemplateRegistryPaneFaceV1 {
  readonly probe: TemplateRegistryClientProbeResultV1
  openCatalog(): void
  /** Pin a template in the guided-compile pane and open it (cross-pane link). */
  openCompile(ref: string): void
}

type ContextServices = Pick<ClientContext, 'get' | 'provide'>

function readContextService<T>(ctx: ContextServices, name: string): T | undefined {
  try {
    return ctx.get(name as never) as T | undefined
  } catch {
    return undefined
  }
}

function provide(ctx: ContextServices, name: string, value: unknown): () => void {
  try {
    return (ctx as unknown as { provide(name: string, value: unknown): () => void }).provide(name as never, value) as () => void
  } catch {
    return () => {}
  }
}

/**
 * Mounts the template-registry client face and returns an exact, idempotent
 * disposer. Missing seams fail closed with a probe-only face that carries the
 * disabled reason (the capability matrix explains why the entry is absent).
 */
export async function apply(ctx: ClientContext): Promise<() => void> {
  const existing = readContextService<TemplateRegistryPaneFaceV1>(ctx, 'templateRegistryPane')
  if (existing !== undefined) return () => {}

  const { probe, pane, host } = await probeTemplateRegistryClient(ctx)
  if (pane === undefined || host === undefined) {
    const probeOnlyFace: Pick<TemplateRegistryPaneFaceV1, 'probe'> = { probe }
    const unprovide = provide(ctx, 'templateRegistryPane', probeOnlyFace)
    return () => { unprovide() }
  }

  const locale: TemplateRegistryLocale = host.locale ?? 'zh'
  const catalog = createTemplateCatalogController(host)
  const compile = createTemplateCompileController(host)
  const disposers: (() => void)[] = []
  let disposed = false

  const openCatalog = (): void => {
    pane.openView({ kind: TEMPLATE_REGISTRY_VIEW_KINDS.catalog, role: 'content', preferredRegion: 'either', retention: 'recreate', singleton: true })
  }

  const openCompile = (ref: string): void => {
    void compile.pinTemplate(ref)
    pane.openView({ kind: TEMPLATE_REGISTRY_VIEW_KINDS.compile, role: 'content', preferredRegion: 'either', retention: 'recreate', singleton: true })
  }

  disposers.push(pane.registerView({
    descriptor: {
      kind: TEMPLATE_REGISTRY_VIEW_KINDS.catalog,
      label: locale === 'en' ? 'Template catalog' : '模板目录',
      componentKey: 'templateRegistryCatalog',
      role: 'content',
      preferredRegion: 'either',
      retention: 'recreate',
      singleton: true,
    },
    component: (): ReactNode => createElement(TemplateCatalogView, { controller: catalog, locale, onCompile: template => openCompile(template.ref) }),
  }))
  disposers.push(pane.registerView({
    descriptor: {
      kind: TEMPLATE_REGISTRY_VIEW_KINDS.compile,
      label: locale === 'en' ? 'Guided compile' : '引导编译',
      componentKey: 'templateRegistryCompile',
      role: 'content',
      preferredRegion: 'either',
      retention: 'recreate',
      singleton: true,
    },
    component: (): ReactNode => createElement(TemplateCompileView, { controller: compile, locale, onOpenCatalog: openCatalog }),
  }))
  if (typeof pane.registerCommand === 'function') {
    const catalogCommandId = TEMPLATE_REGISTRY_COMMAND_SPECS[0]?.id
    for (const spec of TEMPLATE_REGISTRY_COMMAND_SPECS) {
      disposers.push(pane.registerCommand({
        descriptor: {
          id: spec.id,
          label: locale === 'en' ? spec.labelEn : spec.labelZh,
          slash: { name: 'template', hint: spec.hint, category: 'work' },
        },
        execute: () => (spec.id === catalogCommandId ? openCatalog() : pane.openView({ kind: TEMPLATE_REGISTRY_VIEW_KINDS.compile })),
      }))
    }
  }

  const face: TemplateRegistryPaneFaceV1 = { probe, openCatalog, openCompile }
  const unprovide = provide(ctx, 'templateRegistryPane', face)

  return () => {
    if (disposed) return
    disposed = true
    unprovide()
    for (const dispose of disposers.reverse()) dispose()
    catalog.dispose()
    compile.dispose()
  }
}

export {
  probeTemplateRegistryClient,
  TEMPLATE_REGISTRY_CLIENT_PROBE_REASONS,
} from './seam.js'
export type {
  TemplateRegistryClientDependency,
  TemplateRegistryClientProbeEntryV1,
  TemplateRegistryClientProbeResultV1,
  TemplateRegistryClientProbeResolutionV1,
  TemplateRegistryHostFace,
  TemplateRegistryPaneWorkbenchFace,
  TemplateRegistryLocale,
} from './seam.js'

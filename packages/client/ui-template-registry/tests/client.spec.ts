import './primitives.js'
import { describe, expect, it } from 'vitest'
import {
  TEMPLATE_REGISTRY_COMMAND_SPECS,
  TEMPLATE_REGISTRY_VIEW_KINDS,
  apply,
  type TemplateRegistryPaneFaceV1,
} from '../src/client.js'
import type { TemplateRegistryClientProbeResultV1 } from '../src/seam.js'
import { createFakeHost } from './fake-host.js'

function fakePane() {
  const views = new Map<string, unknown>()
  const commands = new Map<string, unknown>()
  const opened: string[] = []
  return {
    views,
    commands,
    opened,
    face: {
      registerView(input: { descriptor: { kind: string } }) {
        if (views.has(input.descriptor.kind)) throw new Error(`duplicate view ${input.descriptor.kind}`)
        views.set(input.descriptor.kind, input)
        return () => views.delete(input.descriptor.kind)
      },
      registerCommand(input: { descriptor: { id: string } }) {
        if (commands.has(input.descriptor.id)) throw new Error(`duplicate command ${input.descriptor.id}`)
        commands.set(input.descriptor.id, input)
        return () => commands.delete(input.descriptor.id)
      },
      openView(request: { kind: string }) {
        opened.push(request.kind)
      },
    },
  }
}

function fakeCtx(services: Record<string, unknown>) {
  const provided = new Map<string, unknown>(Object.entries(services))
  return {
    get(name: string) {
      return provided.get(name)
    },
    provide(name: string, value: unknown) {
      provided.set(name, value)
      return () => {
        provided.delete(name)
      }
    },
  }
}

describe('template-registry client apply (tasks 3.1/3.2/3.3 entry)', () => {
  it('registers the catalog and compile views plus the /template command entries when seams probe', async () => {
    const pane = fakePane()
    const ctx = fakeCtx({ paneWorkbench: pane.face, templateRegistryHost: createFakeHost() })
    const dispose = await apply(ctx as never)

    expect(pane.views.has(TEMPLATE_REGISTRY_VIEW_KINDS.catalog)).toBe(true)
    expect(pane.views.has(TEMPLATE_REGISTRY_VIEW_KINDS.compile)).toBe(true)
    expect(pane.commands.size).toBe(TEMPLATE_REGISTRY_COMMAND_SPECS.length)

    dispose()
    expect(pane.views.size).toBe(0)
    expect(pane.commands.size).toBe(0)
    expect(ctx.get('templateRegistryPane')).toBeUndefined()
  })

  it('second apply is a no-op on an already-mounted context and its disposer removes nothing', async () => {
    const pane = fakePane()
    const ctx = fakeCtx({ paneWorkbench: pane.face, templateRegistryHost: createFakeHost() })
    const first = await apply(ctx as never)
    const second = await apply(ctx as never)
    expect(pane.views.size).toBe(2)
    second()
    expect(pane.views.size).toBe(2)
    first()
    expect(pane.views.size).toBe(0)
  })

  it('reinstall after dispose restores exactly one registration set (HMR-safe)', async () => {
    const pane = fakePane()
    const ctx = fakeCtx({ paneWorkbench: pane.face, templateRegistryHost: createFakeHost() })
    const first = await apply(ctx as never)
    first()
    const reinstall = await apply(ctx as never)
    expect(pane.views.size).toBe(2)
    expect(pane.commands.size).toBe(TEMPLATE_REGISTRY_COMMAND_SPECS.length)
    reinstall()
    expect(pane.views.size).toBe(0)
  })

  it('fails closed with a probe-only face when the host Remote is missing', async () => {
    const pane = fakePane()
    const ctx = fakeCtx({ paneWorkbench: pane.face })
    const dispose = await apply(ctx as never)
    const face = ctx.get('templateRegistryPane') as { probe: TemplateRegistryClientProbeResultV1 }
    expect(face).toBeDefined()
    expect(face.probe.available).toBe(false)
    expect(face.probe.templateRegistryHost.reason).toContain('needs_template_registry')
    expect(pane.views.size).toBe(0)
    dispose()
    expect(ctx.get('templateRegistryPane')).toBeUndefined()
  })

  it('fails closed when the pane slot is missing', async () => {
    const ctx = fakeCtx({ templateRegistryHost: createFakeHost() })
    const dispose = await apply(ctx as never)
    const face = ctx.get('templateRegistryPane') as { probe: TemplateRegistryClientProbeResultV1 }
    expect(face.probe.available).toBe(false)
    expect(face.probe.paneWorkbench.reason).toContain('seam_unavailable')
    dispose()
  })

  it('rejects a structurally foreign host service (schema discriminator)', async () => {
    const pane = fakePane()
    const foreign = { ...createFakeHost(), schema: 'something.else.v1' }
    const ctx = fakeCtx({ paneWorkbench: pane.face, templateRegistryHost: foreign })
    await apply(ctx as never)
    const face = ctx.get('templateRegistryPane') as { probe: TemplateRegistryClientProbeResultV1 }
    expect(face.probe.available).toBe(false)
    expect(face.probe.templateRegistryHost.reason).toContain('needs_template_registry')
    expect(pane.views.size).toBe(0)
  })

  it('keeps the panes mounted when the host seam is only degraded (panes own the honest state)', async () => {
    const pane = fakePane()
    const degraded = createFakeHost({ health: { state: 'degraded', reason: 'transport_lost', catalogDigest: 'sha256:catalog-snapshot-1' } })
    const ctx = fakeCtx({ paneWorkbench: pane.face, templateRegistryHost: degraded })
    const dispose = await apply(ctx as never)
    expect(pane.views.size).toBe(2)
    dispose()
  })

  it('the provided face opens both panes and pins the compile target', async () => {
    const pane = fakePane()
    const ctx = fakeCtx({ paneWorkbench: pane.face, templateRegistryHost: createFakeHost() })
    const dispose = await apply(ctx as never)
    const face = ctx.get('templateRegistryPane') as TemplateRegistryPaneFaceV1
    face.openCatalog()
    face.openCompile('solution/demo/templates/main@en')
    expect(pane.opened).toStrictEqual([TEMPLATE_REGISTRY_VIEW_KINDS.catalog, TEMPLATE_REGISTRY_VIEW_KINDS.compile])
    dispose()
  })
})

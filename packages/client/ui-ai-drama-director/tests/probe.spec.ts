import { describe, expect, it } from 'vitest'
import {
  dramaCommandAvailability,
  dramaViewAvailability,
  probeDramaCapability,
  DRAMA_PROBE_REASONS,
} from '../src/client/probe.js'

function fakeCtx(services: Record<string, unknown>) {
  return {
    get(name: string) {
      if (name.startsWith('remote.')) {
        const remote = services.remote as Record<string, unknown> | undefined
        return remote?.[name.slice('remote.'.length)]
      }
      return services[name]
    },
  }
}

function fakePane() {
  return {
    registerView: () => () => {},
    openView: () => {},
    registerCommand: () => () => {},
  }
}

const fakeProjection = { snapshot: async () => ({}) }
const fakeDramaHost = { snapshot: async () => ({}), dispatch: async () => ({}) }
const fakeSlashDirectory = { snapshot: () => ({}), subscribe: () => () => {} }

describe('probeDramaCapability', () => {
  it('fails closed with reasons when nothing is installed', async () => {
    const { probe, pane, dramaHost, creatorStudio } = await probeDramaCapability(fakeCtx({}) as never)

    expect(probe.available).toBe(false)
    expect(probe.paneWorkbench.available).toBe(false)
    expect(probe.paneWorkbench.reason).toBe(DRAMA_PROBE_REASONS.paneWorkbench)
    expect(probe.creatorStudio.reason).toBe(DRAMA_PROBE_REASONS.creatorStudio)
    expect(probe.dramaHost.reason).toBe(DRAMA_PROBE_REASONS.dramaHost)
    expect(probe.commandExperience.reason).toBe(DRAMA_PROBE_REASONS.commandExperience)
    expect(probe.commandRouter.available).toBe(false)
    expect(pane).toBeUndefined()
    expect(dramaHost).toBeUndefined()
    expect(creatorStudio).toBeUndefined()
  })

  it('never throws when ctx.get throws', async () => {
    const ctx = { get: () => { throw new Error('no services') } }
    const { probe } = await probeDramaCapability(ctx as never)
    expect(probe.available).toBe(false)
    expect(probe.paneWorkbench.available).toBe(false)
  })

  it('resolves transports through the remote mount point', async () => {
    const ctx = fakeCtx({
      paneWorkbench: fakePane(),
      remote: { creatorStudio: fakeProjection, dramaDirector: fakeDramaHost },
      slashDirectory: fakeSlashDirectory,
    })
    const { probe, pane, creatorStudio, dramaHost, slashDirectory } = await probeDramaCapability(ctx as never)

    expect(probe.available).toBe(true)
    expect(probe.commandExperience.available).toBe(true)
    expect(pane).toBeDefined()
    expect(creatorStudio).toBe(fakeProjection)
    expect(dramaHost).toBe(fakeDramaHost)
    expect(slashDirectory).toBe(fakeSlashDirectory)
  })

  it('treats the router seam as enhancement-only', async () => {
    const ctx = fakeCtx({
      paneWorkbench: fakePane(),
      remote: { creatorStudio: fakeProjection, dramaDirector: fakeDramaHost },
      slashDirectory: fakeSlashDirectory,
    })
    const without = await probeDramaCapability(ctx as never)
    expect(without.probe.available).toBe(true)
    expect(without.probe.commandRouter.available).toBe(false)

    const withRouter = await probeDramaCapability(fakeCtx({
      paneWorkbench: fakePane(),
      remote: { creatorStudio: fakeProjection, dramaDirector: fakeDramaHost },
      slashDirectory: fakeSlashDirectory,
      commandExperienceRouter: { project: () => ({}) },
    }) as never)
    expect(withRouter.probe.commandRouter.available).toBe(true)
    expect(withRouter.probe.available).toBe(true)
  })

  it('reports no reserved-name conflicts for the drama slash contribution', async () => {
    const { probe } = await probeDramaCapability(fakeCtx({}) as never)
    expect(probe.slashConflicts).toEqual([])
  })
})

describe('probe → view/command availability mapping', () => {
  it('maps a missing creator-studio projection to Review/Run/secondary disables', async () => {
    const ctx = fakeCtx({ paneWorkbench: fakePane(), remote: { dramaDirector: fakeDramaHost } })
    const { probe } = await probeDramaCapability(ctx as never)

    for (const view of ['Review', 'Run', 'Story', 'Visual', 'Audio'] as const) {
      const availability = dramaViewAvailability(probe, view)
      expect(availability.disabled).toBe(true)
      expect(availability.reason).toBe('missing creator-studio projection')
    }
    // Context only needs the drama host transport; help/hub stay available.
    expect(dramaViewAvailability(probe, 'Context').disabled).toBe(false)
    expect(dramaCommandAvailability(probe, 'drama.help').disabled).toBe(false)
    expect(dramaCommandAvailability(probe, 'drama.review').reason).toBe('missing creator-studio projection')
  })

  it('maps a missing drama host transport to context/mutation disables', async () => {
    const ctx = fakeCtx({ paneWorkbench: fakePane(), remote: { creatorStudio: fakeProjection } })
    const { probe } = await probeDramaCapability(ctx as never)

    expect(dramaViewAvailability(probe, 'Context').reason).toBe('missing drama owner projection')
    expect(dramaViewAvailability(probe, 'Story').disabled).toBe(false)
    expect(dramaCommandAvailability(probe, 'drama.open').disabled).toBe(false)
    expect(dramaCommandAvailability(probe, 'drama.handoff').reason).toBe('missing drama owner projection')
    expect(dramaCommandAvailability(probe, 'drama.evidence').disabled).toBe(true)
  })

  it('disables everything with the pane reason when pane workbench is absent', async () => {
    const { probe } = await probeDramaCapability(fakeCtx({}) as never)
    expect(dramaViewAvailability(probe, 'Context').reason).toBe(DRAMA_PROBE_REASONS.paneWorkbench)
    expect(dramaCommandAvailability(probe, 'drama').reason).toBe(DRAMA_PROBE_REASONS.paneWorkbench)
  })

  it('rejects unknown command ids fail-closed', async () => {
    const ctx = fakeCtx({
      paneWorkbench: fakePane(),
      remote: { creatorStudio: fakeProjection, dramaDirector: fakeDramaHost },
    })
    const { probe } = await probeDramaCapability(ctx as never)
    const availability = dramaCommandAvailability(probe, 'drama.nope')
    expect(availability.disabled).toBe(true)
    expect(availability.reason).toBe('unknown drama command')
  })
})

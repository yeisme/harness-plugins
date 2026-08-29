import { describe, expect, it } from 'vitest'
import { createComposedWorkbenchRegistry } from '../src/composed-registry.ts'
import {
  createDefaultWorkbenchScenarioMapping,
  resolveWorkbenchScenarioModules,
  validateWorkbenchScenarioMapping,
  WORKBENCH_SCENARIO_MAPPING_SCHEMA,
  WORKBENCH_SCENARIO_MAPPING_VERSION,
} from '../src/scenario-mapping.ts'

const COMPOSED_MODULE_IDS = ['dsh-file-document', 'dsh-rich-media', 'dsh-terminal']

describe('workbench scenario mapping validation', () => {
  it('ships a valid versioned default mapping for Drama/Code/Review/Media', () => {
    const mapping = createDefaultWorkbenchScenarioMapping()
    expect(validateWorkbenchScenarioMapping(mapping)).toEqual({ ok: true, value: mapping })
    expect(mapping.schema).toBe(WORKBENCH_SCENARIO_MAPPING_SCHEMA)
    expect(mapping.version).toBe(WORKBENCH_SCENARIO_MAPPING_VERSION)
    expect(Object.keys(mapping.scenarios).sort()).toEqual(['code', 'drama', 'media', 'review'])
  })

  it('fails closed on invalid mappings', () => {
    const mapping = createDefaultWorkbenchScenarioMapping()
    expect(validateWorkbenchScenarioMapping(undefined)).toMatchObject({ ok: false })
    expect(validateWorkbenchScenarioMapping({ ...mapping, schema: 'workbench.scenario-mapping.v0' })).toMatchObject({ ok: false })
    expect(validateWorkbenchScenarioMapping({ ...mapping, version: '1.0' })).toMatchObject({ ok: false })
    expect(validateWorkbenchScenarioMapping({ ...mapping, scenarios: { 'Drama!': [] } })).toMatchObject({ ok: false })
    expect(validateWorkbenchScenarioMapping({ ...mapping, scenarios: { drama: [] } })).toMatchObject({ ok: false })
    expect(validateWorkbenchScenarioMapping({ ...mapping, scenarios: { drama: [{ moduleId: '../escape' }] } })).toMatchObject({ ok: false })
    expect(validateWorkbenchScenarioMapping({
      ...mapping,
      scenarios: { drama: [{ moduleId: 'dsh-terminal' }, { moduleId: 'dsh-terminal' }] },
    })).toMatchObject({ ok: false })
  })

  it('rejects install hints that carry URLs or absolute paths', () => {
    const mapping = createDefaultWorkbenchScenarioMapping()
    expect(validateWorkbenchScenarioMapping({
      ...mapping,
      scenarios: { drama: [{ moduleId: 'dsh-terminal', installHint: 'https://packages.example/dsh-terminal' }] },
    })).toMatchObject({ ok: false })
    expect(validateWorkbenchScenarioMapping({
      ...mapping,
      scenarios: { drama: [{ moduleId: 'dsh-terminal', installHint: '/home/user/bundles/dsh-terminal' }] },
    })).toMatchObject({ ok: false })
  })
})

describe('workbench scenario resolution', () => {
  it('enables exactly the declared modules when all are installed', () => {
    const resolution = resolveWorkbenchScenarioModules(createDefaultWorkbenchScenarioMapping(), 'code', COMPOSED_MODULE_IDS)
    expect(resolution).toEqual({
      ok: true,
      scenario: 'code',
      version: WORKBENCH_SCENARIO_MAPPING_VERSION,
      entries: [
        { moduleId: 'dsh-file-document', enabled: true },
        { moduleId: 'dsh-terminal', enabled: true },
      ],
    })
  })

  it('disables entries referencing uninstalled modules with install guidance and keeps the rest enabled', () => {
    const registry = createComposedWorkbenchRegistry()
    const resolution = resolveWorkbenchScenarioModules(createDefaultWorkbenchScenarioMapping(), 'drama', registry)
    expect(resolution.ok).toBe(true)
    if (!resolution.ok) return
    expect(resolution.entries).toEqual([
      {
        moduleId: 'dsh-ai-drama-director',
        enabled: false,
        reason: 'module_not_installed',
        installHint: 'dsh plugin add @yeisme/dsh-ai-drama-director',
      },
      { moduleId: 'dsh-file-document', enabled: true },
      { moduleId: 'dsh-rich-media', enabled: true },
    ])
  })

  it('never fabricates undeclared modules and never silently skips declared ones', () => {
    const resolution = resolveWorkbenchScenarioModules(createDefaultWorkbenchScenarioMapping(), 'media', [])
    expect(resolution.ok).toBe(true)
    if (!resolution.ok) return
    expect(resolution.entries.map(entry => entry.moduleId)).toEqual(['dsh-rich-media', 'dsh-file-document'])
    expect(resolution.entries.every(entry => !entry.enabled && entry.reason === 'module_not_installed')).toBe(true)
  })

  it('fails closed on invalid mappings and undeclared scenarios', () => {
    expect(resolveWorkbenchScenarioModules({ schema: 'nope' }, 'code', COMPOSED_MODULE_IDS)).toMatchObject({ ok: false, reason: 'mapping_invalid' })
    expect(resolveWorkbenchScenarioModules(createDefaultWorkbenchScenarioMapping(), 'writing', COMPOSED_MODULE_IDS)).toMatchObject({ ok: false, reason: 'scenario_not_declared' })
  })
})

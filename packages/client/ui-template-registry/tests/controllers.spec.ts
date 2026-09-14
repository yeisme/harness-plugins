import { describe, expect, it } from 'vitest'
import { createFakeHost, fakeInspection, fakeTemplate } from './fake-host.js'
import {
  createTemplateCatalogController,
  filterTemplates,
  moveCatalogSelection,
} from '../src/catalog-controller.js'
import {
  composeConfirmDecisionRef,
  createTemplateCompileController,
  isCompileArmed,
  missingRequiredFields,
  suggestExportName,
} from '../src/compile-controller.js'

async function settle(steps = 4): Promise<void> {
  for (let index = 0; index < steps; index += 1) await Promise.resolve()
}

describe('catalog controller state matrix', () => {
  it('folds a successful mcp browse into ready with the templates', async () => {
    const controller = createTemplateCatalogController(createFakeHostWithTemplates())
    await controller.refresh()
    const state = controller.snapshot()
    expect(state.phase).toBe('ready')
    expect(state.origin).toBe('mcp')
    expect(state.templates).toHaveLength(2)
  })

  it('folds offline into an error state with the stable offline reason', async () => {
    const controller = createTemplateCatalogController(createFakeHost({ browseFailure: { kind: 'offline' } }))
    await controller.refresh()
    const state = controller.snapshot()
    expect(state.phase).toBe('error')
    expect(state.errorReason).toBe('offline')
  })

  it('surfaces the owner error code verbatim without raw text', async () => {
    const controller = createTemplateCatalogController(createFakeHost({ browseFailure: { kind: 'registry_error', code: 'INPUT_INVALID', retryable: false } }))
    await controller.refresh()
    const state = controller.snapshot()
    expect(state.phase).toBe('error')
    expect(state.errorReason).toBe('registry_error')
    expect(state.errorCode).toBe('INPUT_INVALID')
  })

  it('keeps serving the degraded catalog snapshot with origin catalog', async () => {
    const controller = createTemplateCatalogController(createFakeHost({ browseOrigin: 'catalog' }))
    await controller.refresh()
    const state = controller.snapshot()
    expect(state.phase).toBe('ready')
    expect(state.origin).toBe('catalog')
  })

  it('sends active filters to the host browse and folds them pane-side', async () => {
    const host = createFakeHostWithTemplates()
    const controller = createTemplateCatalogController(host)
    controller.setFilters({ query: 'demo', tag: 'category:demo' })
    await settle()
    expect(host.calls.browseInputs.at(-1)).toMatchObject({ query: 'demo', tag: 'category:demo' })
    expect(filterTemplates(host.calls.browseInputs.length > 0 ? controller.snapshot().templates : [], { query: 'DEMO', tag: null, capability: null })).toHaveLength(2)
  })

  it('loads the inspect detail and folds not_found into an error detail', async () => {
    const controller = createTemplateCatalogController(createFakeHost({ inspection: fakeInspection() }))
    await controller.refresh()
    await controller.select('solution/demo-template/templates/main@en')
    expect(controller.snapshot().detail?.phase).toBe('ready')

    const missing = createTemplateCatalogController(createFakeHost({ inspectFailure: { kind: 'not_found' } }))
    await missing.refresh()
    await missing.select('solution/gone/templates/main@en')
    expect(missing.snapshot().detail?.phase).toBe('error')
    expect(missing.snapshot().detail?.reason).toBe('not_found')
  })

  it('retry re-runs the capability probe before refreshing', async () => {
    const host = createFakeHostWithTemplates()
    const controller = createTemplateCatalogController(host)
    await controller.retry()
    expect(host.calls.probeCount).toBe(1)
    expect(controller.snapshot().phase).toBe('ready')
  })

  it('roving selection helper moves within bounds and clamps', () => {
    expect(moveCatalogSelection('ArrowDown', 0, 3)).toBe(1)
    expect(moveCatalogSelection('ArrowDown', 2, 3)).toBe(2)
    expect(moveCatalogSelection('ArrowUp', 2, 3)).toBe(1)
    expect(moveCatalogSelection('Home', 2, 3)).toBe(0)
    expect(moveCatalogSelection('End', 0, 3)).toBe(2)
    expect(moveCatalogSelection('ArrowDown', 0, 0)).toBe(-1)
    expect(moveCatalogSelection('Enter', 1, 3)).toBe(1)
  })
})

describe('compile controller gate and stale fold', () => {
  it('pins a template through inspect and exposes the contract form', async () => {
    const controller = createTemplateCompileController(createFakeHost({ inspection: fakeInspection() }))
    await controller.pinTemplate('solution/demo-template/templates/main@en')
    const state = controller.snapshot()
    expect(state.phase).toBe('form')
    expect(state.inspection?.contract.inputs).toHaveLength(3)
    expect(state.pinnedDigest).toBe('sha256:template-demo-1')
  })

  it('refuses to start a session without a goal', async () => {
    const controller = createTemplateCompileController(createFakeHost({ inspection: fakeInspection() }))
    await controller.pinTemplate('solution/demo-template/templates/main@en')
    await controller.startSession()
    expect(controller.snapshot().error?.code).toBe('invalid_input')
  })

  it('composes the decision ref only on the explicit confirm action', async () => {
    const host = createFakeHost({ inspection: fakeInspection() })
    const controller = createTemplateCompileController(host)
    await controller.pinTemplate('solution/demo-template/templates/main@en')
    controller.setGoal('demo goal')
    await controller.startSession()
    const session = controller.snapshot().session
    expect(session).toBeDefined()
    expect(host.calls.decisionRefs).toHaveLength(0)

    await controller.confirm()
    expect(host.calls.decisionRefs).toStrictEqual([composeConfirmDecisionRef(session!.id, session!.revision)])
    expect(composeConfirmDecisionRef('s1', 3)).toBe('dsh.template-registry.confirm.v1.s1.3')
    expect(controller.snapshot().session?.confirmed).toBe(true)
  })

  it('compile stays unarmed until confirmed and all required drafts are filled', async () => {
    const controller = createTemplateCompileController(createFakeHost({ inspection: fakeInspection() }))
    await controller.pinTemplate('solution/demo-template/templates/main@en')
    controller.setGoal('demo goal')
    await controller.startSession()
    expect(isCompileArmed(controller.snapshot())).toBe(false)
    expect(missingRequiredFields(controller.snapshot().inspection, controller.snapshot().fields)).toStrictEqual(['subject', 'audience'])

    controller.setField('subject', 'a castle')
    controller.setField('audience', 'children')
    await controller.submitFields()
    await controller.confirm()
    expect(isCompileArmed(controller.snapshot())).toBe(true)
  })

  it('compiles with zero provider calls and folds the result card facts', async () => {
    const controller = createTemplateCompileController(createFakeHost({ inspection: fakeInspection() }))
    await controller.pinTemplate('solution/demo-template/templates/main@en')
    controller.setGoal('demo goal')
    await controller.startSession()
    controller.setField('subject', 'a castle')
    controller.setField('audience', 'children')
    await controller.submitFields()
    await controller.confirm()
    await controller.compile()
    const state = controller.snapshot()
    expect(state.phase).toBe('compiled')
    expect(state.compile?.compileId).toMatch(/^c/)
    expect(state.session?.provider_calls).toBe(0)
  })

  it('surfaces the not_confirmed guard verbatim when compiling unconfirmed', async () => {
    const controller = createTemplateCompileController(createFakeHost({ inspection: fakeInspection(), compileGuard: 'not_confirmed' }))
    await controller.pinTemplate('solution/demo-template/templates/main@en')
    controller.setGoal('demo goal')
    await controller.startSession()
    controller.setField('subject', 'a castle')
    controller.setField('audience', 'children')
    await controller.submitFields()
    await controller.compile()
    expect(controller.snapshot().error?.code).toBe('not_confirmed')
  })

  it('digest drift marks the session stale and disables export until re-pin', async () => {
    // Template digest changed upstream: the freshness re-inspect sees drift.
    const script: { inspection?: ReturnType<typeof fakeInspection> } = { inspection: fakeInspection() }
    const driftedController = createTemplateCompileController(createFakeHost(script))
    await driftedController.pinTemplate('solution/demo-template/templates/main@en')
    driftedController.setGoal('demo goal')
    await driftedController.startSession()
    driftedController.setField('subject', 'a')
    driftedController.setField('audience', 'b')
    await driftedController.submitFields()
    await driftedController.confirm()
    await driftedController.compile()
    expect(driftedController.snapshot().stale).toBe(false)

    script.inspection = fakeInspection({ template: fakeTemplate({ digest: 'sha256:template-demo-2' }) })
    await driftedController.checkFreshness()
    const state = driftedController.snapshot()
    expect(state.stale).toBe(true)
    expect(state.error?.code).toBe('stale_digest')

    // The host export guard double-checks: stale digest fails closed.
    await driftedController.export('demo-package')
    expect(driftedController.snapshot().error?.code).toBe('stale_digest')
    expect(driftedController.snapshot().phase).toBe('compiled')

    // Explicit reset unlocks the overlay without destroying the form.
    driftedController.reset()
    expect(driftedController.snapshot().stale).toBe(false)
    expect(driftedController.snapshot().session).toBeUndefined()
  })

  it('export returns the bounded owner-relative receipt', async () => {
    const controller = createTemplateCompileController(createFakeHost({ inspection: fakeInspection() }))
    await controller.pinTemplate('solution/demo-template/templates/main@en')
    controller.setGoal('demo goal')
    await controller.startSession()
    controller.setField('subject', 'a castle')
    controller.setField('audience', 'children')
    await controller.submitFields()
    await controller.confirm()
    await controller.compile()
    await controller.export('demo package!')
    const state = controller.snapshot()
    expect(state.phase).toBe('exported')
    expect(state.exportReceipt?.outputRef).toBe('exports/demo package!.md')
    expect(state.exportReceipt?.providerCalls).toBe(0)
    expect(suggestExportName('solution/demo-template/templates/main@en')).toBe('main-en')
  })
})

function createFakeHostWithTemplates() {
  return createFakeHost({
    templates: [
      fakeTemplate(),
      fakeTemplate({ ref: 'solution/second/templates/main@en', digest: 'sha256:template-2', title: 'Second template', tags: ['category:other'], capabilities: ['review'] }),
    ],
  })
}

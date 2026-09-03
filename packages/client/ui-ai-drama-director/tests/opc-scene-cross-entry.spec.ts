import { describe, expect, it } from 'vitest'
import { deriveDramaScenePackageExceptionView } from '../src/client/opc-scene-view.ts'
import { OPC_SCENE_CROSS_ENTRY_CASES } from './opc-scene-cross-entry.fixture.ts'

/**
 * opc-scene 3.1 cross-entry：DSH 侧执行共享语义表。Workbench 侧由
 * `apps/web/test/opc-scene-package-view-model.test.tsx` 表测试锁定同一合同
 * （identity 1:1，不重算不重命名）——两侧对同一 package revision 的
 * action/target/version/side-effect/confirmation/idempotency/receipt/reconcile
 * 身份必须逐行一致；摘要密度与文案允许不同。
 */
describe('opc scene package cross-entry fixture (3.1)', () => {
  for (const testCase of OPC_SCENE_CROSS_ENTRY_CASES) {
    it(`matches the shared identity table: ${testCase.caseId}`, () => {
      const view = deriveDramaScenePackageExceptionView({ summary: testCase.summary })
      expect(view.mutationsEnabled).toBe(testCase.mutationsEnabled)
      const action = view.primaryAction
      expect(action).toBeDefined()
      if (action === undefined) return
      expect(action.actionId).toBe(testCase.expect.primaryActionId)
      expect(action.targetRef).toBe(testCase.expect.targetRef)
      expect(action.expectedVersion).toBe(testCase.expect.expectedVersion)
      expect(action.sideEffectClass).toBe(testCase.expect.sideEffectClass)
      expect(action.requiresConfirmation).toBe(testCase.expect.requiresConfirmation)
      expect(action.idempotencyKey).toBe(testCase.expect.idempotencyKey)
      // receipt/reconcile 身份：1:1 拷贝，不重排不合成。
      expect(view.receipts.map(receipt => receipt.receiptRef).join('|')).toBe(testCase.expect.receiptIdentity)
      const reconcileRefs = view.exceptionCards.map(card => card.reconcileRef).filter((value): value is string => value !== undefined)
      expect(reconcileRefs.includes(testCase.expect.reconcileIdentity ?? '')).toBe(testCase.expect.reconcileIdentity !== undefined)
      // 禁用只改变可用性，永不改变身份字段。
      expect(action.enabled).toBe(testCase.mutationsEnabled)
    })
  }

  it('keeps identity fields byte-identical across clear/exception/degraded states', () => {
    const [base, stale] = OPC_SCENE_CROSS_ENTRY_CASES
    const baseView = deriveDramaScenePackageExceptionView({ summary: base.summary })
    const staleView = deriveDramaScenePackageExceptionView({ summary: stale.summary })
    const identity = (action: NonNullable<ReturnType<typeof deriveDramaScenePackageExceptionView>['primaryAction']>): string =>
      `${action.actionId}|${action.targetRef}|${action.expectedVersion}|${action.sideEffectClass}|${action.requiresConfirmation}|${action.idempotencyKey}`
    expect(identity(staleView.primaryAction!)).toBe(identity(baseView.primaryAction!))
  })
})

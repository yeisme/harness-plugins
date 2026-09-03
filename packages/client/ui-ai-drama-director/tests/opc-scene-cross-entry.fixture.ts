/**
 * OPC scene package 同 revision cross-entry fixture（opc-scene 3.1）。
 *
 * 可移植语义表：对同一 package revision，DSH（harness-plugins
 * `deriveDramaScenePackageExceptionView`）与 Workbench
 * （`packages/task-sdk/src/scaena-opc-view-model.ts`，其语义由
 * `apps/web/test/opc-scene-package-view-model.test.tsx` 表测试锁定）必须
 * 逐行匹配 design §5 的七个身份字段。两侧只允许摘要密度/排序/文案不同。
 *
 * 本文件不携带 prompt、provider payload 或绝对路径；表值全部来自
 * `OPC_SCENE_SUMMARY_FIXTURE` 的 owner 合同形状。
 */

import { OPC_SCENE_SUMMARY_FIXTURE, type OpcScenePackageSummaryV1alpha1 } from '@yeisme/dsh-ai-drama-director'

export interface OpcSceneCrossEntryExpectation {
  readonly primaryActionId: string
  readonly targetRef: string
  readonly expectedVersion: string
  readonly sideEffectClass: string
  readonly requiresConfirmation: boolean
  readonly idempotencyKey: string
  readonly receiptIdentity: string
  readonly reconcileIdentity: string | undefined
}

export interface OpcSceneCrossEntryCase {
  readonly caseId: string
  readonly summary: OpcScenePackageSummaryV1alpha1
  readonly expect: OpcSceneCrossEntryExpectation
  /** 两侧共享的 UI 语义锚（mutation 可用性）。 */
  readonly mutationsEnabled: boolean
}

function summary(overrides: Record<string, unknown>): OpcScenePackageSummaryV1alpha1 {
  return { ...OPC_SCENE_SUMMARY_FIXTURE, ...overrides } as OpcScenePackageSummaryV1alpha1
}

export const OPC_SCENE_CROSS_ENTRY_CASES: readonly OpcSceneCrossEntryCase[] = [
  {
    caseId: 'ready-direction-confirm',
    summary: OPC_SCENE_SUMMARY_FIXTURE,
    mutationsEnabled: true,
    expect: {
      primaryActionId: 'act:confirm-direction',
      targetRef: 'pkg:scene-12-r42',
      expectedVersion: 'r42',
      sideEffectClass: 'owner_write',
      requiresConfirmation: true,
      idempotencyKey: 'idem:confirm-direction-r42',
      receiptIdentity: 'rcpt:action-77|rcpt:action-78',
      reconcileIdentity: 'recon:rights-r42',
    },
  },
  {
    caseId: 'stale-rebind-input',
    summary: summary({ freshness: 'stale', exceptions: [] }),
    mutationsEnabled: false,
    expect: {
      primaryActionId: 'act:confirm-direction',
      targetRef: 'pkg:scene-12-r42',
      expectedVersion: 'r42',
      sideEffectClass: 'owner_write',
      requiresConfirmation: true,
      idempotencyKey: 'idem:confirm-direction-r42',
      receiptIdentity: 'rcpt:action-77|rcpt:action-78',
      reconcileIdentity: undefined,
    },
  },
  {
    caseId: 'unknown-reconcile-only',
    summary: summary({ freshness: 'unknown', exceptions: [] }),
    mutationsEnabled: false,
    expect: {
      primaryActionId: 'act:confirm-direction',
      targetRef: 'pkg:scene-12-r42',
      expectedVersion: 'r42',
      sideEffectClass: 'owner_write',
      requiresConfirmation: true,
      idempotencyKey: 'idem:confirm-direction-r42',
      receiptIdentity: 'rcpt:action-77|rcpt:action-78',
      reconcileIdentity: undefined,
    },
  },
]

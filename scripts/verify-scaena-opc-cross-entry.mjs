import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { verifyScaenaCanonicalOpcCrossEntryConformance } from '../packages/host/dsh-ai-drama-director/lib/index.mjs'

const fixtureArgument = process.argv[2]
if (!fixtureArgument) {
  console.error('Usage: node scripts/verify-scaena-opc-cross-entry.mjs <conformance-fixture.json>')
  process.exit(2)
}

try {
  const fixturePath = resolve(fixtureArgument)
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
  const { compared } = verifyScaenaCanonicalOpcCrossEntryConformance(fixture)
  const gateReceipts = Object.entries(compared.gateReceipts)
    .map(([gateId, receiptRef]) => `${gateId}=${receiptRef ?? 'null'}`)
    .join(',')
  console.log(
    [
      'DSH/Workbench OPC cross-entry conformance passed',
      `package_ref=${compared.packageRef}`,
      `package_version=${compared.packageVersion}`,
      `action_id=${compared.actionId}`,
      `target_ref=${compared.targetRef}`,
      `expected_version=${compared.expectedVersion}`,
      `side_effect_class=${compared.sideEffectClass}`,
      `confirmation_required=${compared.confirmationRequired}`,
      `idempotency_required=${compared.idempotencyRequired}`,
      `gate_receipts=${gateReceipts || 'none'}`,
      `receipt_refs=${compared.receiptRefs.join('|') || 'none'}`,
      `reconcile_ref=${compared.reconcileRef ?? 'none'}`,
    ].join(' '),
  )
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}

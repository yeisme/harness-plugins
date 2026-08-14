import type { OrdoAgentOpsSnapshot } from '@deepseek-ai/dsh-api-remotes/client'

/** Consumer decision for one readable owner snapshot. */
export type OrdoAgentOpsCursorDecision = 'establish' | 'advance' | 'duplicate' | 'drift'

/**
 * Snapshot-axis cursor for one panel generation. The Ordo owner event stream
 * contract is not mounted, so the cursor covers `snapshotRef` and
 * `snapshotVersion` only; event-sequence gap detection stays with the owner
 * read contract. A drift decision resets the cursor so the next read
 * reconciles against a fresh authoritative snapshot.
 */
export class OrdoAgentOpsCursor {
  private ref: string | undefined
  private version = 0

  /**
   * Classify one readable owner snapshot against the current cursor.
   * @param snapshot - Host-validated projection in a readable state.
   * @returns how the consumer must treat the snapshot.
   */
  apply(snapshot: OrdoAgentOpsSnapshot): OrdoAgentOpsCursorDecision {
    if (this.ref === undefined) {
      this.ref = snapshot.snapshotRef
      this.version = snapshot.snapshotVersion
      return 'establish'
    }
    if (snapshot.snapshotRef !== this.ref || snapshot.snapshotVersion < this.version) {
      this.ref = undefined
      return 'drift'
    }
    if (snapshot.snapshotVersion === this.version) return 'duplicate'
    this.version = snapshot.snapshotVersion
    return 'advance'
  }

  /** Drop the cursor; the next readable snapshot re-establishes it. */
  reset(): void {
    this.ref = undefined
  }
}

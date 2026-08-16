import type { OrdoAgentOpsSnapshot } from './contracts.ts'

/** 一个可读 owner snapshot 相对当前 cursor 的处理结论。 */
export type OrdoAgentOpsCursorDecision = 'establish' | 'advance' | 'duplicate' | 'drift'

/**
 * 仅追踪 snapshotRef/snapshotVersion 的 browser cursor。事件序列、gap 检测与
 * reconcile 仍由 Ordo owner 负责；引用轮换或版本倒退时清空本地展示并等待下一次权威读取。
 */
export class OrdoAgentOpsCursor {
  private ref: string | undefined
  private version = 0

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

  /** 在连接代际切换或卸载时丢弃 cursor。 */
  reset(): void {
    this.ref = undefined
  }
}

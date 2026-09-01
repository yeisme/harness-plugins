import { join, relative } from 'node:path'
import { readFileSync } from 'node:fs'
import { report, type CheckerReport, type Finding } from '../types.js'
import { listWorkspacePackages, sourceFiles } from '../workspace.js'

/**
 * dispose/HMR conformance（G18 §4，R9 观测门主体）：把 V3 7.5 在 pane-workbench
 * 上的 disposal 验证泛化为全包静态释放对称性 harness。四类资源：
 * 事件监听器 / 定时器 / ResizeObserver·MutationObserver·IntersectionObserver /
 * host 订阅，逐文件统计 acquire vs release：
 * - DISPOSE/NO_RELEASE_PATH：文件有 acquire 但全文无任何释放标记
 *   （dispose/unmount/unregister/cleanup/remove 系）——最强信号，HMR 重挂即泄漏；
 * - DISPOSE/COUNT_ASYMMETRY：有释放路径但数量不配对——次强信号（跨模块释放、
 *   共享 disposer 会造成误报，观测门语义下由 owner 复核，清零归 G21 定点修）。
 */
export function runDisposeConformance(root: string): CheckerReport {
  const findings: Finding[] = []
  const notes: string[] = []
  const packages = listWorkspacePackages(root)
  const targets = packages.filter(pkg => pkg.kind === 'client' || pkg.kind === 'bundle')
  let checkedFiles = 0
  let filesWithAcquisitions = 0

  for (const pkg of targets) {
    for (const file of sourceFiles(join(pkg.dir, 'src'))) {
      const rel = relative(root, file)
      const text = readFileSync(file, 'utf8')
      const ledger = releaseLedger(text)
      const acquisitions = ledger.totalAcquired
      if (acquisitions === 0) {
        checkedFiles += 1
        continue
      }
      filesWithAcquisitions += 1
      checkedFiles += 1
      const hasReleasePath = RELEASE_PATH.test(text)
      for (const entry of ledger.classes) {
        // 计数已配平（内联 remove/disconnect 即释放）不算观测点；只报 released < acquired。
        if (entry.acquired === 0 || entry.released >= entry.acquired) continue
        const detail = `acquired ${entry.acquired}, released ${entry.released}`
        if (!hasReleasePath) {
          findings.push({
            location: rel,
            code: 'DISPOSE/NO_RELEASE_PATH',
            message: `${entry.kind}: ${detail}; file declares no dispose/unmount/unregister/cleanup path`,
          })
        } else {
          findings.push({
            location: rel,
            code: 'DISPOSE/COUNT_ASYMMETRY',
            message: `${entry.kind}: ${detail}; cross-module release is possible — owner review`,
          })
        }
      }
    }
  }

  notes.push(`${checkedFiles} files scanned, ${filesWithAcquisitions} with tracked acquisitions (static symmetry harness)`)
  return report('dispose-hmr-conformance', checkedFiles, findings, notes)
}

/** 文件内出现任意释放路径标记即视为「声明了释放路径」 */
const RELEASE_PATH = /\b(?:dispose|unmount|unregister|cleanup|teardown|destroy)\w*\s*\(|\b(?:off|unsubscribe)\s*\(/i

interface ClassLedger { kind: string; acquired: number; released: number }

/** 四类资源的对称计数（注释行不计入；字符串模板中的伪命中由基线复核兜底） */
function releaseLedger(text: string): { classes: ClassLedger[]; totalAcquired: number } {
  const lines = text
    .split('\n')
    .filter(line => !/^\s*(?:\/\/|\*|\/\*)/.test(line))
    .join('\n')

  const listenerAdds = countMatches(lines, /\.addEventListener\s*\(/g)
  const listenerRemoves = countMatches(lines, /\.removeEventListener\s*\(/g)
  // 定时器只计 interval：timeout 一次性触发后自释放，不构成泄漏类（基线降噪）。
  const timerAdds = countMatches(lines, /\bsetInterval\s*\(/g)
  const timerRemoves = countMatches(lines, /\bclearInterval\s*\(/g)
  const observerAdds = countMatches(lines, /\bnew\s+(?:Resize|Mutation|Intersection|Performance)Observer\s*\(/g)
  const observerRemoves = countMatches(lines, /\.disconnect\s*\(/g)
  const subscriptionAdds = countMatches(lines, /\.(?:subscribe|on)\s*\(/g)
  const subscriptionRemoves = countMatches(lines, /\.(?:unsubscribe|off)\s*\(/g)

  const classes: ClassLedger[] = [
    { kind: 'event-listener', acquired: listenerAdds, released: listenerRemoves },
    { kind: 'interval', acquired: timerAdds, released: timerRemoves },
    { kind: 'observer', acquired: observerAdds, released: observerRemoves },
    { kind: 'host-subscription', acquired: subscriptionAdds, released: subscriptionRemoves },
  ]
  return {
    classes,
    totalAcquired: classes.reduce((sum, entry) => sum + entry.acquired, 0),
  }
}

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length
}

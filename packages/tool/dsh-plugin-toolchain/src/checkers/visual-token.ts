import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { report, type CheckerReport, type Finding } from '../types.js'
import { listWorkspacePackages, readCodeLines, sourceFiles } from '../workspace.js'

/**
 * visual token conformance（G18 §5）：
 * 1) 分类不回退——复用既有 check:surfaces 门（scripts/check-ui-surface-contracts.mjs，
 *    80e3382 建立的 client/bundle 分类账本）作为子进程执行，逐条回收其错误行；
 *    分类账本仍由该脚本 owner 维护，本工具不复制账本，避免双源漂移。
 * 2) token 使用率——对 web-surface 相关包统计 var(--vk-*|--dsw-*) 引用 vs 裸色值
 *    （#hex / rgb()）的比率。基线只记录不清零（清零与阈值化归 G21）。
 */
export function runVisualTokenConformance(root: string): CheckerReport {
  const findings: Finding[] = []
  const notes: string[] = []
  let checked = 0

  // 子进程跑 surfaces 门（--allow-pending 与基线语义一致：pending 记 note 不红灯）。
  const surfaces = spawnSync(process.execPath, [join(root, 'scripts/check-ui-surface-contracts.mjs'), '--allow-pending'], {
    cwd: root,
    encoding: 'utf8',
  })
  if (surfaces.error !== undefined) {
    return {
      checker: 'visual-token-conformance',
      status: 'error',
      checkedCount: 0,
      findings,
      notes,
      error: `failed to execute surfaces gate: ${String(surfaces.error)}`,
      durationMs: 0,
    }
  }
  const surfacesOutput = `${surfaces.stdout ?? ''}${surfaces.stderr ?? ''}`
  for (const line of surfacesOutput.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('- ')) {
      findings.push({ location: trimmed.slice(2).split(':')[0] ?? 'surfaces', code: 'VT/SURFACE_REGRESSION', message: trimmed.slice(2) })
    }
  }
  if (surfaces.status === 0) {
    notes.push('surfaces gate passed (classification non-regression)')
  } else if (findings.length === 0) {
    // 子进程失败但无可解读的发现行（脚本缺失/崩溃/输出形态漂移）→ 内部错误而非红灯。
    return {
      checker: 'visual-token-conformance',
      status: 'error',
      checkedCount: 0,
      findings,
      notes,
      error: 'surfaces gate failed without parsable findings (script missing or crashed) — exit ' + String(surfaces.status),
      durationMs: 0,
    }
  } else {
    notes.push(`surfaces gate exit ${String(surfaces.status)} — findings recorded above`)
  }

  // token 使用率基线（不含 excluded 包；embed 包计 --vk- 引用）。
  const packages = listWorkspacePackages(root).filter(pkg => pkg.kind === 'client' || pkg.kind === 'bundle')
  const rates: Array<{ name: string; rate: number; tokens: number; raw: number }> = []
  for (const pkg of packages) {
    let tokenRefs = 0
    let rawColors = 0
    for (const file of sourceFiles(join(pkg.dir, 'src'))) {
      for (const { text } of readCodeLines(file)) {
        tokenRefs += countMatches(text, /var\(--(?:vk|dsw|ys)[\w-]+/g)
        rawColors += countMatches(text, /#[0-9a-fA-F]{3,8}\b/g) + countMatches(text, /\brgba?\(/g)
      }
    }
    if (tokenRefs + rawColors > 0) {
      rates.push({ name: `packages/${pkg.kind}/${pkg.dirName}`, rate: tokenRefs / (tokenRefs + rawColors), tokens: tokenRefs, raw: rawColors })
      checked += 1
    }
  }
  rates.sort((a, b) => a.rate - b.rate)
  for (const item of rates) {
    notes.push(`token-rate ${item.name}: ${(item.rate * 100).toFixed(0)}% (${item.tokens} token refs vs ${item.raw} raw literals)`)
  }

  return report('visual-token-conformance', checked, findings, notes)
}

function countMatches(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length
}

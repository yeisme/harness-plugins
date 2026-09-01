import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { ToolchainRunResult } from './types.js'

/**
 * 报告落盘：temp/toolchain-runs/<runId>/ 下 report.json（机读）+ report.md（人读）。
 * 脱敏规则与集成证据一致：只允许仓库相对路径，checkers 已保证不回显字段值。
 */
export async function writeRunReport(
  result: ToolchainRunResult,
  reportRoot: string,
): Promise<{ runDir: string; jsonPath: string; mdPath: string }> {
  const runId = result.startedAt.replace(/[:.]/g, '').replace('T', 'T') + '-toolchain'
  const runDir = resolve(reportRoot, runId)
  await mkdir(runDir, { recursive: true })
  const jsonPath = resolve(runDir, 'report.json')
  const mdPath = resolve(runDir, 'report.md')
  await writeFile(jsonPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  await writeFile(mdPath, renderMarkdown(result), 'utf8')
  return { runDir, jsonPath, mdPath }
}

function renderMarkdown(result: ToolchainRunResult): string {
  const lines: string[] = [
    `# Plugin toolchain run ${result.startedAt}`,
    '',
    `- mode: ${result.baseline ? 'baseline（首跑允许既有红灯，仅记录）' : 'gate（红灯即失败）'}`,
    `- checkers: ${result.reports.length}`,
    '',
  ]
  for (const reportItem of result.reports) {
    lines.push(`## ${reportItem.checker} — ${reportItem.status}`)
    lines.push('')
    lines.push(`checked: ${reportItem.checkedCount}, findings: ${reportItem.findings.length}, duration: ${reportItem.durationMs}ms`)
    if (reportItem.error !== undefined) lines.push(`internal error: ${reportItem.error}`)
    for (const note of reportItem.notes) lines.push(`- note: ${note}`)
    lines.push('')
    if (reportItem.findings.length === 0) continue
    lines.push('| location | line | code | message |')
    lines.push('| --- | --- | --- | --- |')
    for (const finding of reportItem.findings) {
      lines.push(`| ${finding.location} | ${finding.line ?? ''} | ${finding.code} | ${finding.message.replaceAll('|', '\\|')} |`)
    }
    lines.push('')
  }
  return `${lines.join('\n')}\n`
}

#!/usr/bin/env node
// Generate task state through a repository command; ordinary prose remains editable.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
const change = "dsh-ordo-project-command-center-v1"
const rows = [["1","固化 Pane/Tab/Host 投影与旧入口兼容合同","openspec validate dsh-ordo-project-command-center-v1 --strict --no-interactive"],["2","实现异步项目 Host 接入和项目指挥四视图","pnpm --filter @yeisme/dsh-ordo-agent-ops test"],["3","实现固定会话 Agents Tab、并排查看和跟进隔离","pnpm --filter @yeisme/dsh-client-ui-pane-subagent test"],["4","实现结构化计划修改、回执与重开恢复","pnpm --filter @yeisme/dsh-ordo-agent-ops test"],["5","完成跨 owner 集成、视觉与全局质量门","node scripts/run-project-ops-integration.mjs"],["6","完成兼容 DSH 中三个场景的真实 Agent 闭环与双栏验收","pnpm dsh:workbench -- --check"]]
const target = resolve(import.meta.dirname, '..', 'openspec/changes', change, 'tasks.md')
let previous = ''
try { previous = readFileSync(target, 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error }
const evidence = []
const done = new Set([...previous.matchAll(/^- \[x\] (\d+)\./gm)].map(match => match[1]))
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--evidence') {
    const path = resolve(import.meta.dirname, '..', process.argv[++i] ?? '')
    const base = resolve(import.meta.dirname, '..', 'temp/integration-test-runs')
    if (!path.startsWith(base + sep) || !path.endsWith('/summary.json')) throw new Error('Evidence must be an owner integration summary')
    const summary = JSON.parse(readFileSync(path, 'utf8'))
    if (!['passed', 'failed', 'partial', 'skipped'].includes(summary.status)) throw new Error('Invalid evidence summary status')
    evidence.push({ path: relative(resolve(import.meta.dirname, '..'), path), status: summary.status })
    continue
  }
  if (process.argv[i] !== '--done' || !rows.some(row => row[0] === process.argv[i + 1])) throw new Error('Usage: node scripts/project-ops-change.mjs [--done <task-id>]')
  done.add(process.argv[++i])
}
const body = '# 实施任务\n\n' + rows.map(([id, title, command], index) => '- [' + (done.has(id) ? 'x' : ' ') + '] ' + id + '. ' + title + '。Owner: 本子项目；Dependencies: ' + (index ? rows[index - 1][0] : 'none') + '；Acceptance: 实际行为与新增合同一致，未完成的真实运行不得由模拟证据代替；Verification: `' + command + '`；Expected: exit 0；Failure recheck: 区分本改动、既有问题与环境原因，保留原始失败证据。').join('\n') + '\n'
writeFileSync(target, body)
if (evidence.length) writeFileSync(resolve(dirname(target), 'verification.md'), '# 验证记录\n\n由仓库命令从实际测试 summary 生成。完整真实执行、有限返工和人工验收仍以未关闭任务为准；不把协议或合成数据测试当作真实模型证据。\n\n' + evidence.map(item => '- `' + item.path + '`：' + item.status).join('\n') + '\n\n证据位于本地 temp 目录，重新检出后需通过任务中的验证命令重建。\n')
process.stdout.write('Updated project operations tasks.\n')


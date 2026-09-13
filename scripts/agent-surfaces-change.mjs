#!/usr/bin/env node
// Generate task state through a repository command; ordinary prose remains editable.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
const change = "dsh-agent-surfaces-polish-v1"
const rows = [
  ['1','固化会话 Subagents 与用户级 Agent Team 的设计和增量 spec','openspec validate dsh-agent-surfaces-polish-v1 --strict --no-interactive'],
  ['2','实现会话执行树、详情、过滤、键盘与迟到结果隔离','pnpm --filter @yeisme/dsh-client-ui-pane-subagent test'],
  ['3','实现用户项目入口、Team roster 与既有 Ordo 视图和命令兼容','pnpm --filter @yeisme/dsh-ordo-agent-ops test'],
  ['4','验证实际编译 UI 的三种宽度、英文、焦点、作用域和视觉门','node scripts/run-ui-visual-tests.mjs visual-agent-surfaces.spec.ts'],
]
const acceptance = { '1': '明确用户工作区、项目与会话三层范围；旧入口保持兼容', '2': '单节点详情位于顶部；后代搜索、焦点恢复、迟到反馈和无接口降级通过回归', '3': '无当前聊天可打开注册项目；切换聊天不改变项目；新旧命令复用同一用户入口', '4': '360/560/960px 无溢出，单节点长名称、中英、键盘和作用域验证有实际编译 UI 证据' }
const target = resolve(import.meta.dirname, '..', 'openspec/changes', change, 'tasks.md')
let previous = ''
try { previous = readFileSync(target, 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error }
const evidence = []
const notes = []
const done = new Set([...previous.matchAll(/^- \[x\] (\d+)\./gm)].map(match => match[1]))
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--note') { const note = process.argv[++i]; if (!note || note.length > 4096) throw new Error('A bounded verification note is required'); notes.push(note); continue }
  if (process.argv[i] === '--evidence') {
    const path = resolve(import.meta.dirname, '..', process.argv[++i] ?? '')
    const base = resolve(import.meta.dirname, '..', 'temp/integration-test-runs')
    if (!path.startsWith(base + sep) || !path.endsWith('/summary.json')) throw new Error('Evidence must be an owner integration summary')
    const summary = JSON.parse(readFileSync(path, 'utf8'))
    if (!['passed', 'failed', 'partial', 'skipped'].includes(summary.status)) throw new Error('Invalid evidence summary status')
    evidence.push({ path: relative(resolve(import.meta.dirname, '..'), path), status: summary.status })
    continue
  }
  if (process.argv[i] !== '--done' || !rows.some(row => row[0] === process.argv[i + 1])) throw new Error('Usage: node scripts/agent-surfaces-change.mjs [--done <task-id>] [--evidence <summary.json>] [--note <text>]')
  done.add(process.argv[++i])
}
const body = '# 实施任务\n\n' + rows.map(([id, title, command], index) => '- [' + (done.has(id) ? 'x' : ' ') + '] ' + id + '. ' + title + '。Owner: 本子项目；Dependencies: ' + (index ? rows[index - 1][0] : 'none') + '；Acceptance: ' + acceptance[id] + '；Verification: `' + command + '`；Expected: exit 0；Failure recheck: 区分本改动、既有问题与环境原因，保留原始失败证据。').join('\n') + '\n'
writeFileSync(target, body)
if (evidence.length) writeFileSync(resolve(dirname(target), 'verification.md'), '# 验证记录\n\n由仓库命令从实际测试 summary 生成。完整真实执行、有限返工和人工验收继续由 dsh-ordo-project-command-center-v1 的未关闭任务跟踪；不把协议或合成数据测试当作真实模型证据。\n\n' + evidence.map(item => '- `' + item.path + '`：' + item.status).join('\n') + (notes.length ? '\n\n' + notes.join('\n\n') : '') + '\n\n证据位于本地 temp 目录，重新检出后需通过任务中的验证命令重建。\n')
process.stdout.write('Updated agent surface tasks.\n')


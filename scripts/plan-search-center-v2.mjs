#!/usr/bin/env node
/** Initialize the pending search-center checklist without rewriting progress. */
import { readFile, realpath, rename, writeFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const change = resolve(root, 'openspec/changes/dsh-search-center-v2')
await readFile(resolve(change, '.openspec.yaml'))
await readFile(resolve(change, 'design.md'))
await readFile(resolve(change, 'specs/dsh-search-center/spec.md'))

// Completion is explicit and requires a passed, project-owned evidence receipt.
if (process.argv.length > 2) {
  const [action, taskId, evidenceFlag, evidencePath, ...extra] = process.argv.slice(2)
  if (action !== '--complete' || !/^\d+\.\d+$/.test(taskId ?? '') || evidenceFlag !== '--evidence' || !evidencePath || extra.length) {
    throw new Error('Usage: node scripts/plan-search-center-v2.mjs [--complete TASK --evidence temp/integration-test-runs/RUN/summary.json]')
  }
  const evidence = await realpath(resolve(root, evidencePath))
  const evidenceRef = relative(root, evidence)
  if (!/^temp\/integration-test-runs\/[^/]+\/summary\.json$/.test(evidenceRef)) throw new Error('Evidence must be a project-owned run summary')
  const receipt = JSON.parse(await readFile(evidence, 'utf8'))
  if (receipt.status !== 'passed' || receipt.exit_code !== 0) throw new Error('Task completion requires a passed run')
  const taskFile = resolve(change, 'tasks.md')
  const body = await readFile(taskFile, 'utf8')
  const pattern = new RegExp(`^- \\[ \\] ${taskId.replace('.', '\\.')} (.+)$`, 'm')
  if (!pattern.test(body)) throw new Error('Task is missing or already complete')
  const updated = body
    .replace(/^本文件由[^\n]*\n/, '本文件由 `node scripts/plan-search-center-v2.mjs` 初始化；2026-09-11已开始实施。任务仅通过显式 `--complete TASK --evidence PATH` 按通过证据更新；默认初始化不覆盖现有进度，文档校验不代表页面或真实owner验收完成。任务依赖不构成子agent授权。\n')
    .replace(pattern, (_line, description) => `- [x] ${taskId} ${description}\n  - Evidence: [passed run](../../../${evidenceRef})`)
  const temporary = `${taskFile}.${process.pid}.tmp`
  await writeFile(temporary, updated, { flag: 'wx' })
  if (await readFile(taskFile, 'utf8') !== body) throw new Error('Task progress changed; refusing to overwrite')
  await rename(temporary, taskFile)
  console.log(`Completed task ${taskId} with ${evidenceRef}. Other tasks are unchanged.`)
  process.exit(0)
}

const groups = [
  ['A0. 来源事实、身份与兼容基线', [
    '盘点旧搜索、sessions快照、工具目录及所有目标owner；按design的35个二级资源记录真实查询字段、scope、filters/sorts、preview/open和完整性。验收：目录/元数据/正文分开，缺失能力明确待接入。依赖：无。',
    '设计并实现搜索包内部的来源能力描述与legacy/provider适配分支，保留V1类型、命令和Pane身份；旧插件缺元数据继续工作。验收：旧消费者、同名不同源、不同版本、open-only去重测试。依赖：1.1。',
    '核验sessions快照的project映射、归档和正文能力，缺scope支持时拒绝该组而非混入全局会话；有界请求只面向授权来源。验收：元数据不冒充正文、伪global拒绝、范围不扩大。依赖：1.1、1.2。',
  ]],
  ['A1. 搜索中心与快捷浮层', [
    '实现八类两层导航、35项资源分类目录和最近/常用/已打开快捷视图；空查询探索卡片、有查询每组5项列表、查看全部与诚实计数。验收：无虚构热门、待接入不显示零结果。依赖：1.2。',
    '实现scope、适用筛选、来源覆盖、组内排序与条件移除提示；仅对完整快照或支持合同的来源应用。验收：不得第一页过滤伪装全库有效。依赖：1.3、2.1。',
    '按UI Contract复用Surface/token/primitives，实现六类页面、深浅主题、192px分类/320px预览、容器响应式和独立滚动。验收：分类卡片仅用于探索，媒体缩略图显式开启。依赖：2.1、2.2。',
    '实现浮层继续到搜索Pane的查询/范围/筛选/选择与焦点交接，复用已有单例；关闭和返回不执行业务动作。验收：交接失败保留上下文，无双焦点或重复Pane。依赖：2.3。',
    '复用并扩展IME、debounce、generation、AbortSignal、来源并发、分页和缓存；撤权清除片段及预览，偏好只存安全引用。验收：乱序/重复页/未知总数/offline/denied/存储失败。依赖：1.2、2.2。',
    '实现键盘、读屏、coarse pointer、reduced-motion和200%缩放；预览不抢输入编辑，返回恢复原选择和滚动。验收：search-accessible及邻Pane隔离。依赖：2.3、2.4、2.5。',
    '以真实owner结果确认打开，保留右/下/悬浮能力探测与保存保护；未确认或缺open不记成功，命令仍走原权限。验收：search-open-layout、search-handoff-pane。依赖：2.4、2.5。',
    '扩展现有stage-a与视觉入口并完成A阶段验证；5000条本地p95≤100ms，证据标明源码、真实/fixture边界。验收：A阶段场景全部有对应断言，B/C未接入项不勾选。依赖：2.1–2.7。',
  ]],
  ['B1. 工具与能力接入', [
    '适配Skills目录与Tools详情，保留已安装/当前会话可调用、来源/revision身份和部分覆盖；正文委托参考Reader。验收：search-skill-reader，读文档不安装/启用/执行。依赖：A阶段、Reader实际能力。',
    '适配MCP工具、MCP资源和native工具，分别探测工具目录与资源目录/读取能力；未安装产品CLI的已连接客户端可用。验收：search-mcp-native与缺失来源恢复。依赖：A阶段。',
    '接入插件、预设、设置入口与兼容项；只打开原管理详情，不在搜索中新增启停/安装/应用动作。验收：search-plugin-preset及精确ID发现。依赖：A阶段。',
  ]],
  ['B2. 项目、知识、创作与执行资源接入', [
    '接入项目、workspace和画布节点元数据，scope来自可信owner映射；打开定位原项目/节点。验收：search-project-node和跨项目迟到响应。依赖：A阶段、项目owner能力。',
    '接入文件、文件夹、文档、Pinax笔记和Inferrum知识条目，分别记录元数据与正文能力；不新建浏览器索引。验收：search-file-knowledge、同名异源和访问拒绝。依赖：A阶段、各owner能力。',
    '接入图片、视频、音频、字幕、文本成果和交付包，预览复用授权Reader/Viewer，固定版本并手动播放。验收：search-media-version覆盖六类资源及缩略图失败。依赖：A阶段、媒体owner能力。',
    '接入提示词、模板、可复用引用；明确目标会话与prepare/ack，模板预览不执行，插入不发送。验收：search-prompt-template及双会话隔离。依赖：A阶段、对应owner能力。',
    '接入Ordo任务、运行、审批、验证和证据的安全只读投影，专属状态归原owner。验收：search-ordo-evidence，零批准/重跑/业务写入。依赖：A阶段、Ordo及领域owner能力。',
    '按来源运行B阶段真实搜索/预览/打开/引用和失败恢复；逐一核对35项账本。验收：存在目录但未接搜索或只有mock的项保持未完成。依赖：3.1–3.3、4.1–4.5。',
  ]],
  ['C. 明确合同下的正文搜索', [
    '接入DSH history正文、归档和真实message/event锚点，区分current/shadowed与元数据匹配。验收：search-history-anchor和权限/cursor/freshness；不以sessions快照代替。依赖：A阶段、history owner真实合同。',
    '接入文件、文档、笔记、知识、字幕、文本成果和公开提示词/证据中owner明确授权的正文查询；保留版本和截断范围。验收：相应场景的正文命中、中文召回、禁止内容排除与无越界读取。依赖：B阶段对应来源、正文owner合同。',
    '验证预览续读、revision变化、source卸载、授权撤销与旧响应隔离；首次正文预览显式触发。验收：256KiB/5000行上限取owner更严格值，零混合版本，零自动执行。依赖：5.1、5.2。',
  ]],
  ['D. 稳定实现后的验收与交付', [
    '在现有Vitest与Playwright/evidence入口覆盖design全部16个场景，失败保留六件套及原exit code。验收：真实owner链、fixture和设计校验分别报告。依赖：A/B/C相关实现稳定。',
    '运行关联包测试和check:surfaces/test:visual/check:plugins；按实际代码影响执行typecheck/build/check:bundles。验收：全局失败按introduced/pre-existing/concurrent/environmental/ambiguous归因，不清理无关代码。依赖：6.1。',
    '需要宿主扩展时经upstream-prs保存自有增量，验证干净基线apply与回退；插件合同门和真实host链分开报告。验收：旧入口/偏好/领域数据保持原义，官方上游合入不作插件门。依赖：6.2。',
    '更新真实能力账本、用户说明、前后截图与限制；仅按证据更新对应任务，不删除未接入能力或将整change提前归档。验收：文档链接和OpenSpec strict通过；无自动发布、推送或部署。依赖：6.1–6.3。',
  ]],
]

const count = groups.reduce((sum, [, items]) => sum + items.length, 0)
const body = '本文件由 `node scripts/plan-search-center-v2.mjs` 初始化。全部为后续实施任务，本轮仅交付设计文档；文档校验不代表实现通过。重复运行脚本拒绝覆盖现有进度。任务依赖不构成子agent授权。\n\n'
  + groups.map(([title, items], i) => `## ${i + 1}. ${title}\n\n${items.map((item, j) => `- [ ] ${i + 1}.${j + 1} ${item}`).join('\n')}`).join('\n\n') + '\n'
await writeFile(resolve(change, 'tasks.md'), body, { flag: 'wx' })
console.log(`Created ${count} pending search-center tasks. Existing progress is never overwritten.`)

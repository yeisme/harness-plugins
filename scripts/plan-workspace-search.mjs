#!/usr/bin/env node
/** Initialize only the planned search checklist; never mark implementation complete. */
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const change = resolve(root, 'openspec/changes/dsh-workspace-search-experience-v1')
await readFile(resolve(change, '.openspec.yaml'))
await readFile(resolve(change, 'design.md'))
const groups = [
 ['A0. 实施前基线与合同映射', [
  'P0 盘点当前目录、命令、会话 provider 和对应测试；明确历史查询能力实际可用／缺失项，记录截图与重复目标基线。依赖：无；验收：不能把历史 OpenSpec 已完成设计当作 runtime 能力。',
  'P0 定义内部稳定结果身份及 open-only 去重映射；列明最小可选元数据、消费者与回退，禁止同名合并或强制旧插件补字段。依赖：1.1；验收：同目标／同名异目标／含副作用命令／旧描述四类合同测试。',
 ]],
 ['A1. 分组搜索、筛选与视觉同步交付', [
  'P0 复用注册快照和现有匹配 helper，完成中英文、ID、别名、确定排序与安全高亮。依赖：1.2；验收：精确优先、稳定同分、HTML 不执行。',
  'P0 完成空查询的最近／已打开／常用和关键词分组，每组有界呈现、查看全部及诚实计数；兼容入口默认折叠但可精确发现。依赖：2.1；验收：重复目标和分页未知总数样本。',
  'P0 实现类别、当前／所有可访问项目、已打开、状态及条件相关筛选；显示条件标签与清除。依赖：2.2；验收：项目缺失、不适用条件、筛选后空态不误导。',
  'P0 实现搜索框、分类筛选栏、分组标题、48px 结果行、语义图标、状态和底部提示，统一深浅／系统主题。依赖：2.2、2.3；验收：完整 UI Contract 截图，不单独交付未美化列表。',
  'P0 接入 combobox/listbox 选择、IME、筛选和独立动作菜单；刷新保持 stableKey，关闭恢复焦点。依赖：2.4；验收：键盘全路径、读屏标签、触控不依赖 hover。',
  'P1 接入本机最近使用引用（最多 20）和清空入口，仅确认打开成功后写入，存储失败降级。依赖：2.5；验收：无查询词／片段持久化，失败操作不记成功。',
  'P0 阶段 A 验收：360／560／960px、200% zoom、长标题、中英文、相邻 Pane 样式隔离、本地 5000 条 p95 性能。依赖：2.1–2.6；验收：真实输入和证据，不只检查截图。',
 ]],
 ['B. 历史来源、等待与缓存', [
  'P0 通过实际能力 probe 适配现有会话搜索与全局历史 owner；单项目接口不伪装跨项目，缺失能力记录为阻塞而非通过。依赖：1.1、1.2；验收：available／offline／denied／contract_mismatch 夹具及实际来源说明。',
  'P0 实现 200ms debounce、IME 边界、AbortSignal 和 generation 防乱序；项目／筛选／locale 变化重置请求。依赖：3.1；验收：假时钟＋忽略取消的 provider 仍不能覆盖新结果。',
  'P0 实现分组状态、延迟 loading 提示、较慢／超时与独立重试；保持本地结果和键盘选中。依赖：3.2、2.5；验收：快速／冷启动／部分失败／全部失败四种完整状态链。',
  'P0 实现不透明 cursor 分页、stableKey 去重、已加载计数、显式加载更多。依赖：3.2；验收：筛选切换中的旧页、重复页和无总数来源。',
  'P0 实现 32 页／1000 摘要 LRU、30s TTL／5min stale 和后台更新；缓存键包含权限与项目上下文。依赖：3.3、3.4；验收：过期淘汰、跨项目／profile／locale 不串用。',
  'P0 补齐权限拒绝、provider 卸载、HMR、会话更新、搜索关闭的清理；无权限 generation 时缓存只保留当前打开周期。依赖：3.5；验收：撤权后旧片段不可见且无在途回写。',
  'P0 阶段 B 验收：真实 owner 能力可用时执行分页／命中打开；不可用时只验适配合同，保留对应功能任务未完成。依赖：3.1–3.6；验收：证据明确区分实际查询与 mock。',
 ]],
 ['C. 打开行为、搜索 Pane 与常用筛选', [
  'P0 统一定位已打开／新会话预览／显式命令执行，保留权限和保存保护；失败保留搜索上下文。依赖：2.5；验收：同会话去重、跨项目草稿和轨迹不串用、危险命令不因选择而执行。',
  'P1 接入右侧／下方／悬浮打开菜单与结果拖入工作区，复用唯一协调器。依赖：4.1；验收：真实指针 drop、取消、空间不足和输入区域文本选择。',
  'P1 将浮层固定为搜索 Pane，复用模型并交接焦点／取消订阅；布局仅保存搜索 Pane 引用。依赖：3.6、4.1；验收：条件延续、无双浮层、关闭不执行业务动作。',
  'P1 接入最多 10 个命名筛选和结构化偏好恢复，不存自由文本查询；失效项目不扩大范围。依赖：2.6、4.3；验收：失效、存储拒绝和回滚后旧偏好均安全。',
 ]],
 ['D. 完整验收与本地交付', [
  'P0 在原有 Vitest 体系覆盖全部结果／查询／缓存／命令委托合同；仅在量测必要时复用已有虚拟列表。依赖：A/B/C；验收：稳定源码对应的关联测试通过。',
  'P0 扩展现有 Playwright 入口，证据统一落 temp/integration-test-runs/<run-id>/；对运行宿主做搜索、筛选、等待、打开、拖拽、恢复和主题全链验证。依赖：5.1；验收：检查结果身份与请求，不仅截图；失败证据同样保留且脱敏。',
  'P0 稳定后执行 pnpm run check:surfaces、pnpm run test:visual、pnpm run check:plugins；按实际影响执行 pnpm run typecheck、pnpm run build、pnpm run check:bundles。依赖：5.1、5.2；验收：记录 exit code，基线只在人工确认差异后更新。',
  'P0 更新所属 upstream-prs 补丁和 Agent Note，验证干净目标版本可应用／构建；保留旧入口与 profile 回退，不推送或发布。依赖：5.3；验收：插件协议门与宿主联合门分别记录。',
  'P0 交付前后截图、能力结果表、真实／mock 边界、性能证据、缓存说明、启动和回退；仅凭通过证据勾选任务。依赖：5.4；验收：历史服务阻塞时不将整个 change 标为完成。',
 ]],
]
const body = '本文件由 `node scripts/plan-workspace-search.mjs` 初始化；全部为待实施任务。设计校验通过不代表功能完成。任务序号表示执行依赖，不表示子 agent 分派。\n\n' + groups.map(([title, items], i) => `## ${i + 1}. ${title}\n\n${items.map((item, j) => `- [ ] ${i + 1}.${j + 1} ${item}`).join('\n')}`).join('\n\n') + '\n'
await writeFile(resolve(change, 'tasks.md'), body, { flag: 'wx' })
console.log('Created 25 pending search implementation tasks; existing task files are never overwritten.')

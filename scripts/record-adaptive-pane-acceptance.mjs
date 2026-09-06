#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '..')
const ids = process.argv.slice(2)
if (ids.length !== 5 || ids.some(id => !/^[a-z0-9TZ.-]+$/.test(id))) throw new Error('Usage: node scripts/record-adaptive-pane-acceptance.mjs <before-run> <adaptive-run> <regression-run> <gates-run> <main-run>')
const records = await Promise.all(ids.map(id => readFile(resolve(root, 'temp/integration-test-runs', id, 'summary.json'), 'utf8').then(JSON.parse)))
if (records.some(r => r.status !== 'passed') || records[1].checks.length < 6 || records[2].checks.length < 21 || records[3].results.length !== 3) throw new Error('Required acceptance evidence is incomplete')
const raw = await readFile(resolve(root, 'temp/dsh-adaptive-final-unit.log'), 'utf8')
const count = raw.match(/Tests\s+(\d+) passed/)?.[1]
if (!count) throw new Error('Focused host tests did not pass')
const evidence = ids.map(id => `../../temp/integration-test-runs/${id}`)
await writeFile(resolve(root, 'temp/integration-test-runs', ids[1], 'artifacts/host-unit.log'), raw.replaceAll(root, '[PROJECT_ROOT]'))
const report = `# Pane 自适应停靠体验修正

本轮解决固定窄边缘难以命中、拖动只出现空框、窄屏硬挤，以及标签像独立小窗口的问题。继续使用现有宿主布局和 session 身份；轨迹仍与对应对话同 Pane。

## 操作变化

- 靠近目标边缘即可感应，不必精确对准最外侧。面板越大，合理的感应范围越大。
- 拖拽时相邻内容提前让位，蓝色区域显示松手后的真实占用空间。边缘轻微抖动不会反复切换落点，更接近另一个边缘时仍会切换。
- 拖到另一组中间直接合并标签；Alt 拖动可临时关闭吸附，继续自由悬浮。悬浮组标题栏仍可移动整组、贴边停靠。
- 窄窗口优先按可读宽度改为上下排列；变宽后恢复原比例。窗口变化和悬停预演不会改写保存的布局。
- 分隔线更容易抓取，双击可恢复均衡比例。标签按空间收缩，关闭按钮在选中／悬停／键盘聚焦时出现。

当前本机入口仍为 [DSH 工作台](http://127.0.0.1:61818/)，刷新即可加载新界面。启动和回退命令沿用 [完整工作台交付](dsh-unified-multi-pane-acceptance-2026-09-05.md)。

## 实测前后

- [修改前：拖到目标内侧时邻居尺寸不变](${evidence[0]}/artifacts/before.png)，[几何记录](${evidence[0]}/artifacts/baseline.json)。
- [修改后：真实分屏让位预演](${evidence[1]}/artifacts/magnetic-preview.png)。
- [窄窗口自动上下排列](${evidence[1]}/artifacts/responsive-stack.png)。
- [宽窗口恢复后的工作区](${evidence[1]}/artifacts/after.png)。

## 验证

| 检查 | 结果 | 证据 |
|---|---|---|
| 宿主布局相关测试 | ${count} 项通过 | [日志](${evidence[1]}/artifacts/host-unit.log) |
| 磁性停靠与自适应浏览器专项 | 6 条动作链通过 | [结果](${evidence[1]}/summary.json) |
| 原有完整工作台浏览器回归 | 21 条动作链通过，保留对话／轨迹／草稿／恢复／取消 | [结果](${evidence[2]}/summary.json) |
| Surface、视觉、插件门禁 | 三项通过，未更新视觉基线 | [结果](${evidence[3]}/summary.json) |
| 本机主 web | ${records[4].bundles.length} bundle 加载、${records[4].results.length} 视图打开 | [结果](${evidence[4]}/summary.json) |

同一工作树的并发改动曾移除 Desktop 等待统一注册器的逻辑，导致 Git 入口在启动时丢失；本轮恢复等待逻辑并通过相关包 typecheck、测试和构建。没有覆盖其他业务改动。

补丁继续由 upstream-prs/unified-multi-pane-workbench 维护，不改安装目录、不新增长期 fork、不复制业务数据、不发送模型请求、不发布或推送。
`
await mkdir(resolve(root, 'docs/delivery'), { recursive: true })
await writeFile(resolve(root, 'docs/delivery/dsh-adaptive-pane-docking-2026-09-05.md'), report)
await writeFile(resolve(root, 'openspec/changes/dsh-adaptive-pane-docking/tasks.md'), `## 1. 交互与几何\n\n- [x] 1.1 建立真实输入基线与 UI Contract\n- [x] 1.2 实现宽吸附区、退出容差、实际让位及安全取消\n- [x] 1.3 实现可读宽度投影、分隔线方向与均衡操作\n- [x] 1.4 收敛标签和拖拽反馈，保留主动悬浮\n\n## 2. 验证与交付\n\n- [x] 2.1 宿主相关测试、专项及完整浏览器动作链通过\n- [x] 2.2 Surface、视觉和插件门禁通过\n- [x] 2.3 更新 upstream-prs、本机入口和前后证据\n`)
console.log('Recorded verified adaptive Pane delivery.')

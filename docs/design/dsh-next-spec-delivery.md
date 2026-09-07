# DSH 后续 Spec 推进清单

本轮继续沿用当前 Pane 风格、会话显式绑定、VS Code 风格快捷键和本地验证后提交的工作方式。下表来自当前活动 change 的未勾选任务；未勾选不等于缺少全部代码，也不代表历史 external-gate 在新版宿主中仍然成立。每组开始时重新检查源码、实际能力与证据，不直接沿用旧结论。

## 优先推进的能力

| 顺序 | 用户能得到什么 | Spec | 归属与当前动作 |
|---|---|---|---|
| 1 | 定位原调用后看到清楚的目标标记；整行选中；查看安全命令/操作摘要 | dsh-tools-location-command-ux-v1 | split-owner：Tools UI + Chat/调用 owner；已完成当前基线复现，接着冻结安全摘要和定位反馈合同 |
| 2 | 目录变化自动更新，旧文件引用可恢复，冲突不覆盖编辑；右键菜单与焦点完整 | dsh-pane-workspace-followups-v1 | split-owner：目录/文件 owner + Pane UI；可先做 watch/gap 和引用恢复合同、合成场景验证 |
| 3 | 全局搜索命中后正确打开文件或会话，分页不中断 | dsh-workspace-search-experience-v1 | split-owner：搜索 owner + 导航；已有在途源码，先验现有候选，避免重叠修改 |
| 4 | 引用块原位编辑、发送预览、成果预览/编辑/比较/采纳与独立写回 | dsh-prompt-reference-creative-workspace-v1 | split-owner：Composer + Creator + 文件/环境 owner；当前有大量在途源码，分阶段验收，不能整组先勾完 |
| 5 | HTML/SVG安全预览、Office/EPUB/notebook转换、归档清单和二进制回退 | dsh-pane-workspace-experience-v3 | split-owner：preview owner + renderer；先推进安全格式切片，再核对真实媒体/PTY能力 |
| 6 | 安装单个bundle即可带齐依赖，旧/新/混合profile都能加载和卸载 | dsh-plugin-package-consolidation-v1、dsh-plugin-ecosystem-consolidation-v1 | fit：插件打包与测试；使用可丢弃profile、tarball和真实Loader验证 |
| 7 | Ordo操作先预览再确认，审批/未知状态/回执一致，面板与CLI语义一致 | dsh-ordo-command-interaction-v1、ordo-dsh-plugin-visualization-v1 | split-owner：Ordo保留执行与回执权威；可先补typed adapter和合同测试，真实动作另按授权执行 |

## 其余待核对项

| Spec | 剩余任务（本轮盘点时） | 可做的工作或限制 |
|---|---:|---|
| dsh-file-document-v1 | 1 | 核对当前真实fs/文档预览seam；不能以静态fixture代替真实owner数据 |
| dsh-git-agent-review-workbench-v1 | 1 | Agent launch双receipt及Git action transport属于Ordo/Git owner |
| dsh-long-term-history-global-search-v1 | 3 | 补集成证据规范、条件性索引同步和Agent Note交接；条件未满足不直接归档 |
| dsh-mcp-inspector-v1 | 1 | 旧L2 inventory补丁与远端PR任务需重核范围；已有Tools目录实现不等于该任务已完成 |
| dsh-ordo-command-interaction-v1 | 3 | action preview/CAS、真实集成与文档收尾 |
| dsh-pane-workspace-experience-v3 | 8 | 安全格式、真实terminal/preview适配与多尺寸验收 |
| dsh-pane-workspace-followups-v1 | 4 | watch/gap、引用恢复、目录菜单、跨项目布局恢复 |
| dsh-plugin-consistency-coverage-v1 | 1 | 四波收口说明和真实14天dogfood观测；不能压缩时间或编造记录 |
| dsh-plugin-ecosystem-consolidation-v1 | 3 | profile组合、证据、子change最终验收 |
| dsh-plugin-package-consolidation-v1 | 5 | owner边界、tarball闭包、干净profile、兼容矩阵和最终验收 |
| dsh-prompt-reference-creative-workspace-v1 | 37 | 引用/输入框、成果工作区、环境预览及实际Host验收；源码正在修改 |
| dsh-rich-media-plugin-v1 | 4 | 真实slot、附件与领域handoff；先核对新版宿主能力 |
| dsh-session-tags-grouping-v1 | 1 | upstream PR与候选发布是明确外部动作，普通本地继续开发不包含发布授权 |
| dsh-tools-location-command-ux-v1 | 8 | 本轮先完成1.1基线复现，其他项按真实实现和验证更新 |
| dsh-workbench-compose-v1 | 2 | 真实Host数据和跨模块ArtifactRef交接 |
| dsh-workspace-productivity-ui-v3 | 5 | terminal/preview合同冻结、跨项目映射与证据复核 |
| dsh-workspace-search-experience-v1 | 1 | 真实owner分页和命中打开验收，不将mock宣称为实际查询 |
| ordo-dsh-plugin-visualization-v1 | 6 | 旧owner路径需按upstream-prs通道重核，推进投影/事件/隔离/一致性验收 |

盘点时18组、94项未完成；会话Tools工作区V2的21项已完成，不纳入剩余统计。本轮完成Tools的1.1后，剩余93项。此表是阅读用路线，不替代各change的tasks状态。

## 本轮实际推进

已运行Tools定位基线检查，使用合成调用、独立fixture端口，不访问真实会话：选中按钮有背景，整行仍透明；执行摘要区缺席。证据位于 `temp/integration-test-runs/tools-location-baseline-2026-09-07T10-14-27-342Z/`，有六件套与选中调用截图。这是问题复现通过，不是新功能验收通过。

```bash
node scripts/check-tools-location-baseline.mjs
openspec validate dsh-tools-location-command-ux-v1 --strict --no-interactive
```

先完成Tools定位反馈这一组，再推进目录树followups。搜索和引用/创作分支先检查稳定候选再验收；旧external-gate按当前接口重新判断。远端发布、真实业务mutation和14天观测不作为可以立即完成的本地任务。

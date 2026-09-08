## Context

依据 2026-09-07 创作台程序 §3。Ordo 托管工作文档与既有 dsh-ordo-agent-ops 是跨领域执行的唯一通道；画布 document 由 canvas change 拥有。

## Goals / Non-Goals

目标：画布上可编辑执行连接、预览将执行的范围、显式确认并观察运行，重开可恢复观察。

不做执行循环、调度器、审批账本、隐式类型转换、静默扩大范围，或把画布草案当执行账本。

## Decisions

1. Owner-fit：split-owner。本仓拥有执行边/草案编辑与预览呈现；Ordo 拥有跨领域计划、调度、预算与恢复；领域 owner 拥有单领域 workflow。
2. 执行边带输出版本与输入用途；参考边不参与执行。连接不兼容保留草案并显示原因，禁止隐式转换。
3. 分支范围=从选定节点沿执行边可达的下游；执行图有向无环，迭代通过新运行或复制分支表达。
4. 范围外输入必须已有可用固定版本，否则列为阻塞；确认预览冻结输入/参数/版本/计划摘要。
5. 预算 unknown 显示 unknown 并要求显式确认；owner 可因预算合同不满足拒绝。运行中编辑只影响下一份草案。
6. 运行观察复用 Ordo 投影订阅；unknown 只对账原 operation；关闭 Pane 不取消运行，刷新/恢复不重放命令。
7. 上游修改标记受影响节点并保留已采用结果；重跑只产生新候选，用户比较采用后才推进。

## UI Contract

- Surface classification: embed（画布节点/边内嵌）+ adopted inspector（运行预览/观察）
- Surface kind: workspace（预览与观察 Pane）
- First / second / third visual priority: 将执行的节点与范围 / 确认动作 / 阻塞与版本证据
- Existing components reused: 画布 renderer（canvas change）、ui-visual-kit token、Ordo 面板组件
- Cards that earn existence: 运行观察卡（状态/进度/阻塞）；无进度卡片墙
- Primary scroll owner: 范围列表/运行观察；参数独立滚动

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 执行图编辑 | — | 无节点说明 | 校验错误 | 草案保存 | 不兼容草案保留 | 无权限节点 |
| 范围预览 | 解析中 | 未选择说明 | 图错误 | 范围+阻塞清单 | 范围外输入未固定 | 阻塞不可确认 |
| 运行观察 | 订阅中 | 无运行 | owner 错误 | 状态/进度 | gap 重读 | 未确认禁用 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 单栏+返回；范围折叠 | 导航/内容切换 | 画布+预览/观察并列 |

### Accessibility

- Keyboard path: 选节点→选范围→预览→确认全程键盘；Escape 回发起节点
- Focus owner/return: 发起节点；完成后回节点或观察卡
- Visible labels and accessible names: 范围/阻塞/预算态文本化
- Reduced motion and coarse pointer: 动画可关；触控 ≥44px

## Validation

focused reducer/适配测试先行；稳定后全门禁。真实跨领域运行在 Ordo staging 验证并标注 fixture/real。证据写 `temp/integration-test-runs/<run-id>/`，脱敏 owner payload。

## 创建入口、页面与任务边界

[工作流页面](../../../docs/design/dsh-creative-workflow.md)定义模板、手动连线和Agent草案三种入口；均编辑画布change拥有的同一document，不创建额外图模型。模板不携带旧权限，Agent修改给出摘要与撤销，执行另确认。

运行预览由节点/范围列表、固定输入、已知费用和未知项、缺口、人工审阅点组成。确认前草案revision变化即失效。单领域步骤和内部workflow直接进入领域owner；只有跨领域计划由Ordo执行，缺适配任务归agent/ordo，不阻塞专业Pane。第4组验收依赖新增5.1–5.4。

单owner返回多个候选而下游要求一个输入时，必须在流程设计中放人工选择或owner支持的显式选择规则；没有选择时暂停，不自动以最新结果继续。范围扩展和预算变化重新确认；人工审阅只解锁计划中已授权的范围。

视觉例外：无。完整组件复用、内容与control分离、版本迁移、关入口仍可恢复和证据规则见[公共合同](../../../docs/interfaces/dsh-creative-studio-contracts.md)。默认关闭新跨领域执行入口；原单领域运行继续可见且可对账。新schema additive，不重解释既有Ordo plan/grant或Workbench标识。

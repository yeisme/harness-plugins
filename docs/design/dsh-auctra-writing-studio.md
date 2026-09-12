# Auctra 文本台页面与控件设计

状态：规格、任务、fixture 原型与领域 UI 已形成；真实 owner 全路径（4.2）仍开放。唯一任务入口：[tasks](../../openspec/changes/dsh-auctra-writing-studio-v1/tasks.md)；规范：[spec](../../openspec/changes/dsh-auctra-writing-studio-v1/specs/dsh-auctra-writing-studio/spec.md)。

## 用户路径

打开小说/剧本/文本→编辑并确认保存→选区交给Agent→比较并采用candidate→Checkpoint/Review→固定版本导出。本Pane从DSH目录或owner对象引用独立打开；不依赖画布、其他专业Pane或Ordo才能直接操作。

## 页面与交互

| 工作页 | 控件与直接动作 | 关键行为 |
|---|---|---|
| 结构与正文 | 小说章节、剧本场景、通用文本单元、正文编辑与结构动作 | Working Copy通过owner读写，浏览器仅有active edit buffer |
| Agent与候选 | 选区引用、候选、文本Diff、比较与采用 | Agent变更进入candidate，base revision/digest必须核对 |
| 版本与审阅 | Working Copy、Checkpoint、Review、Canon和历史 | 各动作独立；采用候选不自动创建检查点或晋级 |
| 导出与交接 | 固定文本版本、格式、用途与导出预览 | 按选定版本导出，源文件写回是另一动作 |

```text
DSH Pane 标题（原宿主管理）
┌──────────────┬─────────────────────────┬─────────────────┐
│ 对象导航     │ 当前对象/正文/媒体预览  │ 参数/版本/证据  │
│ 树或列表     │ 比较按需替换主体        │ 一次一个详情deck│
└──────────────┴─────────────────────────┴─────────────────┘
```

该线框表达内容关系，不增加固定布局器；分屏/放大/移动由Pane host拥有。画布节点显示主要输入、关键参数、状态和选定结果，复杂编辑打开专业Pane。二者绑定相同owner/ref/version/project，并复用查询订阅。新成果只提示，不抢焦点或改变选定版本。

## 领域规则

复用既有artifact-workspace编辑/Diff/候选能力，不另造autosave服务。正文和结构联合变更遵循owner atomic change-set。UTF-16 patch按owner合同处理emoji/IME，不按视觉字数猜offset。插件草稿权限不授权Agent直接覆盖领域正文。

- The studio SHALL support novel chapters, screenplay scenes and general text units; Working Copy save, candidate adoption, Checkpoint, Review and Canon SHALL remain separate actions.
- Editing SHALL preserve Unicode, IME and source text; combined structure/body changes SHALL follow the owner atomic change-set and version contract.

Agent可编辑指定范围内插件草稿，执行另确认；领域正文仍经owner candidate。候选采用、保存、源文件写回、正式版本确认和交付各自显示真实receipt。UI undo只撤销布局/临时编辑；远程反向操作必须经owner批准。

## 状态与响应式

loading保留scope与最后确认内容；empty给首个创建/导入动作；error保留编辑；partial保留成功候选；stale/conflict要求重新读取比较；unknown只对账原operation。disabled保留入口、原因与配套任务，不假装功能已经交付。

容器≤420px时对象/内容/详情单面切换；421–720px用主体与参数互斥Sheet；>720px允许主体和一个侧区并排。所有能力保留，复杂操作可放大Pane。菜单/焦点回归host，键盘覆盖导航、选择、确认和撤销；中英locale、IME、200%zoom与reduced motion必须验证，不自动播放媒体。

## 复用与依赖

复用ui-surface、ui-visual-kit、官方primitives，以及既有CreatorActionComposer、artifact-workspace和rich-media。不要把本文解释为重新实现所有共享编辑/候选/引用能力。具体UI Contract见[design](../../openspec/changes/dsh-auctra-writing-studio-v1/design.md)；共用接口、证据和边界见[公共合同](../interfaces/dsh-creative-studio-contracts.md)。

依据：[owner文档](../../../../cli/auctra/docs/service-api-interface.md)。当前源码/文档不等于真实providerready；任务1.1复核operation/handler/registry/version，任务5.1对确认缺失能力在`cli/auctra`创建配套OpenSpec/tasks，并双向链接。缺少canary只应进入验证任务，不重复造API。

## Fixture 原型走查（5.2）

标识：`fixture`，不启用真实 owner 写入、生产准入或 Canon。走查表面为独立 `AuctraWritingStudioPages`（结构与正文 / Agent与候选 / 版本与审阅）加共享 artifact-workspace。证据：`packages/client/ui-creator-studio/tests/auctra-writing-studio.spec.tsx` 键盘页切换；`packages/client/ui-creator-studio/tests/artifact-workspace.spec.tsx` 比较/分页/草稿；不启动官方 `dsh web`。

| 页面 | 主动作 | 窄 Pane / 并排 | 结果 |
|---|---|---|---|
| 结构与正文 | 三类资源列表、授权正文、保存 | 单栏页切换；>720px 与候选页互斥 | 通过；未知 kind 不渲染正文 |
| Agent与候选 | 创建候选、比较 Diff、采用/撤销、历史分页 | 比较替换主体；分页失败保留当前页 | 通过；采用不触发 Checkpoint |
| 版本与审阅 | 显示 acceptedVersion；Checkpoint/Review/Canon 独立 | 与结构页互斥 | 通过：独立 owner 动作，采用不触发 |
| 导出与交接 | 固定版本导出预览 | 不另开主壳 | 通过：`text.export` 独立动作，源写回分离 |

原型关闭后不删除 owner 资源；未启用真实能力。完整真实写作闭环归 4.2。

## 领域 UI（5.3）

独立 `AuctraWritingStudioPages` 四页：结构与正文、Agent与候选、版本与审阅、导出与交接。Checkpoint/Review/Canon/export 走独立 server-authored 动作，`presentation.group` 分别为 `versions` 与 `export`；Composer 按组过滤。采用候选不创建 Checkpoint、不提交 Review、不 accept Canon。证据：`packages/host/creator-studio/tests/auctra-working-copy-adapter.spec.ts` 独立动作合同；`packages/client/ui-creator-studio/tests/auctra-writing-studio.spec.tsx` 四页键盘；`packages/client/ui-creator-studio/tests/action-composer.spec.tsx` 分组过滤。官方 `dsh web` 不是完成条件。

## 恢复矩阵（5.4）

| 项 | 路径 | 标注 | 结果 |
|---|---|---|---|
| IME/emoji | 源编辑器 composition 期间不自动保存；结束后按完整正文保存 | fixture | 通过：artifact-workspace IME 测试 |
| 并发编辑 | 保存 409 保留 pending，提供 reread/compare/save-as-draft | fixture + owner HTTP | 通过：adapter conflict + 既有 HTTP |
| candidate base 过期 | stale apply 拒绝，acceptedVersion 不变 | fixture + owner HTTP | 通过 |
| autosave 失败 | unknown 暂停自动保存，不重试，保留草稿 | fixture | 通过 |
| atomic change-set 失败 | 本切片无独立 change-set UI；零 change-set 写入 | fixture | 通过：独立动作测试零 `/change-sets/` |
| 采用不晋级 Canon | adopt 摘要与 mutation URL 不含 checkpoint/review/canon | fixture + owner HTTP | 通过 |
| 双会话/项目隔离 | 其他 session context 不能 dispatch Checkpoint | fixture | 通过 |
| 旧版本保留 | 迟到 dispatch/read 丢弃 | fixture | 通过：controller 迟到响应 |
| unknown 零重试 | 未知 Checkpoint 只一次 POST | fixture | 通过 |
| 禁用不删除 | disabled 入口保留原因，不删草稿/资源 | fixture | 通过：Composer unavailable 态 |
| 画布同步 | 可选消费，不阻塞独立 Pane | n/a | 不阻塞 |

完整小说/剧本/文本真实写作闭环仍归 4.2，零匹配/skip 不能关闭该任务。

## 独立验收

打开小说/剧本/文本→编辑并确认保存→选区交给Agent→比较并采用candidate→Checkpoint/Review→固定版本导出；反例覆盖：IME/emoji、并发编辑、candidate base过期、autosave失败、atomic change-set失败、采用不晋级Canon。对应第4组tasks只有在第5组补充交互和本Pane required能力通过后才能关闭；不依赖其他Pane的未完成项目。协议/fixture/real分别记证据，关闭新Pane仍能经原owner恢复在途操作。

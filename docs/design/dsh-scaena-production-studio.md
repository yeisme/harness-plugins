# Scaena 制作台页面与控件设计

状态：规格和任务已形成；实现、原型与真实owner验收未完成。唯一任务入口：[tasks](../../openspec/changes/dsh-scaena-production-studio-v1/tasks.md)；规范：[spec](../../openspec/changes/dsh-scaena-production-studio-v1/specs/dsh-scaena-production-studio/spec.md)。

## 用户路径

创建或打开镜头→绑定图像/声音→制作→比较替换候选→保存镜头编排→审阅→合成或导出。本Pane从DSH目录或owner对象引用独立打开；不依赖画布、其他专业Pane或Ordo才能直接操作。

## 页面与交互

| 工作页 | 控件与直接动作 | 关键行为 |
|---|---|---|
| 项目与镜头 | 项目/剧集/场景/镜头树、镜头描述、批准的结构编辑 | 结构写入由Scaena处理；画布只绑定资源 |
| 资产与制作 | 角色/场景/图像/声音绑定、制作参数、运行与候选比较替换 | 采用校验expected version/digest，旧成果保留 |
| 镜头级编排 | 镜头顺序、时长、声音关联、素材缺口、预览与保存 | 时长修改显示声音/字幕影响，不静默伸缩原音频 |
| 审阅与交付 | 生产审阅、证据/权利/连续性缺口、合成/制作包导出 | 运行成功、production acceptance和delivered独立 |

```text
DSH Pane 标题（原宿主管理）
┌──────────────┬─────────────────────────┬─────────────────┐
│ 对象导航     │ 当前对象/正文/媒体预览  │ 参数/版本/证据  │
│ 树或列表     │ 比较按需替换主体        │ 一次一个详情deck│
└──────────────┴─────────────────────────┴─────────────────┘
```

该线框表达内容关系，不增加固定布局器；分屏/放大/移动由Pane host拥有。画布节点显示主要输入、关键参数、状态和选定结果，复杂编辑打开专业Pane。二者绑定相同owner/ref/version/project，并复用查询订阅。新成果只提示，不抢焦点或改变选定版本。

## 领域规则

范围包括镜头级制作、顺序/时长/声音编排和支持的合成/导出，不增加通用多轨剪辑器。领域内部制作workflow直接使用Scaena，只有跨领域编排由Ordo控制。本Pane是Scaena公开合同的DSH呈现，不创建另一套Production Canvas或状态机。

- The studio SHALL provide project/episode/scene/shot navigation, approved structural edits, asset and audio binding, shot order and duration editing through Scaena actions, without a general multitrack editor.
- Run completion, candidate adoption, production acceptance and delivery SHALL retain distinct owner states and receipts.

Agent可编辑指定范围内插件草稿，执行另确认；领域正文仍经owner candidate。候选采用、保存、源文件写回、正式版本确认和交付各自显示真实receipt。UI undo只撤销布局/临时编辑；远程反向操作必须经owner批准。

## 状态与响应式

loading保留scope与最后确认内容；empty给首个创建/导入动作；error保留编辑；partial保留成功候选；stale/conflict要求重新读取比较；unknown只对账原operation。disabled保留入口、原因与配套任务，不假装功能已经交付。

容器≤420px时对象/内容/详情单面切换；421–720px用主体与参数互斥Sheet；>720px允许主体和一个侧区并排。所有能力保留，复杂操作可放大Pane。菜单/焦点回归host，键盘覆盖导航、选择、确认和撤销；中英locale、IME、200%zoom与reduced motion必须验证，不自动播放媒体。

## 复用与依赖

复用ui-surface、ui-visual-kit、官方primitives，以及既有CreatorActionComposer、artifact-workspace和rich-media。不要把本文解释为重新实现所有共享编辑/候选/引用能力。具体UI Contract见[design](../../openspec/changes/dsh-scaena-production-studio-v1/design.md)；共用接口、证据和边界见[公共合同](../interfaces/dsh-creative-studio-contracts.md)。

依据：[owner文档](../../../../agent/scaena/docs/design/production-public-api-contract.md)。当前源码/文档不等于真实providerready；任务1.1复核operation/handler/registry/version，任务5.1对确认缺失能力在`agent/scaena`创建配套OpenSpec/tasks，并双向链接。缺少canary只应进入验证任务，不重复造API。

## 独立验收

创建或打开镜头→绑定图像/声音→制作→比较替换候选→保存镜头编排→审阅→合成或导出；反例覆盖：候选digest冲突、绑定失权、partial制作、声音时长不匹配、导出失败、unknown采用。对应第4组tasks只有在第5组补充交互和本Pane required能力通过后才能关闭；不依赖其他Pane的未完成项目。协议/fixture/real分别记证据，关闭新Pane仍能经原owner恢复在途操作。

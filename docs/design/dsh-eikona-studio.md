# Eikona 生成台页面与控件设计

状态：已接入生成配置、候选与修改、资产与来源三页，复用共享执行和成果组件；切页草稿保留及中英导航已有测试，见[实施基线](../../openspec/changes/dsh-eikona-studio-v1/implementation-baseline.md)。完整生成配置、遮罩、lineage与真实owner验收仍未完成。唯一任务入口：[tasks](../../openspec/changes/dsh-eikona-studio-v1/tasks.md)；规范：[spec](../../openspec/changes/dsh-eikona-studio-v1/specs/dsh-eikona-studio/spec.md)。

## 用户路径

真实生成两候选→比较→基于选定结果修改→保留旧版并采用新版→固定版本引用/交接。本Pane从DSH目录或owner对象引用独立打开；不依赖画布、其他专业Pane或Ordo才能直接操作。

## 页面与交互

| 工作页 | 控件与直接动作 | 关键行为 |
|---|---|---|
| 生成配置 | 提示词、参考图/区域、模型、尺寸、数量、可用seed；生成预览与确认 | 预览绑定配置版本，模型或参考变化必须重做预览 |
| 候选与修改 | 批量候选网格、并排/切换比较、选定结果、遮罩和修改提示词 | 新结果仅为候选；遮罩绑定原图版本与坐标 |
| 资产与来源 | 生成来源、run、资产版本、绑定用途、固定引用与交接 | 采用、引用和交接分别操作，不自动采用最新图 |

```text
DSH Pane 标题（原宿主管理）
┌──────────────┬─────────────────────────┬─────────────────┐
│ 对象导航     │ 当前对象/正文/媒体预览  │ 参数/版本/证据  │
│ 树或列表     │ 比较按需替换主体        │ 一次一个详情deck│
└──────────────┴─────────────────────────┴─────────────────┘
```

该线框表达内容关系，不增加固定布局器；分屏/放大/移动由Pane host拥有。画布节点显示主要输入、关键参数、状态和选定结果，复杂编辑打开专业Pane。二者绑定相同owner/ref/version/project，并复用查询订阅。新成果只提示，不抢焦点或改变选定版本。

## 领域规则

默认模型固定 `openai/gpt-5.4-image-2`，其他模型仅来自 owner capability。必须支持参考图/选区/遮罩与修改交互；模型不支持时禁用具体动作并显示原因和补齐任务。批量partial保留成功候选，失败重试范围来自owner，unknown只对账。

- The studio SHALL default to openai/gpt-5.4-image-2 and expose only model-supported generation/edit controls; required unsupported actions SHALL retain disabled reasons and owner tasks.
- Reference regions and masks SHALL bind to source version and dimensions; a partial batch SHALL preserve successful candidates and never retry unknown members.

Agent可编辑指定范围内插件草稿，执行另确认；领域正文仍经owner candidate。候选采用、保存、源文件写回、正式版本确认和交付各自显示真实receipt。UI undo只撤销布局/临时编辑；远程反向操作必须经owner批准。

## 状态与响应式

loading保留scope与最后确认内容；empty给首个创建/导入动作；error保留编辑；partial保留成功候选；stale/conflict要求重新读取比较；unknown只对账原operation。disabled保留入口、原因与配套任务，不假装功能已经交付。

容器≤420px时对象/内容/详情单面切换；421–720px用主体与参数互斥Sheet；>720px允许主体和一个侧区并排。所有能力保留，复杂操作可放大Pane。菜单/焦点回归host，键盘覆盖导航、选择、确认和撤销；中英locale、IME、200%zoom与reduced motion必须验证，不自动播放媒体。

## 复用与依赖

复用ui-surface、ui-visual-kit、官方primitives，以及既有CreatorActionComposer、artifact-workspace和rich-media。不要把本文解释为重新实现所有共享编辑/候选/引用能力。具体UI Contract见[design](../../openspec/changes/dsh-eikona-studio-v1/design.md)；共用接口、证据和边界见[公共合同](../interfaces/dsh-creative-studio-contracts.md)。

依据：[owner文档](../../../../cli/eikona/docs/interfaces/consumer-contract-matrix.md)。当前源码/文档不等于真实providerready；任务1.1复核operation/handler/registry/version，任务5.1对确认缺失能力在`cli/eikona`创建配套OpenSpec/tasks，并双向链接。缺少canary只应进入验证任务，不重复造API。

## 独立验收

真实生成两候选→比较→基于选定结果修改→保留旧版并采用新版→固定版本引用/交接；反例覆盖：默认模型/不支持模型、遮罩过期、费用unknown、批量partial、重复点击、采用与交接分离。对应第4组tasks只有在第5组补充交互和本Pane required能力通过后才能关闭；不依赖其他Pane的未完成项目。协议/fixture/real分别记证据，关闭新Pane仍能经原owner恢复在途操作。

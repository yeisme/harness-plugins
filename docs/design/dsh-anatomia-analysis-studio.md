# Anatomia 分析台页面与控件设计

状态：规格和任务已形成；实现、原型与真实owner验收未完成。唯一任务入口：[tasks](../../openspec/changes/dsh-anatomia-analysis-studio-v1/tasks.md)；规范：[spec](../../openspec/changes/dsh-anatomia-analysis-studio-v1/specs/dsh-anatomia-analysis-studio/spec.md)。

## 用户路径

导入授权视频→分析→镜头/证据定位→审阅观察→提取固定版本参考包→交接。本Pane从DSH目录或owner对象引用独立打开；不依赖画布、其他专业Pane或Ordo才能直接操作。

## 页面与交互

| 工作页 | 控件与直接动作 | 关键行为 |
|---|---|---|
| 来源与分析 | 授权来源、媒体概览、分析profile、范围、费用与开始/恢复/取消 | 来源可见不等于允许分析、播放或导出 |
| 播放器与时间线 | 播放器、镜头/场景条目、字幕、关键帧、区间选择与时间码跳转 | 所有视图绑定同一source/version和owner时间基准 |
| 观察与证据 | observed/inferred、coverage、证据、冲突与revision比较/审阅 | 模型观察不自动成为accepted fact，缺口不能显示为完整覆盖 |
| 参考提取 | 片段/关键帧/角色/场景参考、固定版本包与目标交接 | 包固定revision与范围，handoff与生产采用分离 |

```text
DSH Pane 标题（原宿主管理）
┌──────────────┬─────────────────────────┬─────────────────┐
│ 对象导航     │ 当前对象/正文/媒体预览  │ 参数/版本/证据  │
│ 树或列表     │ 比较按需替换主体        │ 一次一个详情deck│
└──────────────┴─────────────────────────┴─────────────────┘
```

该线框表达内容关系，不增加固定布局器；分屏/放大/移动由Pane host拥有。画布节点显示主要输入、关键参数、状态和选定结果，复杂编辑打开专业Pane。二者绑定相同owner/ref/version/project，并复用查询订阅。新成果只提示，不抢焦点或改变选定版本。

## 领域规则

保留二维观察、推断、三维空间证据和生产采用的真相区别。没有完整时序coverage或空间校准时显示缺口，不从二维界面推导精确三维事实。范围分析、审阅和包冻结分别执行owner动作。

- The studio SHALL offer source import, player, shot/scene timeline, transcript, keyframes and range navigation using a single source version and owner time base.
- The studio SHALL retain observed/inferred labels, coverage gaps, conflicting claims and evidence levels; it SHALL NOT automatically accept observations or infer calibrated spatial truth.

Agent可编辑指定范围内插件草稿，执行另确认；领域正文仍经owner candidate。候选采用、保存、源文件写回、正式版本确认和交付各自显示真实receipt。UI undo只撤销布局/临时编辑；远程反向操作必须经owner批准。

## 状态与响应式

loading保留scope与最后确认内容；empty给首个创建/导入动作；error保留编辑；partial保留成功候选；stale/conflict要求重新读取比较；unknown只对账原operation。disabled保留入口、原因与配套任务，不假装功能已经交付。

容器≤420px时对象/内容/详情单面切换；421–720px用主体与参数互斥Sheet；>720px允许主体和一个侧区并排。所有能力保留，复杂操作可放大Pane。菜单/焦点回归host，键盘覆盖导航、选择、确认和撤销；中英locale、IME、200%zoom与reduced motion必须验证，不自动播放媒体。

## 复用与依赖

复用ui-surface、ui-visual-kit、官方primitives，以及既有CreatorActionComposer、artifact-workspace和rich-media。不要把本文解释为重新实现所有共享编辑/候选/引用能力。具体UI Contract见[design](../../openspec/changes/dsh-anatomia-analysis-studio-v1/design.md)；共用接口、证据和边界见[公共合同](../interfaces/dsh-creative-studio-contracts.md)。

依据：[owner文档](../../../../agent/anatomia/docs/contracts/public-interfaces.md)。当前源码/文档不等于真实providerready；任务1.1复核operation/handler/registry/version，任务5.1对确认缺失能力在`agent/anatomia`创建配套OpenSpec/tasks，并双向链接。缺少canary只应进入验证任务，不重复造API。

## 独立验收

导入授权视频→分析→镜头/证据定位→审阅观察→提取固定版本参考包→交接；反例覆盖：来源失权、时间基准错配、partial coverage、冲突审阅、stale revision包、取消未知。对应第4组tasks只有在第5组补充交互和本Pane required能力通过后才能关闭；不依赖其他Pane的未完成项目。协议/fixture/real分别记证据，关闭新Pane仍能经原owner恢复在途操作。

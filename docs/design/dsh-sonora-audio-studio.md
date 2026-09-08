# Sonora 声音台页面与控件设计

状态：规格和任务已形成；实现、原型与真实owner验收未完成。唯一任务入口：[tasks](../../openspec/changes/dsh-sonora-audio-studio-v1/tasks.md)；规范：[spec](../../openspec/changes/dsh-sonora-audio-studio-v1/specs/dsh-sonora-audio-studio/spec.md)。

## 用户路径

选定台词/片段→配音/音乐/音效→试听比较→审阅采用→字幕/对齐核验→镜头绑定或支持的导出。本Pane从DSH目录或owner对象引用独立打开；不依赖画布、其他专业Pane或Ordo才能直接操作。

## 页面与交互

| 工作页 | 控件与直接动作 | 关键行为 |
|---|---|---|
| 声音与生成 | 台词/角色声音、配音/音乐/音效、provider/target、参数和预算 | 分任务类型发现实际能力；确认后生成或导入授权配音 |
| 候选与片段 | 播放、时间范围、候选切换、时长/质量、基础修改与采用 | 版本固定，新的候选不抢当前试听；缺能力不本地伪造 |
| 字幕与对齐 | 转写、cue、时间码、可读性/对齐finding、镜头关联 | segment-to-cue不等于word-level alignment或SRT/VTT导出 |
| 资产与交接 | 声音版本、权利/质量/审阅、目标镜头与交接 | 试听、handoff_ready与Scaena生产采用保持不同 |

```text
DSH Pane 标题（原宿主管理）
┌──────────────┬─────────────────────────┬─────────────────┐
│ 对象导航     │ 当前对象/正文/媒体预览  │ 参数/版本/证据  │
│ 树或列表     │ 比较按需替换主体        │ 一次一个详情deck│
└──────────────┴─────────────────────────┴─────────────────┘
```

该线框表达内容关系，不增加固定布局器；分屏/放大/移动由Pane host拥有。画布节点显示主要输入、关键参数、状态和选定结果，复杂编辑打开专业Pane。二者绑定相同owner/ref/version/project，并复用查询订阅。新成果只提示，不抢焦点或改变选定版本。

## 领域规则

配音、音乐、音效都为required设计能力，不能只验证TTS就关闭整个声音台。当前部分provider的voice clone未稳定开放，music fixture/preview不代表生产ready；字幕精度/导出按owner能力处理。对确认缺口创建Sonora配套任务，不以永久disabled结项。

- The studio SHALL provide independent speech, music and sound-effect configuration, audition and candidate comparison; unavailable required capabilities SHALL expose a reason and linked owner task.
- Subtitle/alignment precision, readability findings, rights, handoff readiness and production acceptance SHALL remain owner-authored and distinct.

Agent可编辑指定范围内插件草稿，执行另确认；领域正文仍经owner candidate。候选采用、保存、源文件写回、正式版本确认和交付各自显示真实receipt。UI undo只撤销布局/临时编辑；远程反向操作必须经owner批准。

## 状态与响应式

loading保留scope与最后确认内容；empty给首个创建/导入动作；error保留编辑；partial保留成功候选；stale/conflict要求重新读取比较；unknown只对账原operation。disabled保留入口、原因与配套任务，不假装功能已经交付。

容器≤420px时对象/内容/详情单面切换；421–720px用主体与参数互斥Sheet；>720px允许主体和一个侧区并排。所有能力保留，复杂操作可放大Pane。菜单/焦点回归host，键盘覆盖导航、选择、确认和撤销；中英locale、IME、200%zoom与reduced motion必须验证，不自动播放媒体。

## 复用与依赖

复用ui-surface、ui-visual-kit、官方primitives，以及既有CreatorActionComposer、artifact-workspace和rich-media。不要把本文解释为重新实现所有共享编辑/候选/引用能力。具体UI Contract见[design](../../openspec/changes/dsh-sonora-audio-studio-v1/design.md)；共用接口、证据和边界见[公共合同](../interfaces/dsh-creative-studio-contracts.md)。

依据：[owner文档](../../../../cli/sonora/docs/commands/workflow.md)。当前源码/文档不等于真实providerready；任务1.1复核operation/handler/registry/version，任务5.1对确认缺失能力在`cli/sonora`创建配套OpenSpec/tasks，并双向链接。缺少canary只应进入验证任务，不重复造API。

## 独立验收

选定台词/片段→配音/音乐/音效→试听比较→审阅采用→字幕/对齐核验→镜头绑定或支持的导出；反例覆盖：unknown费用、clone不可用、试听切版本、cue越界、rights拒绝、stale handoff digest、fixture不冒充production。对应第4组tasks只有在第5组补充交互和本Pane required能力通过后才能关闭；不依赖其他Pane的未完成项目。协议/fixture/real分别记证据，关闭新Pane仍能经原owner恢复在途操作。

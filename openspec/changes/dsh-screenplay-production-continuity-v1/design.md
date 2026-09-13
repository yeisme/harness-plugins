## 实施与依赖

本变更协调已批准的“剧本／梗概→分镜草案→无限画布→候选审阅→制作包→重开续接”流程。既有画布、文本台、制作台、工作流与 3D change 保留独立责任和未完成任务。

## 当前接线盘点

| 能力 | 已存在的真实入口 | 本次状态与下一步 |
|---|---|---|
| 画布保存 | Creator Studio canvasRead/canvasSave/canvasReconcile | 已接做剧嵌入面；真实Store重挂载测试通过，真实浏览器双Pane仍待 |
| 文本恢复 | Auctra editor-recovery-drafts/save、list、content 的现有客户端 | 复用原恢复合同，不重新保存正文到DSH；本次未验收剧本主流程 |
| 分镜表 | local-scaena-table 的 readScaenaTable 与 set/set_duration/reorder | 已有制作台可消费；工作台到固定剧本来源的草案确认流程仍待 |
| 制作包 | local-scaena-package 的 selectScaenaPackage、formal/draft export、export-status | 已有明确草稿/正式门控和原键对账；六镜头主流程、候选回填仍待 |
| 3D 预演 | sceneWorkbenchRead/saveSceneWorkbench | 本次新增，实际Controller/Gateway/Store验证；不作为Scaena生产镜头状态 |
| 跨领域执行 | Ordo配套creative-workflow adapter change | 尚未串联真实执行，不升级为可启动能力 |

这张表是源码盘点，不是上述全部能力的端到端验收。既有旧文档中“只有存储基础”的说法须以当前客户端代码和本次证据区分，不能直接照搬为当前缺口。

先核实并复用 Creator Studio 的 Auctra、Scaena 分镜表与制作包 adapter，再接做剧工作台与原 owner。不得在浏览器保存第二份领域正文或生产镜头。Pipeline 的画布读写统一委托现有 Creator Studio Host；方法缺失继续只读降级。所有请求保留 document scope，最终由 Host 验证身份与版本。画布独立 Pane 与嵌入面共用存储，冲突由原 revision CAS 处理。

3D 保存必须区分请求提交前后发生的编辑；回执确认旧快照时只推进保存基线，不能清空后续编辑的 dirty 标记。尚未进入保存请求的关键帧不得声称已保存。预演数据合同使用可协商增量，旧 scene schema 保持严格兼容。

实际增量为可选 `sceneWorkbenchRead` / `saveSceneWorkbench`，读取 envelope 为 `dsh.scene-workbench.v1`。旧 `SceneDocumentSchema`、`sceneRead` 与 `saveScene` 不扩字段。Host 在原 documents row 中保存可选 shots，与场景共享 revision、写前日志、回执和上下文检查；老式场景保存保留已存在 shots。缺少新方法时保留原场景能力，但关键帧编辑不允许标记为保存成功。持久化 shots 优先于 Pipeline 的旧投影，运行通知不得覆盖未保存或已恢复的关键帧。此处保存的是预演快照，不提升为 Scaena 生产编排或交付事实；旧 GLB 导出仍只导出场景，镜头预演不隐式转换成 glTF animation。

新增集成场景复用 `scripts/run-3d-director-integration.mjs`：实际 Controller→Gateway→Store，注入内存 storageDomain 和一次提交丢失；覆盖存储重挂载、原日志恢复、重复 shot 拒绝及跨项目拒绝。它证明 owner 接线，不证明真实浏览器重启、真实模型或磁盘故障持久性。

## UI Contract

- Surface classification: adopted；画布节点为 embed。
- Surface kind: workspace + inspector。
- First / second / third visual priority: 制作对象与保存状态；镜头和候选；引用与证据。
- Existing components reused: ui-surface、官方 primitives、ProjectCanvasView、现有专业 Pane 和 Scene3DController。
- Cards that earn existence: 素材、候选及可选择镜头；无额外指标卡片。
- Primary scroll owner: 现有工作台主区，详情独立有界。
- State Matrix: loading 说明正在读取的 owner；empty 不填充伪数据；error 保留草稿；success 以回执为准；stale/unknown 禁止重复提交并提供对账；能力缺失说明原因。
- Responsive: 360/560px 列表与详情切换；960px 画布与详情并排。
- Accessibility: 中英文、键盘、焦点恢复、IME、缩放和长名称；无新增动画，遵循 reduced-motion。
- Visual Exceptions: 无新增例外，沿用现有画布测量几何。

## 验收

一个项目、两个场景、六个镜头；验证固定来源、分镜确认、候选采用、制作包与重开。覆盖保存中编辑、冲突、未知回执、部分失败、项目切换和迟到响应。300混合节点与持续使用另跑性能验收。实际本地 owner、fixture 和付费模型证据分别标记，失败也保留在 temp/integration-test-runs。

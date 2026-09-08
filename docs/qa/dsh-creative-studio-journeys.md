# 创作工作台场景与故障验收矩阵

本文定义待实施/执行的场景；当前全部为未运行，未生成任何新的fixture/real通过证据。任务归 [跨项目 change](../../openspec/changes/dsh-creative-cross-owner-journeys-v1/tasks.md)，场景执行不复制成员change的代码。所有证据经本项目runner写入 `temp/integration-test-runs/<run-id>/`，至少summary/command/stdout/stderr/env/artifacts。

## 1. 业务场景

| ID | 用户与工作 | 必要成果 | 成员change / owner | 审阅门与核心断言 | 交接/导出 | 实施验证入口与状态 |
|---|---|---|---|---|---|---|
| DSH-CREATIVE-EIK | 图像创作者：参考→生成→修改 | 输入refs、两候选、选定版本、receipt | dsh-eikona-studio-v1 / Eikona | 默认模型正确；遮罩绑定版本；partial不丢结果；采用不自动交付 | 固定图像版本/asset handoff | 成员4.2创建实际测试；未运行 |
| DSH-CREATIVE-ANA | 分析者：视频→观察→参考 | source、时间范围、证据、revision、参考包 | dsh-anatomia-analysis-studio-v1 / Anatomia | observed/inferred/coverage冲突保真；时间码一致；非自动accepted | 参考包到Eikona/Scaena | 成员4.2；未运行 |
| DSH-CREATIVE-SCA | 制作者：镜头→候选→交付 | 镜头结构、绑定、候选、编排、导出receipt | dsh-scaena-production-studio-v1 / Scaena | 镜头顺序/时长/声音条件；production acceptance与delivered分离 | 支持的合成或制作包 | 成员4.2；未运行 |
| DSH-CREATIVE-AUC | 作者：正文→候选→版本 | Working Copy、candidate、Checkpoint、Review | dsh-auctra-writing-studio-v1 / Auctra | IME/emoji无损；candidate base冲突；采用不自动Canon | 选定文本版本到制作 | 成员4.2；未运行 |
| DSH-CREATIVE-SON | 声音创作者：文本/片段→声音 | TTS/music/SFX、片段、字幕/对齐、rights与receipt | dsh-sonora-audio-studio-v1 / Sonora | 三类声音分别验收；精度/rights和handoff保真 | 声音/字幕绑定镜头 | 成员4.2；未运行 |
| DSH-CREATIVE-CROSS | 创作者：参考→文本/图像/声音→镜头交付 | 固定版本输入、Ordo计划、各owner run/receipt、交付物 | 全部五专业change + dsh-creative-workflow-v1；六owner含Ordo | 选定范围不扩大；采用点暂停；无跨owner伪原子事务；失败可恢复 | Scaena支持的最终交付 | 本change 2.2；未运行 |
| DSH-CREATIVE-RESTORE | 多项目使用者：隔天续接 | layout/Draft、原session/run、成果refs | dsh-project-canvas-continuity-v1 / DSH、可选Pinax | 三项目两类工作；10次至少8次≤30秒定位；不恢复执行 | 继续原运行观察或显式新回合 | 画布4.2/4.3；未运行 |
| DSH-CREATIVE-PERF | 桌面用户：持续工作 | 300混合节点样本、指标和保存证据 | 画布change、实际被测Pane | 输入p95≤100ms、缓存切换p95≤200ms；60分钟无增长性泄漏/丢稿/重复操作 | 性能与问题摘要 | 画布4.3；未运行 |

验证入口目前指向明确负责创建测试的任务，而不是尚不存在的命令。实现时须登记真实runner命令、非零匹配数量、fixture/real与owner版本；零匹配和skip不能通过。本change 2.2必须覆盖五个专业正常/恢复路径和至少一个真实跨领域路径，可复用成员直接证据而不无故重复模型调用。

## 2. 故障演练

| ID | 注入或用户行为 | 必须观察到的行为 | 负责验证 |
|---|---|---|---|
| F01 | 修改上游参考/提示词 | 下游标影响，已采用版本不变；重跑产生候选 | 工作流2.6、各专业5.4 |
| F02 | 比较后owner revision变化 | 旧采用拒绝，保留编辑并重新比较 | 各专业5.4 |
| F03 | 确认提交后丢响应 | 原operation对账；无新submit/重复费用；pending不变saved | 工作流观察、各专业5.4 |
| F04 | 事件gap或乱序/迟到 | 单次权威重读，cursor/generation去重，原scope保留 | 工作流2.5、画布3.1 |
| F05 | 双栏切项目/会话 | 各自Draft/选择/成果互不污染；不得改投current session | 画布3.1、各专业3.1 |
| F06 | Pane关闭/禁用/重装 | UI解除订阅但原run继续；草稿/owner资源保留 | 画布与各专业回滚任务 |
| F07 | 资源失权或媒体地址过期 | 禁止继续读取/写入，清除不再授权的缓存，保留安全状态说明 | 各专业5.4 |
| F08 | owner或storage seam缺失 | 入口禁用并有原因及负责任务；其他专业Pane继续可用 | 各专业5.1/5.4 |
| F09 | 批量部分失败 | 成功结果/receipt保留，只对失败允许范围修复；unknown不重试 | Eikona、Scaena、Sonora |
| F10 | 预览后参数/范围/预算变化 | 旧预览失效，重新确认，不暗中增加节点 | 工作流2.3 |
| F11 | 声音rights/字幕精度不足 | 可用性与生产门保真，不能以fixture/试听结果标生产ready | Sonora、Scaena |
| F12 | owner保存失败/项目storage冲突 | 本地未保存编辑保留；已确认内容可恢复；UI撤销不伪造远程回滚 | Auctra、画布 |

## 3. 证据与关闭条件

每次运行保留版本、profile、环境、scenario ID、执行命令、匹配数、原退出码与被测owner capability。脱敏，不记录正文/raw prompt/provider payload/credentials/私有工具参数。

成员独立通过不要求其他Pane完成；综合路径只有所有实际参与步骤和相关恢复证据齐全才能通过。所有required能力必须有直接证据或明确未完成owner任务，不能将缺失能力删除来归档。运行记录与readiness索引必须由runner/CLI生成，本文不手写成功收据。

# 工具发现与会话草稿

工具页服务于“找到能力 → 看懂用途和可用条件 → 加入绑定会话草稿”。本功能本地验收已通过：8项浏览器场景、真实Host A/B草稿隔离、相关包及布局/补丁门；全仓类型与视觉检查仍有其它在途改动失败，详见 [验收记录](../../openspec/changes/dsh-tools-discovery-draft-v1/verification.md)。实施由 [OpenSpec](../../openspec/changes/dsh-tools-discovery-draft-v1/tasks.md) 维护；完整 [UI Contract](../../openspec/changes/dsh-tools-discovery-draft-v1/design.md) 沿用项目统一视觉系统。

## 使用路径

默认查看当前会话可用能力，可切换本机已有目录。搜索支持原始名称、说明、来源及已提供的中文用途关键词；用途分类优先，类型和来源用于缩小范围。没有补充说明的来源保留原文，不自动生成推荐或伪造分类。

选择结果后查看用途、完整可公开说明、来源和可用条件。宽Pane并排展示列表和详情；窄Pane进入详情，返回或Escape恢复原行及列表位置。目录覆盖不等于连接或加载成功，部分失败和旧数据必须明示。

“加入〈会话〉草稿”面向标题显示的明确目标。加入后留在列表，既有正文和引用保留，相同引用不重复堆叠；只有Host回执确认才显示成功。用户通过“去对话”主动返回，不自动切页或发送。A旁栏在查看B时仍只向A添加，迟到结果不能改变目标。

本机已安装但会话不可用时展示原因及现有设置入口。没有精确配置导航时提供明确操作指引，不造死按钮。返回工具页保留筛选和选择，重新检测可用性。

## 布局与边界

工具内容使用容器宽度，不继承对话正文的阅读宽度；正文调宽区域在工具页不显示、不截获操作。工作台外层Pane分屏继续可调，返回对话保留原阅读宽度偏好。

调用记录和上下文诊断由dsh-context维护。本轮不包含外部安装市场、语义模型推荐、面板内直接调用、Skill正文递归阅读或发布。递归说明/引用阅读仍由 [独立设计](dsh-tools-reference-reader.md) 管理。

## 验证

```bash
node scripts/run-tools-discovery-checks.mjs focused layout patches
node scripts/run-tools-discovery-checks.mjs typecheck surfaces plugins visual openspec
node scripts/run-tools-discovery-host-tests.mjs
```

所有gate保留脱敏证据。布局组件fixture、真实Host草稿交接、外部MCP业务调用是不同证据层；最终结果见OpenSpec验证记录，历史Tools V2通过记录不能替代本轮验收。

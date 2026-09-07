# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [ ] 1.1 编写旅程矩阵文档：至少覆盖图像（Eikona）、分析（Anatomia）、制作（Scaena）、文本（Auctra）、声音（Sonora）各一条完整旅程+一条跨领域工作流旅程；每条列成员 change、owner capability 与断言点。
- [ ] 1.2 编写故障演练矩阵：上游修改、版本冲突、保存 unknown、订阅 gap/迟到事件、seam 缺席、Pane 禁用/重装、项目/会话切换迟到结果；标注预期行为与证据来源。
- [ ] 2.1 fixture 级组合回归：矩阵旅程以 fixture 驱动跑通断言点（scope 冻结、零已确认丢失、禁用不删草稿）；产出六件套证据。
- [ ] 2.2 真实多 owner 旅程执行：至少两条旅程在真实 owner capability 下执行并断言；标注 fixture/real。
- [ ] 2.3 故障演练执行：按演练矩阵逐项执行并保存脱敏证据；未知态只对账、不自动重试。
- [ ] 3.1 汇总证据索引与逐旅程 readiness（未执行/fixture/real）；链接各成员 change 验收任务；不虚报 real。
- [ ] 3.2 矩阵、索引与成员 change 双向链接一致性检查；doc 结构检查通过。

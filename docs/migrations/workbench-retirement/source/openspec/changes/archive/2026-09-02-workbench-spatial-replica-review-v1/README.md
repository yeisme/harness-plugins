# workbench-spatial-replica-review-v1

在单一 Agent-first /agent 壳内组合 Anatomia 视频证据与 Scaena ReplicaStage，提供同步播放器、3D 视口、时间轴、独立 owner 面板、问答和 receipt 审阅；不保存第四套 canonical 状态。

Rollout 语义：additive + experimental + default-off（十个 capability 独立开关，server capability 是唯一 enable authority）；无 DB migration，rollback = 关 capability flag（capability off from start 时浏览器零 3D chunk 请求，rollback rehearsal e2e 断言）。owner projection 现由 deterministic fixture adapter 供给，真实 Anatomia/Auctra/Scaena runtime 合同保持 `needs_contract`。

证据与门禁汇总：[details/09-closeout-evidence.md](details/09-closeout-evidence.md)（8.x 全部 evidence run-id、9.1/9.2 最终门禁数字、concurrent/external 分类账、未证明项与 9.3/9.5 输入）。

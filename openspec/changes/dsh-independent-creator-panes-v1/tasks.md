# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [x] 1.1 独立 Eikona/Scaena 页面与按 owner 查询，保留旧入口和聚合合同。 | evidence: 正式 ModuleLoader 打开、拖拽并排、刷新恢复：temp/integration-test-runs/independent-panes-host-2026-09-11T03-10-15-323Z；360/960px 页面：temp/integration-test-runs/ui-visual-2026-09-11T02-40-43-324Z-3337499。
- [x] 1.2 默认本地 CLI 接线、用户级配置与正式 Gateway 挂载。 | evidence: 正式 RPC 验证 local context 与两个本地 adapter；用户级配置服务和 bundle 生命周期测试通过。配置使用说明：docs/runtime/dsh-creator-local-cli.md。
- [x] 2.1 Eikona 本地准备、批准、生成、候选读取、采用与恢复。 | evidence: 单图 CLI 准备→批准→生成→历史读取→采用→原操作恢复：temp/integration-test-runs/local-studio-2026-09-11T03-02-10-048Z-3551101，provider 为回环 fixture，调用一次。批量、参考导入、区域编辑、继续修改与交接仍在领域任务中开放。
- [ ] 2.2 Scaena canonical 镜头制作、编排、审阅、导出与跨 owner 交接。 | evidence: 已完成 canonical 镜头表字段、时长、场景顺序编辑及原操作查询、制作包读取与导出查询。未完成项目/镜头创建、图像声音绑定、候选替换、审阅合成、跨 owner 交接。
- [ ] 3.1 正式 ModuleLoader/浏览器/隔离测试与质量门，区分 fixture/real。 | evidence: 正式宿主基础验收和相关包回归通过；完整双项目/双会话及业务异常矩阵尚未完成。全局 check:plugins 被本轮未修改的 dsh-context 安全投影两项阻挡。真实收费 provider 与视觉认可未验收。

# dsh-conversation-rewrite-plugin-v1

DSH Web 会话改写/重试/分支插件：用户消息编辑、Assistant 重试、精确 forkBeforeMessage 与插件化交互。

- 根级设计：`docs/design/dsh-web-conversation-rewrite-plugin-v1.md`
- Goal：`goal.md`
- 文档：`proposal.md`、`design.md`
- 任务：`tasks.md`
- Spec：`specs/conversation-rewrite/spec.md`

状态：本地切片 1.1-5.3 已完成（client/bundle 包、Retry/Edit 组件与 controller、Agent Note handoff）；6.1-6.6 为 retain-next，依赖 DSH Host seam/首轮能力/a11y/附件/lineage 后续推进。

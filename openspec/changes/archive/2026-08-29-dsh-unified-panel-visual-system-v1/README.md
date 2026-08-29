# dsh-unified-panel-visual-system-v1

插件侧面板统一视觉与交互系统：一个 token registry、一个 scoped chrome 构建器、一个交互底线，按用户价值分片采纳到 DSH web 面板（先 domain panes 与 Creator Studio）。

- 提案：`proposal.md`
- 设计（token registry、分层、采纳顺序）：`design.md`
- 能力 spec：`specs/dsh-panel-visual-system/spec.md`（ADDED）
- 现状审计证据：`docs/design/dsh-unified-panel-visual-system.md`

边界：官方 `dsh web` host 仍是主题与 slot owner；本 change 不改 host/owner 合同，不新增重依赖，完成门不依赖官方合入。

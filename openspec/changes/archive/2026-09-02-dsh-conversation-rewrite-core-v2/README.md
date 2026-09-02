# dsh-conversation-rewrite-core-v2

共享 conversation rewrite core v2：稳定边界、分阶段 fork/prompt/activate、unknown outcome 对账、恢复卡合同与旧 Web 导出兼容

状态：**implemented（core 包 + Web facade，全部 focused gates 绿；根级 typecheck/test/build 见 §6 收口）**。证据：`temp/integration-test-runs/conversation-rewrite-core-v2-20260902125803Z-806734/`；pack canary `0.1.0-rc.1` sha256 `b8ce64b568fae5bd7b3be566af12cdda64c79842c23df7cfbccbd1867d03cc12`。

- 设计：[DSH Conversation Rewrite Core V2](../../../docs/design/dsh-conversation-rewrite-core-v2.md)
- 首个 consumer：`client/dsh-tui/openspec/changes/dsh-tui-v21-conversation-input-control/`
- 兼容分类：新 package/V2 symbols additive；现有 Web exports 与 DSH APIs unchanged；无 deprecation。
- 回滚：Web 恢复旧 V1 internal boundary/controller；已发布 additive core 保留。

```bash
cd /workspaces/yeisme-agent/agent/harness-plugins
openspec validate dsh-conversation-rewrite-core-v2 --strict --no-interactive
```

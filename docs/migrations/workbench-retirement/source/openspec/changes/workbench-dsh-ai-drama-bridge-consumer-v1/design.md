## Context

DSH 侧已完成 `dsh.workbench_ai_drama_bridge.v2` provider（OpenSpec `dsh-workbench-ai-drama-bridge-v2`，plugin-complete），发布 canonical fixtures 于 `@yeisme/dsh-ai-drama-director` npm 包 `fixtures/dsh-workbench-ai-drama-bridge-v2/`。Workbench 需要实现匹配 consumer 才能让跨仓 rollout-ready 成立。设计决策、字段规范、失败状态机、迁移矩阵与发布门的完整真值在 DSH 侧 change 与 packet 文档，本设计只记录 Workbench 侧落地决策。

## Decisions

1. **Ingress 归属 server-side**：launchRef/envelope 消费在 Go service ingress 完成（`service/internal/showcontrol/` 现有 dsh_bridge 入口的同层演进），浏览器与 Task SDK 不做 owner 鉴权，只渲染结果投影。alpha 深链路径保留为显式 legacy lane。
2. **校验统一到 V2 规范**：nonce 一律 `^[0-9a-f]{32}$`，修平当前 TS SDK 与 Go ingress 的格式分歧；digest 用 canonical schema-ordered SHA-256，不做签名语义。
3. **replay record 有界**：内存 + TTL 清理起步（对齐 DSH provider 的 bounded map 语义），不新建持久化 ledger；升级到持久化由性能/审计需求另立变更。
4. **权限与版本对账读 owner**：authorization 与 resourceVersion/contextRevision 全部从 Workbench 已有的 owner integration refetch，不信任 envelope 内任何标题/状态/可写字段。
5. **lens 定位走 `/agent` spatial router**：intent→lens 映射固化为常量（与 DSH `BRIDGE_V2_LENS_MAP` 对齐），未知 intent fail-closed。
6. **fixtures 是唯一跨仓验收物**：CI 拉取 npm 包内 fixtures 跑 consumer+both cases；fixtureVersion 变更即触发双方重新对齐，禁止本地复制 fixture 文件造成漂移。

## Migration / Rollback

- 兼容期同时支持 alpha 深链（legacy lane）与 V2 ingress；legacy 字段语义不变。
- 回滚：关闭 V2 消费入口，流量回落 alpha/legacy lane；不迁移、不删除、不回写任何 owner state。
- 退役 alpha 合同由 DSH 侧独立 removal change 主导，Workbench 跟随其发布窗口。

## Open Questions

- launchRef 交换 transport（server-to-server 或同进程 trusted channel）的部署形态：跟随 DSH host registry 的部署确认；本合同冻结逻辑 identity `workbench.agent.spatial`。

# Workbench 真实 Owner 后端集成

## 背景

Yeisme Workbench 已具备 React 多 Pane 工作区、Bun 本机 BFF、统一 `WorkbenchClient`、Task 控制面和 Open Design 只读投影，但 Auctra、Eikona、Scaena、Pinax、Sonora、Ordo、Ordo、Quaestor 等领域仍处于不同接口成熟度。若前端逐页直接适配 owner 私有结构，会形成多套认证、状态机、错误语义和重试策略；若为了统一而复制领域状态，又会让 Workbench 成为新的业务真源。

本 change 定义真实后端接入的正式纵切片：Workbench 发现 owner、读取安全投影、观察事件，并把所有 mutation 统一提交给现有 Task 控制面；每个 owner 继续拥有 canonical state、权限、成本、review、receipt 和恢复语义。

## 目标

- 让 Workbench 在一个项目空间内真实组合多个 owner 的项目、对象、活动、证据、资产、review 与 handoff 状态。
- 浏览器只访问同源 Bun BFF；`workbenchd` 通过启动配置连接 owner，不接受请求级动态 URL。
- 使用 capability discovery 诚实表达 `available`、`degraded`、`offline`、`needs_contract`、`contract_mismatch` 和 `permission_required`。
- 读取保留 owner 原生 typed projection，mutation 统一进入 Operation registry、Task 状态机、gate、idempotency、receipt 和 reconcile。
- 为已有真实 HTTP 合同的 owner 建立首批 adapter，为尚未晋级的 owner 保留明确 handoff，不解析 human CLI output，也不伪造成功状态。

## 首版范围

### P0：真实接入

- Scaena：项目、ProductionGraph、scene/shot、run/output、review、delivery、event。
- Eikona：项目、run、event、asset、lineage、Visual Library、workflow preview。
- Pinax：capability、project/board、note card、folder、inbox、draft、memory 安全投影。
- Sonora：voice/model catalog、strategy comparison/explanation、estimate、公开 voice event。

P0 最终范围不变，但晋级顺序采用共享 spine 的纵切片：先以已有安全 connector 的 Eikona 完成 discovery→read→event→delegated mutation→receipt/reconcile→Pane canary，再推进 Scaena 复杂 production daily loop，随后并行 Pinax/Sonora reads。read capability 的成功不得推断 mutation 或 managed delegation 已可用。

### P1：合同晋级后接入

- Auctra：复用现有 Operation Catalog 与 CommandEnvelope，生产 network adapter 晋级前保持 `needs_contract`。
- Ordo：项目、run、assignment、review、worker/queue、handoff、audit、SSE；先完成可机器校验的 OpenAPI/SDK parity。

### P2：探索性接入

- Ordo：run、plan、approval、event、receipt、evidence；需要 owner 先提供只读服务投影。
- Quaestor：thesis、evidence ledger、quant experiment、review、report；需要 owner 先建立 capability/API 合同。
- 外部媒体库（用户自选，例如 Jellyfin/Immich/NAS/对象存储；MediaHub 产品已于 2026-08-22 退役）、Capsa、未来获批的通信桥、MediaOps：只进入 owner catalog 与 readiness，不在首版新增业务页面或绕过其 owner 边界。

## 非目标

- 不把 Workbench 变成 Scaena production、Sonora Audio 或任一 owner 的替代真源。
- 不读取 owner 数据库、私有目录、raw prompt、provider payload、credential、完整正文或完整思维链。
- 不把 owner CLI subprocess 或 human output 当作生产 Web transport。
- 不在浏览器实现跨 owner saga、自动重试未知 mutation、成本决策或权限推断。
- 不在本 change 中实现云端、多租户、LAN、外部 popout window、统一文件系统浏览器或 provider SDK。

## 成功标准

- P0 owner 在真实本机服务启动后可被 Workbench 发现、读取、观察并显示准确 freshness/health。
- 所有浏览器请求只到 Bun BFF，owner token 不进入浏览器、日志、构建产物或 evidence。
- mutation 只有在 capability、permission、cost、version 和 idempotency gate 通过后才创建 Task；未知接受进入 `unknown_accept` 并通过 owner receipt/status 对账。
- P1/P2 未完成合同的动作始终显示 `needs_contract` 或 `unavailable`，不得产生本地成功状态。
- REST、gRPC、JSON-RPC 和 TypeScript SDK 对新增 Workbench 合同保持 parity，并通过 strict OpenSpec、contract、integration 与 Playwright 验证。

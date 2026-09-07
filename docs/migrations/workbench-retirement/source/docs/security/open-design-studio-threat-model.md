# Open Design Studio 安全威胁模型

## 评审状态

- 范围：Workbench 单用户 loopback BFF、Design projection、六个 Design Operation、Task/Event/Receipt、Dockview preview。
- 当前结论：Workbench 已建立 fail-closed 基线；Open Design `0.8.0` 尚未提供可消费的领域合同，因此 owner adapter、candidate preview 与 mutation promotion 继续阻断。
- 信任边界：浏览器不可信；BFF 持有本地 session token；`workbenchd` 是控制面；Open Design 是外部 owner；owner 返回的正文、MIME、ref、event 和 receipt 均按不可信输入处理。

## 威胁与控制

| 威胁 | 影响 | 当前控制 | 晋级前必须补齐 | 归属 lane |
| --- | --- | --- | --- | --- |
| raw prompt 被持久化或写入日志 | 创作内容泄露 | gated mutation input 仅保存在进程内 volatile map；Task 只保存 digest；重启后 fail-closed | owner 合同声明 payload 上限与 redaction；integration evidence 扫描正文 | `mutation-adapter` / `persistence-audit` |
| HTML/candidate preview 执行脚本或读取 session | token、DOM 或本地数据泄露 | 文件 HTML 使用空 `sandbox`、内嵌 `default-src 'none'` CSP、`no-referrer`；正文按需读取 | candidate capability 明确 MIME；同源无凭据 proxy；size/cache/download/CSP 测试 | `preview-security` |
| owner URL、redirect 或 ref 触发 SSRF | 访问非预期本地/内网资源 | owner base URL 固定配置；禁止 userinfo/query/fragment；redirect 为 manual；browser 只到 loopback BFF | adapter host allowlist、DNS/redirect recheck、preview target 禁止动态 URL | `read-adapter` / `preview-security` |
| opaque ref 被当作路径或跨项目复用 | traversal、越权读取 | file ref 为 project + safe relative name 的 digest；API 不返回私有路径；refs 有格式校验 | owner contract 明确 ref scope、expiry、re-resolution 和 not-found/conflict 语义 | `owner-contract` / `read-adapter` |
| 浏览器注入 Authorization/cookie | session fixation 或 credential forwarding | BFF 删除浏览器 authorization、cookie、proxy headers，仅注入服务端 token；校验 loopback Host/Origin | Playwright 网络断言与 token redaction evidence | `browser-e2e` / `security-review` |
| owner payload 进入 event、receipt 或 evidence | provider 数据、私有路径、内部推理泄露 | Workbench 使用 typed safe summaries，不保存 raw owner payload；integration runner 写脱敏 evidence | 对 owner fake 注入 token/path/prompt/provider payload 的负向测试 | `contract-tests` / `mutation-integration` |
| timeout 后自动重放未知副作用 | 重复生成、重复决定或重复导出 | timeout/不确定结果不得映射普通 failed；任务保留 idempotency digest 和 expected version | owner receipt/status reconcile；item-level export receipt；禁止 unknown-accept 自动 retry | `reconcile` |
| permission/cost/version gate 被 UI 绕过 | 未授权或意外成本 | 六个 mutation 只通过 TaskService；Registry 元数据驱动命令面；owner mode 要求 expected version | mutation conformance 覆盖 reject/conflict，并证明无 owner 直连 | `mutation-integration` |
| 过大正文、事件或 preview 导致资源耗尽 | 本机 DoS | text projection MIME allowlist、1 MiB 上限、8 秒 owner timeout；candidate compare 最多 4 个 | owner capability 声明分页、payload 与 heartbeat 上限；preview 并发取消 | `read-adapter` / `performance` |

## 阻断条件

以下任一条件存在时，相关 capability 必须保持 `needs_contract`、`contract_mismatch` 或 `unavailable`：

1. owner contract 不可版本锁定或只能通过 CLI human output 获取；
2. prompt body、credential、private path 或 raw provider payload 会进入持久化、日志、事件、receipt 或测试证据；
3. preview MIME、大小、CSP、凭据隔离或 ref 作用域无法验证；
4. mutation 没有 idempotency、expected-version 或不确定结果 reconcile；
5. cancel 只表示请求已发送却被展示为 canonical `cancelled`；
6. partial export 没有 item receipt，导致成功项可能被重复执行。

## 验证证据

- `bun test apps/web/server`：验证浏览器 Authorization 被丢弃、跨 Origin mutation 和非 loopback Host 被拒绝。
- `CGO_ENABLED=0 go test ./service/...`：验证 owner URL、redirect、opaque file ref、MIME/size、volatile prompt 与 fail-closed 状态。
- `bun run test:contract`：验证 Operation Registry 与 REST/gRPC/JSON-RPC/SDK 元数据一致。
- `bun run test:integration`：每次运行生成脱敏 evidence；owner 合同接入后增加恶意 payload、unknown accept 和 partial receipt fixtures。

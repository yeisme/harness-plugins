# Owner Backend Integrations 安全审查

日期：2026-07-28

## 结论

**GO（本地安全门）**。当前 Workbench owner connector、admission、Task mutation、BFF 与浏览器边界经复核后 P0=0、P1=0。真实 owner canary、delegated mutation 与 provider handoff 仍是独立外部发布门，不因本结论自动晋级 capability。

## 审查范围

- owner URL、loopback、userinfo、query/fragment、redirect 与 SSRF 边界；
- safe ref、project/resource projection、raw payload、private path 与日志/evidence 脱敏；
- event cursor、cache freshness、unknown acceptance、reconcile 与禁止自动重放；
- admission 的 capability、permission、cost、schema、version 与 readiness gate；
- Browser→BFF→workbenchd 单向凭据托管与动态 owner URL/generic proxy 缺失。

## 发现与修复

- P1：共享 JSON content-type 校验曾可接受非 `application/*+json` 的伪 JSON MIME。现使用标准 media-type 解析，仅接受 `application/json` 或 `application/*+json`。
- P1：connector 的 `io.LimitReader` 仅截断读取，未证明响应未超限，也可能接受额外 JSON。现统一读取 `max+1`、显式拒绝超限、验证单一完整 JSON，并返回稳定安全错误。
- 防御加固：注入的自定义 `http.Client` 现在保留 transport，但强制 bounded timeout 与 redirect rejection；Eikona 统一使用共享 loopback URL policy、content-type、size 与 JSON decoder。

## 证据

- Owner/admission/conformance integration：`temp/integration-test-runs/20260728040822-069163f0-ea60-4ce6-af2c-584f72f8b9fc/`，exit code 0，redaction PASS。
- Full service：`CGO_ENABLED=0 go test ./service/... -count=1` 全部通过。
- Full Web E2E：`temp/integration-test-runs/20260728040223-55351c9a-8ba1-4315-9334-ebc54bb309b0/`，31 PASS，浏览器只访问同源 BFF 且无 Authorization/credential/private owner endpoint 泄漏。
- Owner security negative coverage：严格 MIME、oversize、trailing JSON、redirect、unsafe ref、forbidden DTO fields 与 safe logs 均通过。

## 保留阻塞

- `1.3b`、`3.6`、`4.4`、`6.0-6.4` 仍需要真实 owner/provider 仓库、进程或批准合同。
- 因真实 Eikona mutation/reconcile canary 和 P0 owner transport conformance 未完成，`7.3` 与 `7.4` 必须保持 pending。

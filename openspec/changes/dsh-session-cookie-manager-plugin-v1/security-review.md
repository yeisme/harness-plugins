# Security review — 四面凭据泄漏扫描（2026-08-21）

范围：`packages/client/ui-session-cookie-manager`（Phase 1）+ `packages/bundle/dsh-session-cookie-manager`。

| 面 | 扫描方式 | 结果 |
| --- | --- | --- |
| renderer | `tests/profile-manager.spec.tsx`：renderToStaticMarkup 快照断言输出不含 `cookie=` 等凭据形态；面板仅渲染 ProfileMetaV1 白名单字段 | PASS（断言在库，测试绿） |
| 持久化 | `ProfileStore.serialize()` roundtrip 测试：序列化产物不含 cookie/token/secret/bearer；`deserialize` 对含禁字段的条目 fail-closed 整体拒绝 | PASS（测试绿） |
| 日志 | `grep -rn 'console\.' src` → 零命中；包内无任何日志/遥测输出点 | PASS |
| 产物/证据 | `grep credential 关键词 lib/index.js` → 21 处命中，逐处抽样核对全部为 `FORBIDDEN_PROFILE_KEYS` 拒绝清单、validator 代码与降级文案（"waits for the host seam"），无凭据数据通路；测试快照即证据，只含元数据 | PASS |

结构性保证：`parseProfileMeta` 顶层禁 15 类凭据字段；`siteScope`/`profileId` 拒 URL/路径；真实 jar apply/switch 无本地写路径（`onApply === undefined` 时按钮禁用 + 明示等待 `web.cookieJars` seam）。

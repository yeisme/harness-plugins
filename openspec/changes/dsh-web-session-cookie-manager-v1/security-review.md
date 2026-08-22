# Security review — 四面凭据泄漏扫描（2026-08-22）

范围：`packages/client/ui-session-cookie-manager`（`@yeisme/dsh-client-ui-session-cookie-manager`）+ `packages/bundle/dsh-session-cookie-manager`（`@yeisme/dsh-session-cookie-manager`）。实施记录（子 change 侧）见 `openspec/changes/dsh-session-cookie-manager-plugin-v1/security-review.md`（2026-08-21）；本文是合同 change 任务 2.4 的正式归档扫描记录，命令均可从仓库根复跑。

## 面 1：renderer（组件渲染输出）

扫描方式与结果：

- 源码凭据形态字面量：`grep -rniE '(cookie|token|secret|bearer|password|authorization|credential)[[:space:]]*[:=]' packages/client/ui-session-cookie-manager/src packages/bundle/dsh-session-cookie-manager/src` → **0 命中**。
- 源码凭据词出现（人工分类）：client src 共 38 处，全部为三类非数据形态：(a) 产品标识符（`CookieManagerPanel`、`dsh-session-cookie-manager` 模块名）；(b) `FORBIDDEN_PROFILE_KEYS` deny 清单成员本身；(c) 固定 parser 报错文案与文档注释。无任何凭据值或数据通路。
- 渲染输出红线（测试断言即快照）：`tests/profile-manager.spec.tsx` 的 `credential red line sweep across rendered surfaces` 对列表态/失败态/账号+配额组合态三种 renderToStaticMarkup 快照断言零命中 `/(cookie|token|secret|bearer|password|authorization|credential)\s*[:=]/i`；`renders profile rows with metadata only`、`renders a CRUD failure without credential values` 同样断言不含 `cookie=`/`token`。
- deny-by-default 渲染：quota 字段经 `renderableQuotaFields` 过滤（禁字段键与非 string 值不渲染，`quota panel deny-by-default rendering` 测试证明 `bearer: 'raw-value'` 不出现在 DOM）；账号投影丢弃 owner 私有字段（`reason`、`actionRefs`，`composes account-resume sessions read-only and drops owner-private fields` 测试证明）。

结论：**PASS**。

## 面 2：持久化

扫描方式与结果：

- 运行时序列化扫描（`node --input-type=module` 驱动 `lib/index.js`）：创建两个含 `accountSummary: 'acct-••42'`（redacted 形态）的 profile 后 `serialize()`，产物为 `[{profileId,siteScope,displayName,accountSummary,capabilities,createdAt,updatedAt},…]`，`/(cookie|token|secret|bearer|password|credential|authorization)/i` → **0 命中**；键集与白名单 `{profileId,siteScope,displayName,accountSummary,capabilities,createdAt,updatedAt}` 完全一致。
- schema 级测试证据：`tests/profile-manager.spec.tsx` 的 `persisted schema is a closed whitelist: no credential field can exist`（逐键白名单断言）与 `serialization round-trips and provably carries no credential values`（词表断言 + roundtrip）。
- fail-closed：`deserialize fails closed on forbidden or invalid entries` 证明任何带禁字段/URL scope/坏 JSON 的载荷整体拒绝加载。

结论：**PASS**。

## 面 3：日志

扫描方式与结果：

- `grep -rn 'console\.' packages/client/ui-session-cookie-manager/src packages/bundle/dsh-session-cookie-manager/src` → **0 命中**。
- `grep -rniE '\blogger\b|telemetry|\.track\(|process\.env' …` → **0 命中**。两包不存在任何日志/遥测输出点，故无日志面泄漏向量。

结论：**PASS**。

## 面 4：evidence / 测试快照与产物

扫描方式与结果：

- 构建产物：client `lib/index.js` 与 bundle `lib/client.js`/`lib/index.js` 的凭据词命中逐条分类，全部为 deny 清单数组成员（`token"`、`secret"`、`password"`、`credentials"`、`cookies"`）、产品标识符（`cookie-manager`、`CookieManagerPanel`）、quota 过滤器文档短语与模块注释；**无凭据数据通路**。
- 外发通道：`grep -rniE 'fetch\(|XMLHttpRequest|localStorage|sessionStorage|document\.cookie' …src` → **0 命中**；不存在网络/存储写路径，evidence 无外泄面。
- 快照内容：全部测试快照（renderToStaticMarkup 断言、serialize 断言）只含元数据与 redacted 形态（如 `acct-••42`）；无 cookie/token 明文，符合"evidence 与测试快照只允许 digest 或 redacted 投影"红线。
- 失败态文案：`profileErrorMessage` 只透传固定 parser 文案，外来异常一律降级为常量 `'Profile change failed.'`（`maps store failures onto fixed panel error text without echoing foreign messages` 测试证明 `token=raw-secret` 形态的外来消息不进入 renderer）。

结论：**PASS**。

## 结构性保证（代码位置）

- `packages/client/ui-session-cookie-manager/src/profile-types.ts`：`FORBIDDEN_PROFILE_KEYS` 顶层禁 15 类凭据字段；`siteScope`/`profileId` 拒 URL/路径形态。
- `packages/client/ui-session-cookie-manager/src/profile-store.ts`：所有写路径经 `parseProfileMeta`，序列化产物可证明无凭据字段。
- `packages/client/ui-session-cookie-manager/src/panel.tsx`：`renderableQuotaFields` deny-by-default；`onApply === undefined` 时按钮禁用 + 明示等待 `web.cookieJars` seam，无本地写路径。
- `packages/client/ui-session-cookie-manager/src/provider-adapter.ts`：只读派生、每次调用重算（无本地缓存副本，owner 仍是唯一状态源），丢弃 `reason`/`actionRefs` 等 owner 私有字段。

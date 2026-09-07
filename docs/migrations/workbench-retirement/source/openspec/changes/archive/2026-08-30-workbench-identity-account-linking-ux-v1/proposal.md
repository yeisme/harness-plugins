# Workbench Identity Account Linking UX 提案

## Why

统一登录合同要求 Google 与飞书/Lark 身份只能由已登录用户在近期重新认证后显式关联，且不得按 email、域名或显示名自动合并。Identity Platform 已新建 owning change `identity-platform-account-linking-v1` 承接服务端合同与实现；Workbench 需要一个独立 consumer change，把安全的 link/unlink 状态、冲突恢复和未知结果对账做成可操作界面，而不是在根 change 或通用登录页面中隐式实现。

## Owner fit

| 能力 | 判定 | Owner | 边界 |
| --- | --- | --- | --- |
| provider subject、link transaction、unlink、recent re-auth、冲突与 audit | `split-owner` | Identity Platform | Workbench 不复制身份状态机或 canonical binding |
| 登录方式设置页、确认/错误/恢复状态、安全投影与 owner receipt | `fit` | Workbench | 只调用 typed client/BFF，不读取 provider token |
| tenant membership 或企业授权 | `reject-now` | Identity Platform membership contract | link/unlink 不得改变 tenant access |

## What Changes

- 新增 typed Identity Platform account-linking client/BFF 合同，消费 safe provider/link projection、reason code、receipt/status/reconcile。
- 新增登录方式设置体验：可用 provider、已关联身份安全摘要、recent re-auth、显式确认、冲突、最后登录方式保护、pending/unknown outcome 对账与成功回执。
- 浏览器只使用平台 `Secure`/`HttpOnly` session；不得接收、保存、记录或转发 Google/Lark access token、refresh token、authorization code 或原始 provider payload。
- 同 email/domain 不展示为“已自动合并”；`identity_conflict` 进入明确恢复指引，不允许 Workbench 移动或合并绑定。
- child contract 未就绪时保持 `needs_contract`，不伪造成功或回退为本地状态。

## Capabilities

### New Capabilities

- `workbench-identity-account-linking-ux`：显式 link/unlink、recent re-auth、冲突/最后登录方式保护、未知结果对账与无敏感 token 的浏览器体验。

### Modified Capabilities

无。现有 login、tenant selector 与 provider consumer 合同保持 additive/default-off。

## Impact

- Workbench typed SDK/BFF、Web settings/login-method UI、组件/安全/browser 测试与 integration evidence。
- 依赖 `backend-server/identity-platform/openspec/changes/identity-platform-account-linking-v1/`；服务端合同未交付前本 change 保持 active。
- 不配置真实 OAuth app、不部署 staging、不导入生产账号、不改变 tenant membership。

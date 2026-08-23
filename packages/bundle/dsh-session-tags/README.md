# @yeisme/dsh-session-tags

DSH 会话标签 bundle：组合 Host sidecar、`sessionTags` Remote、原生会话分组
provider 和可访问标签编辑器。它不替换侧栏，也不把标签写入 SessionEvent、
模型上下文、Workspace registry 或浏览器存储。

## 安装与回滚

首个包含 `ctx.sessionGroupings` v1alpha1 seam 的 DSH 版本和本候选包发布后：

```bash
dsh plugin --profile web add @yeisme/dsh-session-tags
dsh web --profile web
```

卸载只移除 Host/Client 插件行，sidecar 数据保留；重装后会按当前 Session
生命周期重新投影：

```bash
dsh plugin --profile web remove @yeisme/dsh-session-tags
dsh plugin --profile web add @yeisme/dsh-session-tags
```

## 能力矩阵

| Surface | 状态 | Owner 与边界 |
| --- | --- | --- |
| Host sidecar（`yeisme_session_tags_v1`） | 可用 | Harness Plugins Host 是标签权威 owner；按 SessionId + 生命周期身份保存 |
| `sessionTags.list/set` Remote | 可用 | Host 返回权威快照；写入是完整目标集合 + `ifVersion` CAS |
| `yeisme.session-tags` 分组 provider | probe-gated | 只拥有组、成员、标签搜索词和行级动作；过滤、排序、行渲染仍归 DSH Browser |
| `shell.overlay` 标签编辑器 | probe-gated | 只通过 `sessionTags.set` mutation；取消不写入，冲突不自动覆盖 |

当前官方 DSH `0.1.1-rc.2` 尚未发布分组 seam，因此 Host 能加载，但 Client
不会出现“按标签”或“管理标签”：probe 缺失即零 provider、零 slot、零 DOM
fallback。上游 staging 位于 `upstream-prs/session-grouping-provider/`。

**INCOMPATIBLE：** 不含该 seam 的 DSH 版本不提供分组和编辑器 UI；这是明确的
能力缺失，不会通过 DOM fallback 伪装支持。Host sidecar 仍可独立加载与保留数据。

## Provider 合同

`SessionGroupingProviderV1Alpha1` 是通用 DSH Client 合同，不含 tags 领域类型：

- `id` 全局唯一；`workspace`、`flat` 和 `provider:` 前缀保留。
- `getSnapshot()` 在下一次订阅通知前必须返回同一引用。
- snapshot 提供稳定 `revision`、有序 `groups`，可选的纯文本
  `searchTermsBySession`；一个 SessionId 可出现在多个组。
- `subscribe(listener)` 返回退订函数；注册与 dispose 归调用插件 fiber。
- `sessionActions` 可选，只追加原生会话行菜单动作。
- Browser 继续过滤未知、归档、subagent-origin 和不可见会话，并保留原生
  rename/fork/archive、当前会话高亮及 Manual/Last updated 排序。

本 bundle 的 provider id 是 `yeisme.session-tags`；标签组按 locale 排序，
“未标记”组置底，搜索词只包含规范化标签文本。

## Host 数据与错误处理

唯一 canonical store 是 Host storage domain `yeisme_session_tags_v1`。此前设计稿中的
点号形式 `yeisme.session-tags.v1` 不符合 DSH storage unit 命名规则，无法加载，
因此在候选发布前更正且不需要数据迁移。

V1 标签规则：trim + NFKC、首现去重、每个会话最多 12 个标签、每个标签最多
64 UTF-8 bytes、拒绝控制字符。空目标集合删除 sidecar 行；标签写入不改变会话
recency。

| code | 调用方处理 |
| --- | --- |
| `session-not-found` | 停止写入并刷新会话列表 |
| `tags-invalid` | 展示 `reasons`，保留原权威行与版本 |
| `version-conflict` | 使用返回的权威行 reconcile；不得静默覆盖或自动重试 |
| `storage-unavailable` | 保持当前 UI 状态并允许用户稍后显式重试 |

## 社区分组扩展示例

以下示例只导入 seam 发布后的公开 surface，不依赖 Harness tags 包或 DSH 私有模块：

```ts
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  SessionGroupingProviderV1Alpha1,
  SessionGroupingSnapshotV1Alpha1,
} from '@deepseek-ai/dsh-client-ui-workspace/client'

export const inject = ['sessionGroupings'] as const

const listeners = new Set<() => void>()
const snapshot: SessionGroupingSnapshotV1Alpha1 = Object.freeze({
  revision: 1,
  groups: Object.freeze([
    Object.freeze({ id: 'pinned', label: 'Pinned', sessionIds: Object.freeze([]) }),
  ]),
})

const provider: SessionGroupingProviderV1Alpha1 = {
  id: 'org.example.pinned-sessions',
  label: () => 'By pin',
  getSnapshot: () => snapshot,
  subscribe(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

export function apply(ctx: ClientContext): () => void {
  return ctx.sessionGroupings.register(provider)
}
```

真实 provider 在材料变化时应构造新 snapshot、递增 revision，并通知当前
listeners；材料未变时保持 snapshot 引用稳定。旧 DSH 必须先做 capability probe
并诚实降级，不能 patch DOM 或替换完整侧栏。

## 开发与验证

从本仓库根目录运行：

```bash
pnpm --filter @yeisme/dsh-session-tags-host run test
pnpm --filter @yeisme/dsh-client-ui-session-tags run test
pnpm --filter @yeisme/dsh-session-tags run test
pnpm --filter @yeisme/dsh-session-tags run test:integration
```

集成流程会验证官方 DSH 的诚实降级，以及应用 staging seam 后的安装、设置标签、
刷新、分组、搜索、多组打开、卸载和重装恢复。每次运行的证据写入
`temp/integration-test-runs/<run-id>/`，成功和失败均保留原退出码。

完整规格与兼容性账本见 `openspec/changes/dsh-session-tags-grouping-v1/`。

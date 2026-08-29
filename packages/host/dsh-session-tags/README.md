# @yeisme/dsh-session-tags-host

Harness Plugins 拥有的 Session 标签 sidecar Host。V1 使用公开 `ctx.storageDomain`
打开 `yeisme_session_tags_v1`（sessions 表，SessionId 为 key），按 Session 生命周期
身份（createdAt + cwd）保存标签行；通过 Typert Remote `sessionTags.list/set`
暴露只读快照与全量目标值 + `ifVersion` 的 CAS 写入。不得写入
会话事件日志、Workspace registry 或浏览器存储，不改变会话 recency。

同一 Host 还 additive 打开 `yeisme_session_organization_v1`，并注册
`sessionOrganization` v1。新 domain 保存功能类型、assignment、标签目录元数据、
规则和批次 receipt；旧 tags domain、Remote 和错误码保持不变。

## 模块

- `wire`：跨 Host/Client 合同类型（`specVersion: '1.0'`、四个固定失败码）。
- `tags`：V1 标签模型（NFKC+trim、首现去重、12 tags/64 bytes、控制字符拒绝）。
- `domain`：storage-domain 声明（zod 行 schema，durable boundary 校验）。
- `service`：`SessionTagsSidecar`——行级写队列、CAS、stale 行过滤、
  durability-before-memory（服务不持有行副本）、no-op 不换版本、空 tags 删行。
- `remote`：`SessionTagsRemoteService`（Typert `@Remote` list/set，namespace
  `sessionTags`），失败原样返回，绝不自动重试。
- `plugin`：Cordis 装配（`inject: ['storageDomain','sessionPersistence']`）。
- `organization-*`：八类默认功能目录、0.8 分类门、人工锁、规则顺序、
  `plan → execute → undo`、30 天可逆 receipt 与 15 分钟管理员 purge grant。

## 失败码

| code | 语义 |
| --- | --- |
| `session-not-found` | Session 不存在或已删除；storage 无新增 |
| `tags-invalid` | 目标集合违反 V1 模型；旧行/版本不动 |
| `version-conflict` | `ifVersion` 不匹配；返回当前权威行（stale 行视为无行） |
| `storage-unavailable` | 后端读写失败；内存/耐久态不变 |

## 开发

```bash
pnpm --filter @yeisme/dsh-session-tags-host run typecheck
pnpm --filter @yeisme/dsh-session-tags-host run test
pnpm --filter @yeisme/dsh-session-tags-host run build
```

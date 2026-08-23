# @yeisme/dsh-session-tags-host

Harness Plugins 拥有的 Session 标签 sidecar Host。V1 使用公开 `ctx.storageDomain`
打开 `yeisme.session-tags.v1`，按 Session 生命周期身份保存标签行；不得写入
会话事件日志、Workspace registry 或浏览器存储。

本切片只发布可 typecheck 的包身份、行类型与占位 Host。完整 domain / CAS 与
Typert `sessionTags` Remote 属于后续任务。运行时依赖已发布的
`@deepseek-ai/dsh-storage-domain`、`@deepseek-ai/dsh-session-persistence` 与
`@deepseek-ai/dsh-typert-protocol`（`^0.1.0-rc.6`）。

## 开发

```bash
pnpm --filter @yeisme/dsh-session-tags-host run typecheck
pnpm --filter @yeisme/dsh-session-tags-host run test
pnpm --filter @yeisme/dsh-session-tags-host run build
```

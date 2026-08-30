# @yeisme/dsh-client-ui-personal-radar

DSH Personal Drama Radar client：Context badge、`/drama radar` 命令入口与按需 Radar Pane。所有入口由 capability probe 驱动；官方 Pane slot 或 radar host transport 缺失时只注册 probe-only face 并携带 disabled reason，不伪造 ready。

## 验证

```bash
pnpm --dir packages/client/ui-personal-radar run typecheck
pnpm --dir packages/client/ui-personal-radar run test
```

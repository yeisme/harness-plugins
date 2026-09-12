# @yeisme/dsh-client-ui-personal-radar

DSH Personal Drama Radar client：Context badge、`/drama radar` 命令入口与按需 Radar Pane。所有入口由 capability probe 驱动；官方 Pane slot 或 radar host transport 缺失时只注册 probe-only face 并携带 disabled reason，不伪造 ready。

## 验证

```bash
pnpm --dir packages/client/ui-personal-radar run typecheck
pnpm --dir packages/client/ui-personal-radar run test
```
# 市场 Web face 实施状态

变化列表可打开指定 signal revision 的详情，展示 owner 提供的命题、市场、来源、时间、比较值、证据 ref 与限制；返回列表恢复焦点，不回退到 latest。详情读取经过当前连接和 policy 检查。当前已完成合成 host 的浏览器验证，真实 owner 服务和跨市场/回顾等详情操作仍在实施。

host提供可选loadCatchup时显示“变化简报／未读补看”导航。补看按owner游标逐页读取，空页有续游标时可继续，末页禁用下一页；从头读取丢弃旧游标，context/policy变化清空旧页。读取不标已读。已通过合成host浏览器分页回放，尚未连接真实owner服务。

当 host 提供 `radarMarketHost`（schema `dsh.radar.market-host.v1`、contextRef/load/subscribeContext/subscribePolicy）时，client 额外注册 `drama-radar.market`。读取函数仅接收安全投影，浏览器不启动 Radar CLI、不读取 SQLite。缺少市场 seam 时不注册空入口，旧个人 Radar face 保持可用。

当前 React face 已展示简报窗口、变化与观察列表、证据引用、覆盖缺口及空/错误/加载状态，复用共享 Surface；具备中英与 pseudo 文案。条件注册、释放及静态 HTML 测试已通过。真实 host 服务装配、完整读写操作、专项响应式截图和实际会话旅程尚未完成，不能当作 live-ready 界面。

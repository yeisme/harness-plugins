# @yeisme/dsh-terminal-host

DSH Terminal Host 将 DSH/领域拥有的 PTY 服务投影为安全、版本化的工作区合同。V1 提供会话列表与 mutation receipt；V2 提供带 epoch/sequence 的输出订阅、输入、resize 和 detach attachment。

浏览器永远不会持有 PTY、原始进程句柄或终端 canonical state。Host 只把 owner 授权的 VT 输出块和短生命周期控制能力交给 xterm.js 渲染器；detach 不会关闭 PTY。

真实 Host 可通过 Cordis context key `dsh.terminalHost` 提供给 Desktop Workbench；未提供时 bundle 保留明确的空状态，不伪造输出。

## Development

```bash
pnpm --filter @yeisme/dsh-terminal-host run typecheck
pnpm --filter @yeisme/dsh-terminal-host run test
pnpm --filter @yeisme/dsh-terminal-host run build
```

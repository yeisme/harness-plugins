## Context

CreatorInputIntake 复用现有 creator-studio host 和 Remote；owner adapter 从 MCP 发现结果映射控制动作。文件选择、打开页面通过显式 host seam 注入，缺少 seam 返回 unavailable。链接和文件句柄只在 host 内存，Remote 只返回安全请求、进度和引用。没有新增 DSH 主壳或资产服务。

## Decisions

复用现有测试与运行结构。原请求身份和 project/session 绑定不可由客户端路径替代。短时链接只允许在临时输出中传递；中断先恢复原请求。关闭新增入口回滚，不清除完成资产。

## Verification

fixture 与 HTTP/MCP 合同证据写入本项目 temp/integration-test-runs，敏感链接不可持久化。DSH 的真实宿主启用与领域服务部署独立于本地 adapter 验收；未注入 file picker seam 时保持不可用，不显示可执行假能力。

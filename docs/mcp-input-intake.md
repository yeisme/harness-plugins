# 创作输入 Host 适配

`packages/host/creator-studio` 的 `CreatorInputIntake` 提供同一输入请求合同的选文件、流式 HTTP、进度与恢复。`creatorStudio.inputRequest` Remote 只接受 owner、操作和稳定 ID/幂等键，不接受 URL、文件路径或文件字节。

每个 owner adapter 显式注入 InputControl，按该 owner 实时能力资源中的工具/action schema 完成 prepare/status/renew/abort 映射；ownerBaseURL 和授权项目来自已验证连接。临时 ResourceLink 只进入 Host 内存。`chooseFile` seam 返回有界文件句柄，`openPage` seam 在宿主打开 owner 一次性页面，两者都不是浏览器任意 fetch 接口。

宿主没有 file picker、页面打开 seam 或 owner adapter 时返回 unavailable；不得创建可点击但无法执行的入口。当前交付为可注入的 Host/Remote 合同，真实 DSH 安装的原生选择器接线须由宿主提供，不能把本地 fixture 通过说成部署完成。页面 UI 在各 owner 服务，独立 DSH 主壳不在本轮范围。

prepare 的幂等键来自原任务。文件选择前先查询原请求；ready 时直接返回 owner 引用，不重复上传或生成。renew 只针对原请求，manual 页面每个已发链接只打开一次；链接过期或丢失返回 needs_renewal。不同 session/context 的临时选择互相隔离，项目/权限或 adapter 版本改变后 Remote 拒绝投影。宿主释放 adapter 时调用 dispose，取消传输并清除内存链接。

验证：`node scripts/run-input-intake-integration.mjs`。证据保存在本项目 `temp/integration-test-runs/`，覆盖文件流、进度、只传 grant、重定向拒绝配置、重复消费、缺少 seam 和会话隔离。

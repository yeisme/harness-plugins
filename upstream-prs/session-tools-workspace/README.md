# 会话 Tools 宿主补丁

接在 pane-editor-shortcuts 后应用：会话标题管理、固定工具旁栏绑定、会话与设置导航、Chat 原调用定位，以及 Skills 可选全目录查询。只包含预先捕获的自有文件增量和导航模块/测试；不修改会话数据或默认快捷键。

```bash
bash upstream-prs/session-tools-workspace/apply.sh /path/to/staging-checkout
pnpm dsh:workbench -- --rebuild --prepare-only
node scripts/test-workbench-patches.mjs
```

重建必须包含 Host 的 Typert 生成，使 includeModelInvocable 与 catalogComplete 可选字段进入实际 Remote 合同。旧请求继续只返回手动触发的 Skills；新请求可查询用户/模型可调用的合集。旧响应缺少完整性字段时，新客户端标为 partial。

源码增量由 `node scripts/export-session-tools-workspace-patch.mjs temp/session-tools-before` 导出。apply.sh 预检全部变更并保护已修改的新文件。

client-modules 兼容显式导出的子路径 manifest Web seat，修复 Pentest 与 Terminal 安装成功但浏览器未启用的问题。普通 Host 子路径不会自动继承根 client 声明。对应 node-half 42 项测试包括允许显式 seat、排除普通 Host 子路径。

完整补丁链均执行应用与当前包幂等检查；逐字比对限定为本包拥有的文件，避免把并行任务的 staging 改动错误收入补丁。

`owned-source.sha256` 由导出命令生成，保存已审阅自有源码校验值。共享的 types.ts 和 apply.ts 仅导出本任务字段/导航 hunk；导出后仍须人工审阅 patch，不能把其他任务的字段或 import 收入。当前独立新增测试还包括同名/重命名会话标题隔离。

# @yeisme/dsh-semantic-file-editor

可安装的 DSH 语义文件编辑 Host bundle。它注册 `/yeisme-language/api/*`、同源 Monaco 资产、Language Intelligence Host，以及 session-scoped workspace edit preflight/apply。

## 安装

先安装拥有 `desktop.file` 与 opaque ref registry 的 Desktop Workbench，再安装本 bundle：

    pnpm --filter @yeisme/dsh-file-host run build
    pnpm --filter @yeisme/dsh-language-intelligence-host run build
    pnpm --filter @yeisme/dsh-client-ui-semantic-file-editor run build
    pnpm --filter @yeisme/dsh-semantic-file-editor run build
    pnpm --filter @yeisme/dsh-client-ui-desktop-workbench run build
    pnpm --filter @yeisme/dsh-desktop-workbench run build
    dsh plugin --profile web add ./packages/bundle/dsh-desktop-workbench
    dsh plugin --profile web add ./packages/bundle/dsh-semantic-file-editor

发布后可改用包名：

    dsh plugin --profile web add @yeisme/dsh-desktop-workbench
    dsh plugin --profile web add @yeisme/dsh-semantic-file-editor

## 降级与回滚

- bundle 缺失、opaque ref capability 缺失、Monaco/CSP 失败或 Host open 被拒绝时，`FileOpenPane` 回退既有 Markdown/textarea/media renderer。
- 不迁移 Pane persistence，也不写入新的业务数据库。
- 回滚只需移除语义 bundle：

    dsh plugin --profile web remove @yeisme/dsh-semantic-file-editor

## 安全边界

- V2 文件 API 禁止浏览器提交 cwd/path。
- Monaco model URI 由 Host 签发，为 `dsh-resource://model/<opaque>`。
- LSP target、workspace edit 与 symlink 都由 session workspace + opaque registry 重新授权。
- command-only code action、create/delete/rename resource operation、workspace 外 target 和 stale version 均拒绝。
- Monaco 0.56.0 资产由本 bundle 同源提供；浏览器不访问 CDN。

## 验证与证据

    pnpm --filter @yeisme/dsh-semantic-file-editor run typecheck
    pnpm --filter @yeisme/dsh-semantic-file-editor run test
    pnpm --filter @yeisme/dsh-semantic-file-editor run test:integration

集成命令会生成脱敏证据到 `temp/integration-test-runs/<run-id>/`，包含 `summary.json`、`command.txt`、`stdout.log`、`stderr.log`、`env.json` 与 `artifacts/`。

## 第三方依赖

`monaco-editor@0.56.0` 使用 MIT License，并由同源资产路由按锁定版本交付。Language Host 的 parser/LSP 依赖见其 README。

## 1. 合同与安全文件引用

- [x] 1.1 新增 `FileOpaqueRefCapabilityV1`、server-side ref registry 与 `fs.treeV2/readV2/writeV2/binaryV2`，保留旧方法和 `FileHostV1` 签名。
- [x] 1.2 增加 V2 transport contract tests：禁止 path/cwd/file URI、跨 workspace ref、symlink escape 与 stale write。
- [x] 1.3 新增 `FileWorkspaceEditHostV1` preflight/apply/receipt，只接受既有文件 bounded text edits。

## 2. Language Intelligence Host

- [x] 2.1 创建 `@yeisme/dsh-language-intelligence-host`，冻结 probe、document handle、UTF-16 position、diagnostic/symbol/token、syntax tree 与 workspace edit draft 类型。
- [x] 2.2 实现 bounded AST provider registry 和 Markdown/JSON/通用代码结构 provider；parser 不可用时诚实降级。
- [x] 2.3 实现 allowlisted LSP stdio client、capability probe、document version fence、cancellation、crash/restart 与 target ref mapping。
- [x] 2.4 增加 fake LSP server integration tests，覆盖 semantic query、Unicode、乱序、cancel、crash 与 command/resource-operation 拒绝。

## 3. Semantic File Editor

- [x] 3.1 创建 `@yeisme/dsh-client-ui-semantic-file-editor`，实现格式识别、Editor/Rendered/Split/Structure、Outline、Problems、状态栏与保存冲突状态。
- [x] 3.2 接入 Monaco same-origin asset/worker loader；asset/CSP 失败回退 builtin renderer，close/dispose 无 model/listener 泄漏。
- [x] 3.3 创建可安装 `@yeisme/dsh-semantic-file-editor` bundle，注册 host/API、client facade 和 renderer contribution。
- [x] 3.4 在现有 `desktop.file` 接入可选 semantic renderer，不改变 Pane kind、preview/pinned/dirty owner 或既有 fallback。
- [x] 3.5 实现 format、rename、code action diff preview 与版本栅栏 mutation receipt；unsupported action 不执行。

## 4. 验证与交付

- [x] 4.1 补齐 host、client、bundle 和 Desktop Workbench focused unit/component/contract tests。
- [x] 4.2 增加 `test:integration` evidence runner，失败也生成脱敏 `temp/integration-test-runs/<run-id>/` 完整文件集。
- [x] 4.3 更新 package README、第三方声明和安装/回滚说明；不把 raw path、prompt 或 provider payload 写入文档/fixture。
- [x] 4.4 运行 focused typecheck/test/build、bundle contract、strict OpenSpec 与最终仓库 gates，并按 introduced/pre-existing/concurrent/environmental 分类失败。

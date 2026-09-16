# 实施基线：1.1 实际合同核对（2026-09-16）

逐操作记录当前 source/handler、支持状态与缺口。只读审计，未修改任何在途 change 的实现。上游 seam 核对方法：对 pnpm store 内已安装 `@deepseek-ai/*@0.1.5-rc.2` 各包 `lib/` 做 grep（`getDocument`、`readResource`、`resources/list`），2026-09-16 实测。

## 1. Tools 详情（目录/详情/返回/状态）

- Source：`packages/client/ui-mcp-inspector/src/client/McpInspectorView.tsx`（目录筛选、详情 `activeSection === 'details'`、返回目录、状态/来源呈现、可选 `renderReference` 插槽）。
- 支持：已支持。详情容器即本 change 的扩展点；design.md 已确认不新增平行 Tools 主壳。
- 缺口：详情内"说明"正文区当前只有源码分页（见 2），渲染模式/文内搜索/引用文件列表未接（本 change 3.x 范围）。

## 2. Skill 正文分页读取（源码模式，search-center 已交付增量）

- Source：Host `packages/host/dsh-tool-hub/src/reference-reader.ts`（`SkillReferenceReader.readSkill`，256KiB/5000 行分段、`skill-document:<sha256>` 资源身份、revision+资源绑定 cursor、Unicode 边界保护、固定失败原因）＋ `reference-remote.ts`/`plugin.ts`（`toolReferences` Remote + typert invocation 直连注册）；Client `packages/client/ui-mcp-inspector/src/client/skill-document-remote.ts`（白名单解析、字节/行数复核）＋ `SkillDocumentReader.tsx`（单页正文、≤50 页历史、Escape 关闭、焦点回归、revision/resource 漂移防护）＋ `pane.tsx`（经 `renderReference` 挂载，`remote.toolReferences` 缺席时不可用）。
- 支持：已支持（显式源码分页；正文不落目录快照/日志/持久缓存；不执行/启用工具）。
- 缺口（本 change 2.x/3.x 保留项）：渲染模式、文内检索、相对文件引用解析（linkId）、文档历史/并排打开、会话范围引用与 prepare/ack 均未接，与 design.md「内容与引用合同」表一致。

## 3. Skill 安装来源 / scope / 同名区分

- Source：Host 目录采集 `packages/host/dsh-tool-hub/src/plugin.ts::createHostCatalogPort`（ctx `skills.snapshot()` 优先、缺 snapshot 回退 `list()`，`complete` 语义保留；失败源不掩盖其它源）；来源校验 `reference-reader.ts`（source ∈ {project-dsh, project-agents, user-dsh, user-agents, custom, bundled}、provider 必须为 `filesystem`、`resourceBase.kind === 'directory'`；读取前后双查 owner 身份与来源身份）。
- 支持：profile scope、默认 filesystem provider 已支持；同名 Skill 目前以「`skill:<name>` 唯一匹配（恰一条才可读）+ 来源目录身份摘要」区分。
- 缺口：owner 侧 `skills.getDocument(name)` seam 在上游 `@deepseek-ai/dsh-skill-filesystem@0.1.5-rc.2` 中不存在（lib grep `getDocument` 0 命中）→ 未打 owner 补丁的 stock 运行时 `readSkill` 诚实返回 `disabled/reader_unavailable`（owner 补丁已在隔离副本验证并回退，见 design.md）。配套 owner 任务：上游 skills 文档来源 seam（实现 2.x 前按仓规固化 `upstream-prs/` 系列，不伪造支持）。多安装实例 per-instance sourceRef（`tools.reference-reader.v1alpha1` 目标态）未实现，属 2.x。

## 4. MCP 资源（resource list/read）

- Source：Host 仅 `mcpServers.list()` 健康面（`plugin.ts`）；Session 目录 `packages/client/ui-mcp-inspector/src/client/session-catalog.ts`（`referenceTools`/`skills` query，`mcp__` 前缀归 mcp 族，零工具执行）。
- 支持：MCP 工具目录+健康只读投影已支持。
- 缺口：MCP resource 读取（`resources/list`/`readResource`）在上游 `@deepseek-ai/dsh-mcp-client@0.1.5-rc.2` 中 0 命中，官方 dsh/dsh-agent/dsh-session/dsh-web/dsh-fs lib 同 0 命中 → 本仓无可消费合同。配套 owner 任务：MCP resource 授权读取 seam（上游或 mcp-inspector lane）；在其就绪前 spec 中 MCP resource URI 场景保持缺口，不直接 fetch URI。

## 5. 文件预览（并排打开/媒体）

- Source：`packages/bundle/dsh-rich-media/src/client/preview/`（`PreviewResourceV1`：owner:ref:version opaque 身份、families image/audio/video/pdf/text/table/document/binary；`ResourcePreviewHostV1` 短时授权访问句柄；`PreviewRendererRegistry` preference→exact MIME→suffix→family→binary 决定性解析、HMR 安全注册；renderer：archive/binary-hex/csv/docx/pdf/sheet/static-html/table/text）；文件打开分派为 `desktop.preview` per-file Pane（dsh-file-preview-dispatch-v1 已归档）。
- 支持：平台合同与 renderer 家族已支持复用；浏览器侧无路径/URL，全部走 owner 签发 ref。
- 缺口：Skill 包内相对路径文件经 Host 解析授权后进入该平台（`ResourcePreviewHostV1` 的 Skill 来源适配）未接，属 2.2/2.3。

## 6. Markdown / 代码渲染

- Source：rich-media preview platform text family（`format-kinds.ts` 含 markdown 类）；代码/文本源码视图已有（SkillDocumentReader 源码分页；file preview text renderer）。
- 支持：预览平台侧 Markdown 与代码渲染能力存在。
- 缺口：详情内"说明"渲染模式（禁可执行 HTML/事件、远程图片不自动加载）未接，属 3.1；源码模式行号/精确引用位置已有起始行/续行标记，锚点高亮未做。

## 7. Composer prepare/ack（引用到会话）

- Source：`packages/client/ui-pane-workbench/src/explorer/references-v2.ts`（`ComposerReferenceBridgeV1` 可选 `prepareReference`；`ComposerReferenceDraftV2.prepared` 冻结实例快照——"acknowledgements never consume later edits"；插入/移除 Host 回执与状态机）。该合同由 `dsh-prompt-reference-creative-workspace-v1` 交付并经真实 composer-host 运行验证（R1/R2 证据见该 change verification.md）。
- 支持：会话引用的 prepare/ack 语义合同已存在且可复用。
- 缺口：本 change 侧"引用到会话"（显式选择目标 session、查看/插入/发送/执行四动作分离）未接，属 3.3；无需新建第二 composer 合同。

## 结论

- 可直接复用：Tools 详情容器、Skill 源码分页链（readSkill 全链）、rich-media 预览平台、Composer prepare/ack 合同。
- 仓内实现缺口（本 change 2.x/3.x）：渲染模式、文内搜索、linkId 引用解析、包内相对路径授权读取与 realpath/symlink 校验、文档历史/并排、会话引用接线。
- 外部 owner 缺口（不伪造支持）：① 上游 `skills.getDocument` 文档来源 seam（dsh-skill-filesystem 0.1.5-rc.2 无）；② MCP resource list/read seam（dsh-mcp-client 0.1.5-rc.2 无）。①②就绪前分别以 `reader_unavailable`/能力缺失禁用态呈现。

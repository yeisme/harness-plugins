# 文档交付校验

后续状态：用户已授权代码实施，任务进入实施中。以下为已完成文档阶段的历史记录，不代表新代码或整体功能已验收；实施基线与新增证据记录在本文后续章节。

日期：2026-09-07。范围：本 change 的 proposal、design、四份新增 spec、tasks、产品设计文档及两处文档入口更新。未修改产品实现，未启动 Host／开发服务，未执行 provider 或工具能力。

## 已交付内容

- 4 组新增能力，22 条 Requirement，46 个 WHEN／THEN 场景。
- 38 项未来实施／验收任务，全部保持未勾选；每项标明负责模块、交付物和验收条件。
- 产品文档包含默认／展开输入框、原位源码、发送预览、侧边成果面板线框，合成内容示例、恢复路径及 Requirement→Task→证据追踪表。
- 增量合同明确可编辑正文与来源证明分离、显式提示词投影、V1 无静默降级、媒体实际资源、候选采纳与独立写回。

## 命令与结果

命令均在本仓库执行；全仓结果为本次观察到的共享工作区状态，不代表其他并行任务完成。

| 命令／检查 | 结果 |
|---|---|
| `openspec validate dsh-prompt-reference-creative-workspace-v1 --strict --no-interactive` | exit 0，valid |
| `openspec validate --all` | exit 0，147 passed，0 failed |
| `openspec status --change dsh-prompt-reference-creative-workspace-v1 --json` | exit 0，proposal／design／specs／tasks 均 done；表示产物就绪，不表示功能完成 |
| `git diff --check` | exit 2，4 个既有 credentialctl skill 文件末尾空行；本次未修改这些文件 |
| `git diff --check -- docs/README.md docs/design/dsh-reference-theme-integration.md docs/design/dsh-prompt-reference-creative-workspace.md openspec/changes/dsh-prompt-reference-creative-workspace-v1` | exit 0，本次跟踪文件变更无空白问题 |
| 新增 Markdown 补充检查 | 新文件无行尾空白、末尾单换行；检查不依赖 Git 是否已跟踪文件 |
| 文档结构检查 | 4 份 spec／22 条要求／46 个场景；38 个任务编号唯一，已勾选任务 0 |
| 链接与合同一致性检查 | 9 份新增 Markdown、11 个相关相对链接通过；Requirement 编号唯一，每条有规范用语和场景，所有任务包含负责模块、交付物和验收条件 |

全仓空白告警分别位于 `.agents/skills/credentialctl-usage/` 与 `.claude/skills/credentialctl-usage/` 的 `SKILL.md` 和 `agents/openai.yaml`。保留无关并行改动，未为消除全仓告警改写这些文件。

## 验收边界

本轮未运行七项产品门禁或浏览器、媒体、真实服务集成测试，因为用户仅要求 spec、tasks 和文档。相应命令和证据要求已写入 tasks 第 6 组。

插件协议完成、Host seam 可用、真实 Host 运行、成果／开发环境交互及完整产品验收分别记录。未来缺少服务能力时须保留依赖和未验收项；文档通过、mock 或历史证据均不能替代新功能验收。本次不归档此 change，不将新 spec 同步为已交付功能。

## 代码实施启动基线

- Host staging 基线为 `a66e4702047846cdaa10c66c9d3df3951f5ea70d`，package version `0.1.2-rc.1`。当前叠加既有补丁与并行工作，不能用版本号或整体 dirty diff 代表本 change。
- `pnpm dsh:workbench -- --check` 在启动器执行前触发 pnpm 自动依赖安装，因 `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` 退出 1；不通过关闭 purge 确认或设置 CI 强行重装共享依赖。
- `node scripts/dsh-workbench.mjs --check` 退出 0，确认兼容构建且未修改 profile 或会话。后续 pnpm 验证使用临时 `pnpm_config_verify_deps_before_run=warn` 避免自动安装；不更改项目依赖策略。
- 源码按功能分配路径所有权，保留并行 Tools／搜索改动；每个 Host 自有文件在写入前捕获基线，仅导出本次增量补丁。当前尚无新功能运行验收证据。

### 浏览器验证前置环境

- 插件根目录 `@playwright/test` 需要 Chromium 1223；已通过其 CLI 安装到本仓库 `temp/prompt-reference-browsers`，使用该 `PLAYWRIGHT_BROWSERS_PATH` 的 headless launch／close 检查退出 0。全局缓存安装因共享锁等待而停止的是本任务自己的安装 PID，未删除锁或终止其他进程。
- Host `apps/web` 的 Playwright 需要 Chromium 1228，默认缓存已有匹配版本；在该目录执行默认 headless launch／close 检查退出 0。Host E2E 不使用插件 1223 路径。
- 以上仅证明浏览器可启动，不是页面、发送、成果或视觉回归验收结果；两套 runner 各自记录实际浏览器来源，不能跨版本套用旧截图作为新证据。

### 首轮 Creator／Browser 独立代码审查

结论：REQUEST_CHANGES，尚不接受为完成候选。只读审查发现完整正文被有界 textPreview 替代、刷新和切换丢弃编辑、候选选择未进入动作绑定；Browser 存在 actionId/kind 混用、stale mutation、未执行确认、迟到 snapshot 跨 binding、空命令、未校验 viewport lease 等问题。另有 partial 表单保留、编辑预览同步、真实页面输入以及主题／locale 覆盖缺口。

已有包测试通过仅证明其覆盖的既有行为，尚未覆盖新增 JSX 交互，不能据此关闭任务。问题已交回同一功能负责人修复；修复后需新交互测试和稳定 diff 再审。本节为审查时发现的问题，不预先宣称已修复。

### Browser UI 依赖增量核验

Browser UI 为统一组件新增既有 ui-surface、ui-visual-kit workspace 依赖和 Host primitives peer／dev 声明。功能负责人运行带 `pnpm_config_verify_deps_before_run=warn` 的包级 typecheck 时，pnpm 仍生成了对应 live importer 和缺失 symlink；未执行手动 install、全量重装或清理。

root 在独立 manifest-only 临时工作区复制当前 manifests、workspace 配置、lock 和既有 patches，执行 `pnpm --dir temp/prompt-reference-lock-workspace install --lockfile-only --offline --ignore-scripts` 退出 0。生成锁文件与 live 文件逐字节一致；Git diff 仅含 Browser importer 的 9 行新增，不含其他 package/snapshot 升级，因此保留此增量。后续定向测试优先直接调用现有 package `.bin`，避免 pnpm 自动依赖副作用。该核验不代表 UI typecheck 或交互测试已通过。

### 引用真实 Host 首轮运行（未通过）

`node scripts/run-composer-reference-host-tests.mjs reference-composer-multi.e2e.ts` 已实际启动测试 Host 与插件 overlay。证据 `temp/integration-test-runs/composer-host-2026-09-07T09-19-15-020Z-4144270/` 的 summary 为 failed／exit 1，source diff stat unchanged；截图中可见原位编辑后的引用和完整发送预览，失败为测试环境不提供 `toContainText` matcher，不能据此宣称全链路通过。

修复断言后的证据 `temp/integration-test-runs/composer-host-2026-09-07T09-21-12-414Z-6266/` 仍为 failed／exit 1，source diff stat unchanged。主失败为点击刷新后来源比较 region 未出现；replay fixture 未完全消费是提前失败的后果。此问题仍需修复真实 refresh 接口接线，不允许删除刷新场景或跳过模型接收／历史断言以关闭验收。

刷新故障后续定位：session-controller 普通包 bundle 不运行 Typert 生成器，已有 `lib/typert.remote-client` 不含新增 `refreshReference`。root 使用已有 `WorkspaceTypertGenerator` 的 `generate(['@deepseek-ai/dsh-api-session-controller'], ['host'])` 定向生成，保留默认 diagnostics 检查，验证只返回该包且 remote JS 含新方法后，更新其 5 个 generated lib artifacts。操作退出 0，原产物保存在 Host temp/editable-prompt-transport-baseline；没有执行全工作区生成或修改其他包产物。修复是否贯通仍由下一次真实 Host E2E 判断，生成成功本身不关闭验收。

独立诊断进一步确认：09:40 运行仍加载未包含异常收尾的旧 ui-conversation bundle；引用刷新事件以外层 Promise 等待回调，而 listener 只处理成功，内部拒绝会永久保留 Refreshing。源码已补异常收尾与 DOM 元素归属校验，但必须重建后再验。`api/remotes/src/client/index.ts` 静态聚合 session-controller 的 generated Remote，聚合 bundle 也需在定向生成之后重建。

诊断证据同时排除 fixture 路由：实际页面 fixture=false，预览使用 `__DSH_TRANSPORT__.fetch` 的 Worker 消息通道，页面 request/websocket observations 为空不足以断言无 RPC。真实来源 owner 已由 desktop bundle 注册到 composerReferenceOwners，文件刷新应增量扩展其 opaque fd registry；不添加按路径读取的替代 owner，不修改无关 standalone fixture 路由。

09:48 新运行 `temp/integration-test-runs/composer-host-2026-09-07T09-48-45-131Z-1220115/` 已在 `artifacts/refresh-wire.json` 记录两次真实 `POST /api/session/refreshReference` 与各自 200 响应；测试通过来源比较和编辑期间失效保护后推进至后续引用目录。整次运行仍 failed／exit 1：选择 Agent 引用后预期 5 个 chip、实际 4 个，模型接收与历史断言尚未完成。刷新局部通过不等于本轮真实 Web 整体通过，仍保留全链路任务未完成。

09:53 诊断显示 Agent pick 前已有数量为 3、pick 后为 4，缺项发生在输入查询前，而非 Agent 插入拒绝。测试 helper 改为显式 focus／Control+End，并新增输入查询前后 chip 数量不变断言，保留原目标数量。09:55 运行 `temp/integration-test-runs/composer-host-2026-09-07T09-55-48-284Z-1636979/` 随后通过目录插入和响应式步骤，推进至实际发送；但 context/session-reference 的旧 pre-step 要求所有引用含 snapshot，与已验证编辑文本的正文投影路径不兼容，整次仍 failed。修复必须只排除已投影编辑文本的原文重复注入，保留旧模式和实际媒体的 snapshot 校验；模型接收／历史任务仍未完成。

上下文包恢复使用 tsdown 程序接口的显式 `config:false/workspace:false/fixedExtension:false/dts:false/clean:false`，输入为该包 tsc 产出的 lib/types/index.js；仅生成正常 lib/index.js，并使用现有 WorkspaceTypertGenerator 定向恢复 session-reference 的 Typert 产物。exit 0，已验证入口和远程描述存在且含编辑文本投影过滤。先前直接 CLI 的错误产物不是交付依据。

后续 E2E 断言必须按引用实例检查编辑选区没有重复原文快照：同一消息中独立的完整文件引用仍可合法包含原文，不能以全消息字符串禁用原文代替此不变量。证据中的目标选择／多会话隔离标志只能由本轮实际断言产生；单元覆盖或历史通过不得写成本轮浏览器 true。

### 核心引用真实 Host 通过（限定范围）

命令：`node scripts/run-composer-reference-host-tests.mjs reference-composer-multi.e2e.ts`。

证据：`temp/integration-test-runs/composer-host-2026-09-07T10-08-59-098Z-2004002/`。root 读取 summary 和 browser artifact：exit 0／passed，实际 Host 与插件 overlay，source diff stat unchanged；两次模型请求、0 page errors、0 warnings、provider_request=false。覆盖十类既有引用、原位改写、来源刷新／比较冲突、实际模型接收与 durable history，以及 360／560／960 和深色／reduced-motion 场景。root 已目检本轮 360px 截图。

范围限制：本轮 `target_chooser_roundtrip=false`、`target_draft_isolation=false`，未将单元覆盖冒充浏览器验证；相应真实浏览器场景正在单独补充。源码已冻结交独立安全／正确性复审，尚未完成新补丁导出、七门、完整成果／开发环境验收，因此不能据本条关闭整体目标。

### 目标与草稿隔离真实 Host 通过（修复前基线）

命令：`node scripts/run-composer-reference-host-tests.mjs reference-composer-targets.e2e.ts`。

证据：`temp/integration-test-runs/composer-host-2026-09-07T10-29-44-212Z-2725781/`。root 读取 summary／browser artifact：exit 0，source diff stat unchanged；target_chooser_roundtrip=true、target_draft_isolation=true、cross_draft_drift=false、page_errors=0、warnings=0、provider_request=false。覆盖显式 Alpha/Beta 会话与各自编辑引用、目标选择、Escape 取消焦点恢复、workspace owner 脱离目标后的失效拒绝。该测试是独立真实 Host 测试，不替代核心发送回放。

### 引用独立安全／正确性复审：REQUEST_CHANGES

已通过上述正向运行的候选仍存在安全与并发反例缺口，当前不得作为完成候选导出或发布：

1. refresh 接口未充分绑定先前授权，跳过旧证明检查且未沿用普通敏感文件读取门，可用可见 opaque ref 伪造旧证明请求当前内容。
2. 完整编辑正文通过全局 window 事件流转；应改为私有／editor-scoped 通路，跨插件事件仅传安全引用声明。
3. refresh pending 期间的编辑未在响应到达和 Replace 两处进行 occurrence/revision/body CAS。
4. 浏览器可自行添加 editable projection 标记，可能抑制本应保留的 legacy directory／terminal 快照；需要 owner 授权的编辑能力绑定。
5. optional prompt 校验缺少 source 非空对象及与顶层证明一致性检查。
6. full／prefix 引用刷新无法合理跟随来源长度变化。

root 已授权在原 scope 中修复：准备／授权 grant 绑定 session、workspace、ref、kind、range 与原始证明，刷新重新检查敏感读取权限；私有编辑命令；响应与替换双重 CAS；严格 payload 和媒体／旧模式校验；owner 派生新的 full／prefix 范围。功能负责人已进入修复，正向 E2E 需在修复后重新验证，七门和整体目标继续保持未完成。此处记录真实发现，不宣称已关闭。

root 已完成 Finding 5 的空对象／来源不一致子修复：`isEditablePromptReference` 拒绝 null／array／缺失 source、错误字段类型，并要求 owner/ref/version/scope/digest 与顶层证明精确一致。直接命令（Host staging）：`node_modules/.bin/vitest run packages/client/ui-conversation/tests/editable-prompt-reference-validation.client.spec.ts`，exit 0，7/7。测试覆盖异常输入不抛出、五项证明逐一不匹配时拒绝、合法空白保留与来源不可变。grant／kind 矩阵和总量限制仍由主修复线统一验证；不以这 7 项测试宣称所有安全问题关闭。

安全修复期间补充两个规格场景：完整文件长度变化后的新证明／新授权可发送，及首次发送期间改写的同一引用在确认后可再次发送。当前规格场景数由文档初版 46 增至 48，要求数仍为 22。新增场景为待验收，不是已通过的测试结果。

### Creator／Browser 局部候选复审快照

root 保存 `temp/creative-review-snapshot-20260907/`，包含 43 个本轮已修改／新增文件的不可变副本与逐文件 SHA-256 manifest，交独立 reviewer 检查首轮问题的关闭情况。该审查读取快照，不对并行中的 live diff 声称稳定。

功能负责人报告新增 Creator JSX 7 项、Browser JSX 6 项及相关包级测试通过，覆盖完整正文／实时预览／版本草稿保留／候选绑定／图像区域／音频范围／语言／确认与 receipt。root 尚未以此关闭完整任务：新的私有 Composer 授权接入仍在开发，媒体和 Browser 的反例由独立审查继续检查，真实成果／环境 owner 及七门仍待验证。此快照仅为局部审查候选，不是部署或发布产物。

该快照独立复审结论仍为 REQUEST_CHANGES。上一轮 12 项已有实质修复，但发现新的反例：候选切换取消基础正文请求后无法重试；descriptor 字段与跨 owner 候选校验不足；contentRevision 未用于保存 CAS；Browser reconcile 实际别名到 snapshot，unknown 可能错误解锁；指针／键盘 payload 缺少实际输入；图像区域坐标未适配 contain 留白与变换；授权 blob 音视频 URL 与 renderer 策略不一致；环境 workspace 未绑定请求；accepted 回执过早清除 dirty；Composer unknown 缺少原身份恢复入口。问题已交原负责人对照当前 live 修复，不能据前述测试数量关闭任务。

### 局部构建与真实 Host 证据加固

root 新增 `scripts/build-editable-reference-host.mjs`，采用逐包 tsc、限定包 Typert 生成、Host 原有客户端 preset，禁止 workspace 扩展与 clean。`node --check`、默认和 `--include-chat` 两种 `--plan` 检查通过；直接加载 remotes／ui-conversation／ui-reference 三个 preset，分别得到 1／2／2 个非清理配置。尚未在 grant 修复后的稳定源码上执行完整构建，因此不计入构建门通过。

`scripts/run-composer-reference-host-tests.mjs` 改为直接调用 Host 本地 Vitest，避免包管理器隐式安装。新增相关 Host／插件源码、未跟踪测试和 manifest 的逐文件 SHA-256 前后证据；输入变化时，即使测试 exit 0，验收脚本仍 exit 1，并分别记录 `test_exit_code` 与 `source_inputs_unchanged`。语法和局部 diff 检查通过，新的实际 E2E 仍待修复稳定后运行。旧有 diff stat 字段仅保留兼容，不再单独作为源码未变化的依据。

本次文档更新后执行 `openspec validate dsh-prompt-reference-creative-workspace-v1 --strict --no-interactive`，exit 0。此结果仅验证规格结构，不关闭功能或运行验收任务。

Creator 第二轮修复期间，root 分别在 `packages/host/creator-studio` 和 `packages/bundle/dsh-rich-media` 执行 `./node_modules/.bin/tsc -p tsconfig.json --noEmit`，两项均 exit 0。该检查独立于实现负责人报告，证明这两个包当前类型检查通过；不替代六包测试、实际资源交互或整个仓库门禁，也不重复清理构建中的共享输出。

root 随后独立执行两个已稳定包的针对性测试：在 rich-media 执行 `./node_modules/.bin/vitest run tests/media-renderers.interaction.spec.tsx tests/media-renderers.spec.tsx`，2 files／13 tests、exit 0；在 dsh-browser-host 执行 `./node_modules/.bin/vitest run tests/remote.spec.ts tests/validation.spec.ts`，2 files／19 tests、exit 0。覆盖 renderer 选区／播放资源策略以及 Browser workspace／reconcile／输入校验的局部反例。DOM／模拟 owner 测试不能证明真实服务与 Host 页面几何，完整独立复审和运行验收仍待完成。

完整门禁 runner 也已显式设置 `pnpm_config_verify_deps_before_run=warn`。root 读取本机 pnpm 实现确认此模式报告依赖漂移而不走默认 install 分支；语法和局部 diff 检查通过。本轮没有运行可能清理共享输出的全仓 build，七门状态不因此改变。

### 独立引用 grant 反例测试发现

root 在独立文件 `packages/api/session-controller/tests/session-reference-grants.host.spec.ts` 增加 9 项合成 owner 协议测试。Host staging 命令：`./node_modules/.bin/vitest run packages/api/session-controller/tests/session-reference-grants.host.spec.ts`。首次 6 pass／3 fail，其中两个为开发中的错误码已统一到 `session/reference-invalid`，按当前公开错误码修正精确断言；第二次 8 pass／1 fail、exit 1。

保留的真实失败：完整文件从 4 字节范围增长至 8 字节后，owner 返回新版本／digest／范围，但 `sameRefreshTarget` 对所有类型强制旧 window 相等，刷新候选被拒绝。该行为不符合新增规格场景，已交引用负责人修复完整文件／prefix 的 owner 派生范围；选区仍需严格校验，不能通过缩小测试目标消除失败。

已通过的 8 项涵盖错误工作区、伪造 grant、伪造 opaque ref／来源证明、敏感 reveal 授权转交与不泄漏到消息、会话／工作区／证明绑定、刷新候选独立 grant 与取消、消费后保留草稿的再次授权、过期且 owner 撤权时拒绝并保留输入。它们使用合成服务，只证明控制器协议；原请求去重、容量界限、真实文件敏感权限和实际 Host 仍由后续验收覆盖。

### 授权刷新修复及旧模式回归

完整文件范围刷新已修复，root 用同一 grant 命令独立复跑，9/9、exit 0。随后执行 `./node_modules/.bin/vitest run packages/api/session-controller/tests/session-models.host.spec.ts`，初次 16 pass／5 fail：三项新模式 fixture 未准备工作区／grant；两项旧模式因为无条件读取 workspaceRegistry 而失败。问题交原负责人修复，明确要求旧模式不新增工作区依赖，不能只修改旧图片 fixture 掩盖回归。负责人后续报告 21/21，通过结果尚待 root 合并验收。

### Creator／Browser 冻结候选及构建发现

root 核对并复制 `temp/creative-review-final-20260907-1924/` 的 48 文件 SHA-256。负责人六包 typecheck／test 报告为 16、35、155、28、41、8 项全通过，共 283 项。独立复审仍为 REQUEST_CHANGES：旧保存完成回执可能删除等待期间的新编辑；插入超时对账会把已存在的重复引用误判为本次成功；正文缓存缺 context fence；自动绑定字段类型／选项校验不足；Browser 对账 settled 缺严格 wire 校验。前四项已交 Creator 与引用负责人，root 负责第五项，不以通过测试数量关闭这些反例。

root 已修复 Browser 对账：拒绝非对象、额外字段、非 boolean settled 和不匹配身份，返回重新构建的严格投影。`packages/host/dsh-browser-host` 的 typecheck 与 `vitest run tests/remote.spec.ts` 均 exit 0，9 项测试通过，含字符串 false／数字／空值／扩展字段及合法 boolean 的对照。

实际包构建发现 Browser client 原配置把 Host primitives 连同 KaTeX CSS 内联，构建 exit 1。root 按 desktop bundle 先例加入平台 externals 后，Browser UI 和 Browser bundle 构建 exit 0；`vitest run tests/bundle-runtime.spec.ts tests/client-entry.spec.tsx` 2/2、exit 0。新测试执行实际 `lib/client.js` 工厂，依赖仅 React、JSX runtime 与 Host primitives；这不是实际浏览器 ModuleLoader 验收。两文件构建修复快照列于 `root-build-addendum.sha256`。

Creator UI 已按 package.json 中的完整多入口构建命令通过。Creator Host bundle 缺少 readArtifactContent Typert member／invocation，root 已增量补上；该 bundle typecheck 与 `vitest run tests/bundle.spec.ts` 3/3 通过。实际 client 构建另发现旧 Rich Media alias 只指向 preview leaf，无法解析新的表格／比较／图片／播放 API；该构建连接正在修复，未标为通过。真实 Host E2E scaffold 已开始准备，但领域 owner／开发环境证据仍缺失。

随后 root 将 Creator bundle alias 对齐公开 Rich Media client API，并沿 desktop 先例将 workbench-core 解析到源码，避免将 ModuleLoader 工厂当作 ESM 导出。实际 tsdown 构建 exit 0，生成 2.69 MB 单文件 client；明确 named exports 消除了 mixed-export 提示。`vitest run tests/client-artifact.spec.ts tests/bundle.spec.ts` 4/4、exit 0，测试从 UI 包解析共享 React DOM，实际执行构建产物的工厂。首次该测试因 installer 包本身没有 react-dom 而失败，修复的是平台依赖解析，不是跳过工厂执行。

root 的 Browser settled 与 Creator bundle 6 文件修复已独立冻结在 `temp/creative-root-integration-review-20260907/` 并交审查；Creator UI 的四项状态问题仍由原负责人修复，不能据 root 的构建通过关闭它们。所有以上结果为局部开发候选，完整七门与实际 Web／服务验收仍未完成。

root 独立复跑 `session-models.host.spec.ts` 与 `session-reference-grants.host.spec.ts`，2 files／30 tests、exit 0，确认上述旧模式回归及完整文件刷新反例均已关闭。其余插入回执与真实 Host 场景仍待后续验证。

6 文件独立复审结果为 ACCEPT_WITH_FOLLOWUP：Browser 非 boolean settled 问题关闭，未发现新的运行时 P1；提出 Creator bundle 根入口缺少新增正文 validator／类型导出。root 已补上 `validateCreatorArtifactContent` 及七项 artifact 内容、候选、动作、来源证明和工作区类型；该 bundle `tsc -p tsconfig.json --noEmit` 与 `vitest run tests/bundle.spec.ts` 4/4、exit 0。这些是公开合同增量，不改变旧 export，也不等于真实 Typert 往返已验证。

### 稳定修复复查与界面门禁

root 独立执行 Creator UI noEmit 与 `vitest run tests/artifact-workspace.spec.tsx`，15/15、exit 0；冻结增量供复审。复审确认保存 A 期间编辑 B 的清理 CAS、精确 requestId 插入对账、Browser boolean settled 已关闭，但提出完整 context 字段／无歧义 epoch、正文读取与动作字段容量差异、并发 descriptor 的提交归属，以及运行时字段不可绑定 select 四项补充反例，仍需修复。

root 已修复运行时字段绑定：contentRevision／range／annotation 仅接受有 maxLength 的 text／textarea；sourceVersion 保留已有明确投影值的选项校验。Creator Host noEmit 与 `vitest run tests/validation.spec.ts` 4/4、exit 0，其中三个角色分别有 select 拒绝／text 接受对照。另三项继续由 Creator 负责人修复。

执行 `pnpm_config_verify_deps_before_run=warn pnpm run check:surfaces` 初次 exit 1，发现新增媒体时间范围缺少动态几何登记；同时 Browser Pane 仍被旧目录标为纯状态逻辑而排除。root 核对实际仅有范围 start／width 百分比计算后登记该几何例外，并将实际使用 Surface 的 Browser Pane 改为 adopted。重跑 exit 0，28 client／7 bundle packages 通过。pnpm 提示 patchedDependencies 漂移，未安装或清理依赖；此处为真实界面门禁结果，完整稳定候选七门仍待统一运行。

引用负责人报告 `node scripts/build-editable-reference-host.mjs --include-chat` 已实际 exit 0，包含 Typert 生成、remotes aggregate 与 ui-chat；真实 Host 多目标 E2E 已启动，尚无终态结果时不计为通过。

### 真实 Host 暴露的浏览器产物遗漏

多目标 E2E 首次失败证据为 `temp/integration-test-runs/composer-host-2026-09-07T11-52-52-472Z-971706/`。root 读取 summary：exit 1、source_inputs_unchanged=true。实际 `@` 文件入口退回旧 file row，插入标签没有编辑按钮。负责人随后使用公开 catalog／bridge 的诊断探针确认 catalog 为空；此诊断不能代替原 `@` 用户路径验收。

root 比较当前产物定位到自身局部构建脚本遗漏：session-controller 的 `lib/types/client/sessions/session.js` 已有 prepareReference，但真正由页面加载的 `lib/client.js` 没有。原脚本的反射包分支只打包 Node half，不能因为其 exit 0 宣称浏览器 Session 模型已更新。

脚本现为 session-controller 同时构建 Node 与 Client face。root 使用该包原 clientBundle preset 定向生成浏览器包，exit 0，并核对 `lib/client.js` 已包含 prepareReference 方法与实际 Remote 调用。脚本语法和计划检查通过；下一次 E2E 必须恢复实际 `@` 选取路径，先前失败不计为通过。

### Creator 页面启动与 Host／Client 边界修复

首轮 creative Host E2E 证据 `temp/integration-test-runs/creative-workspace-host-2026-09-07T12-03-52-863Z-1232989/` 报告启动失败：测试 provider 早于注册表挂载，以及 Browser bundle 的 Node 入口导入 React UI，触发 KaTeX CSS 的 `ERR_UNKNOWN_FILE_EXTENSION`。前者由 test-only inject 依赖修复；后者是实际产品边界问题，不能用测试 CSS mock 隐藏。

root 为 Browser UI 增加纯标识 `/contracts` 子路径，保留原根入口导出；共享注册函数只接收 Client 提供的 renderer，Host 安装入口不加载 React UI。缺 renderer 时不注册空白 view／command，Client apply 仍提供真实 BrowserPaneProviderView。UI／bundle 构建通过；bundle noEmit 和全包 11 tests、exit 0，包含独立 Node 子进程实际导入构建后的 Host 入口、真实 client 工厂加载与无 renderer 的反例。无依赖安装或第三方 CSS 新增。

Creator 最后一项乱序确认反例已加入 per-artifact confirmation generation，root 独立执行 `vitest run tests/artifact-workspace.spec.tsx` 20/20、exit 0，覆盖 A 先提交、确认读取最后返回时不覆盖已确认的 B。该修复与 Browser 边界共 14 文件已冻结为 `temp/creative-browser-boundary-review-20260907/`，等待独立审查；真实 owner 回执仍未验证。

集成继续发现 Creator bundle 未向 composerReferenceOwners 注册六个成果 owner，因此 UI 私有插入调用编译通过并不代表真实 Host 可授权展开。已登记为当前纵向链路缺口，由 root 接入现有 Creator owner snapshot／正文读取，禁止测试直接伪造引用 owner 绕过产品注册。媒体资源及正文／时间范围的 owner 合同需一并核定，不能将媒体描述文字冒充实际附件。

### 新授权链路真实 Host 通过

root 读取最新两份 summary 和 browser artifact：

- `composer-host-2026-09-07T12-22-24-417Z-1661214`：真实 `@` 多目标测试 exit 0、source_inputs_unchanged=true；目标往返、独立草稿、Escape／焦点恢复、关闭目标拒绝均通过，无串草稿，model／provider 请求为 0，page_errors／warnings 为 0。
- `composer-host-2026-09-07T12-28-04-534Z-1781215`：真实主链路 exit 0、source_inputs_unchanged=true；10 类引用、编辑／刷新／发送／历史，2 次模型回放请求且实际上下文接收成立，provider_request=false，页面错误／警告为 0，360／560／960px 布局检查通过。该包明确不覆盖目标切换，目标证据来自上一包，不能混写标志。

root 查看最新 360px 截图，发送按钮和停靠面板均可见；引用块的局部内容 disclosure 与全局 Send preview 同名问题已交引用负责人收敛。上述目录均在所属仓库 `temp/integration-test-runs/`。旧失败包保留，包括遗漏 Session 浏览器包和过期 selection bundle，不覆盖历史失败记录。

### Creator 真实 owner 注册的正文链路

root 新增 `src/reference-owner.ts` 并将六个 Creator owner 注册到现有共享引用 registry，挂载与卸载随 Creator bundle 引用计数处理。解析经真实 Gateway snapshot／readArtifactContent，要求 Host session/workspace 与冻结 Creator context 一致，精确匹配 base／candidate 的 ArtifactRef 与 colocated proof，拒绝撤权／过期／歧义对象和超过 16 KiB 的正文范围，不复制路径或发起任意 URL 请求。

该 bundle noEmit／构建通过，`vitest run tests/bundle.spec.ts` 5/5、exit 0；新增用例使用实际 Gateway 和公共 owner adapter，验证正常读取、伪造 digest／跨会话／撤权拒绝和 registry 卸载。首轮 fixture 缺必填 acceptedVersion，修正 fixture 后通过，没有放宽生产 schema。当前 provider 只完成 artifact/body 正文；媒体真实资源解析仍待 owner/Host 能力对接，不能以文字快照宣称媒体附件完成。

Browser manifest 已补上 dsh.client Web face，Client 等待 paneWorkbench 后 apply；缺 renderer 时在 provider probe 前返回 needs_contract，避免 Node Host 无效探测。相关 bundle 构建和 11 项测试通过，后续还需实际 manifest-driven Loader 证据。

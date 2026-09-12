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


### 2026-09-08 正文证明、服务生命周期与完整门禁

Creator 正文解析现要求 proof.contentRevision 与实际读取版本相同，并校验完整 UTF-8 正文 SHA-256；读取前后复核 owner generation、完整 context、workspace 归属及生命周期。局部 byte window 明确标记 truncated。旧展示 proof 可继续省略新增字段，新正文授权不得省略。卸载先撤销授权，再尝试全部 disposer；任一清理失败仍继续其余清理。冻结 expected context 延迟出现时通过 Cordis inject 挂载 Gateway，撤销时解除绑定。Creator bundle 的 tsc、构建和 bundle.spec.ts 8/8 通过，含错误版本、错误正文 hash、读取中撤权、局部范围、清理异常和延迟 context 反例。

七门首轮证据 `temp/integration-test-runs/full-plugins-2026-09-08T01-38-47-689Z-799346/`：typecheck、test、build、check:bundles、check:surfaces、check:plugins 均 exit 0；test:visual 为 103/106。三张中文选区截图重复差异一致；查看 expected／actual／diff 后确认文字内容、布局及焦点状态未改变，按当前渲染更新 selection-zh-360／560／960 三张基线。完整视觉复跑证据 `temp/integration-test-runs/full-plugins-2026-09-08T02-04-22-041Z-1921813/` 为 exit 0、106/106。首轮之后 Creator 生命周期有增量，并已做上述局部验证；这些结果不宣称同一冻结候选的七门最终验收。

真实 Creative Host 的 `creative-workspace-host-2026-09-08T02-14-37-233Z-2173222` 为 exit 1、source_inputs_unchanged=true。截图显示选定 candidate two 已进入主 Composer，并显示成功回执；失败原因是测试精确文案遗漏句首 The。已对齐测试文案后重新运行，不能把该失败包直接改记通过。真实领域 owner 和开发环境验收仍未完成。


### 创作候选真实 Host 闭环通过

`node scripts/run-creative-workspace-host-tests.mjs` 最新证据 `temp/integration-test-runs/creative-workspace-host-2026-09-08T02-25-07-930Z-2460373/` 为 exit 0、source_inputs_unchanged=true。真实 ModuleLoader 加载 Creator／Browser，超过 1200 字摘要的正文完整编辑并预览，合成 owner 保存后，选定 candidate two 经真实 Creator 引用 owner 和私有 Host 插入回执进入 Composer，原位编辑内容确认为所选版本。360/960px、亮暗、页面错误／警告为 0。缺 Browser provider 时入口不注册；不等价于真实 viewport 验收。先前测试错误地期待空 Browser Pane，现按已有能力探测合同验证隐藏入口。

验收测试与合成 fixture 已固化到 `upstream-prs/creative-workspace-host-acceptance-v1/`，六个新增文件在临时 Git 目录 apply、逐字节比对 staging、reverse-check 全部通过。该包依赖既有引用 Host 补丁，未直接修改官方 core，也未访问真实领域或模型服务。

本轮 `openspec validate dsh-prompt-reference-creative-workspace-v1 --strict --no-interactive` 通过；`openspec validate --all` 为 160/160；`git diff --check` exit 0。功能 Tasks 仍按全部验收条件保留未勾选，特别是 3.4 媒体附件、4.8/4.9 真实采纳与写回、5.1–5.3 实际环境、6.6 领域运行验收。


### 共享按钮继承规则的真实主题回归

复查真实 Host 截图发现 Creator 主按钮文字不可见。新增浏览器计算样式对比度断言后，`creative-workspace-host-2026-09-08T02-28-30-179Z-2553336` 确认亮色对比度仅 1:1。根因为 visual-kit 的 `[data-scope] button{font:inherit;color:inherit}` 比宿主 Button 变体优先级更高。改为零优先级 `:where([data-scope] button)`，保留基础继承并让宿主字号／前景色生效，未复制按钮或新增颜色 token。

visual-kit 构建及 17 tests 通过；Creator bundle 定向构建通过。首次修后 E2E 测试本身 exit 0，但并发 project-canvas 测试新增导致 source fence 失败，记录保留于 `creative-workspace-host-2026-09-08T02-29-59-493Z-2612315`。随后将视觉依赖 visual-kit／surface 纳入运行器 fingerprint，重跑 `creative-workspace-host-2026-09-08T02-30-55-511Z-2641224`：exit 0、source_inputs_unchanged=true；主按钮浅色约 18.90:1、深色约 18.08:1；正文编辑、保存、candidate two 引用、360/960px 及页面无错误仍通过。Host 验收补丁同步更新，真实领域和 viewport 状态保持未验收。

共享样式修复后的完整视觉复跑 `temp/integration-test-runs/ui-visual-2026-09-08T02-31-16-676Z-2650882/` 为 106/106、exit 0；本次未更新任何视觉基线。


### 七门完整运行与 Creator 图片资源增量

`temp/integration-test-runs/full-plugins-2026-09-08T02-32-50-105Z-2692751/` 七项 pnpm 门禁全部 exit 0。该运行完成后才开始下列图片代码，不能把其结果当作图片增量的七门证明。

新增 Host-only `CreatorOwnerAdapterV1.readArtifactImage`、有界资源 validator、directory／Gateway 调用和 Creator reference resolver 的 artifact/media 分支。二进制不注册 Remote／Typert；绑定 ArtifactRef、contentRevision、完整 SHA-256、MIME、owner generation 与当前权限；拒绝超过 16 MiB、共享内存、空资源和伪造元数据。普通 image 与 image-region 范围分开，预览 URL 不参与发送读取。Host 20 tests、Creator bundle 10 tests 通过并构建；Creator UI 22 tests、Rich Media 13 tests 通过，相关 typecheck 通过。

真实浏览器暴露图片默认 draggable 拦截框选手势，修复为选择模式禁用原生拖拽并捕获指针，取消指针清理未完成框选；工具条改为换行，避免挤出面板。UI 同时拒绝用全图 proof 加入局部选区，不静默改变 proof.kind 或丢弃选区。

`creative-workspace-host-2026-09-08T02-55-00-525Z-3644636` exit 0、source_inputs_unchanged=true：合成 owner 图片预览、真实鼠标框选、授权再次引用、主 Composer 提交、Host 附件裁剪与 keyless 模型请求通过；原图 726px，实际附件 364px，model_requests=1，provider_request=false，page_errors／warnings=0。调试阶段先修正读取历史事件的筛选：不能把最后一条派生上下文消息当作原始 user source。旧失败证据保留。

随后新增更严格的模型 content 数组 image block 计数断言，`creative-workspace-host-2026-09-08T02-56-55-024Z-3740985` 在启动阶段因并发全仓 build 清理 session-manager 产物失败；确认 PID 3736443 的 pnpm build 当时仍活跃，未重启或清理对方构建。收紧断言需在产物恢复后复跑。当前领域真实服务、音视频附件与开发环境仍未验收。

并发 build PID 已终止且依赖产物恢复后，重跑 `creative-workspace-host-2026-09-08T02-59-27-559Z-3853678` 为 exit 0、source_inputs_unchanged=true；更严格的 model content 数组验证确认恰有 1 个原生 image block，图片附件实际为 364px（原图 726px）。Host 验收补丁六文件 apply、逐字节比对、reverse-check 通过。`openspec validate --all` 160/160，通过严格 change 校验和 git diff --check。


### HTML 静态结构预览增量

核查 CAW-02 发现原 HTML Preview 仅为 CodeBlock 源码高亮。新增 Rich Media `StaticHtmlPreview`，使用已存在的 DOMPurify 依赖创建独立净化实例，只允许语义结构和少量表格属性；完整编辑正文独立保留，不以净化结果回写。无脚本、CSS、网络资源、表单、命名 DOM 或用户 class；无新 iframe、bridge 或依赖安装。128 Ki UTF-16 码元的预览预算只限制渲染，失败／超限不截断源码；异步结果须与当前源码一致。

Rich Media typecheck 与 static-html 4 tests、Creator UI typecheck 与 artifact-workspace／styles 26 tests 通过；Rich Media 和 Creator bundle 构建通过。测试 alias 初次遗漏新增组件导出导致 1 项失败，已改为转发真实 renderer，未用 mock 替代净化逻辑。surface 检查 29 client／7 bundle 通过，bundle 合同 27/27，通过 git diff --check。

`creative-workspace-host-2026-09-08T03-13-46-830Z-643008` 为 exit 0、source_inputs_unchanged=true。真实 Host 显示标题／表格并支持源码编辑后更新预览，原始 script 字符串保留于源码而不执行；资源请求计数为 0，页面错误／警告为 0。候选引用和图片真实裁剪／原生模型图片块仍通过。该证据使用合成 owner、keyless replay，未宣称实际环境运行。随后扩展 360/560/960px 的 HTML 几何验证。

HTML 窄屏增量首跑 `creative-workspace-host-2026-09-08T03-16-42-425Z-747441` 在 ResizeObserver 更新前读取旧几何而失败；保留该失败包，并改为有界等待布局收敛，没有修改 Host 布局代码。最新 `creative-workspace-host-2026-09-08T03-19-37-803Z-851013` exit 0、source_inputs_unchanged=true：360/560/960px、亮暗、HTML 编辑与静态渲染通过；资源请求为 0、page_errors／warnings=0，真实裁剪图片与 1 个原生模型 image block 仍通过。验收补丁六文件 apply／字节比对／reverse-check 通过。

最终 Rich Media 发布包重新构建成功，`vitest run tests/bundle-runtime-smoke.spec.ts tests/static-html.spec.tsx` 为 5/5、exit 0，确保独立净化器修复进入实际 bundle；未安装依赖或更新现有视觉基线。

当前逐 Requirement／Task 的完成审计和剩余动作见 [completion-audit.md](completion-audit.md)。该表保留完整原目标，不以已有局部测试缩减验收范围。


### 成果页签键盘、空列表恢复及 Creator 来源刷新

新增回归用例先确认两项实际失败：空列表转可用触发 `Rendered more hooks than during the previous render`；未选中页签仍为 tabindex=0。现将空状态返回移到全部 Hook 之后，保留同上下文草稿；页签加入唯一 ID、tabpanel 关联、roving tabindex、Arrow/Home/End、RTL、IME 与修饰键保护。Creator UI typecheck 和 artifact-workspace／styles 28 tests 通过，覆盖空→有→空→有后草稿保留。

Creator reference owner 增加既有 refresh 回调：只解析同一 opaque ref 的当前 base，或重新授权原版本的不可变候选；不跳到不同候选，不重写旧 claim，proof id 变化、撤权、歧义 head 或失效选区拒绝。实际读取复用完整 resolve 校验。Creator bundle typecheck、11 tests 和构建通过；Gateway 测试覆盖原 v1 失效而显式刷新取得 v2 正文。

实际 Host 首跑受并行 Eikona 页面改版影响，旧测试直接寻找成果区失败（`creative-workspace-host-2026-09-08T03-37-09-813Z-1850034`）。随后按当前“Candidates and edits”入口进入，区分外层“Assets and sources”与内层 Source 页签，并按真实引用标题匹配 aria-label；旧失败包保留，未回滚他人页面改版。

`creative-workspace-host-2026-09-08T03-50-10-432Z-2399645` exit 0、source_inputs_unchanged=true。真实键盘切换及 ARIA 关联通过；Creator 引用编辑后 Refresh source 获取来源比较，Cancel 保留本地改写，再次刷新并 Replace 后恢复 owner 原文，随后发送成功。HTML 窄屏／图片原生附件链路仍通过。该包是合成 owner，不能关闭真实领域版本更新验收。

最终重新构建 Creator bundle 后，`creative-workspace-host-2026-09-08T03-58-44-011Z-2755828` exit 0、source_inputs_unchanged=true；页签键盘／ARIA、Creator 刷新取消／替换、HTML 窄屏及原生图片接收均通过。验收补丁六文件 apply／字节比对／reverse-check 通过；surface 检查 29 client／7 bundle，通过严格 OpenSpec 与 git diff --check。


### 图片查看模式与真实 Mermaid 渲染

图片 renderer 原先只要有 selection 回调就锁定所有变换，无法满足 Creator 缩放要求。现增加查看／框选双模式：查看可缩放平移旋转，框选恢复无变换坐标并保留原区域；查看拖动不调用选区 mutation。新增可选 labels，Creator 补齐图像工具 zh/en/pseudo，工具条用 vk-btn 和换行；Rich Media typecheck 与 renderer 14 tests、Creator UI 28 tests 通过并构建。

真实验收 overlay 按正常 ModuleLoader 加入已有 dsh-mermaid-render bundle，没有在 Creator 复制 parser。首次故障 `creative-workspace-host-2026-09-08T04-14-55-579Z-3451543` 使 Visual Pane 进入错误边界；进一步保留 console error 后定位到当前 Host MarkdownText 必填 labels 缺失（Cannot read properties of undefined reading code）。Creator 已显式传递复制／已复制／脚注文案给 MarkdownText 和 CodeBlock，兼容旧接口仍可接受的增量 props。

随后 `creative-workspace-host-2026-09-08T04-22-21-566Z-3708534` 发现 SVG 有路径但没有节点名称：Mermaid 默认 HTML labels 被既有净化器移除。改为 htmlLabels=false 并增加真实 parser 对中文标签的断言。jsdom 为缺失的 SVG getComputedTextLength 提供几何 stub；真实 Host 使用浏览器度量，不用 stub 充当实际渲染证据。

`creative-workspace-host-2026-09-08T04-24-38-273Z-3791739` 虽自动断言通过，截图仍见黑色节点与缺失连线样式，故不能计为视觉完成。净化器现从隔离 CSSStyleSheet 中只投影受限 SVG 呈现属性，不把生成样式挂到 Host；保留局部且实际指向 marker 的箭头引用，禁止外部 URL、脚本、foreignObject 和布局样式。`creative-workspace-host-2026-09-08T04-28-13-704Z-3896018` 图形节点／文字／箭头截图复核可读。进一步收紧 inline style 允许项并将 console errors 纳入最终浏览器门禁。

Mermaid typecheck 与 unit/render、unit/sanitize、real-mermaid smoke 9 tests 通过，Mermaid bundle 构建通过。全部失败包保留，图片模型接收仍使用 keyless replay 和合成 owner；真实领域／开发环境未验收。

最终 `creative-workspace-host-2026-09-08T04-29-57-727Z-3959604` exit 0、source_inputs_unchanged=true；实际 Mermaid parser 及源码更新、节点填充／文字／边线、图片查看 zoom=1.5→框选无变换→364px 附件接收全部通过；console_errors／page_errors／warnings=0，model_image_blocks=1。Host 六文件补丁 apply／逐字节比对／reverse-check 通过。


### Mermaid 语法失败恢复与原位节点更新

源码审计发现观察器对已记录的 code 节点直接跳过：同节点源码修正后，旧成功／失败图形不会更新。现检测 source 变化，拆除旧投影并恢复源码，重新经过稳定门渲染；旧异步成功／失败和主题结果只可更新仍为当前记录的对象。卸载后的迟到请求不重新渲染。

`vitest run tests/unit/graft.spec.ts` 11/11 通过，包含同节点解析失败→修正恢复、旧请求迟到不覆盖新图。Mermaid typecheck 与 bundle 构建通过。真实 Host `creative-workspace-host-2026-09-08T04-36-19-414Z-4147706` exit 0、source_inputs_unchanged=true：实际 parser 处理非法源码后显示失败，源码仍完整保留，修正后 SVG 展示 RecoveredDiagram；console_errors／page_errors／warnings=0，原有图片裁剪与 1 个原生图片 block 接收保持通过。测试补丁六文件 apply／字节比对／reverse-check 通过。


### CSV／TSV 格式恢复和实际 grid 接入

Creator 原先直接取 parseDelimitedTable.rows，丢弃截断标记且未提示错误引号。现 parser 增量返回首个 diagnostic，旧宽容 rows 保持不变；Creator 显示字符位置、源码恢复说明以及公共 LOCAL_TABLE_BUDGET 的行／cell 预算提示，完整草稿不变。CSV parser 15 tests、Creator UI typecheck 与 25 tests 通过，Rich Media／Creator bundle 构建通过。

实际 Host `creative-workspace-host-2026-09-08T04-42-27-433Z-122595` 暴露此前表格预览根本未传 columns，真实 renderer 显示无 schema；测试替身曾直接输出 rows，未覆盖该合同。现 Creator 沿用 columnsFromHeaderRow 首行列定义并将其余行传给现有 grid；测试替身缺 columns 时失败，真实 Host 仍为主要显示证据。`creative-workspace-host-2026-09-08T04-44-43-809Z-182246` exit 0，通过逗号引号数据、格式错误→源码保留→修正恢复、超长 cell 预算说明。随后增加实际 cell 的嵌入换行断言复跑。

表格最终证据：`temp/integration-test-runs/creative-workspace-host-2026-09-08T04-45-37-662Z-220134/`，exit 0、source_inputs_unchanged=true；实际 grid 单元格保留嵌入换行、错误源码修正恢复、预算提示通过，console_errors=0。完整 Host 其他路径仍通过；六文件验收补丁 apply／字节比对／reverse 检查通过。


### 表格 UTF-8 预算修正

源码复核发现 maxBytes 实际按 UTF-16 length 截断，中文可超出声明字节预算且 emoji 可能被切半。现按码点扫描可容纳前缀，计算 UTF-8 长度，不为任意大输入先分配完整编码数组；截断保持完整码点、原始源码不变。maxBytes／maxRows／maxColumns 必须为正 safe integer；正常旧调用行为不变，非法预算明确抛 RangeError。

Rich Media typecheck、`vitest run tests/csv-parse.spec.ts tests/file-preview-formats.spec.tsx` 为 50/50、exit 0，涵盖中文、emoji 边界、原有 ASCII／引号／换行和预览功能；Rich Media 发布包构建通过。本次为字节边界修复，实际 Host 图表／图片／表格的前次证据不被重新声明为本次运行。


### 最终门禁复跑与 Host 补丁独立核查

`full-plugins-2026-09-08T04-50-40-111Z-373751` 完成七门：typecheck、build、check:bundles、check:surfaces、test:visual、check:plugins 均 exit 0；test exit 1，明确失败在 dsh-mermaid-render 的 jsdom 发布包 smoke。修补 smoke 环境的 getComputedTextLength 后继续定位到 CSSStyleRule 未暴露；已补对应 jsdom window 全局，真实产物 smoke PASS，且额外要求 SVG 包含中文节点文字，不以空 SVG 算通过。未修改 parser 行为或放宽真实浏览器断言。完整 test 门已单独复跑，需等终态。

独立核查发现临时 `editable-prompt-references-v1-upstream-baseline` 已有后续修改，五个文件与正式 baseline.sha256 不符，不能直接据此重新导出。现对临时副本中的当前 staging 反向应用正式 patch，23 个哈希全部与已审 baseline 相符，再运行原 apply.sh，29 文件与当前 staging 逐字节一致；正式 patch SHA-256 仍为 75f567fdc133e6ccfadb72a50f86da3b5671f9ae036613af496ed0fb4e2f6a3c。未修改共享临时基线目录。

导出脚本增加写入前的全部已审基线校验，遇到临时目录漂移拒绝导出，防止覆盖正式 packet。已实际运行拒绝分支并比较整个 packet 前后哈希，全部文件未变，脚本语法与 git diff --check 通过。此修复不将临时目录的 WIP 当作新基线，也不代表可以跳过正式前置补丁应用。


### 测试门恢复与正文显式重读

完整测试门重跑 `full-plugins-2026-09-08T05-01-33-057Z-999301` 为 exit 0。结合上一包的其他六门，本轮七项命令均已有通过结果；旧 Mermaid smoke 失败包保留，不改写为通过。后续重读正文 UI 是新增变化，仍须以其专项测试／Host 证据单独说明。

正文读取 error／unavailable 先前永久保留在本地 cache，无法在原 Pane 恢复。新增“重新读取正文”显式入口，仅针对当前正文／候选的失败缓存；删除失败读取状态以重新走 owner read，不清除其他草稿，不调用保存，不自动重试。加载中无重试入口且去重表继续生效；图片／音视频没有可编辑正文时不显示误导性的正文重读按钮。Creator UI typecheck、artifact-workspace／styles 31 tests、bundle build 通过，包含临时异常和暂不可用两类恢复反例。

正文重读真实 Host 最终证据 `creative-workspace-host-2026-09-08T05-09-26-605Z-1436193` exit 0、source_inputs_unchanged=true，首次 owner 暂不可用后显式重读恢复实际表格，其余完整链路通过。此前两次测试自身 exit 0，但一次 Creator 入口源码并发改动、一次 README 并发改动导致 source fence 拒绝，失败记录保留。核对固定 fixture 不消费 README 后，仅从 fingerprint 排除包 README 文档，继续覆盖代码／fixture／manifest／配置；未排除生产代码。六文件验收补丁 apply／逐字节比对／reverse-check 通过。


### 图表主题与异步结果隔离

核查发现 renderer 在主题切换后仍可复用旧 in-flight promise，旧图完成还会回填新 cache；observer 主题重绘没有请求代次。现 cache 以完整源码／主题代次为 key（消除 hash 碰撞身份），setTheme／dispose 撤销旧代次，迟到结果拒绝；图形记录用 renderRevision 防止旧首次渲染或主题请求覆盖当前 SVG。

Mermaid typecheck、render／graft 17 tests 和 bundle 构建通过，覆盖切换主题时旧结果最后返回、当前图和 cache 不变。真实 Host `creative-workspace-host-2026-09-08T05-13-53-621Z-1561251` exit 0、source_inputs_unchanged=true：实际 SVG 节点颜色亮→暗→亮往返符合预期，节点文本与错误恢复、图片／HTML／表格／引用重读等既有场景保持通过。六文件测试补丁 apply／字节比对／reverse-check 通过。


### TSV 大表分页与窄屏

当前 owner 合同复核仍无真实开发环境目录／启动接口及音视频原生发送路径；已向用户请求测试配置位置，未调用外部或生产服务。本地继续验证 TSV 实际表格。

真实 Host `creative-workspace-host-2026-09-08T05-18-27-605Z-1678524` 验证 205 行 TSV 首／末页往返与 360px 翻页。进一步源码审计发现 Next page 用当前 page.loaded 对比总数，若最后一页恰好满页可进入额外空页。改为当前页偏移加 pageSize 与 total 比较，不改变 owner 数据。Rich Media typecheck 和 table-renderer 4 tests 通过，覆盖 400 行、200 行分页的满末页禁用／返回首页。实际 fixture 扩为 400 行继续 Host 验收。

TSV 最终证据：`temp/integration-test-runs/creative-workspace-host-2026-09-08T05-20-48-162Z-1754756/`，exit 0、source_inputs_unchanged=true，400 行满末页禁用下一页、上一页恢复、360px 翻页和中文内容通过，CSV／Mermaid 错误恢复仍通过。六文件 patch apply／逐字节比对／reverse-check 通过。该证据关闭 task 4.3，不代表真实领域或环境验收完成。

引用无损编辑及撤销证据：`temp/integration-test-runs/creative-workspace-host-2026-09-08T05-25-58-875Z-1941308/`，exit 0、source_inputs_unchanged=true。中文／emoji／空行／Tab／嵌套围栏原位往返精确相等，三行 clamp 与实际溢出已测量，展开保留完整正文；删除引用后原生 Ctrl+Z 恢复，后续来源刷新和发送不受影响。Task 2.2 已按该证据完成。六文件 patch apply／字节比对／reverse-check 通过，未改写其他任务完成状态。


### 发送预览与模型正文空白一致性

新真实断言 `creative-workspace-host-2026-09-08T05-29-01-148Z-2052148` 发现预览与冻结消息不一致：sinkSerialized 最后 trim 删除首尾空白。现仅当草稿包含合法 editable prompt 时保留完整 out，普通文本和 V1 仍走原 trim。引用正文、首尾草稿空白及插入分隔符与预览共同保留，不以修改测试去掉空白冒充通过。

正确 Host cwd 下 `vitest run packages/client/ui-conversation/tests/input-reference-submit.client.spec.ts` 为 15/15，通过精确尾部空白与旧提交行为；首次误在插件根运行匹配到 temp 多份测试的失败不算有效 Host 验收，已改用准确 cwd。`node scripts/build-editable-reference-host.mjs` 通过。真实 Host `creative-workspace-host-2026-09-08T05-33-39-059Z-2227495` exit 0、source_inputs_unchanged=true：保留中文／emoji／嵌套围栏到实际提交，发送预览、冻结 user/message 的 text、模型 user content 的 text 三者逐字相同；原生图片 block 仍由附件路径处理。

新增独立 `upstream-prs/editable-prompt-whitespace-v1`，按原 editable-prompt-references-v1 之后的两个精确文件基线生成；apply／字节比对／reverse-check 通过。原引用 patch 不重写，新的实际 Host 验收包 README 已注明新增先决补丁。Task 2.4 的预览一致性有直接证据，其他预算／超限验收尚待收口，不提前勾选整个任务。

全仓 git diff --check 当前被并行 credentialctl skill 四个 EOF 空行阻断（.agents 与 .claude），不修改该范围。后续仅将本任务 scoped diff 结果与全仓失败分开记录。


### 发送期间同引用改写与历史冻结

真实 Host 测试在真实 API 已接受提交后仅延迟浏览器 ACK 响应；期间修改同一引用正文、追加普通文字、再按 Enter，然后放行 ACK。测试明确等待完整 response finished 和浏览器帧更新后检查，不在 ACK 前过早断言。`creative-workspace-host-2026-09-08T05-43-18-301Z-2522042` exit 0、source_inputs_unchanged=true：新的引用正文与文字均保留，原冻结消息与模型正文仍等于提交前预览，未混入新编辑，model_requests=1。六文件验收 patch apply／字节比对／reverse-check 通过。

但这不是 task 2.5 完整通过：观测 retained_reference_count_after_ack=2，说明同引用改写后，原已提交且未编辑的图片引用也保留在草稿。源码 commitDraft 当前仅能删除精确提交前缀，否则保守保留整稿；需进一步实现按提交实例／正文 revision 精确消费，避免下一次用户提交重复带入旧图片。该剩余问题已登记，不能用“不丢草稿”代替“精确清理已提交内容”。


### ACK 后已发送图片残留修复

修复前 Host 对修改了中间引用的草稿只做整体保留，已发送图片仍留在下次草稿。新模式现捕获提交节点 key／叶类型／正文／引用快照，成功 ACK 先判断引用快照能否安全使用原前缀清理；否则按提交节点身份消费未修改引用和文本叶、保留修改内容／新增后缀。引用证明变化也阻止整稿清空，失败不消费。未修改 V1 旧路径。

准确 Host cwd 的提交与生命周期 20 tests 通过，包含 success 删除未改动图片、error 保留全部引用与新编辑。`node scripts/build-editable-reference-host.mjs` 通过。真实 Host `creative-workspace-host-2026-09-08T05-50-54-774Z-2777600` exit 0、source_inputs_unchanged=true，等待实际 ACK 响应结束后引用数从 2 降为 1，旧图片不再留在草稿，修改引用及新文字保留，原冻结消息与模型内容未变，重复 Enter 未多发。

独立 `upstream-prs/editable-prompt-ack-consumption-v1` 以 whitespace 补丁之后的两个文件为精确基线；baseline、apply、逐字节比对、reverse-check 通过。实际 Host 验收六文件补丁同步且独立 apply／字节比对／reverse-check 通过，README 明确前置顺序。之前“引用数 2”的失败缺口记录保留为修复前事实。Task 2.5 仍需对 unknown、其他内容编辑组合与最终候选门禁收口，不因此整体勾选。


### ACK 同文替换与证明更新回归

在准确 Host cwd 执行 `node node_modules/vitest/vitest.mjs run packages/client/ui-conversation/tests/input-reference-submit.client.spec.ts packages/client/ui-conversation/tests/reference-input-lifecycle.client.spec.tsx`，2 files / 22 tests 通过。新增两种提交期间变更：替换为同文新节点，或原节点仅更新版本／摘要／来源证明；ACK 后均保留引用，并分别检查节点身份变化与证明版本。该证据为 Host 客户端测试，不替代真实 Web 中的全部未知提交组合。独立 ACK 补丁已重新导出，精确基线、apply、与当前两个源文件逐字节一致及 reverse-check 通过。Task 2.5 继续保持未勾选。

补充：发送期间追加同对象同文的新实例，ACK 后原实例被消费、新实例仍在；失败测试改为等待实际错误通知，确保断言发生在结算后。同一准确 Host 命令最终为 2 files / 23 tests 通过。最新 ACK 补丁再次通过 baseline／apply／源文件逐字节一致／reverse-check。`openspec validate dsh-prompt-reference-creative-workspace-v1 --strict --no-interactive` 通过，`openspec validate --all` 为 161 passed / 0 failed。本轮增加客户端回归证据，不增加真实 Web 或真实 owner 验收声明。


### 媒体预览切换和比较失败的异步资源清理

修复 Creator 预览离开后迟到 Blob 不释放，以及图片比较一侧失败后另一侧资源泄漏。每个视图拥有临时 URL lease：错误／卸载只释放一次，迟到资源立即释放，普通 HTTPS 地址不撤销。没有改变领域候选或媒体授权协议。新增四项卸载／失败与返回先后顺序反例；最初测试 mock 未返回 Promise 的失败已修正。

证据：`temp/integration-test-runs/creative-preview-resource-lifecycle-2026-09-08T06-08-57Z/`，包含六类标准文件。包级 `node node_modules/vitest/vitest.mjs run tests/artifact-workspace.spec.tsx` 为 31 tests 通过，`node node_modules/typescript/bin/tsc --noEmit` 通过，两个变更源文件前后指纹相同。仅为客户端组件证据；4.1 阅读位置、4.8 真实媒体 owner 比较和其他服务验收保持待完成。


### 成果视图阅读位置恢复

新增视图局部 reading-position hook，按完整上下文／成果版本／视图和比较候选分别记录滚动位置、源码文字选区及方向。异步正文加载后恢复，上下文变化清空；不调用 focus，不保存正文或接管领域状态。32 项 artifact-workspace 组件测试通过，覆盖独立成果位置、选区和页签焦点；ui-creator-studio 与 dsh-creator-studio 两个包构建通过。

首次真实 Host `creative-workspace-host-2026-09-08T06-12-23-290Z-3493629` 失败：只构建了 UI 包，Host 分发 bundle 未包含新 hook。重新构建实际分发包后，`temp/integration-test-runs/creative-workspace-host-2026-09-08T06-13-44-304Z-3544876/` exit 0、source_inputs_unchanged=true，使用实际溢出的 100 行源码，切换预览再回源码后 scrollTop=180、selection=9..24/backward 精确恢复，焦点仍在 Source 页签；后续创作、再次引用、真实发送与 ACK 场景通过。六文件 Host 验收 patch apply／字节比对／reverse-check 通过。

此实现保留同一已挂载工作台内的源码／预览／成果切换位置。完整 Pane 卸载重建、媒体播放位置与窄屏宿主切换的状态所有权仍待补齐，不据此勾选整个 task 4.1 或 5.5。


### 近期引用与阅读状态增量的七门验证

`temp/integration-test-runs/full-plugins-2026-09-08T06-16-46-764Z-3633936/` 七项命令全部 exit 0：`pnpm run typecheck`、`pnpm run test`、`pnpm run build`、`pnpm run check:bundles`、`pnpm run check:surfaces`、`pnpm run test:visual`、`pnpm run check:plugins`。视觉使用本项目已安装 Chromium 路径；运行期间本任务仅做只读核对及审计文档记录，没有修改待验收代码。runner 不提供完整源输入冻结，因此不扩大为共享工作区无并发变化的证明。

此前新增版本／工作区身份切换的阅读隔离测试，artifact-workspace 单独运行 34 tests 通过：同上下文返回旧版本恢复位置；身份切换清空旧状态，异步正文返回后不串选区。全仓测试随后通过。当前门禁结果不覆盖下一步尚未修复的 unknown 对账 UI 连接缺口，也不代替真实领域服务和开发环境验收，最终候选任务继续保持待收口。


### unknown 保存的原操作查询与草稿结算

CreatorArtifactWorkspace 透传现有 reconcileAction，操作面板查询回执返回 onReceipt；unknown／pending 不提前标记生命周期 handled，权威完成后才释放锁并读取正文确认。查询在途重复点击不重复请求，卸载或上下文变化后迟到回执不回调；不提交表单值、不再次 dispatch。44 项组件测试覆盖 unknown→completed、查询期间新编辑保留、重复点击、卸载和身份切换。最初旧测试同步检查调用次数的失败已改为等待异步查询。

证据：`temp/integration-test-runs/creative-save-reconcile-2026-09-08T06-29-23Z/`，测试及 `tsc --noEmit` 均 exit 0，四个变更输入指纹不变。类型检查首次因并行 Sonora 合同源码新增导出而旧 lib 声明未更新失败；重建既有 Creator Host 包后通过，未改动 Sonora 业务实现。此为客户端证据，尚需真实 Host／owner unknown 回执验收；切到其他成果后恢复入口可达性、partial 结算及自动保存仍待收口。上轮七门结果早于此增量，不冒充新候选七门。


### unknown 跨成果返回原操作的真实 Host 恢复

待结算动作记录原成果版本、候选版本和上下文；切换成果后显示“返回待核对操作”，恢复原选择及动作，只查询既有 controller 的操作身份。版本／候选／上下文变化时禁用并提示通过 owner 核对，不改投新版本。已编辑正文超限也不会遮掉原操作查询面板。新增 zh/en 文案，pseudo 沿统一字典派生。45 项相关组件测试通过，含跨成果恢复和原版本改变禁用；Creator 分发包构建通过。

真实 Host `temp/integration-test-runs/creative-workspace-host-2026-09-08T06-34-05-180Z-348538/` exit 0、source_inputs_unchanged=true：合成 owner 已保存但返回 unknown，用户切到图片→返回待核对操作→查询，owner 校验原 idempotencyKey 和 target，只在 saveDispatchCount=1 时返回 completed；界面实际显示该回执后草稿确认清理，后续创作／引用／图片发送／ACK 场景继续通过。六文件 Host 验收补丁 apply／逐字节比对／reverse-check 通过。此证据是实际 Host＋合成 owner，不证明真实成果服务恢复；partial、自动保存和环境验收仍待收口。


### partial 保留原操作身份

Controller 不再把 partial 当作可删除原幂等身份的终态，dispatch 和 reconcile 均保留原 flight；界面 partial 回执继续显示原操作查询，后续 completed 才结束对应记录。56 项 controller／action-composer／artifact-workspace 测试通过，验证多次 partial 查询始终沿原 idempotencyKey、不携带 values、不重复 dispatch；客户端 tsc --noEmit 与分发 bundle 构建通过。

真实 Host fixture 扩展 unknown→partial→completed，partial 时未保存提示保留，最终保存次数必须为 1。两次浏览器 test_exit_code 都为 0，但整体 gate 均 exit 1/source_inputs_unchanged=false：creative-workspace-host-2026-09-08T06-37-32-611Z-455250 的并发变化为 views.tsx、transcription-capabilities.tsx、styles.ts；重建后 creative-workspace-host-2026-09-08T06-39-36-744Z-505932 的并发变化为 locales.ts。两次记录完整保留，不能记为稳定候选实际 Host 验收通过。停止同状态下重复运行，待源码稳定或独立候选后再验。六文件测试补丁 apply／字节比对／reverse-check 通过。真实领域 owner、自动保存及环境任务仍未完成。


### partial 稳定源码复验通过

在确认此前变化文件两分钟未再更新后，重新构建 Creator 分发包，执行 `node scripts/run-creative-workspace-host-tests.mjs`。`temp/integration-test-runs/creative-workspace-host-2026-09-08T06-42-28-925Z-578246/` 为 test_exit_code=0、exit_code=0、source_inputs_unchanged=true；实际 Host 完成 unknown→跨成果返回原操作→partial 保留未保存状态→继续按原幂等键查询 completed，owner 仅接受一次保存 dispatch；后续图片、预览、引用发送和 ACK 场景全部通过。此前两次因并发变化而失败的记录继续保留，不改写为成功。此结果关闭本次 partial 的合成 owner Host 验收缺口，不关闭真实领域 owner 或自动保存。


### owner 正文自动保存实现与 Host 验收

新增当前成果显式自动保存开关及 800ms 合并调度，复用 saveDraft descriptor、正文与 contentRevision CAS、生命周期锁和原操作查询。完成后必须读回新版本的相同正文才确认；新编辑保留，关闭／卸载取消未触发调度，在途仍结算。无需确认的低风险有效完整参数动作才可自动保存；失败／unknown／partial／读回无法确认暂停，不自动重发。49 项 artifact-auto-save／artifact-workspace／action-composer 测试、客户端 tsc --noEmit 和分发 bundle 构建通过。

实际 Host `temp/integration-test-runs/creative-workspace-host-2026-09-08T06-50-00-538Z-787497/` exit 0、source_inputs_unchanged=true：以自动保存开关替代手动 Save draft／Run action，停顿触发保存后沿 unknown→partial→completed 恢复，保存 dispatch=1；完整后续引用和发送通过。六文件验收 patch apply／字节比对／reverse-check 通过。真实领域 owner、媒体批注自动保存及最终视觉门禁仍未验收，不勾选完整 4.7。

截图复查发现 5.5 的具体未完成项：本 run 的 artifacts/creative-workspace-360-dark.png 中 Host 左侧栏仍占约 272px，主内容只剩约 80px，引用和成果面板被挤压。虽然测试流程 exit 0，该图不能证明整站 360px 可用；需补充宿主窄屏布局修复及可操作宽度断言，不能以局部 HTML／表格几何断言替代全工作台验收。


### 360px 截图过渡时机核对与宽度断言

纠正上一条截图推断：Host 源码及实际 lib 已有 <1024px 自动折叠和覆盖式导航，不是缺少折叠实现。旧截图截在 resize 后 grid 过渡未完成时。首次新断言 run creative-workspace-host-2026-09-08T06-54-43-210Z-902471 已确认 creator 宽度恢复，却因把外容器 280px 门槛误用于带边距的输入内部而失败（内部实测 258px）。失败截图显示 56px rail 与约 304px 主区域，证实边距并非挤压。

现验收先等待主内容至少 280px、输入宽度占主内容至少 80%，再验证 Send message 按钮完整位于 360×900 视口内，随后截图。`temp/integration-test-runs/creative-workspace-host-2026-09-08T06-57-24-757Z-983053/` exit 0、source_inputs_unchanged=true；人工查看 360-dark 截图确认侧栏折叠、引用可读、发送完整。未改动或复制 Host 已有布局实现；六文件测试补丁 apply／字节比对／reverse-check 通过。该修正不代表 200% zoom、触屏或全部窄屏成果操作已经完成，5.5 仍保留未勾选。


### 自动保存期间新增编辑的连续 CAS 验证

新增集成组件场景：首次使用 owner revision=1 提交 first edit；等待回执期间输入 second edit；读回确认 revision=2 后，第二次仅提交 second edit/revision=2，最终读回 revision=3、草稿干净且继续等待也不产生第三次提交。准确包目录下 50 项 autosave／workspace／composer 测试通过。首次根目录命令误匹配 temp 历史副本导致整体失败，不计作有效 gate。

新增 `node scripts/run-creative-workspace-client-tests.mjs`，固定包 cwd 和四个测试文件，不调用安装／构建，记录标准日志及本包 src/tests/config 前后指纹，源变化使 gate 失败。`temp/integration-test-runs/creative-workspace-client-2026-09-08T07-02-20-836Z-1156740/` exit 0、source_inputs_unchanged=true，包含上述三组和 controller 测试。此指纹仅覆盖本包，不能宣称整个依赖树冻结；证据为客户端层，不代替实际 Host、真实 owner 或最终七门。


### 560／960px 工作台断言与自动保存开关样式

新增 560px 单栏和 960px 并排工作台的实际宽度、发送按钮四边视口范围与无页面横向溢出断言，等待布局过渡后保存截图。首次 run creative-workspace-host-2026-09-08T07-04-19-754Z-1217640 的失败来自将 960px 的合法并排成果面板也按全宽要求：该面板为 360px，内容扣除两条 1px 边框后 358px。断言现按单栏／并排合同分别判断，没有修改 Host 原布局。

同一截图发现自动保存 checkbox 继承 cs-field 普通输入样式而放大、与标签分行。已去掉该祖先样式，改用独立 cs-auto-save 布局、已有 cs-confirm 标签排布和 16px 原生复选框，保留语义标签与 accent token。Creator bundle 构建通过。`temp/integration-test-runs/creative-workspace-host-2026-09-08T07-07-36-278Z-1313040/` exit 0、source_inputs_unchanged=true，实际 checkbox 宽高不大于 20px；人工查看 960-light 截图确认 16px 控件与标签同行，完整自动保存／对账／发送流程通过。六文件验收 patch apply／字节比对／reverse-check 通过；200% 缩放、触屏与真实领域验收仍未替代。


### Chromium 触摸模拟及点击区域

自有 Creator 按钮和自动保存标签在 pointer:coarse 时复用 --vk-ctrl-touch（44px）点击区域，复选框视觉仍为 16px。runner 新增 --touch，使用 hasTouch=true，实际断言 maxTouchPoints>0 和 pointer:coarse；通过 Playwright tap 切换 Preview／Source、点击自动保存标签和 Send message。明确为 Chromium 触摸模拟，不冒充物理设备或完整触摸手势覆盖。

`node scripts/run-creative-workspace-host-tests.mjs --touch` 的 `temp/integration-test-runs/creative-workspace-host-2026-09-08T07-12-43-054Z-1453117/` exit 0、source_inputs_unchanged=true、touch_emulation=true。页签及自动保存标签实际高度至少 44px，标签 tap 正确选中开关，自动保存 unknown→partial→completed 及最终原生图片发送、ACK 新草稿保留流程通过。Creator bundle 构建和六文件 patch apply／逐字节比对／reverse-check 通过。200% browser zoom、图片触摸拖动框选和完整 IME／触摸矩阵仍未证明，5.5 继续保留未勾选。


### 图片触摸取消、指针身份与实际附件

图片框选现在绑定启动 pointerId，只接受主触点／主按钮，其他触点不能覆盖起点或结束／取消该手势；pointercancel 和 lostpointercapture 丢弃尚未完成的范围，既有选区不变。4 项 rich-media 交互测试通过；旧 jsdom 指针 fixture 补充 isPrimary=true，新增第二触点干扰及取消后 pointerup 不提交反例。`creative-workspace-client-2026-09-08T07-19-18-389Z-1639329` 60 项客户端回归 exit 0/source_inputs_unchanged=true。Creator bundle 构建通过。

--touch 浏览器 fixture 使用 Chromium Input.dispatchTouchEvent 执行 start→move→cancel，断言范围仍为完整原图，再执行 start→move→end 并发送实际裁剪附件。`creative-workspace-host-2026-09-08T07-18-37-367Z-1616488` test_exit_code=0，但 source_inputs_unchanged=false 导致 gate exit 1：运行期间新增／修改 packages/host/creator-studio/src/auctra-working-copy.ts 与 tests/auctra-working-copy.spec.ts。该记录不算稳定 Host 验收通过，后续待稳定候选复验。六文件测试补丁 apply／字节比对／reverse-check 通过。


### 图片触摸手势稳定源码复验

重新构建当前 Creator Host 与分发包后，`node scripts/run-creative-workspace-host-tests.mjs --touch` 的 `temp/integration-test-runs/creative-workspace-host-2026-09-08T07-24-20-885Z-1785672/` exit 0、test_exit_code=0、source_inputs_unchanged=true、touch_emulation=true。Chromium 触摸取消保持原范围、重新框选、原生裁剪附件发送、自动保存及 ACK 新草稿保留均通过。本证据补足此前因 Auctra 并发源变更失败的稳定候选缺口，不重写原失败记录。

新增 Auctra 依赖只读盘点：packages/host/creator-studio/src/auctra-working-copy.ts 当前提供 normalizeAuctraWorkingCopyOpen，校验已经授权的 working-copy envelope、项目、版本、摘要和正文长度，并投影 CreatorArtifactContentV1。其函数明确不承担授权，当前不包含真实服务连接、保存、采纳或写回动作。因此不能将这个新增规范化工具当作 task 6.6 真实成果服务已完成。


### 原生浏览器 200% 缩放

新增 --zoom 验收模式：仅在独立临时 Chromium profile 加载测试生成的缩放扩展，通过 chrome.tabs.setZoom/getZoom 设置并核对 2，再验证 innerWidth 减半和 DPR=2；不以 CSS zoom 或 pinch scale 冒充浏览器缩放。普通 headless shell 的扩展 worker 探测超时后改用已安装完整 Chromium headless，探测由 1280/DPR1→640/DPR2 证明控制机制。临时扩展和 profile 随测试关闭删除。

首次 Host run creative-workspace-host-2026-09-08T07-30-58-128Z-1984477 功能通过，但默认 fullPage 截图按 CSS 尺寸裁切原生放大后的物理画面。现使用 Page.captureScreenshot 捕获未裁切物理视口，并断言 PNG IHDR 为 1680×1200。`node scripts/run-creative-workspace-host-tests.mjs --zoom` 的 `temp/integration-test-runs/creative-workspace-host-2026-09-08T07-33-07-448Z-2050227/` exit 0/source_inputs_unchanged=true/native_zoom=true，记录 before=1680、after=840、dpr=2；发送预览打开／关闭及原正文保持、发送按钮完整可见、恢复 100% 后后续创作与发送通过。完整截图已人工查看。

六文件 patch apply／字节比对／reverse-check 通过。此证据补足原生缩放的输入／发送预览链路，不能代替完整成果滚动／所有操作和双栏最小宽度合同核对，5.5 仍未整体勾选；真实领域与开发环境不受替代。


### 原生 200% 成果源码／预览及恢复

`node scripts/run-creative-workspace-host-tests.mjs --zoom` 的 `temp/integration-test-runs/creative-workspace-host-2026-09-08T07-37-38-230Z-2165769/` exit 0、source_inputs_unchanged=true。在已证明原生 browser zoom=2 的阶段，实际点击成果 Source、输入中文／emoji 草稿、切到 Preview 看到对应正文、返回 Source 精确相等；恢复 zoom=1 及桌面视口后源码仍一致，后续全部发送流程通过。完整物理视口截图继续保留，六文件验收补丁 apply／字节比对／reverse-check 通过。这补充了放大后的基本成果编辑，不代替所有模态、所有媒体或真实 owner 验收。


### 当前候选七门复验

`temp/integration-test-runs/full-plugins-2026-09-08T07-39-37-143Z-2229703/` 七项项目门禁全部 exit 0：typecheck、test、build、check:bundles、check:surfaces、test:visual、check:plugins。该 run 在原生缩放／触摸／自动保存／partial 对账增量之后执行，仍不含真实领域 owner 和开发环境服务；视觉基线未盲目更新。


### 200% 成果编辑复验与当前全量门禁

真实 Host zoom run `creative-workspace-host-2026-09-08T07-37-38-230Z-2165769` 在原生 browser zoom=2 阶段编辑成果源码 `# Zoom draft`，含中文／emoji，切换 Preview 后返回 Source 内容精确保持；恢复 zoom=1 后继续完成既有发送流程。此前稳定 zoom run 的完整物理截图与 1680×1200 校验继续有效，六文件补丁 apply／逐字节比对／reverse-check 已同步。

当前候选全量门禁 `full-plugins-2026-09-08T07-39-37-143Z-2229703` 的七项 typecheck、test、build、check:bundles、check:surfaces、test:visual、check:plugins 全部 exit 0；OpenSpec `validate --all` 161 passed / 0 failed，本 change strict validation 通过，scoped `git diff --check` 通过。

审计仍显示 35 项任务未勾选：真实领域 owner／开发环境、音视频领域服务、跨 owner 写回、完整 Pane 卸载恢复、200% 下全部媒体和触摸矩阵、最终证据冻结等未完成。合成 Host、客户端测试和项目门禁不能替代这些外部能力，故不调用 goal complete。

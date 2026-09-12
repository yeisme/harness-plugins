## 0. 执行约定

以下任务按实际实现与验证推进，未勾选项不代表已交付。D1–D3 对应分组 1–3，分组 4 是验证。lane 仅规划依赖，不自动授权子 Agent；同包修改必须串行，同一时刻一个 writer。不得改动其他在途 Pane、宿主或全局配置以消除无关失败。

拟新增测试放现有 host/client 包的 tests/，复用 Vitest；包 test/typecheck 与 integration:evidence 是现有命令。集成与浏览器证据写本项目 temp/integration-test-runs/<run-id>/ 的规定文件，失败保留并脱敏。中文文档、英文代码注释与日志；复杂并发、状态机、边界判断和夹具必须注释。

## 1. D1 合同与 probe

1.3 工具执行范围（2026-09-11）：基于兼容staging ToolRuntime源码核实schemas(agent)、execute({callId,name,arguments,agent,signal})和成功value合同，新增createScopedMarketToolConnection。每次读在同一明确agent对象范围重查已发现工具名与schema，再通过execute的policy/guard/cancellation管线；失去可见性立即拒绝，不回退global scope、不直接调用definition。market-tool-runtime/transport 4项测试与host typecheck通过。当前仍为结构兼容适配与模拟runtime验证，真实host注册及remote服务未完成；共享视觉套件仍在同一进程执行。

1.3 实际宿主接口调查（2026-09-11）：pnpm dsh:workbench -- --check通过，同代staging可用。检查staging mcp-client源码确认其公开的是server-qualified tools注册，不是readResource服务；不虚构资源seam。新增createMarketToolTransport，以调用方从discovery取得的精确工具名及inputSchema映射三个固定只读资源到market_capabilities/market_reader/market_brief，任意URI拒绝。Radar同步增加market_capabilities只读view。工具transport两项单元测试与host typecheck通过；下一步接实际ctx.tools执行scope及安全remote投影，仍未完成真实服务注册。

1.3 host组合进展（2026-09-11）：新增createConnectedRadarMarketHost，将已有MarketContextSource连接/上下文订阅与MCP读取adapter组合成client消费的radarMarketHost合同，类型由host统一导出。旧context不发请求；同ref但连接对象替换也丢弃返回结果；订阅cleanup直接交还context source。market-host 3项测试与host构建通过。尚需将factory注册到实际DSH服务，不能据此宣称真实连接已可用；共享视觉进程仍在执行，未记通过。

1.2/1.3 进展（2026-09-11）：新增 readConnectedMarketBrief 与注入式 ConnectedMarketTransport，读取 capabilities→reader→brief→reader，不解析可执行文件、不启动进程。缺能力停止读取正文；policy变化丢弃全部brief，超时有界AbortSignal且不重试，资源错误按命名码区分 absent/blocked/offline，不回传原始错误。market-adapter/market-contracts 9项单元测试及host包typecheck通过。当前测试为transport模拟，尚未绑定实际DSH连接或完成固定argv路径；相关任务不勾选。Radar市场资源已增量返回结构化错误码以支持实际连接分类。

1.1 后续进展（2026-09-11）：新增 brief 与比较值投影，保留 owner 的5＋2列表顺序、policy、时区/窗口、缺口、余量、更正数与比较前后值/百分比/限制；不在host重新计算市场判断。拒绝超界、重复信号、非法时区/时间、非有限数值，未知字段不复制。market-contracts.spec.ts 5项单元测试通过。真实owner向量、完整detail/compare/review投影和已连接MCP adapter仍待完成，任务继续未完成。

1.1 进展（2026-09-11）：当前 checkout 内新增 host market-contracts 白名单转换，覆盖 signal/reader/evidence：绑定明确 spec/revision/policy、未知地区保留、无效时间与不安全 ref 拒绝、摘要有界、未知字段不传浏览器。现有个人合同未改义。market-contracts.spec.ts 3 项单元测试通过；brief/指标投影、实际 owner 向量对齐、adapter/probe 仍待完成，任务不勾选。当前 active leaf 为补齐完整市场合同，随后接已连接 MCP adapter；owned paths 限 personal-radar host/client 与本 change，其他 Pane 和全局配置为禁止修改范围。当前不启动服务或持有端口。

- [ ] 1.1 增加市场安全 projection 类型和校验；owner=harness-plugins；scope=packages/host/dsh-personal-radar；依赖=Radar 1.1 合同草案；lane=host；验收=brief/signal/reader/policy/revision 和 bounded evidence 齐全，旧类型不改义；验证=pnpm --dir packages/host/dsh-personal-radar run test；预期=新 market-contracts.spec.ts 覆盖合法/缺字段/未知版本/不安全 refs；失败复查=对照 Radar 字段真源，不在客户端补业务规则。
- [ ] 1.2 实现 market capability/lane probe；owner=harness-plugins；scope=host/client probe；依赖=1.1；lane=host；验收=新旧 capability 共存，缺市场能力只给 disabled reason，旧个人入口可用；验证=pnpm --dir packages/host/dsh-personal-radar run test；预期=market-probe.spec.ts 覆盖 reader-only/partial/mismatch；失败复查=比对 discovery 与 capability，禁止伪 ready。
- [ ] 1.3 接入已连接 MCP 与旧固定 argv 两种 host 路径；owner=harness-plugins；scope=adapter/transport seam；依赖=1.2、Radar 4.3；lane=host；验收=无本机 CLI 仍可读取，浏览器不启动进程或读路径；验证=pnpm --dir packages/host/dsh-personal-radar run integration:evidence；预期=market-adapter.spec.ts 覆盖 no-local-CLI 和 owner-side 恢复；失败复查=确认 client 未接触可执行参数/凭据。
- [ ] 1.4 实现 typed mutation 与 receipt reconcile；owner=harness-plugins；scope=intents/receipts；依赖=1.3、Radar 3.2/4.5；lane=host；验收=双击同键、陈旧 revision 冲突、unknown 先查回执，不调用 observe；验证=pnpm --dir packages/host/dsh-personal-radar run integration:evidence；预期=market-reconcile.spec.ts 不重复写/擅自提权；失败复查=重放丢回执和乱序响应。

## 2. D2 市场阅读与持续追踪

2.5 对照投影前置（2026-09-11）：host合同新增market compare白名单投影，保留两侧source/sampling scope/observation/evidence、unknown地区与candidate identity，强制side_by_side、无共同数值轴、无因果推断；Radar market resource增加compare路径。contract测试覆盖跨市场未知与不安全指标；真实Radar cross-market MCP回放4项/63断言通过，证据temp/integration-test-runs/2026-09-11T11-41-40-231Z-2yrbh6/。client compare view和详情选择联动仍待完成。

2.3 详情Web切片（2026-09-11）：列表项新增打开详情，详情页绑定signal ref/revision并显示证据/限制/比较值，返回操作恢复原按钮焦点；详情controller取消旧选择并按context/policy清空。client16项测试、构建及6项市场Playwright用例通过，证据temp/integration-test-runs/ui-visual-2026-09-11T11-34-39-623Z-122450/；中途一次端口竞争失败记录temp/integration-test-runs/ui-visual-2026-09-11T11-33-16-109Z-110284/，重跑通过。全量详情证据时间线、跨市场/回顾操作和真实owner仍待完成。

2.3 卸载边界（2026-09-11）：详情controller在无活动context或dispose后忽略选择，既不保留ref也不读取owner，避免异步UI回调在卸载后重新写入临时selection。详情controller3项测试及host typecheck通过，Web详情装配仍待完成。

2.3 详情controller（2026-09-11）：新增createMarketDetailController复用内部读取状态机，选择绑定ref/revision且复制输入；切换选择取消旧请求，close/context/policy/dispose清空选择与正文，晚到响应不覆盖当前详情。detail/reading controller7项测试及host typecheck通过。详情Web组件和返回焦点仍待接入。

2.3 host详情接口（2026-09-11）：RadarMarketHostFace增量增加可选loadSignal，组合指定修订adapter并在读取前后检查context与连接对象。旧上下文零调用，读取期间切换会话丢弃返回值；market-host4项测试及host typecheck通过。client详情选择/返回焦点及真实host注册尚未完成。

2.3 缺失引用恢复（2026-09-11）：signal_not_found/evidence_not_found跨resources与tools-only保留命名码，并映射reference_unavailable；提示重新选择已有引用而非回退latest或误报离线。client中英/pseudo错误字典同步覆盖新状态。adapter/tool-transport14项测试、host构建及client typecheck通过；实际详情导航仍待实现。

2.3 tools-only详情（2026-09-11）：固定signals/{ref}/revisions/{n}及附属evidence路径映射到已发现market_signal/market_evidence view，原样传递明确版本；零版本、超安全整数、任意query拒绝，不回退latest。tool-transport4项测试与host typecheck通过。详情UI、完整证据读取与真实服务装配仍待完成。

2.3 详情读取进展（2026-09-11）：新增readConnectedMarketSignal，按所选ref/revision构造固定资源，复用capability、读取前后policy、取消和超时检查。投影与所选revision不一致时返回contract_mismatch，不返回新版本替代正文。market-adapter8项测试与host typecheck通过；tools-only详情映射、host服务与Web详情导航仍待接入。

2.3 详情引用绑定（2026-09-11）：新增projectSelectedMarketSignal/projectSelectedMarketEvidence，按用户明确选择验证signal ref/revision及附属evidence ref；拒绝新版本替代旧选择、其他信号与未附属证据。owner明确附属的跨来源更正证据保留，不自行推断同源限制。market-contracts8项测试及host typecheck通过。详情网络读取、选中状态与实际Web打开动作仍待接通，此项保持未完成。

2.2 补看失败文案（2026-09-11）：补看按offline/timeout/cancelled/capability/contract/policy/state/content错误分别显示安全中英/pseudo说明；失败使用alert，不误报未读为空，不复述owner原始诊断。新增3项React输出验证，client16项测试与typecheck通过。完整浏览器错误矩阵及真实owner装配仍待完成。

2.2 补看Web切片（2026-09-11）：MarketReadingView接入简报/补看导航，新增MarketCatchupView与host可选loadCatchup，支持空续页、末页禁用、从头读取和30天边界；复用宿主Button/SurfaceActionBar，切context/policy同时清空两种controller。浏览器5项通过（含空页→下一页→末页→返回简报），证据temp/integration-test-runs/ui-visual-2026-09-11T11-14-20-301Z-4069041/；client13项测试、host/client构建、check:surfaces/check:plugins通过。修复Button不支持active属性，改aria-pressed；Node测试按宿主primitive边界mock以避免KaTeX CSS导入，浏览器仍运行真实client bundle＋声明的fixture primitives。真实host连接、完整恢复文案与所有操作尚未完成。

2.2 分页controller（2026-09-11）：提取内部泛型读取状态控制逻辑，保持原简报controller导出兼容；新增createMarketCatchupController，first从空游标开始，next只使用owner nextCursor。空续页不误判完成，重复next在pending期间不重复读取，context/policy变化清空游标与正文并丢弃晚到页。新旧controller7项测试与host typecheck通过。仍需接入补看Web导航、页码/边界文案及浏览器交互回放。

2.2 分页失败恢复（2026-09-11）：owner cursor_invalid与state_conflict都映射到state_changed，明确丢弃旧游标并重启读取，而不误报离线；tools-only保持这些安全命名码。adapter/transport10项测试及host typecheck通过。补看UI与分页操作仍待实现。

2.2 补看读取进展（2026-09-11）：简报和补看共用有界读取/取消/policy检查，新增readConnectedMarketCatchup及host可选loadCatchup；补看还校验读取前后reader revision和页内revision一致。冲突返回state_changed不带page，tools-only保留owner state_conflict码。adapter/host/controller14项测试与host构建通过，覆盖空续页、游标拒绝和reader变化。补看UI与完整分页会话旅程仍待接入。

2.2 补看合同进展（2026-09-11）：新增MarketCatchupProjection，保留owner reader/policy revision、窗口、history_limited和opaque next_cursor；空页有游标继续保留，拒绝重复信号、超100项与不安全游标。tools-only transport支持固定catchup资源及一个cursor，检查discovery能力后原样转发，不解析或合成未读。market-contracts7项与tool-transport3项测试通过，host typecheck通过。补看UI、分页交互与scope切换集成仍待完成。

2.1/2.2 首个Web切片（2026-09-11）：ui-personal-radar新增React MarketReadingView，使用共享Surface/ContextBar/Section/State，覆盖加载、缺简报、空简报、变化/观察列表、证据引用与覆盖缺口，提供zh/en/pseudo静态文案。新增market-runtime条件注册drama-radar.market视图和命令：仅在radarMarketHost typed seam存在时启用，旧个人host缺失不阻止市场face，缺市场seam保留旧face；订阅/注册dispose成对。client 10项测试（含React静态HTML）与typecheck/build通过，host依赖构建通过，check:surfaces/check:plugins通过；新页面尚无专门浏览器截图，不能视作视觉或实际owner接入完成。真实radarMarketHost装配、已读/关注/对照/问答及完整UI状态仍待实现，任务保持未完成。

- [ ] 2.1 建立正式 Web market face 与纯状态 controller；owner=harness-plugins；scope=packages/client/ui-personal-radar；依赖=1.1、1.2；lane=client；验收=使用 Surface/locale/token，注册和 dispose 对称，旧文本 face 保留；验证=pnpm --dir packages/client/ui-personal-radar run test；预期=market-client.spec.ts 的 mount/HMR/unmount 无重复入口；失败复查=核对 host/client 注册责任和订阅释放。
- [ ] 2.2 实现每日变化及补看列表；owner=harness-plugins；scope=market list view/controller；依赖=2.1、Radar 2.4/3.3；lane=client；验收=5＋2 有界、日期/时区/缺口可见，empty/absent 不混淆；验证=pnpm --dir packages/client/ui-personal-radar run test；预期=market-reading.spec.ts 覆盖未读/完整简报/无重大变化；失败复查=禁止 client 重新排序或合成趋势。
- [ ] 2.3 实现信号详情与证据时间线；owner=harness-plugins；scope=detail/evidence view；依赖=2.2；lane=client；验收=原名/指标/窗口/限制明确，返回保留位置，源链接走 host 安全动作；验证=pnpm --dir packages/client/ui-personal-radar run test；预期=market-detail.spec.ts 无任意 URL/跨禁区读取；失败复查=对照 owner ref 与 policy revision。
- [ ] 2.4 接入显式已读/撤销和观察清单；owner=harness-plugins；scope=reader/watch action UI；依赖=1.4、2.2、Radar 3.4；lane=client；验收=仅标实际显示项，pending 不假成功，关注与 save/dismiss 分开；验证=pnpm --dir packages/client/ui-personal-radar run test；预期=market-actions.spec.ts 覆盖双击、分页、暂停恢复及冲突；失败复查=检查发送 refs/revisions、原 receipt 和未读未被读取副作用消耗。
- [ ] 2.5 实现跨市场对照；owner=harness-plugins；scope=compare view；依赖=2.3、Radar 3.5；lane=client；验收=不同口径分栏、不共轴，窄屏上下展示，候选映射不叫同作；验证=pnpm --dir packages/client/ui-personal-radar run test；预期=market-compare.spec.ts 的单侧缺失/unknown/不同指标通过；失败复查=核对分类和地区标签是否来自 owner。
- 2.5 前置实现（2026-09-11）：新增compare controller、host/transport compare读取契约与MarketCompareView；列表可显式选择两个信号后进入对照，窄屏上下展示并保留owner口径/限制。client 16项测试、typecheck/build通过；market专项视觉用例已加入，仍待最终证据回填及真实owner旅程。
- [ ] 2.6 实现周度回顾与更正入口；owner=harness-plugins；scope=review view；依赖=2.3、Radar 3.6；lane=client；验收=原判断/后续并列，inconclusive 单独表达，更正超额有入口；验证=pnpm --dir packages/client/ui-personal-radar run test；预期=market-review.spec.ts 不将无后续显示成失败；失败复查=核对回顾 cutoff 与引用 revision。

## 3. D3 Agent 问答与上下文连续性

3.2 controller复查（2026-09-11）：先以新增测试复现3个本次实现缺陷：loader结果对象被外部修改、订阅抛错中断读取、loading通知重入切上下文后仍发旧请求。已修复为接收结果拷贝、异常订阅移除且不回传错误正文、发送前generation检查。market-controller/adapter共10项单元测试及host包typecheck通过；实际Web会话装配仍待完成，当前证据不替代浏览器隔离验收。

3.2 前置实现（2026-09-11）：readConnectedMarketBrief 增加外部 AbortSignal 与 cancelled 状态，取消后不解析晚到正文或发起后续资源读取。新增临时 market reading controller，按context ref/generation丢弃乱序响应，切上下文/策略失效立即清空显示，dispose取消并清订阅；不存领域状态、不自动重试。market-adapter/controller共7项单元测试通过，host包typecheck通过。当前controller尚未装配到正式Web face或真实会话seam，因此不视为双栏/真实宿主验收完成。

- [ ] 3.1 接入证据问答草稿与当前会话 composer；owner=harness-plugins；scope=question action/composer adapter；依赖=2.3、Radar 4.4；lane=conversation；验收=信号/policy/会话绑定，用户发送前无消息副作用，缺 seam 可读但禁问答；验证=pnpm --dir packages/client/ui-personal-radar run test；预期=market-question.spec.ts 覆盖 evidence_insufficient/缺composer/引用失效；失败复查=检查未新增 Agent runtime 或隐式研究。
- [ ] 3.2 实现晚到响应、会话切换与禁区变更防护；owner=harness-plugins；scope=market controller/request generation；依赖=2.4、3.1；lane=conversation；验收=旧响应不覆盖新上下文，旧草稿不发送到新会话，policy 不明不显示旧正文；验证=pnpm --dir packages/client/ui-personal-radar run test；预期=market-isolation.spec.ts 的双会话及乱序响应通过；失败复查=检查请求 generation、reader/policy/context identity。
- [ ] 3.3 接入 bundle、命令入口与本地文档；owner=harness-plugins；scope=personal-radar bundle 与 README/design；依赖=3.2；lane=composition；验收=复用旧入口、市场 capability 独立，不恢复独立 Workbench；验证=pnpm run check:bundles；pnpm run check:plugins；预期=manifest/注册一致且无重复 host row；失败复查=仅修本 bundle 声明，不覆盖其他在途配置。

## 4. 验证与外部门

4.1 时间可读性（2026-09-11）：市场窗口与观测时间按owner声明时区格式化，保留time/dateTime及title原始UTC，窄屏上下文允许换行而不截断时区。client13项测试及构建通过；市场4项浏览器用例新增时区、本地08:00和上下文无溢出断言并通过，证据temp/integration-test-runs/ui-visual-2026-09-11T10-56-46-963Z-3841544/；check:surfaces/check:plugins通过。完整操作、实际owner和全量视觉门仍未完成。

4.1 市场专项浏览器进展（2026-09-11）：复用现有视觉server/Playwright/evidence runner新增market fixture（真实client bundle＋明确合成host投影），先复现360/560px共享ys-row三列导致状态文字宽度归零，改为市场条目单列后4项浏览器用例通过，覆盖360/560/960px、键盘展开、44px摘要目标、无横向溢出、policy失效清空且读取次数不增加。证据及截图temp/integration-test-runs/ui-visual-2026-09-11T10-52-38-396Z-3802528/；失败证据temp/integration-test-runs/ui-visual-2026-09-11T10-50-52-057Z-3787021/保留。已查看360px截图，时间字段紧凑显示及完整操作仍待完善；非真实Radar数据，不作为4.4实际host门完成依据。

共享视觉失败复查（2026-09-11）：独立4179诊断server的search-center单页浏览器无pageerror/HTTP失败且控件存在。证据runner重跑被4178占用阻断，证据temp/integration-test-runs/ui-visual-2026-09-11T10-48-18-656Z-3754355/；查明占用者是10:26本次已终止全量测试留下的独立server进程，已仅清理核实归属的旧server及本次诊断server。原全量失败原因尚未最终归定，不记为修复或全量通过。

视觉门执行记录（2026-09-11）：已执行pnpm run test:visual，共享套件计划178项；执行过程中多个非Radar页面均未出现预期DOM（domain studio、search center、selection等），在已记录大量失败后主动终止本次专属Playwright进程组，runner以exit1保存证据于temp/integration-test-runs/ui-visual-2026-09-11T10-26-04-055Z-3514917/。该门未通过且未完成全部用例，失败归因暂为ambiguous（跨页面渲染/环境问题待定位），未修改其他Pane或更新视觉基线掩盖失败。市场专项浏览器用例与完整视觉门仍待完成。

2.2 文案进展（2026-09-11）：市场页面增加zh/en/pseudo的来源健康、fixture/manual/live、信号类型/撤回状态和覆盖原因映射，未知码显示尚待核验，不推定正常。client 12项测试与typecheck通过；该检查不替代浏览器可读性验收。

- [ ] 4.1 完成 UI Contract 的响应式/无障碍用例；owner=harness-plugins；scope=personal-radar tests 与既有视觉套件；依赖=3.3；lane=verification；验收=360/560/960px、zh/en/pseudo、47字长名、200%缩放、全键盘/44px/reduced-motion；验证=pnpm run check:surfaces；pnpm run test:visual；预期=无裁切主动作、失焦或窄屏删能力；失败复查=以共享 token/原子控件修复，不加永久豁免。
- [ ] 4.2 完成真实 owner 合同的组件/集成旅程；owner=harness-plugins；scope=市场 fixture vectors 与 host/client integration；依赖=4.1、Radar 4.5；lane=verification；验收=旧/新协议、无CLI、空/partial/stale/offline、读取零写入、未知回执对账通过；验证=pnpm --dir packages/host/dsh-personal-radar run integration:evidence；预期=规定证据文件齐全，fixture 与真实 owner 来源标识分开；失败复查=对照 Radar 生成向量，不手改 fixture 掩盖不一致。
- [ ] 4.3 软件稳定后执行最终门；owner=harness-plugins；scope=本次实现与文档；依赖=4.2；lane=final-gate；验收=类型/测试/build/bundle/plugin/surface/visual 及 strict spec 全通过；验证=pnpm run typecheck；pnpm run test；pnpm run build；pnpm run check:bundles；pnpm run check:plugins；pnpm run check:surfaces；pnpm run test:visual；openspec validate dsh-radar-market-intelligence-v1 --strict --no-interactive；预期=软件门与真实门分开报告；失败复查=先归因并行/历史/环境，不改无关 Pane 逻辑。
- [ ] 4.4 验证兼容本地宿主的实际 Web 旅程；owner=harness-plugins-operator；scope=经检查的 DSH staging preview；依赖=4.3、兼容宿主和真实 Radar 连接；lane=host-evidence；验收=真实 DOM 中读简报→详情→对照→关注→提问→返回，三天补看、拖拽/双栏会话隔离、无重复底栏；验证=先读 docs/runtime/dsh-workbench.md，运行 pnpm dsh:workbench -- --check，再运行 pnpm dsh:workbench -- --no-open --port 40869 并用既有浏览器 harness 记录；预期=脱敏截图/动作证据、无私密数据；失败复查=报告 seam/环境缺口，不能用文本帧或模拟 PASS。该门不要求官方上游合入，未执行保持未完成。
- [ ] 4.5 交接真实使用与回退说明；owner=harness-plugins；scope=本地 UI 文档与 Radar consumer handoff；依赖=4.3，实际host状态来自4.4；lane=handoff；验收=软件、实际宿主、真实数据各有状态，关闭新 face 不删数据；验证=审阅 docs/design/radar-market-experience.md 和本任务证据引用；预期=不声称已部署、无独立 Workbench；失败复查=按实际证据更正文案而不把未执行外部门标完成。

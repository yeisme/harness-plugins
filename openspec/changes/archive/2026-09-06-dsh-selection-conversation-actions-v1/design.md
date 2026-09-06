## Context

用户要求改善选区操作，主要使用体验为添加到对话、引用和询问，并要求最右侧控件支持单击固定、按住拖动。插件合同与 fixture 验收已完成；真实官方宿主 overlay 仍未验证，不计通过。

只读源码检查发现：`ui-interaction-space/src/selection/layer.ts` 的最右侧按钮使用字符 `⌖`，click 进入 `pin` 状态；当前 render 仅显示 `actions-visible` 阶段，因此 pin 不等同于把可操作工具条固定在屏幕上。该层没有为此控件接入拖动手势。截图显示的灰色背景需在实施时检查真实 computed style、token 来源和祖先样式，不能仅凭截图认定某个色值或层级是根因。

关联合同：`dsh-web-composer-references-theme-v1`、`dsh-unified-multi-pane-workbench` 及已归档的 `dsh-selection-interaction-v2`。遵循 [统一视觉系统](../../../docs/design/dsh-unified-panel-visual-system.md) §12、§19；不覆盖并行任务的完成记录。

## Goals / Non-Goals

目标是形成对话优先的选区操作，确保目标会话明确、草稿连续、引用可解释、固定和拖动可发现，并收敛真实宿主中的视觉。

实施不新增独立编辑器、会话账本、主题存储、图标库或全局拖动协调器；不复制 Codex 的品牌皮肤，不自动发送消息或执行引用中的指令。

## Decisions

### 1. 操作层级与焦点

| 入口 | 结果 | 焦点 | 副作用边界 |
|---|---|---|---|
| 添加到对话 | 向明确目标的草稿插入引用卡片／正文引用节点，保留文字与光标书签 | 保留来源焦点，反馈提供“前往输入框” | 不发送、不启动运行 |
| 引用并询问 | 添加引用后激活目标对话并聚焦官方输入框，用户补充问题 | 目标输入框；不覆盖已有草稿 | 不预填强制指令，不自动提交 |
| 选择对话／新建对话 | 用户明确改变目标；新建成功后再插入 | 按随后选择的添加／询问动作处理 | 取消不创建会话；失败不丢选区 |
| 更多详情 | 展开来源、摘要、范围、可用状态及可选定位入口 | 官方预览／菜单管理，关闭返回触发项 | 不加入草稿、不执行 inspect mutation |
| 更多：批注、复制、批量收集 | 沿用原动作合同 | 沿用原规则 | 本地批注不因添加到对话被隐式创建 |

常规宽度显示“添加到对话”“询问”和轻量更多入口；窄屏保留“添加到对话”，询问和详情保持一步可达。参考的是用户截图中的动作体验，不承诺与 Codex 所有能力逐项等价。

### 2. 目标会话与多 Pane

目标来自宿主明确的 active conversation／已确认引用目标，使用 workspace/session 引用及可用的草稿 revision/bookmark。工具条按钮取得 DOM 焦点不改变目标；不得用最后一个聚焦 DOM 或全局未标明的 session 代替宿主引用。

来源属于哪个 Pane 与插入哪个会话分别表达。A/B 并排时显示目标会话名，跨项目显示项目名。用户显式选择目标时重新捕获书签；动作执行时验证可访问性、revision 与来源版本，不能在异步解析期间静默转入 B。目标不明确、失效或能力缺失时保留选区并提供选择／恢复入口。

生成中的会话只更新下一条草稿。重复点击同一次插入的处理中动作不得生成重复节点；去重沿用已有引用桥接。用户主动重复引用不同位置的正常行为仍由原 owner 合同决定。

### 3. 引用卡片与降级

使用宿主原生正文节点和既有引用草稿服务；展示来源类型、名称、有界摘要、范围与状态。展开、定位、移除分别执行独立动作；移除只影响本条草稿，保留文字、其它引用和源内容，参与宿主 undo/redo 与 IME。

有 owner/ref/version 的来源沿用结构化引用校验。没有来源 resolver 时，“定位原文／结构化引用”显示具体限制；若存在可复制的用户选中文字，可提供明确的“以选区文字添加”操作，标注“未关联可定位来源”。这条路径仅使用现有普通文本引用能力，不能伪造资源标识或在结构化发送失败后静默拼接文本。过期或无权限的结构化引用继续服从原 fail-closed 合同。

`no inspect resolver for status` 等内部错误不得作为主要标题或引用源摘要冒充用户所选对象。错误展示为可理解的原因与真实可用的恢复动作；技术信息放入显式详情。引用内容作为用户提供的上下文处理，不因加入草稿获得系统指令或工具执行权限。

### 4. 位置固定与拖动

- 控件使用现有语义图标，提示“单击固定位置，拖动移动”；固定时有可见反馈及 `aria-pressed`。不用 `⌖` 代替图钉或拖动含义。
- 主指针按下进入待判定状态。移动超过 6 CSS px 后进入拖动，阈值以下释放视为单击；超时长按本身不提交固定动作。
- 点击固定后工具条仍可操作，滚动不再自动追随选区；再次单击取消固定。位置固定与来源有效性相互独立。
- 拖动期间使用 pointer capture 和实际坐标，在已有 overlay 边界中投影位置；释放后保留落点并进入位置固定状态，抑制尾随 click，不再翻转固定状态。
- Escape、失焦、pointercancel、丢失捕获或来源失效时，恢复手势前的位置与固定状态；无半成品保存。Escape 在非拖动阶段关闭工具条。
- 文本选择、普通按钮点击不启动移动；touch 手势只由该手柄接管，不接管页面滚动。
- 工具条不得越出可见视口；缩放和视口缩小时重新约束位置。只记录短生命周期展示几何，不把选区正文、引用授权或草稿复制到布局存储。
- 对旧 `pin` 事件的选区收藏／恢复语义采用独立适配，位置固定使用独立内部展示状态；若确需公开扩展，先在此 change 补充 additive 合同，再实施。

### 6. Additive 引用协议扩展（任务 1.3 核实后固化）

均为可选字段／可选方法，宿主未实现时插件 probe 失败并诚实降级，不改变 protocol version 1 既有字段语义：

- `ComposerReferenceAddToMainDetailV1.activation?: { readonly focus: 'composer' }`：引用并询问请求宿主插入后激活目标会话并聚焦官方输入框；`ComposerReferenceAddToMainResultV1.activated?: boolean` 回执报告宿主是否执行。宿主不回 `activated: true` 时，插件不宣称已聚焦，保留来源焦点并显示目标名。
- `ComposerReferenceBridgeV1.chooseTarget?(signal): Promise<{ status: 'selected'; target } | { status: 'cancelled' } | { status: 'unavailable'; reason: string }>`：显式选择另一会话或新建对话的宿主入口（宿主拥有选择器与会话创建，插件不建会话列表或账本）。缺席时目标选择入口禁用并显示原因；cancelled 不创建对话、保留选区。
- 位置固定与拖动为 layer 内部短生命周期展示状态（几何 + 布尔位），不进入 reducer `pinned` 阶段、不写持久化布局、不复制选区正文。

### 5. 视觉与诊断

主视觉取 DSH 宿主颜色、字体与控件；统一 token 仅提供 scope 内 fallback。实施时先比对真实宿主与浮层的 computed background/font/border/focus、祖先透明度和 token 来源，修复错误映射或污染；不靠新的灰色常量、全局 reset 或强制 opacity 掩盖问题。

引用详情使用现有官方 overlay/primitives，完整内部内容按 Surface 组织；微型工具条保持紧凑，不增加大标题、第二个 composer 或厚重卡片。相邻对话、Git、终端和其它插件应保持原样。

## UI Contract

- Surface classification: 工具条与引用节点为 embed；来源预览／目标选择为 adopted。
- Surface kind: micro / inspector / dialog。
- First / second / third visual priority: 添加到明确会话与询问；引用来源及目标；固定、拖动和次级操作。
- Existing components reused: 官方输入框、引用草稿服务、Button/Menu/Modal/Pill、selection action registry、ui-visual-kit、ui-surface。
- Cards that earn existence: 草稿引用节点和可展开的来源预览；不新增卡片墙。
- Primary scroll owner: 宿主对话；详情仅作有界滚动，工具条不新增正文滚动容器。

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 添加／询问 | 保留选区、显示解析或插入中、防重复 | 无选区时不显示浮层 | 保留草稿和引用，说明失败及下一步 | 显示目标名与已添加反馈 | 旧来源需刷新或移除；unknown 不自动重试 | 目标／宿主能力缺失时解释并允许选择 |
| 详情／定位 | 预览加载状态 | 有文字但无结构化来源时明确标注 | 无 resolver 不输出裸内部错误 | 展示有界来源与有效定位 | 缺失范围和版本单独标明 | 定位不可用不阻断显式复制文字 |
| 固定／拖动 | 待判定阶段位置不变 | 不适用 | 取消还原并释放捕获 | 固定可见、松手保留位置 | 来源失效禁用内容动作、允许关闭 | 不可移动时给原因及键盘替代 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 主动作＋更多；详情使用官方窄屏表面；关键触控目标 44×44px | 紧凑单行或菜单，目标可查看 | 两个对话动作及详情入口，长名称有界截断 |

容器宽度与视口可用区分别处理；360/560/960px、200% zoom、中英文／pseudo locale 和长来源名称不得裁切主动作。

### Accessibility

- Keyboard path: Tab 到主动作、详情、手柄；Enter/Space 固定；聚焦手柄时方向键移动，Shift 加大步长；Escape 按手势阶段取消／关闭。
- Focus owner/return: 添加保留来源；询问聚焦明确目标输入框；详情与目标选择由官方 primitive 管理返回；pointer capture 释放后不产生尾随动作。
- Visible labels and accessible names: 固定／取消固定、目标会话、来源、详情和移除都有可读名称；拖动结束播报位置变化或取消，不播报每个像素。
- Reduced motion and coarse pointer: 关闭非必要位移动画；触控不依赖 hover，滚动与手柄拖动分开。

### Visual Exceptions

无。复用已有受支持的 overlay 与几何通道；若宿主无法承载移动，应先记录具体缺口及 upstream-prs 适配方案，不新增全局 portal/z-index 系统。

### Cross-host Semantics

- Canonical data/action/receipt owner: DSH 会话／草稿／发送服务及来源 owner；插件仅拥有展示与操作入口。
- Same capability in Workbench: 通过现有 session Pane 和引用桥接消费；不另建对话 owner。
- DSH role: primary。
- Shared states and wording: loading / ready / stale / unavailable / unknown；具体原因、目标名与恢复动作。
- Handoff trigger and target: 用户显式添加／询问到捕获的 session，或显式创建／选择其它对话。
- Semantic differences allowed: 添加与询问的焦点策略不同，权限、快照和发送语义相同。
- Pixel differences intentionally ignored: 不复刻 Codex 品牌；DSH 内部字体、背景层级与控件一致性仍须验收。

## Verification Plan

| 编号 | 必测动作链 | 必须断言 |
|---|---|---|
| S1 | 选区 → 添加到 A 草稿 | 引用节点、目标引用、已有文字／光标、焦点保留；没有发送调用 |
| S2 | 选区 → 询问 → 补充问题 | 同一引用加入 A，A 输入框获焦；文字不被覆盖且不自动提交 |
| S3 | A/B 并排／跨项目 → 切换或关闭目标 → 插入 | 明确的 workspace/session、revision；失效不改投 B |
| S4 | 新建对话 → 取消／失败／成功 | 取消不创建，失败保留选择；成功只创建一个并插入一次 |
| S5 | 详情／定位／移除及不可定位文本 | 操作职责、来源版本、草稿 undo/redo、显式文本降级标签；无伪造 ref |
| S6 | 手柄 click、阈值下释放、实际拖动、拖后 click | 可见固定状态、实际坐标、释放位置、没有重复 pin |
| S7 | Escape／blur／pointercancel／lost capture／重选／失效 | 还原几何与状态、清除捕获、旧动作不误发 |
| S8 | 主题切换＋相邻插件＋各尺寸＋真实触控与键盘 | computed style、无污染、可见焦点、44px 命中和无裁切 |
| S9 | 生成中追加、重复点击、异步失败或 unknown | 下一条草稿、节点次数、文字保留和无自动重发 |

复用现有 Vitest、测试夹具与 Playwright 入口，先执行相关包测试。固定／拖动不能仅使用元素 `.click()` 或合成状态事件证明成功；浏览器使用真实鼠标／触控输入，并检查几何和状态。引用必须断言宿主草稿节点、目标与回执，不只截图或检查 DOM 文案。

后续稳定阶段使用现有 `pnpm run check:surfaces`、`pnpm run test:visual`、`pnpm run check:plugins` 及相关构建门。集成证据写入本项目 `temp/integration-test-runs/<run-id>/`，包含 summary.json、command.txt、stdout.log、stderr.log、env.json 与 artifacts/；使用合成选区与测试会话，脱敏业务内容及凭据。默认验收到草稿；真实发送与历史 round trip 继续属于关联引用 change，不在此次等待阶段调用付费模型。

## Migration Plan

保留已有 V1 引用 API、事件、批注入口、旧 pin 恢复记录和正常文本发送。新 UI 行为不复用旧事件名改变语义。能力不足则明确降级并保留旧入口；后续实现回退可撤销新入口／独立展示状态及对应宿主适配，不能删除用户批注、草稿或历史消息。此次没有弃用窗口、迁移执行或接口变更。

## Risks / Trade-offs

- 目标因多 Pane 焦点变化串用 → 从宿主捕获明确引用，显示目标并在提交前复验。
- 固定状态使旧选区被误当有效 → 展示位置与来源有效性分开；来源失效后内容动作禁用。
- 点击与拖动竞争、pointer capture 后命中错误 → 阈值判定、坐标投影、拖后 click 抑制及真实事件回归。
- token 单测通过但实机仍为亮灰浮层 → 增加真实 computed style 和并排截图验收。
- 与当前引用／主题实现并行 → 实施前读取最新相关 change 和源码；此补充不覆盖其任务记录或已有业务修复。

## Open Questions

产品交互按本文作为待实施默认方案。实施前复核（任务 1.1–1.3，2026-09-05 完成）已核实以下事项：

- 灰浮层根因（实机 computed style 证据 `temp/integration-test-runs/2026-09-05T14-15-23-470Z-selection-baseline/`）：`buildPanelStyles` base 在 scope 根 `[data-dsh-selection-actions]` 上写入 `background:var(--vk-bg-base)`，叠加根容器 enter 动画 opacity，形成全容器灰色填充。修复限定在 scope extra 内（根容器透明、动画下放到 toolbar/sheet），不新增灰色常量或全局 reset。
- 固定后隐藏根因：`render()` 仅显示 `actions-visible` 阶段，`pin` 事件进入 `pinned` 阶段即隐藏工具条；位置固定必须为 layer 内部展示状态，不复用 reducer `pinned`。
- 手柄拖动缺口确认：layer 无任何 pointer capture/拖动逻辑；真实鼠标拖动几何不变（基线证据 drag-moved=false）。
- 宿主能力缺口：引用桥 `ComposerReferenceAddToMainDetailV1` 无插入后激活/聚焦字段；无显式目标选择／新建对话宿主 seam。两者以 additive 可选合同补充（见 Decisions §6），插件 probe 缺失即禁用并说明原因。
- 已确认可消费合同：`ComposerReferenceBridgeV1/TargetV2/DraftControllerV2`（`ui-pane-workbench/src/explorer/references-v2.ts`）、`dsh-composer-reference:add-to-main[-result]` 事件链、`composerReferenceCatalog` 上下文键、多 Pane 显式 sessionId（宿主 patch，插件不另建投影）。

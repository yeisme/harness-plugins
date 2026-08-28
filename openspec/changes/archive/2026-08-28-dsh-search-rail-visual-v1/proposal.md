# 搜索框与双侧边栏视觉统一

## Why

窗格中心搜索弹窗、右侧工作区活动栏与官方 DSH 折叠侧栏目前由三个时期的样式拼成：弹窗沿用初版松散列表、右栏按钮仍是 32px/8px 圆角/粗侧边蓝条 active、官方折叠侧栏出现重叠椭圆底板。用户已给出可直接执行的 UI Spec（低噪声、强层级、统一尺寸、状态清晰），且工作树中已存在一批未治理的 CSS 覆盖实现——本 change 把该 UI Spec 正式化为能力合同，收编既有覆盖并补齐缺口，保证视觉债不再无主。

## What Changes

- 搜索管理弹窗：720px 宽 / 78% 视口高 / 18px 圆角；48px 主搜索框（默认次级背景、聚焦品牌边框+低透明外发光+背景加深）；占位文案精简；32px 分段控制器（底板+浮起当前项，无大面积蓝填）；第一层筛选标签化可换行；高级筛选四列网格（<760px 两列）；结果行 48px、hover 轻背景+细边框、键盘选中态明显但不满行蓝。
- 右侧工作区活动栏：34×34 热区 / 10px 圆角 / 8px 垂直间距 / 图标视觉 18px；默认次级文字、hover 轻表面、active 品牌色弱填充+细边框（移除粗侧边蓝条）、pressed 缩放 96%、focus 可见焦点环；靠内容方向细分隔线；字体缩放归入底部独立区并加分隔线。
- 左侧主导航（官方 DSH 折叠态）：通过我们发布到官方 footer 的公共 launcher data 属性以 `:has()` 作用域覆盖，36×36 热区 / 10px 圆角 / 同套状态四态；Logo 行独立视觉不套用普通按钮选中样式；底部业务入口与系统设置间分隔线；不依赖官方 build hash class。
- 统一视觉 token：全部颜色来自 `--vk-*` 主题变量并为宿主侧提供安全回退；动效 120–160ms；Active 填充品牌色 12–18% 透明度、Focus 外环 12–16% 透明度语义。
- 响应式：<760px 高级筛选两列；<600px 弹窗距屏边 ≥8px、隐藏范围提示、底部操作区换行；不改左右工作区宽度、不引入横向滚动。
- 纯 CSS 覆盖层策略：不改任何 JSX 结构、交互逻辑、键盘合同与几何合同（栏宽、region 尺寸、拖拽/吸附均不动）。
- 修复 `chrome-tokens.spec` 括号配平启发式对合法 `color-mix(var())` 嵌套的误报，改为真实括号配平解析。

## Capabilities

### New Capabilities

- `dsh-search-rail-visual`: 定义搜索管理弹窗、右侧工作区活动栏、官方折叠侧栏作用域覆盖的视觉合同：尺寸/圆角/间距/状态四态/动效/token 来源/响应式与几何不变约束。

### Modified Capabilities

无。视觉覆盖不修改 `dsh-pane-center-descriptions`、`dsh-pane-tab-system`、`dsh-pane-workspace-docking` 等任何既有 Requirement；键盘导航、搜索匹配、标签管理与侧栏导航逻辑全部保持。

## Impact

- 实现 owner：`packages/client/ui-pane-workbench`（region-chrome.ts 覆盖层 + i18n 占位文案 + chrome-tokens 测试修复）。
- 既有工作树中「Unified sidebar and pane-search polish」CSS 覆盖块由本 change 收编为合同内实现，不再是无主视觉债。
- 官方 DSH 展开态侧栏不在本 change 范围（安全边界：只经公共 launcher 锚点覆盖折叠态）。
- 兼容分类：纯视觉 additive；无 API/schema/持久化/交互变更；回滚即删除覆盖块。

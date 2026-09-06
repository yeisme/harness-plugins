# 自适应停靠设计

## 本轮增量

复用唯一宿主布局树。命中检测以拖动开始时的坐标与标签矩形为基准，不让临时让位后的 DOM 反过来改变落点。按目标尺寸计算 64–180px 水平吸附区与 56–132px 垂直吸附区；命中后提供 18px 退出容差。角落按归一化距离选择最近边缘。

预演使用纯布局转换和同一几何投影。所有已存在 Pane 内容仍是稳定兄弟节点；未提交的侧栏新会话只显示占位预览，不挂载新会话 renderer。指针更新通过 requestAnimationFrame 合并，Escape、失焦、取消与并发修改放弃预演。

内容区落入另一组默认合并标签；同组标签移离标题栏仍可撕出。Alt 暂时关闭吸附。悬浮组标题栏中间移动不自动合组，边缘和标题栏仍可停靠。

布局树的首选轴与比例继续按原格式保存。窗口不足以维持内容可读宽度（对话约 400px、工具约 320px），且另一个轴能容纳时，仅在渲染投影中改变轴；分隔线使用投影后的方向处理指针与键盘。恢复窗口后原比例恢复，不写入用户未提交的布局。

## 本轮验收

真实浏览器检查：离边超过 40px 的停靠、相邻内容实时让位、松手前存储不变、吸附容差、内容区合并、Alt 悬浮、浮窗贴边停靠、窄屏上下排列及恢复、分隔线双击。保留对话与轨迹同 Pane、草稿隔离和取消的已有回归。

## UI Contract

- Surface classification: embed（宿主 chrome）；插件内容沿用既有 adopted Surface。
- Surface kind: workspace。
- First / second / third visual priority: 当前内容；组标签及会话原项目；添加面板和布局操作。
- Existing components reused: 官方 conversation slot、SessionProvider、输入状态服务、DSH CSS token；插件现有 Surface 与视图工厂。
- Cards that earn existence: 仅独立可移动的 Pane 组和临时视图目录，无额外装饰卡片。
- Primary scroll owner: 各 Pane 内容拥有滚动；标签栏独立横向滚动。

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 对话 | 官方加载态 | 官方新会话 | 官方错误及重试 | 真实历史与输入 | 沿用连接状态 | 保留输入阻塞原因 |
| 插件 | provider 加载态 | 原 Surface 空态 | 保留缺失占位 | 原 provider 内容 | 原 owner 状态 | 原 owner 原因 |
| 布局 | 恢复验证 | 打开会话／添加面板／恢复默认 | 存储失败提示 | 提交后保存 | 旧记录保持可选 | 禁止落点及原因 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 侧栏可收起，标签可滚动，禁止过窄分屏 | 按实际组尺寸判定分屏 | 默认首次工具 60／40 分屏 |

### Accessibility

- Keyboard path: 标签 roving focus、方向键排序、Enter 保留、Delete 关闭；分隔线方向键调整。
- Focus owner/return: 当前 Pane 与所属标签；目录关闭回触发点；Escape 取消拖动。
- Visible labels and accessible names: 语义图标配标题和可访问名称，跨项目始终显示原项目。
- Reduced motion and coarse pointer: 几何跟随指针，无强制动画；触控拖动手柄与更宽分隔线命中区。

### Visual Exceptions

宿主 chrome 使用其原生 CSS Modules 和 token，不引入 Yeisme Surface 依赖到上游。插件嵌入内容继续原 Surface；通过联合截图验证边界。

### Cross-host Semantics

- Canonical data/action/receipt owner: DSH 官方会话服务及各领域 owner；ui-layout 只拥有浏览器展示状态。
- Same capability in Workbench: conversation 与原插件 view kind。
- DSH role: primary。
- Shared states and wording: 使用原 owner 的加载、未知、不可用与错误状态。
- Handoff trigger and target: 既有插件动作，保持原 action identity。
- Semantic differences allowed: 仅展示位置、预览／保留状态和布局几何。
- Pixel differences intentionally ignored: 无；继承宿主主题，使用语义图标映射。

本轮 UI Contract 增量：标签取消硬竖线并按可用宽度收缩；实际内容拥有容器宽度约束；拖拽预演使用宿主强调色与短过渡，减少动效时关闭过渡。所有命中与反馈均来自宿主几何，插件状态和业务动作保持其原 owner。

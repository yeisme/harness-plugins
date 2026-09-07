# 设计

## 归属与能力账本
workspace_mode=current-checkout。owned_paths 为 staging ui-layout 的 Workbench、keyboard、测试、README 以及 locale；交付为 pane-keyboard-cycle 增量补丁。插件搜索相关脏改动不纳入。

| 能力 | 归属 | 验收 |
|---|---|---|
| macOS 前缀 | ui-layout | 编辑区可触发，Option 物理键，输入法/终端/模态不拦截 |
| 多 Pane 循环 | 已有 workspace | 1/3/8/32 Pane 正反绕回；包含浮动组 |
| 多 Pane 布局 | 已有布局树 | columns/rows/grid 循环，保留 tab 和会话绑定 |
| 继续分屏 | 原生 picker + dropPane | 当前组分屏选择其他内容；不复制会话 |

## 按键状态
Ctrl+B 进入两秒前缀模式；按 o/Shift+O、空格、%/双引号、z、b 执行动作后退出。Escape、失焦和超时取消。单独修饰键不取消前缀；未知字符正常传给编辑器。Ctrl+B 改为前缀，侧栏改为 Ctrl+B b，macOS 非编辑区仍可 Cmd+B。直接布局快捷键保留。

## UI Contract
Surface classification: excluded（宿主 pane shell）。复用 layoutMenu 和原生 picker，无新增插件 Surface。首要信息为 Pane 内容，其次为当前焦点，前缀帮助只在激活时显示。Primary scroll owner 仍为各 Pane 内容。

| 状态 | 行为 |
|---|---|
| Ready | 显示活动 Pane，前缀帮助用 status 宣告 |
| Empty | 循环和分屏安全无操作 |
| Cancel | 不改变布局、不吞掉未知输入 |
| Floating | 纳入焦点循环，几何保持，分屏按钮禁用 |
| Narrow | 复用宿主自适应布局，可聚焦单 Pane；不承诺无限可见面积 |

复用 Vitest 与现有 Playwright 脚本，浏览器证据由脚本生成六件套。Linux 浏览器模拟 Meta/Option 不等于 macOS 真机验证。

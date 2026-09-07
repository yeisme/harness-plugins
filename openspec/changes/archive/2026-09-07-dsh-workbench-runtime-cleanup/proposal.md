## Why

多 Pane 布局与全局旧版 DSH 启动器混用时，独立 sessionId 绑定和侧栏拖拽标记缺失；用户看到左右栏变成同一会话。输入区同时注册全局 Target 控件，导致每个 Pane 重复显示同一个目标。用户要求统一入口、清理旧内容、本地 Git 存档并固化后续操作。

## What Changes

- 开发启动、插件安装与配置探测使用同一兼容 staging CLI；不静默回退 PATH 上的旧版。
- 保留 `pnpm dsh:dev` 与 `pnpm dsh:workbench`，统一宿主解析并增加只读检查。
- 移除内置常驻 Target 控件及其无用样式，保留按需目标选择和已发布引用接口；引用折叠区只显示数量。
- 通过补丁包存档宿主增量，更新操作文档、技能和 OpenSpec，保留用户数据与无关脏改动。

## Capabilities

### New Capabilities

- `dsh-workbench-runtime-cleanup`: 同代启动、无冗余目标栏及可复现本地清理流程。

## Impact

归属 `fit`：harness-plugins 拥有本地启动、插件与交付；DSH core 改动通过 `upstream-prs` 的 staging 补丁维护。Ordo 继续拥有调度，不迁移 domain state。无协议字段删除、无数据库迁移、无远端发布。

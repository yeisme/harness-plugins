# DSH 完整多 Pane 工作台

基于官方 `dsh-v0.1.2-rc.1`（提交见 base.txt），通过隔离 staging checkout 维护。此目录不包含完整 core fork，不修改全局 DSH 安装目录。

宿主拥有布局、分屏、浮窗和会话呈现；插件通过兼容适配器提交打开／移动意图。官方对话与轨迹在同一个 session Pane 内，沿用原输入状态与消息账本。

在干净的对应版本源码上应用：

```bash
bash upstream-prs/unified-multi-pane-workbench/apply.sh /path/to/staging-checkout
cd /path/to/staging-checkout
pnpm install --frozen-lockfile
pnpm run build:lib:host
pnpm run build:lib:client
pnpm run build:web
```

本仓库联合入口、验收结果和回退方式见所属交付文档。补丁只导出本轮拥有的源码路径，保留 staging 中同时进行的其他工作；重新导出使用：

```bash
node scripts/export-unified-workbench-patch.mjs
```

变更说明：布局只保存安全引用，不保存消息和草稿；关闭不取消运行；恢复不发起业务动作。旧布局按原格式保留，由用户显式选择导入当前项目。能力缺失保留占位和原因。

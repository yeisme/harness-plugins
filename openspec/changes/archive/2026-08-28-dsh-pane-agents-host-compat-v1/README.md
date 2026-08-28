# dsh-pane-agents-host-compat-v1

官方 `ui-layout 0.1.0-rc.9` 上恢复 Agents / 窗格入口，并把入口改为 icon-only。

- 交付：Pane Workbench official overlay 在残缺 `workspaceLayout` 上继续挂载；peer 放宽到已发布 `0.1.0-rc.9`；Agents / 窗格入口图标化，缺宿主时禁用并写明原因。
- 不交付：DSH AppFrame 四列几何、`ui-layout >= 0.1.1-rc.3` npm 发包。
- 完成门不含官方 `dsh web`。

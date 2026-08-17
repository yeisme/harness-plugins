# harness-plugins 文档

本仓库是 @yeisme/dsh-* DSH 插件的实现 owner。产品、设计、实现、QA、发布文档都在本目录。

## 入口

- cookbook/adding-ordo-agent-ops-plugin.md：Ordo Agent Ops 插件的组装/安装方式。
- ../packages/bundle/anchored-standard/README.md：Anchored Standard 预设族的安装与行为。
- ../openspec/changes/ordo-dsh-plugin-visualization-v1/：插件合同、状态机、DSH/Workbench 可视化设计。
- ../packages/**/README.md：各包配置与运行时语义。

## 发布

    pnpm run build
    pnpm publish --filter @yeisme/dsh-ordo-agent-ops --access public

发布是 external action，需 npm 权限与远端仓库，按需执行。


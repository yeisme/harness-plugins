# @yeisme/harness-plugins

Yeisme 自研 DeepSeek Harness（DSH）插件聚合仓库，打包为可通过 `dsh plugin add` 安装的 bundle 层。

## 布局

    packages/host/       Host 插件（服务、transport、事件、命令）
    packages/client/     Client 插件（dsh.client bundle、slot UI）
    packages/preset/     组合/预设投影
    packages/bundle/     可安装的 profile patch 层（dsh.bundle.patch）
    docs/                产品/设计/实现文档
    openspec/            本地 OpenSpec change

## 安装到 DSH profile

    # 从本地 checkout 安装聚合 bundle（相对当前目录自动锚定）
    dsh plugin --profile web add ./packages/bundle/ordo-agent-ops

    # 或发布后按包名安装
    dsh plugin --profile web add @yeisme/dsh-ordo-agent-ops

详见 docs/README.md 与 AGENTS.md。


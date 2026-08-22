# @yeisme/harness-plugins

Yeisme 自研 DeepSeek Harness（DSH）插件聚合仓库，打包为可通过 `dsh plugin add` 安装的 bundle 层。

## Git checkout 开发安装

开发阶段默认从本仓库 checkout 安装，而非依赖尚未发布的 npm 包：

    git clone https://github.com/yeisme/harness-plugins.git
    cd harness-plugins
    pnpm install
    pnpm --filter @yeisme/dsh-ordo-agent-ops run build
    dsh plugin --profile web add ./packages/bundle/ordo-agent-ops

这条路径已验证能在干净 web profile 写入统一 Ordo root 与独立 composition
preview patch row。完整运行仍取决于 DSH core 发布 composition preview 所需的
公开只读 seam；在此之前，不把未经验证的 Git 子目录 URL 当作可运行安装合同。

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

    # 安装 Pane 与桌面工具工作台
    dsh plugin --profile web add ./packages/bundle/pane-workbench
    dsh plugin --profile web add ./packages/bundle/dsh-desktop-workbench

    # 安装 Creator Studio：文字、图像、音频、视频/短剧、资料、分析与审阅
    dsh plugin --profile web add ./packages/bundle/dsh-creator-studio

Creator Studio 复用 Pane Workbench 的 right/bottom region 与 Desktop Workbench
的工具生态，不创建第二侧栏或调度器。Eikona、Scaena、Sonora、Auctra、Pinax、
Anatomia 仍分别拥有其 canonical state、动作、审批和 receipt；未连接 owner adapter
时面板会显示安全的离线/合同状态。详见
`packages/bundle/dsh-creator-studio/README.md`。

### Anchored Standard 预设

    # 从本地 checkout 安装 Anchored Standard 预设族
    dsh plugin --profile web add ./packages/bundle/anchored-standard

    # 或发布后按包名安装
    dsh plugin --profile web add @yeisme/dsh-anchored-standard

该 bundle 会在 DSH 启动时把 `anchored-standard`、`zero-anchored-standard`、
`whoami-standard` 三个实验预设安装到 `$DSH_HOME/.agent-presets/`。

详见 docs/README.md 与 AGENTS.md。

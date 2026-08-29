# @yeisme/harness-plugins

Yeisme 自研 DeepSeek Harness（DSH）插件聚合仓库，打包为可通过 `dsh plugin add` 安装的 bundle 层。

插件完成门是本仓库协议对接：探测公开 slot / capability，缺席则禁用并说明原因。官方 DSH 是否已实现该 seam、能否启动 `dsh web`，都不挡插件验收。需要改 host 时走 `upstream-prs/` 与 `yeisme/deepseek-harness` 的 `pr/<slug>` 分支 + compare URL，不开官方 PR，也不在 fork `master` 上开审查 PR。详见 `docs/plugin-host-protocol.md`。

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

## 全插件热开发

在仓库根运行一条命令，即可构建并 link 安装所有本地 bundle、生成 HMR overlay、启动 DSH Web，并在源码变化后增量重建受影响依赖链：

    pnpm dsh:dev

开发仓库外自己的 bundle：

    pnpm dsh:dev -- --plugin ../my-dsh-plugin --no-open --port 8080

只检查发现结果，或仅完成构建/安装而不启动：

    pnpm dsh:dev -- --check
    pnpm dsh:dev -- --prepare-only

普通源码变化走 Cordis HMR；`package.json`、`cordis.patch.yml` 或 bundle 集合变化会自动重新同步 profile 并重启 DSH。完整说明见 [DSH 插件热开发](docs/cookbook/dsh-plugin-hot-development.md)。

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
    dsh plugin --profile web add ./packages/bundle/dsh-semantic-file-editor

    # 安装 Creator Studio：创作、完整做剧、项目资产、生成观察与审批
    dsh plugin --profile web add ./packages/bundle/dsh-creator-studio

Creator Studio 复用 Pane Workbench 的 right/bottom region 与 Desktop Workbench
的工具生态，不创建第二侧栏或调度器。Eikona、Scaena、Sonora、Auctra、Pinax、
Anatomia 仍分别拥有其 canonical state 与领域动作；Ordo 拥有 run、审批和 receipt。未连接 owner adapter
时面板会显示安全的离线/合同状态。详见
`packages/bundle/dsh-creator-studio/README.md`。

Semantic File Editor 在现有 `desktop.file` 内提供 Host-side LSP/AST、Monaco、Markdown/结构化预览、Outline/Problems 与 workspace edit 确认；未安装或能力缺失时自动回退原 renderer。详见 `packages/bundle/dsh-semantic-file-editor/README.md`。

### DevTools 开发观测

    # 本地 checkout
    pnpm --filter @yeisme/dsh-devtools build
    dsh plugin --profile web add ./packages/bundle/dsh-devtools
    dsh --profile web

    # 发布后
    dsh plugin --profile web add @yeisme/dsh-devtools
    dsh --profile web

DevTools 将脱敏日志、慢操作和性能摘要写入 stderr，不改变现有 stdout URL 合同；
Web 面提供 Host/浏览器时间线、性能 finding、显式 CPU Profile 与安全 JSON 导出。
默认只使用有界内存，不写盘、不上传遥测。详见
`packages/bundle/dsh-devtools/README.md`。

### Anchored Standard 预设

    # 从本地 checkout 安装 Anchored Standard 预设族
    dsh plugin --profile web add ./packages/bundle/anchored-standard

    # 或发布后按包名安装
    dsh plugin --profile web add @yeisme/dsh-anchored-standard

该 bundle 会在 DSH 启动时把 `anchored-standard`、`zero-anchored-standard`、
`whoami-standard` 三个实验预设安装到 `$DSH_HOME/.agent-presets/`。

详见 docs/README.md 与 AGENTS.md。

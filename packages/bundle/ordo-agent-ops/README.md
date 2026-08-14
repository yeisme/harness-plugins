# @yeisme/dsh-ordo-agent-ops

可安装的 DSH profile bundle：把 Ordo Agent Ops 的 host 适配器、/ordo 命令、client 面板与组合预览投影打包为一层 patch。

## 安装

    dsh plugin --profile web add @yeisme/dsh-ordo-agent-ops
    # 本地 checkout：
    dsh plugin --profile web add ./packages/bundle/ordo-agent-ops

## 组合层

本 bundle 通过 cordis.patch.yml 插入四行：

- ordo-agent-ops（host 只读投影 remote）
- ordo-commands（/ordo 命令）
- ui-ordo-agent-ops（client 值班面板）
- agent-composition-preview（组合摘要投影）

详见 AGENTS.md 与 openspec/changes/ordo-dsh-plugin-visualization-v1/。

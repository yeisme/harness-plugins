# @yeisme/dsh-personal-coding-base

DSH 个人编码基础包，组合黄金路径所需的命令、文件/Git 工作台、语义编辑、
终端、诊断、结构化插件合同与可降级的 Ordo 投影。它不拥有 Session、candidate、
run、lease 或领域状态；每个状态仍由对应 owner 提供。

安装：

```bash
dsh plugin --profile web add @yeisme/dsh-command-experience
dsh plugin --profile web add @yeisme/dsh-workbench-core
dsh plugin --profile web add @yeisme/dsh-desktop-workbench
dsh plugin --profile web add @yeisme/dsh-semantic-file-editor
dsh plugin --profile web add @yeisme/dsh-terminal
dsh plugin --profile web add @yeisme/dsh-devtools
dsh plugin --profile web add @yeisme/dsh-ordo-agent-ops
dsh plugin --profile web add @yeisme/dsh-personal-coding-base
```

成员必须作为 sibling Web profile layers 显式安装。不要只安装基础包本身：DSH 不会把 `link:` 组合依赖提升到 profile `node_modules`。composition patch 只 insert 标记 id，避免 duplicate loader id。

基础包不会安装创作/领域 pane。`ordo-agent-ops` 是 optional contribution：缺失或
`run launch` capability 未到岗时只显示稳定禁用原因，不回退为 `run start`。

`package.json` 与 `cordis.patch.yml` 由下列命令生成，禁止手改：

```bash
node scripts/generate-personal-coding-base.mjs
node scripts/generate-personal-coding-base.mjs --check
```

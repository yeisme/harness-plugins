## Context

当前 workspace 有六个 package：

1. packages/host/ordo-agent-ops
2. packages/host/ordo-commands
3. packages/client/ui-ordo-agent-ops
4. packages/preset/agent-composition-preview
5. packages/bundle/ordo-agent-ops
6. packages/bundle/anchored-standard

其中第五项 @yeisme/dsh-ordo-agent-ops 目前只发布 cordis.patch.yml，并在同一 patch 中插入前三个 Ordo 叶包与第四个 composition preview。它把同一个 Ordo 用户功能拆成三条 profile 解析边，也没有把 composition facts 与 Ordo release/owner 边界明确区分。

DSH profile 的 bundle patch 从 bundle 自身目录解析；profile 的 pnpm 安装并不保证聚合包的嵌套叶依赖在所有 linker、registry 或外部安装情形下都能以 Loader 需要的方式解析。DSH 的官方模型已支持同一个 package 同时提供 host 根入口、exports 的 ./client 和 dsh.client 元数据，因此不需要用聚合包绕开这一模型。

外部参考 dsh-web-ui 的 AionUI panel 是完整业务插件，而不是通用 UI 底座：其 layout.ts 通过 data-dsh-frame、CSS selector、MutationObserver 和 gridTemplateColumns 改写 Web Shell 的 DOM/grid，package 同时提供文件系统、Git、预览和 SSE 路由。该项目只能作为双端 package、lifecycle cleanup、状态 reset、拖拽与偏好持久化的实现思路参考，不能作为 Ordo 的依赖或 UI 架构。

参考来源：

- https://github.com/zhu1090093659/dsh-web-ui/blob/3647a33fa467e0335260468614f6eed04b196c38/packages/dsh-aionui-panel/src/client/layout.ts
- https://github.com/zhu1090093659/dsh-web-ui/blob/3647a33fa467e0335260468614f6eed04b196c38/packages/dsh-aionui-panel/package.json

## Goals / Non-Goals

**Goals:**

- 让一个干净 web profile 仅安装 @yeisme/dsh-ordo-agent-ops，即可加载 Ordo Host bridge、/ordo 与 sidebar 值班摘要。
- 以单一发布 package 保留 host、command、client 的源码边界，使用 Cordis、Host Remote、dsh.client、sidebar slot 与后续 ToolView 等官方 seam。
- 维持 Ordo 的 canonical facts/actions owner 边界，以及 Workbench 承担复杂 DAG、跨 run、证据比对与多租户运营的体验边界。
- 以一个明确发布周期的 shim 迁移旧叶包，防止 legacy/new/mixed profile 产生重复 Host 服务、重复 /ordo 命令或重复 sidebar。
- 保持 agent-composition-preview 与 anchored-standard 的独立 package、版本与 release 节奏。

**Non-Goals:**

- 不创建通用 dsh-plugin-ui-kit，也不从 AionUI 抽出一个“通用 Pane”。
- 不使用 data-dsh-frame、任何 CSS class selector、gridTemplateColumns、直接 DOM append、MutationObserver 驱动的 Web Shell 劫持或 iframe bridge。
- 不引入文件树、文件预览器、SCM、/aionui-panel/* 路由、文件系统写入、Git 写入、任意 host path、任意 fetch 或 SSE 路由。
- 不新建 Ordo scheduler、task ledger、lease、approval ledger、terminal state 或 composition facts 副本。
- 不在此 change 实现 ToolView action、审批决策、reconcile mutation、完整 DAG、跨 run 分析或 Workbench 运营台。

## Decisions

### 1. Owner 采用 split-owner，安装面与 canonical owner 分离

agent/harness-plugins 是 DSH adapter、packaging 与 conformance owner；agent/ordo 保持事实、动作、审批与 receipt owner；client/yeisme-workbench 保持完整运营台 owner。DSH 只显示紧凑值班摘要及后续单项 ToolView，复杂操作通过重新鉴权的 Workbench 深链完成。

\`\`\`mermaid
flowchart LR
  U[Operator] --> P[DSH Web profile]
  P --> O[@yeisme/dsh-ordo-agent-ops]
  O --> B[Host bridge: safe Ordo Remote]
  O --> C[/ordo command]
  O --> S[Client sidebar: duty summary]
  S -. later, one action .-> T[ToolView: receipt or approval]
  B --> ORDO[agent/ordo canonical facts and owner receipts]
  S --> WB[Workbench deep link]
  WB --> ORDO
  CP[@yeisme/dsh-agent-composition-preview] -. typed facts only .-> O
  AS[@yeisme/dsh-anchored-standard] -. independent preset distribution .-> P
\`\`\`

DSH browser state只保存 layout、selection、ephemeral dialog 和当前 runtime generation；它不能把 loading、timeout、disconnect、unknown 或 stale 推导成 run terminal state。Host 必须继续把 tenant、workspace、principal、installation、context revision 与 runtime generation 绑定在 safe projection 边界。

### 2. 保留既有 bundle package name，并使它成为真正的双端 package

物理 package root 保持 packages/bundle/ordo-agent-ops/，以避免改名 @yeisme/dsh-ordo-agent-ops。其预期结构如下：

    packages/bundle/ordo-agent-ops/
      package.json
      cordis.patch.yml
      src/index.ts
      src/host/bridge.ts
      src/host/commands.ts
      src/client/index.ts
      src/client/sidebar.tsx
      src/client/toolview.tsx
      tests/

- 根入口注册 bridge 和 /ordo 的 Host face，并拥有一份统一的 logical contribution identity。
- ./client 是 dsh.client 发现的浏览器入口；它通过受审查的 sidebar slot 注册值班摘要，不依赖 host apply 与 client apply 的偶然顺序。
- src/host/bridge.ts 承接现有安全 projection/Remote、schema validation、context containment、cache 与 dispose 逻辑。
- src/host/commands.ts 承接现有 /ordo 解析、只读 command 注册与安全 ref 处理；不得由此 change 扩大 action 权限。
- src/client/sidebar.tsx 承接当前值班摘要和 generation reset/dispose 逻辑。
- src/client/toolview.tsx 是后续单项审批/receipt 的固定位置。当前切片不注册可操作 ToolView；只有 owner 已提供 server-authored action descriptor、approval binding 和 receipt 合同时才启用。

package.json 必须同时声明根入口、./client export、dsh.bundle.patch 与 dsh.client。Root/./client 的实际 export target、types、files、peerDependencies、tsconfig 和 build 产物都必须在 tarball 内可解析；不能再依赖 workspace:^ 的 Ordo 叶包作为生产运行时依赖。

收敛后的 cordis.patch.yml 只包含一个 Ordo root row；为保持单条安装命令，它还以独立命名的直接合同依赖挂载 composition preview：

    - insert:
        - id: ordo-agent-ops
          name: '@yeisme/dsh-ordo-agent-ops'
        - id: agent-composition-preview
          name: '@yeisme/dsh-agent-composition-preview'

第一行是唯一的 Ordo root contribution；第二行仍是独立 package 的 own contribution，不是旧 Ordo leaf shim。@yeisme/dsh-agent-composition-preview 必须作为 @yeisme/dsh-ordo-agent-ops 的直接、版本化 runtime dependency，使 DSH 能从 bundle package directory 解析它。这个 package 是 host/client 的发布边界，不是“通用 Pane”。host/ 与 client/ 的源码拆分保留，避免将 UI 状态混入 Ordo transport 或将 host transport 泄漏到浏览器。

### 3. 使用官方 DSH seam，不触碰 Web Shell DOM

Host 使用 Cordis service、Remote、commands 与 effect-scoped disposal。Client 使用 dsh.client、sidebar slot、typed remote client、locale 和可访问组件。dsh.client.inject 只提供加载/预取信息，不保证 apply 顺序，因此 client 注册必须等待/声明实际 slot seam，而不得以 DOM 选择器或 shell grid 作为同步手段。

每个 runtime generation 的 teardown 必须清理 event subscription、timer、pending request、callback、slot injection、focus trap、selection 和本地 cache。tenant/workspace/runtime/context 切换、HMR、unload、Remote 断开和 late result 均以新的 authoritative snapshot 开始；late result 不得回写新 generation。

从 AionUI 参考中只能借鉴以下抽象思路：mount/unmount 对称清理、状态 reset、pointer drag 的资源清理、用户偏好的有界持久化。不得复制 data-dsh-frame、selector、grid 或任何 host 文件系统/Git/SSE 模型。

### 4. composition preview 与 Anchored Standard 保持独立

@yeisme/dsh-agent-composition-preview 继续单独发布、单独拥有版本和 mount lifecycle。为让用户只安装 @yeisme/dsh-ordo-agent-ops 仍可获得既有 composition 合同，unified Ordo bundle SHALL 把它作为直接 dependency 和独立 patch row 挂载；这不是把实现、release 或 facts owner 迁入 Ordo package。未来若 Ordo 需要显示 composition facts，只能使用一个明确版本化的可选读取合同：

- composition package 已单独 mount 时，Ordo 读取其安全 envelope/ref。
- composition package 缺席、schema 不匹配或事实 unknown 时，Ordo 显示 unavailable/needs_contract，不以本地值补造事实。
- Ordo 不计算、缓存为 canonical、写入或暴露 maturity、risk、qualification、approval 或 receipt；这些仍属于 Ordo owner。

@yeisme/dsh-anchored-standard 既不成为 Ordo dependency，也不成为兼容 shim 的目标。它只作为独立 preset 分发 package 保持现状。

### 5. 公开合同按 expand-then-contract 迁移

下表是本 change 的合同清单与迁移方式：

| 合同面 | 当前 | 迁移发布：0.1.0-rc.7 | 移除发布：不早于 0.1.0-rc.8 |
| --- | --- | --- | --- |
| @yeisme/dsh-ordo-agent-ops package name | bundle-only | 同名 package 扩展为 host + ./client + patch | 保留同名，不移除 |
| dsh.bundle.patch | 四个 package row | 一个 root row | 保留一个 root row |
| @yeisme/dsh-host-ordo-agent-ops | 独立 Host package | 保留为 re-export/adapter shim 与一次性 deprecation diagnostic | 下一独立 change 才可移除 |
| @yeisme/dsh-host-ordo-commands | 独立 command package | 保留为 re-export/adapter shim 与一次性 deprecation diagnostic | 下一独立 change 才可移除 |
| @yeisme/dsh-client-ui-ordo-agent-ops | 独立 client package | 保留为 client shim，保持旧 export 可解析 | 下一独立 change 才可移除 |
| @yeisme/dsh-agent-composition-preview | bundle 的第四 row | 独立 package、direct dependency、独立 patch row；不是 shim | 不属于本 change 的移除面 |

旧 leaf package 在 shim 窗口必须保留已发布 root/subpath export 的可解析性，包括类型、invariant、remote 等现有出口；它们将 unified package 精确锁定到 `0.1.0-rc.7`，避免 rc.8 移除 compatibility entry 后宽范围解析到不兼容实现。新增 unified package 的 granular export 仅用于 shim，文档不得把它包装成新的多包安装方式。

legacy-only、new-only 和 mixed profile 都必须得到每个逻辑贡献恰好一次：一个 bridge、一个 /ordo、一个 sidebar。实现可以采用 shareable logical contribution key、Host service registration guard 与 fiber-scoped client slot guard，但不得依赖模块加载顺序、全局永不释放 boolean 或 Web DOM。混合配置的去重路径必须随 fiber dispose 释放，下一 runtime generation 才可重新挂载。

旧 leaf shim 必须发出一次可操作、无 secret/path/payload 的弃用诊断，提示迁移到 @yeisme/dsh-ordo-agent-ops；deprecated diagnostic 与 README/release note 一起构成一个完整发布周期的 deprecation window。

### 6. 许可与来源采用条件性复制门

本设计不要求复制 dsh-web-ui 代码。若实现者复制了任何来自上述 AionUI package 的非平凡代码、CSS、测试 fixture 或注释，必须在同一变更中：

1. 保留 Apache-2.0 LICENSE 与 NOTICE；
2. 添加可审计的来源说明（upstream repository、固定 commit、文件与适配范围）；
3. 标明哪些内容是原样、改写或仅受启发；
4. 在 package files 和发布 tarball 中包含所需许可文件；
5. 审查复制结果仍不含 DOM grid hack、FS/Git 或 SSE 路由模型。

若无复制，README 仅可说明“受架构思路启发”，不能错误宣称包含上游代码或新增许可负担。

## Risks / Trade-offs

- [一个 package 变大] → host/client 仍按目录、types 和 focused tests 拆分；发布、安装与版本兼容却只留一个 Ordo 用户入口。
- [旧新并存产生双 mount] → 用 actual Loader/Web composition 的 legacy-only/new-only/mixed matrix 锁定一份 logical contribution，且测试 unload 后可重新 mount。
- [pnpm linker 在 registry/profile 中解析差异] → 以最终 pack tarball 和干净 profile 的真实 dsh plugin install 验证，不只在 workspace tsconfig 中测试。
- [composition preview 被重新吸收进 Ordo] → patch、package dependency、owner table 与 contract test 都断言它独立；缺席只能降级，不能复制事实。
- [ToolView 范围蔓延为控制台] → 首版仅保留模块位置，严禁注册 mutation；复杂 DAG/跨 run/证据比对仍交给 Workbench。
- [参考实现带来许可证或错误架构] → 默认不复制；任何复制先执行许可和禁止模型检查。

## Migration Plan

1. 在本 OpenSpec change 中冻结 package、patch、compatibility、owner 和验收合同；不在此阶段发布或删除 package。
2. 在 0.1.0-rc.7 中把 packages/bundle/ordo-agent-ops 变为完整双端 package，并将现有三项运行逻辑迁入该目录；根 bundle 名称不变。
3. 同一发布中将三个旧 leaf package 变为 thin compatibility shim，保留已有 export，记录一次弃用诊断，并为 legacy/new/mixed profile 添加 conformance matrix；composition preview 保持独立 package 与独立 row。
4. 在临时干净 profile 和已发布 candidate 上分别验证单条安装命令、bundle patch、Loader、Web client、/ordo 和无重复 mount。失败时停止发布，不以手动安装 leaf package 绕过。
5. 0.1.0-rc.7 完成后保留 shim 一个发布周期；实际删除旧 leaf package 的 proposal 必须另建 OpenSpec，并且不早于 0.1.0-rc.8。

Rollback 是恢复此前已发布、bundle-only 的 @yeisme/dsh-ordo-agent-ops 版本，并从 profile 移除候选的新版本。因为 Ordo facts、actions、数据库和用户数据均未被迁移，回滚不需要数据 reverse migration；任何已写入的 profile dependency 仅恢复为原 bundle release。

## Scope Change Log

| 输入能力 | 决策 | 理由 |
| --- | --- | --- |
| Host Remote、/ordo、sidebar 合并 | deliver-now | 三者是同一 Ordo Agent Ops 用户功能的不同运行面 |
| 单项 ToolView | retain-next | owner action/approval/receipt 合同尚未冻结，不能以 placeholder 伪造操作能力 |
| composition preview | retained as direct contract dependency | 独立 DSH facts owner；Ordo bundle 可安装并读取，但不能拥有或重发布其事实 |
| Anchored Standard | retained outside scope | 独立 preset 分发 package，不构成 Ordo 拆分问题 |
| 通用 UI kit | excluded | 尚未有三个插件证明稳定复用需求 |
| AionUI DOM/grid、FS/Git/SSE 模型 | rejected | 违反官方 DSH seam、Host safety 与 Ordo owner 边界 |

## Open Questions

无阻塞性产品或 owner 决策。实现开始前只需以目标 DSH 发布版本的真实 Loader/Web profile test 确认 unified package 的 client export 被发现；若该公开 seam 不满足，停止实现并回到 DSH owner，而不是引入 DOM patch 或私有 core API。

# DSH 插件开发工具链与使用体验深度设计（四波 Lane）

> 状态：设计定稿（2026-08-31，grill-me 三轮 12 问收敛；2026-09-01 增补 §6 推进 DAG 并判读 R8 硬门达成，Wave 1 启动）
> 用途：固化「dsh web 插件使用体验优化 + 插件开发完善」的决策、波次、验收与非目标；对应 OpenSpec 骨架
> `dsh-plugin-dev-toolchain-v1`（G18）、`dsh-web-real-data-self-owned-v1`（G19）、
> `dsh-web-command-entry-convergence-v1`（G20）、`dsh-plugin-consistency-coverage-v1`（G21）。

## 1. 决策记录（R1–R12）

| # | 决策 | 含义 |
| --- | --- | --- |
| R1 | 验收基准 = 自己 dogfood | 以个人日常使用流畅度为准；polish bar 低、快速迭代；不做对外稳定承诺 |
| R2 | 痛点四项全选 | 发现与入口、真实数据感、跨插件一致性、性能与稳定性全部纳入，靠 R5 排序消化 |
| R3 | 「完善插件开发」= 开发者体验基建 | 落地 AGENTS.md 已定义但 0 落地的 `packages/sdk\|tool\|catalog\|example` 四层 |
| R4/R8 | 纯设计 → 建新 change；在途先收尾 | 本设计只产出 change 骨架（tasks 不勾）；V3 系列收尾前不启动实现；不碰并行会话的 command-first 与 Lane B |
| R5 | 波次顺序 = 地基 → 真实数据 → 入口 → 一致性 | 稳定性与一致性共用同一 tool 层，第一波一次投入两用 |
| R6 | sdk = 内部一致性工具 | tool 层机械化 + sdk 内部类型契约 + contract 测试防漂移；不承诺对外 semver；catalog 薄做、example 只 1 个 |
| R7 | 真实数据先接自控链 | ordo/team-hub（本地 CLI）+ 官方已有 seam（token/session/model/用量）；做剧 adapter 第二波；upstream 基础 seam（fs/media/PTY）只跟进不承诺 |
| R9 | 观测门先行（默认，可反驳） | 用户暂无具体咬点清单 → 第一波建 dispose/HMR/泄漏 conformance 观测门，红灯驱动定点修；后续补清单可转定点修 |
| R10 | dogfood 主路径 = `pnpm dsh:dev` | 日常使用即持续回归；anchored-standard 作最小稳定集对照；安装体验由 ecosystem-consolidation 的 packed-profile conformance 覆盖 |
| R11 | 成功信号 | 主：连续 14 天日常使用无阻断故障（白屏/卡死/丢状态）+ 31 包机械化门禁零红灯；副：常用面板真数据率 ≥80% |
| R12 | 本会话产出 = 设计文档 + change 骨架 | tasks 全不勾，等 V3 收尾后启动实现 |

## 2. 事实基线（2026-08-31 已核）

- 包布局现状：host 20 / client 31 / bundle 31；`packages/sdk|tool|catalog|example` 在 AGENTS.md 有定义但磁盘 0 落地。
- 热开发链路已有：`pnpm dsh:dev`（构建+link 全部本地 bundle、HMR overlay、启动 DSH Web、增量重建）。
- 既有机械化门：`pnpm check:bundles`（ModuleLoader 单文件契约，14/14）；visual token 已有五个 web-surface 包分类基础（80e3382，ys-field 合同）。
- 在途 14 个 active change（V3 pane-workspace 49/58、productivity-ui 6/11、ordo-dsh-plugin-visualization 16/22 等）；`dsh-web-command-first-interaction-v1` 为并行会话产物（命令优先壳：Composer slash + 全局 Palette + 状态中枢）。
- 仓库红线：新 capability 只写 ADDED；tool 层只读 inspect 被测包；不建 scheduler/registry/遥测；safe projection 不出 cookie/token/raw URL/绝对路径。

## 3. 四波设计

### Wave 1 — 机械化地基（G18 / `dsh-plugin-dev-toolchain-v1`）

一次投入同时消化 R2 的「性能与稳定性」与「跨插件一致性」两层痛点的机制部分。

- 新建 `packages/tool/dsh-plugin-toolchain`，统一入口 `pnpm check:plugins`（收编 `scripts/check-bundle-contracts.mjs`，保留 `check:bundles` 别名）：
  - **declaration-lint**：校验 bundle 的 `dsh.bundle.patch` / `cordis.patch.yml` / `package.json` 三方一致性（包名、entry、依赖行只指向本仓插件行、workspace 边界）。
  - **safe-projection-audit**：静态扫描 host→client 导出面与 wire fixture；cookie/token/raw URL/绝对路径/任意 fetch 出投影即红灯。
  - **dispose-hmr-conformance**：mount/unmount/HMR 循环断言（事件监听器、定时器、ResizeObserver/MutationObserver、host 订阅释放）；把 V3 7.5 在 pane-workbench 上的 disposal 验证泛化为全包工具。R9 观测门主体。
  - **visual-token-conformance**：ui-visual-kit token 使用率与 ys-field 裸控件检测。
- 新建 `packages/sdk/dsh-plugin-contracts`（内部定位）：收口 31 包重复的 safe projection 类型、slot/capability probe helpers、dispose 合同；附 contract 测试防漂移（消费方类型与 sdk 声明不一致即红）。不承诺 semver，README 明示内部定位。
- tool 层只读 inspect 被测包、不改 source；报告落 `temp/toolchain-runs/<date>/`（脱敏同集成证据规则）。
- **验收**：`pnpm check:plugins` 对 31 包跑通并出基线报告；首跑允许既有红灯（量化基线），清零归 Wave 4 完成点。

**Wave 1 基线结论（2026-09-01 首跑，`temp/toolchain-runs/2026-09-01T014345901Z-toolchain/`）**：

| 检查器 | 覆盖 | 红灯 | 基线要点 |
| --- | --- | --- | --- |
| bundle-contract | 27 bundle | 0 | 收编后与 `check:bundles` 逐字等价（27/27 PASS） |
| declaration-lint | 30 bundle | 2 | `DECL/PATCH_MISSING`：dsh-browser-pane、dsh-file-document（属实，缺 cordis.patch.yml）；30 note（21 bundle→bundle、9 client→bundle 为既定组合形态记录，层规则按仓现实校准） |
| safe-projection-audit | 597 文件 | 12 | 10 处浏览器 storage 直访 + 2 处非本地 URL 字面量，全部为待 owner 复核观测点 |
| dispose-hmr-conformance | 449 文件 | 36 | 强信号项：session-tags provider/overlay×4、pane-workbench client.ts/region-chrome.ts 等无释放路径 host 订阅；G21 定点修复输入 |
| visual-token-conformance | 26 包 | 0 | surfaces 门（--allow-pending）不回退；token-rate 全量记基线，阈值化归 G21 |

合计基线红灯 50；sdk 契约包（projection/probe/dispose 三组）+ 三试点（ui-pane-domain、ui-next-step-suggestions、ui-session-tags）落地，纯类型层等价替换。首跑红灯量在 R9 预期范围内（观测门先行），清零轨迹以 G18 基线报告为对照归 G21。

### Wave 2 — 真实数据自控链（G19 / `dsh-web-real-data-self-owned-v1`）

消化「真实数据感」，只选自己可控的数据源（R7）。

- 先审计：盘点常用面板数据源现状（真数据 / 官方 seam 可接 / 静态投影），产出面板真数据率基线。
- ordo/team-hub：`ordo-agent-ops` host + `ui-ordo-agent-ops` 接本地 ordo CLI 真数据（run/task/approval/evidence/team）；只读安全投影，边界遵循 `ordo-dsh-plugin-visualization-v1` 冻结的能力；**起点依赖该 change 归档**。
- 官方已有 seam：token/session/model/用量面板全部接官方 seam 真数据（无 seam 处 probe 降级，不伪造）。
- **验收**：常用面板真数据率 ≥80%（面板清单：ordo/team-hub、token/session/model/用量、command-first 状态中枢投影）。

### Wave 3 — 入口收敛（G20 / `dsh-web-command-entry-convergence-v1`）

消化「发现与入口」，方式是消费并行会话成果而非重复造。

- **依赖**：`dsh-web-command-first-interaction-v1` 冻结/归档后启动；只消费其 command directory、反馈链与 Pane handoff 合同。
- 31 bundle 的散落 Modal/按钮入口 additive 注册进统一 slash+Palette 目录；旧入口保留 probe-first fallback，不复制实现、不移除既有 surface。
- **验收**：常用动作均可从 Palette/slash 发现并执行；目录贡献在插件热卸载后无陈旧行。

### Wave 4 — 一致性全覆盖 + 薄生态（G21 / `dsh-plugin-consistency-coverage-v1`）

- visual-token-conformance 铺满剩余包至零红灯（R11 主指标达成点）。
- `packages/catalog/dsh-plugin-catalog`：静态清单 + 本地查询工具；不建网络服务、无遥测。
- `packages/example/dsh-plugin-example`：1 个参考插件，展示 host+client+bundle 三层最小结构与 probe-first 降级写法。
- **验收**：`pnpm check:plugins` 31 包零红灯；catalog 覆盖全部可安装 bundle；example 可在干净 profile 安装运行。

## 4. 验收总口径（R11）

- **主指标**：连续 14 天日常使用无阻断性故障（白屏/卡死/丢状态）+ 31 包 `pnpm check:plugins` 零红灯。
- **副指标**：常用面板真数据率 ≥80%。
- 观测口径：阻断故障以 dogfood 记录为准；门禁红灯以 toolchain 报告为准。

## 5. 非目标

- 不做对外插件作者平台、不承诺 sdk semver（R6）。
- 不接管、不修改并行会话的 command-first change；Wave 3 只消费其产物（R4）。
- 不在本设计会话启动任何 Wave 实现（R8）。
- 不等待、不承诺 upstream seam（fs/media/PTY）合入；upstream 跟进继续走既有 canary/pr-rebase 自动化（R7）。
- 不建 registry、遥测或网络服务。

## 6. 推进 DAG（2026-09-01 定稿）

19 个在途 change 全景分为三类，本 lane 只推进第三类：

### 6.1 并行会话所有（本 lane 禁改）

- `dsh-tui-command-first-interaction-v1`（0/33）、`dsh-web-command-first-interaction-v1`（0/32）：命令优先壳 lane 的产物，含新包 `ui-command-experience-tui/web`。冻结/归档后解锁 Wave 3（G20）。

### 6.2 外部停车区（无本地可派工，保持 active 不归档）

| change | 进度 | 停车键 |
| --- | --- | --- |
| dsh-pane-workspace-experience-v3 | 49/58 | 剩 9 项全外部：7.1/7.2 官方 seam、7.3 真实 peer 抬升、4.8/8.2 尾随 seam、8.3/8.4 实机浏览器、8.5/8.7 汇合归档 |
| dsh-workspace-productivity-ui-v3 | 6/11 | 1.3/1.4 upstream-prs 系列、2.1/2.4 官方 Agent Note、3.2 V3 handoff evidence |
| ordo-dsh-plugin-visualization-v1 | 16/22 | 6 项 external/retain-next：Ordo owner 事件源 + 官方 profile/browser evidence + Workbench parity fixtures |
| dsh-plugin-package-consolidation-v1 | 14/19 | 3.1 composition package（外部 owner 发布）→ 5.1–5.4 链 |
| dsh-plugin-ecosystem-consolidation-v1 | 3/6 | composition artifact + 官方 browser evidence |
| dsh-workbench-compose-v1 | 16/19 | 6.1 ctx.fs/attachments/terminals seam、6.3 官方宿主 slot、6.4 ArtifactRef seam |
| dsh-rich-media-plugin-v1 | 23/27 | 4.2/4.5/4.6 官方 slot、6.1 媒体附件 seam |
| dsh-file-document-v1 | 9/10 | 5.1 真实 fs/文档 seam |
| dsh-long-term-history-global-search-v1 | 11/14 | handoff-only，等 DSH Agent Notes accepted |
| dsh-session-tags-grouping-v1 | 17/18 | 6.2 用户一键 upstream PR / classic PAT |
| dsh-git-agent-review-workbench-v1 | 17/18 | 3.5 ordo/Git owner 双 receipt |
| dsh-ordo-command-interaction-v1 | 5/8 | 2.1 独立 composition owner + qualify 合同 → 4.1/4.2 链 |
| dsh-mcp-inspector-v1 | 6/7 | 3.1 用户确认留待专门会话（upstream-prs/mcp-inventory） |

### 6.3 本 lane 推进 DAG

```
（R8 硬门已达成，见 6.4 论证）
W1/G18 dsh-plugin-dev-toolchain-v1 (0/19) ──归档+基线报告──► W4/G21 consistency-coverage (0/10)
   │                                             │
   │ 排序（R5）                                  │ 硬门②：ordo-viz 归档（ordo 部分 §2）
   ▼                                             ▼
W2/G19 real-data-self-owned (0/10)          W3/G20 command-entry-convergence (0/8)
   §1 审计 + §3 官方 seam 面可在 W1 后启动        硬门③：command-first 冻结（只消费不碰）
   §2 ordo 面等 ordo-viz 归档
```

### 6.4 R8 硬门达成判读（W1 启动依据）

R8 要求 DX 实现排队于「在途 V3 系列收尾」之后，目的是避免与在途 V3 实现竞争包接触与门禁。2026-09-01 核验：V3 两 change 的本地实现已尽——`dsh-pane-workspace-experience-v3` 49/58（剩 9 项全部为官方 seam/实机浏览器/汇合归档类外部门，8.1 已收），`dsh-workspace-productivity-ui-v3` 6/11（剩 5 项全部 blocked 于 upstream-prs/官方 Agent Note/V3 handoff evidence）。V3 lane 已无可做的本地实现任务，与 Wave 1（新包 packages/tool|sdk + scripts 入口）无包接触重叠；硬门的竞争规避目的已经满足，W1 启动。若 V3 因外部 seam 到岗重启本地波次，Wave 1 让行。

## 7. 风险与缺口

- **R9 为默认假设**：观测门若漏掉真实咬点，需用户补充现象清单转定点修（grill-me 可反驳项）。
- **Wave 3 节奏外部制约**：受 command-first 冻结时间影响，波动直接传导 G20。
- **首跑红灯量未知**：31 包 conformance 基线红灯量未探测，Wave 1 验收以「跑通+基线报告」为界，清零量归 Wave 4 评估。
- **跨 lane 包接触**：Wave 2 会改 ordo-agent-ops 相关包，与在途 ordo visualization change 存在包重叠；以「该 change 先归档」为硬门。

## 8. 四波收口结论（2026-09-02）

| Wave | change | 状态 | 结论 |
| --- | --- | --- | --- |
| W1/G18 | dsh-plugin-dev-toolchain-v1 | 已归档（2026-09-01） | 五检查器 + 基线报告落地；`pnpm check:plugins` 成为机械化门禁入口；基线 50 红（dispose 36、safeproj 12、decl 2、visual-token 0）。 |
| W2/G19 | dsh-web-real-data-self-owned-v1 | 已归档（2026-09-02） | 审计账本 + SessionManagerHostV1 官方 seam 生产接线，真数据率 40%→50%；ordo 两面板按 DAG 等 ordo-viz 归档。 |
| W3/G20 | dsh-web-command-entry-convergence-v1 | 已归档（2026-09-02） | 入口收敛消费 command-first 冻结产物；command-first 三 change（web/tui command-first、real-data）全归档，其包面随之解冻。 |
| W4/G21 | dsh-plugin-consistency-coverage-v1 | 进行中（5/10） | catalog/example 两新包落地；红灯 50→16（2026-09-01）→9（2026-09-02，含 VT 回归清零）；余 9 项全部位于四个在途 lane 禁改包（dsh-terminal 3、ui-interaction-space 2、ordo-agent-ops 2、dsh-rich-media 2），清零条件 = 对应 lane 冻结（见 change tasks 1.2/1.3 归属记录）。 |

- 清零轨迹对照 G18 基线：dispose 36→8、safeproj 12→1、decl-lint 2→0、visual-token 0→0（09-02 曾因新增包 ui-session-status 未分类回红 1，当日补分类清零）；bundle-contract 全程 0。
- 14 天 dogfood 观测（R11 主指标）：窗口 2026-09-01 起，观测记录以 `temp/toolchain-runs/<ts>-toolchain` 门禁报告序列为准（每日收口跑 `pnpm check:plugins` 落盘）；窗口未满，结论以窗口末报告为准。

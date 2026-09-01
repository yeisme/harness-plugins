# dsh-plugin-toolchain Capability

DSH 插件聚合仓库的机械化开发工具链：统一 `pnpm check:plugins` 入口、四类检查器、只读 inspect 边界与基线报告语义。

## ADDED Requirements

### Requirement: check:plugins SHALL 作为统一检查入口且保持 check:bundles 兼容
系统 SHALL 提供单一命令 `pnpm check:plugins` 顺序执行 declaration-lint、safe-projection-audit、dispose-hmr-conformance、visual-token-conformance 与 bundle 产物合同检查，并对 `packages/host`、`packages/client`、`packages/bundle` 全部包产出逐包结果。既有 `pnpm check:bundles` MUST 保持为可用别名且行为不回退。

#### Scenario: 单命令全量检查
- **WHEN** 在仓库根执行 `pnpm check:plugins`
- **THEN** 全部 host/client/bundle 包 SHALL 逐包产出五类检查结果与汇总退出码
- **AND** 任一检查器内部错误 SHALL 与「检查发现红灯」区分报告，不得互相吞并

#### Scenario: 旧别名保持兼容
- **WHEN** 在仓库根执行 `pnpm check:bundles`
- **THEN** 输出 SHALL 与收编前的 bundle 合同检查语义一致
- **AND** CI 中对该命令的既有引用 SHALL 不需要修改

### Requirement: declaration-lint SHALL 校验三方声明一致
declaration-lint SHALL 对每个 bundle 校验 `dsh.bundle.patch`、`cordis.patch.yml` 与 `package.json` 的相互一致：包名与 entry 对应、依赖行只指向本仓插件行或允许的外部依赖、workspace 边界不越层引用。发现不一致 MUST 输出文件与行级定位。

#### Scenario: 依赖行指向不存在的插件行
- **WHEN** 某 bundle 的 `dsh.bundle.patch` 引用了未在本仓发布的插件行
- **THEN** declaration-lint SHALL 对该包记红灯并输出引用位置
- **AND** 汇总报告 SHALL 列出该包名与违反的声明文件

### Requirement: safe-projection-audit SHALL 红线扫描 host→client 导出面
safe-projection-audit SHALL 静态扫描 host 包导出类型、wire projection 与 fixture：cookie、token、raw URL、绝对文件路径或任意 fetch 能力出现在投影面即红灯。扫描 MUST 只读 inspect 被测包 source，不修改任何被测文件。

#### Scenario: 投影类型泄露凭据形状字段
- **WHEN** 某 host 包导出的 projection 类型包含凭据形状字段或 raw URL 字段
- **THEN** safe-projection-audit SHALL 记红灯并指出类型名与字段
- **AND** 报告 MUST NOT 把该字段值写入任何输出（只报告形状定位）

### Requirement: dispose-hmr-conformance SHALL 断言资源释放
dispose-hmr-conformance SHALL 对每个 client 包执行 mount/unmount 与 HMR 循环断言：事件监听器、定时器、ResizeObserver/MutationObserver 与 host 订阅在 dispose/热替换后全部释放。断言 SHALL 以通用 harness 驱动（V3 7.5 pane-workbench 模式泛化），逐包给出释放明细。

#### Scenario: 热替换后残留订阅
- **WHEN** 某插件面板在 HMR 热替换后仍持有 host 订阅未释放
- **THEN** dispose-hmr-conformance SHALL 记红灯并列出未释放订阅标识
- **AND** 该结果 SHALL 出现在基线报告中供后续波次定点修复

### Requirement: 首跑 SHALL 产出基线报告且既有红灯不阻塞
首次全量运行 SHALL 在 `temp/toolchain-runs/<date>/` 产出基线报告（逐包逐检查器结果、红灯计数与定位），报告内容遵循集成证据脱敏规则。本 capability 的验收 SHALL 以「31 包跑通 + 基线报告产出」为界；既有红灯只量化记录，红灯清零由 `dsh-plugin-consistency-coverage-v1` 承接。

#### Scenario: 基线报告落盘
- **WHEN** `pnpm check:plugins` 首次对全部包跑通
- **THEN** `temp/toolchain-runs/<date>/` SHALL 存在含全部包逐项结果的基线报告
- **AND** 报告 SHALL 不含 secret、raw prompt、provider payload、private tool arguments、绝对路径与完整思维链

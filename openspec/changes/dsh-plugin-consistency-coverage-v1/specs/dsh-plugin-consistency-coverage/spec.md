# dsh-plugin-consistency-coverage Capability

一致性全覆盖收口：门禁红灯清零、静态 catalog 薄做与单个参考插件。

## ADDED Requirements

### Requirement: check:plugins SHALL 对全部包零红灯
`pnpm check:plugins` SHALL 对 31 个包（host/client/bundle 全集）产出零红灯结果：visual-token-conformance 无裸控件与 token 违规，dispose-hmr-conformance 无未释放资源，declaration-lint 与 safe-projection-audit 无违规。已分类 web-surface 包 SHALL 不回退。

#### Scenario: 零红灯验收
- **WHEN** 在仓库根执行 `pnpm check:plugins`
- **THEN** 汇总退出码 SHALL 为绿且逐包结果零红灯
- **AND** 报告 SHALL 与 G18 基线对照展示红灯清零轨迹

### Requirement: catalog SHALL 为静态清单且无网络服务
`packages/catalog/dsh-plugin-catalog` SHALL 提供覆盖全部可安装 bundle 的静态清单与本地查询工具。它 MUST NOT 启动网络服务、MUST NOT 收集遥测、MUST NOT 成为第二 package registry；清单数据 MUST 由构建工具从仓库包生成而非手写。

#### Scenario: 清单覆盖全部可安装 bundle
- **WHEN** 构建 catalog 清单
- **THEN** 全部 `packages/bundle/*` SHALL 各有一条目（名称、描述、安装路径、依赖插件行）
- **AND** 新增 bundle 后重建清单 SHALL 自动包含而不需手工登记

### Requirement: example SHALL 为单个可安装参考插件
`packages/example/dsh-plugin-example` SHALL 以单个参考插件展示 host+client+bundle 三层最小结构与 probe-first 降级写法，并可在干净 web profile 经 `dsh plugin add` 安装运行。example MUST NOT 接管 core state 或引入额外运行时依赖。

#### Scenario: 干净 profile 安装运行
- **WHEN** 在干净 web profile 安装 example bundle 并启动
- **THEN** 示例面板与命令 SHALL 正常出现
- **AND** 模拟 seam 缺失时 SHALL 显示禁用与原因而非死按钮

### Requirement: 红灯修复 SHALL 保持行为等价
为清零门禁红灯对既有包的修改 SHALL 保持用户可见行为等价或 additive（视觉 token 替换、资源释放补齐）；MUST NOT 借一致性修复改名、移除或语义变更既有 surface。

#### Scenario: token 替换不改变语义
- **WHEN** 某包裸控件按 ys-field 合同替换为 visual-kit 组件
- **THEN** 该控件的交互语义与可达性 SHALL 保持
- **AND** 相关包测试 SHALL 全绿

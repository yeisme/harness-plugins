# dsh-web-command-entry-convergence Capability

31 个 bundle 的命令性入口向统一 slash+Palette 目录的 additive 收敛：注册合同、fallback、热卸载与统一反馈。

## ADDED Requirements

### Requirement: 散落入口 SHALL 完成盘点并 additive 注册进统一目录
每个 bundle 的命令性动作（Modal 专属动作、面板按钮命令、面板局部状态入口）SHALL 以盘点清单登记，并按 command-first 目录合同 additive 注册（canonical id、alias、可用性、禁用原因、danger、handler owner）。注册 MUST NOT 复制第二份命令注册表或第二交互壳。

#### Scenario: 面板按钮动作可从 Palette 发现
- **WHEN** 某插件面板存在「执行 X」按钮动作且已完成收敛
- **THEN** 该动作 SHALL 可从 slash Assist 或全局 Palette 以同一 canonical id 发现并执行
- **AND** 执行结果 SHALL 进入统一反馈链而非插件局部 toast 专属通道

### Requirement: 旧入口 SHALL 保留 probe-first fallback
收敛后旧 Modal/按钮入口 SHALL 保持可用：统一目录 seam 缺失或插件未注册时旧路径 MUST 继续工作；收敛 MUST NOT 移除或重命名既有 surface。

#### Scenario: 目录 seam 缺失时旧入口兜底
- **WHEN** command-first 目录 seam 在当前 profile 不可用
- **THEN** 已收敛插件的旧按钮/Modal 入口 SHALL 继续可用
- **AND** MUST NOT 出现动作两边都不可达的死路径

### Requirement: 热卸载 SHALL 不留陈旧目录行
插件卸载或热替换后，其贡献的目录行 SHALL 随目录 revision 同步移除；MUST NOT 留下可点击的陈旧行或指向已释放 handler 的贡献。

#### Scenario: 收敛插件热卸载
- **WHEN** 已收敛插件被卸载并发布新目录 revision
- **THEN** 其全部目录贡献 SHALL 从 slash 与 Palette 同时消失
- **AND** 旧入口 fallback 不因卸载报错

### Requirement: 收敛 SHALL 以清单验收覆盖全部命令性入口
入口盘点清单 SHALL 作为验收账本：每个命令性入口标注已收敛（canonical id）/无命令语义（纯面板交互）/豁免（原因）。验收时已收敛 + 豁免 SHALL 覆盖清单全集。

#### Scenario: 清单闭环
- **WHEN** 本 change 归档评审
- **THEN** 盘点清单 SHALL 无未处理条目
- **AND** 每个已收敛条目 SHALL 附从 Palette 执行成功的验证记录

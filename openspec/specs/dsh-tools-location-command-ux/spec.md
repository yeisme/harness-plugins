# dsh-tools-location-command-ux Specification

## Purpose
TBD - created by archiving change dsh-tools-location-command-ux-v1. Update Purpose after archive.
## Requirements
### Requirement: 准确且可辨认的调用定位
系统 SHALL 使用会话与调用的稳定owner引用完成定位，并明确标记目标Pane和原调用记录，不以滚动或focus本身替代可见反馈。

#### Scenario: 多Pane中的同名工具
- **WHEN** 用户从会话A的工具详情定位一条bash调用，B也有bash调用
- **THEN** 系统 SHALL 激活A的Chat并标记准确的调用记录，不改变B的绑定、选择和滚动

#### Scenario: 连续定位与失败
- **WHEN** 用户连续定位两条不同调用，或第二条已不可访问
- **THEN** 成功定位 SHALL 替换前一当前目标标记；失败 SHALL 保留详情并解释原因，不标记相邻行

### Requirement: 安全执行摘要
Tools SHALL 展示owner-authored有界脱敏执行摘要；MUST NOT 直接把完整arguments、argsRaw、脚本正文或result作为详情内容。

#### Scenario: 可安全展示的Shell命令
- **WHEN** owner提供已脱敏的实际命令摘要
- **THEN** 详情 SHALL 在代码区显示命令、脱敏/截断状态，与该调用的时间、状态和耗时相邻

#### Scenario: 凭据与复杂脚本
- **WHEN** 命令含凭据、敏感URL、环境值、秘密文件引用或无法可靠审查的内联脚本
- **THEN** owner SHALL 隐去相关片段或省略摘要，并提供安全原因；脱敏必须先于600字符显示截断

#### Scenario: 旧记录没有摘要
- **WHEN** 记录没有可用安全摘要
- **THEN** UI SHALL 明示缺失并保留可用定位入口，不猜测命令、不解析整包私有参数兜底

### Requirement: 一致的选择与密度
Tools SHALL 使用现有Pane视觉token，保护标题可读性，统一列表/时间线整行选中态，并让选中详情与主内容形成清晰层次。

#### Scenario: 窄Pane和长标题
- **WHEN** Pane宽度360px或页面缩放200%，且标题和统计很长
- **THEN** 标题不得被挤成零碎单字，关键动作仍可访问，详情内容不得导致全页横向溢出

#### Scenario: 时间线选择
- **WHEN** 用户选中一条时间线调用
- **THEN** 名称、轨道和状态的整行 SHALL 呈现统一选中态；真实耗时与成功/失败语义不变

### Requirement: 不引入执行副作用
本补充 SHALL 仅提供查看、导航和安全呈现，不增加工具重试、重新执行或完整原始参数导出。

#### Scenario: 查看命令和定位
- **WHEN** 用户展开详情、查看摘要或定位原消息
- **THEN** 系统 SHALL 不执行任何工具、不修改原会话日志、不改变其他Pane的会话绑定

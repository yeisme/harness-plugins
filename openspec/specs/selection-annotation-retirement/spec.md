# selection-annotation-retirement Specification

## Purpose
TBD - created by archiving change dsh-selection-annotation-retirement-v1. Update Purpose after archive.
## Requirements
### Requirement: Retired bundle is inert
旧选区批注bundle SHALL 不再挂载选区工具条、监听器或composer。

#### Scenario: Old configuration loads the bundle
- **WHEN** 残留配置调用旧bundle apply并选择文本
- **THEN** 不创建工具条、样式或批注框，原生选区保留

### Requirement: Preserve data and unrelated Pane capabilities
退役 SHALL 保留已有会话、草稿和引用，交互空间Pane不再自动挂载已退役工具条。

#### Scenario: Active profile removes annotation plugin
- **WHEN** 从web或ui-acceptance卸载选区插件
- **THEN** 插件依赖与bundle项移除，不删除持久用户数据

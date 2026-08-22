## ADDED Requirements

### Requirement: 会话内 mermaid 渲染
系统 SHALL 在 DSH Web 会话中把已稳定的 mermaid fence 渲染为内联 SVG 图，且源码保留可回看。

#### Scenario: settle 后渲染
- **WHEN** assistant 消息含 ```mermaid``` fence 且内容稳定（流式结束）
- **THEN** fence 位置渲染 mermaid SVG，原代码块隐藏但可一键回看

#### Scenario: streaming 不闪图
- **WHEN** 消息仍在流式输出、fence 内容持续变化
- **THEN** 保持纯文本代码块，不发起渲染

#### Scenario: 渲染失败降级
- **WHEN** mermaid 源非法或渲染抛错
- **THEN** 显示原代码块与错误提示，不白屏、不丢源码

### Requirement: 增量与可还原
插件 MUST NOT 修改宿主 markdown 管线输出内容，且一切改动 SHALL 可随插件卸载完全还原。

#### Scenario: 卸载还原
- **WHEN** 插件 dispose
- **THEN** 移除全部注入元素/样式/class/display 改动，会话 DOM 回到宿主原样

#### Scenario: 无 mermaid 零开销
- **WHEN** 会话不含 mermaid fence
- **THEN** 不加载 mermaid 运行时、不改变任何消息渲染

### Requirement: 安全
插件 SHALL 以 strict 安全级运行 mermaid，并只注入经白名单净化的 SVG。

#### Scenario: 敌意源净化
- **WHEN** 渲染不可信 assistant 产出的 mermaid 源
- **THEN** SVG 经白名单净化后注入，无脚本/外链/事件属性，无网络请求，mermaid 代码本地打包（无 CDN/外部 URL）

### Requirement: 交付与安装
bundle SHALL 以独立可卸载的 profile patch 行交付。

#### Scenario: 本地安装
- **WHEN** 用户执行 `dsh plugin --profile web add ./packages/bundle/dsh-mermaid-render`
- **THEN** web profile 增加一行可独立卸载的 patch 行

#### Scenario: 卸载
- **WHEN** 用户移除该 profile 行
- **THEN** 会话渲染回到宿主默认，无残留样式或 DOM 改动

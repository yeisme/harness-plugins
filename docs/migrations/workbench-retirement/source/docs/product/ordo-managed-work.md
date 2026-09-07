# Workbench 中的 Ordo 托管工作

状态：已规划，消费链与真实Ordo验收待完成。[Owning change](../../openspec/changes/workbench-ordo-managed-work-v1/design.md)。

独立Ordo网页可以单独安装；Workbench提供既有/agent主壳内的registered工作Pane，保留Chat/composer与单一context rail。它只消费Ordo概览、Agent关系、时间线、候选和受控动作，不复制执行状态。

## 用户路径

现有项目/session→委托草案→确认范围/额度→工作概览→展开分工/时间线→Review候选→成果owner采用。关闭Pane或切session不会cancel。独立网页与Workbench观察同一个work/run；control变化只限制新的界面操作。

## 合同与旧能力

[Ordo managed provider](../../../../agent/ordo/openspec/changes/ordo-managed-work-experience-v1/design.md)提供新合同；旧Team control的exact-plan批准和read-only scope保留。chat/session/access grant不能代替managed授权。Browser只经WorkbenchClient/BFF/TaskService，owner凭据留在服务端。

通用Ordo adapter归新consumer task2.1；Text Development task2.4保留领域接线与验证，7.x继续拥有文本Team deck/simulation/canary与Auctra候选规则。新Pane使用本地design-system，跨客户端共享语义和fixtures，不引入独立网页的React/CSS或iframe。

## 实现与验收

[UI与信任链](../../openspec/changes/workbench-ordo-managed-work-v1/design.md)、[Tasks](../../openspec/changes/workbench-ordo-managed-work-v1/tasks.md)。重点selectors：WB-OMW-CONTRACT、WB-OMW-PARITY、WB-OMW-RECOVERY、WB-OMW-UI、WB-OMW-LEGACY。

平台和runtime成熟度由Ordo提供；本consumer另验SDK/BFF、浏览器、真实owner和双入口，不继承provider之外的ready声明。capability缺失显示needs_contract，unknown只对账原operation；关闭新capability不遗弃原accepted任务。

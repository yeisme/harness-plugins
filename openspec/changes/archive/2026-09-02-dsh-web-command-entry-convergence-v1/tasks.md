> 状态：骨架（2026-08-31 设计定稿；硬门 = `dsh-web-command-first-interaction-v1` 冻结/归档，且排队于 G19 之后；全任务未启动）。

## 1. 入口盘点

- [x] 1.1 盘点 31 个 bundle 的命令性入口（Modal 动作、面板按钮命令、局部状态入口），产出入口清单账本（canonical id / 无命令语义 / 豁免三态）。
- [x] 1.2 与 command-first 目录合同对齐注册字段映射（canonical id、alias、可用性、禁用原因、danger、handler owner）。

## 2. 逐包 additive 收敛

- [x] 2.1 按清单分批把插件入口注册进统一 slash+Palette 目录；执行反馈接统一 receipt/Activity 链。
- [x] 2.2 每个收敛包保留旧入口 probe-first fallback；验证目录 seam 缺失时旧路径继续可用、无死路径。
- [x] 2.3 验证热卸载/热替换后目录无陈旧行、fallback 不报错。

## 3. 验证与证据

- [x] 3.1 清单闭环：全部条目已收敛或显式豁免，每条已收敛条目附 Palette 执行成功记录。
- [x] 3.2 相关包 `pnpm run typecheck && test && build` 全绿；openspec validate strict 通过。
- [x] 3.3 dogfood 主路径实测从 Palette 完成一次跨插件工作流（发现 → 执行 → 看结果），证据落 temp/integration-test-runs/。

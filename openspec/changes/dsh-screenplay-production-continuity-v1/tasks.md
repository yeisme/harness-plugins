# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [x] 1.1 核实制作对象、Auctra/Scaena合同与原画布保存入口，冻结兼容与owner边界。 | evidence: design.md已核实Creator Studio画布唯一写者、Auctra恢复draft客户端、Scaena表编辑与草稿/正式制作包入口及Ordo未串联边界；源码盘点不冒充真实闭环。
- [ ] 2.1 接通嵌入画布与Creator Studio唯一读写owner；验证scope、缺席降级、保存重开。 | evidence: Creator Studio三方法整组probe，Pipeline只委托同一owner，30项定向测试含实际ProjectCanvasStore保存重开且无重复save；真实宿主双Pane验收未关闭。
- [x] 2.2 修复3D保存期间继续编辑的dirty与revision回执；验证未知后对账及再次保存。 | evidence: Scene3DController按提交editCount判断后续编辑，旧回执只推进revision；3D client 98项通过，集成证据temp/integration-test-runs/3d-director-20260913-043329-3010926。
- [ ] 3.1 剧本固定版本、分镜草案差异确认及Scaena表编辑接线。
- [ ] 3.2 镜头/画布/Inspector选择与专业Pane固定引用联动、候选采用回填。 | evidence: 本次补齐画布编辑/undo到窄屏对象列表同步、负坐标媒体拖入；30项Pipeline定向通过。专业Pane固定对象交接和采用回填仍未完成。
- [ ] 3.3 Scaena草稿/正式制作包导出和重开恢复。
- [ ] 4.1 协商并实现3D预演镜头和关键帧持久化，不改变旧scene严格合同。 | evidence: 新增协商sceneWorkbenchRead/saveSceneWorkbench，复用原documents存储及CAS/journal/receipt；旧scene严格输出不变，关键帧恢复/提交丢失/外项目/重复shot验证通过。Host59项/client98项；最终浏览器、历史预演回滚与原生宿主恢复仍待核验。
- [ ] 5.1 一个项目两场景六镜头真实本地owner完整流程与故障恢复；记录fixture/real层级。
- [ ] 5.2 稳定后完成所属项目质量门、三宽度/IME/缩放及300混合节点持续性能验收。 | evidence: 本次增量全仓build/typecheck通过，protocol41、3D Host59/client98、工作台307项包测试及后增保存重开30项定向通过；9工作台+4导演台浏览器场景通过，check:plugins/check:surfaces绿。主流程、真实IME/浏览器缩放及300混合节点持续性能仍待。证据3d-director-20260913-043910-3070350、ui-visual-2026-09-13T04-37-53-676Z-3057992、ui-visual-2026-09-13T04-38-12-361Z-3052036。

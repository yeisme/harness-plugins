# Upstream provenance

本 Skill 参考以下 MIT 项目的公开机制：

- Repository: `https://github.com/mattpocock/skills`
- Reviewed commit: `6654f6b60cd9d5be8b54c6fafe44346dabeb3b76`
- Upstream modules: `skills/productivity/grill-me`、`skills/productivity/grilling`
- License: MIT, Copyright (c) 2026 Matt Pocock

Yeisme 适配差异：

- 将一行 wrapper 与底层访谈原语合并为一个自包含 `grill-me`，避免跨 Skill 加载失败。
- 保持显式调用，不因普通产品、架构或开发请求自动启动。
- 未经当前用户明确授权，不创建子 Agent；事实改由当前 Agent 内联查证。
- 保持无状态、默认不写文件、共享理解确认前不实施。
- 创作生产主题交给 Yeisme 的 `creative-grill-me` / `creative-grilling`。

更新时先比较上游变化，再人工吸收适用机制；不要自动跟随 `main` 或未经审阅替换本地权限边界。

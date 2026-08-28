# dsh-slash-directory-hotplug-v1

Live `/` directory for common inspect commands (`/mcp` `/skills` `/plugins` `/pane`) plus pane hot-plug slash contributions. Pane plugins publish launcher or `slash.name` short names without editing command-experience.

Artifacts: `proposal.md`, `design.md`, `tasks.md`, `specs/dsh-command-experience/spec.md`, `specs/pane-protocol/spec.md`.

2026-08-28 集成加固（design §D5 / tasks §5）：host 面改 wait-for `inject: ['commands']`、官方拥有名（goal/plan）永不投影 + 注册前 `find()` 让位、插件清单改投影 `ctx.loader.entries()`。真机证据：临时最小 profile `/plugins` 持久 command/run|done；真实 web profile `/` 菜单全量 + `/mcp` success。

# @yeisme/dsh-anchored-standard

可安装的 DSH profile bundle：把 Anchored Standard / Zero-Anchored Standard /
Whoami Standard 三个实验预设作为插件子项目集成到 Yeisme harness-plugins。

## 安装

    dsh plugin --profile web add @yeisme/dsh-anchored-standard
    # 本地 checkout：
    dsh plugin --profile web add ./packages/bundle/anchored-standard

安装后重启 DeepSeek Harness，新建空白会话，即可在预设列表中选择：

- Anchored Standard (experimental)
- Zero-Anchored Standard (experimental)
- Whoami Standard (experimental)

## 行为

bundle 插入 host 插件 `@yeisme/dsh-host-anchored-standard`。该插件在 DSH 启动时
把内置的三个 preset 目录复制到 `$DSH_HOME/.agent-presets/`；已存在时不覆盖。

## 来源

上游项目：[xiaobright/dsh-anchored-standard](https://github.com/xiaobright/dsh-anchored-standard)
（MIT）。`zero-anchored-standard` 与 `whoami-standard` 的共享模块引用已从上游的
`../preset/` 调整为 `../anchored-standard/`，使三个 preset 可以独立安装。

# Design

拷贝根模板，cron `37 5 * * 1`。只跑 OSV，不引入 Go 扫描器。

```mermaid
flowchart LR
  weekly[Monday OSV] --> artifact[SARIF]
  ci[Existing CI] --> typecheck[typecheck/test/build]
```

# @yeisme/dsh-client-ui-surface

Yeisme DSH Web 的共享内容组合层。它位于官方 `@deepseek-ai/dsh-client-ui-primitives` 原子控件与 `@yeisme/dsh-client-ui-visual-kit` token/fallback 之上，只统一 pane、workspace、inspector、dialog 和 micro surface 的骨架。

## 使用

```tsx
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  Surface,
  SurfaceActionBar,
  SurfaceContextBar,
  SurfaceSection,
  SurfaceState,
} from '@yeisme/dsh-client-ui-surface'

export function RepositoryPane() {
  return (
    <Surface kind="navigator" aria-label="Repository">
      <SurfaceContextBar context="Repository" actions={<Button size="sm">Refresh</Button>} />
      <div className="ys-body">
        <SurfaceSection title="Changes">
          <SurfaceState phase="empty" title="Working tree clean" />
        </SurfaceSection>
      </div>
      <SurfaceActionBar>...</SurfaceActionBar>
    </Surface>
  )
}
```

## 约束

- 不从本包重导出 Button、Input、Modal、Menu、Pill、StateDot 或 DiffBlock；直接使用官方 primitives。
- 原生 `select`、`textarea` 放在 `.ys-field` 中；业务包可保留自己的历史 class。
- 布局响应由 surface container query 控制，不得据此改变 mutation、approval 或 permission admission。
- `navigator|workspace|inspector|dialog|micro` 是内容姿态，不接管宿主 Pane/AppFrame 几何。

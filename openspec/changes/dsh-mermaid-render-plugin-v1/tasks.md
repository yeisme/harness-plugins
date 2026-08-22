## 1. 规格

- [x] proposal.md：why/what/ledger
- [x] design.md：挂载点决策、交付约束、安全、降级、Track 2 seam 规格
- [x] specs/dsh-mermaid-render/spec.md：需求与场景

## 2. client package（packages/client/ui-mermaid-render）

- [x] package.json（dsh.client manifest、peer/dev deps、mermaid 依赖）
- [x] tsconfig.json / tsdown.config.ts（CJS ModuleLoader 包装、mermaid 懒加载）
- [x] src/index.ts host 面 no-op
- [x] src/client/index.ts apply/dispose/kill-switch
- [x] src/client/observer.ts 稳定门 + 嫁接 + 自愈 + 清理
- [x] src/client/render.ts mermaid 懒加载 + strict 初始化 + 缓存 + 主题
- [x] src/client/sanitize.ts SVG 白名单净化
- [x] src/client/locales.ts zh/en 文案
- [x] tests/unit：anchor、stabilize、graft、error、toggle、dispose、theme
- [x] tests/integration：apply 生命周期

## 3. bundle package（packages/bundle/dsh-mermaid-render）

- [x] package.json + cordis.patch.yml + src（host no-op / client 再导出）+ README

## 4. 验证

- [x] pnpm install（新包接入 workspace）
- [x] vitest 全绿（unit + integration）
- [x] tsc typecheck + tsdown build 通过；client.js 无外部 URL、mermaid 为懒工厂
- [x] 真实 mermaid 冒烟（jsdom + getBBox stub 渲染样例图为 SVG）
- [x] dsh plugin --profile web add 本地安装 + dump-config 出现行
- [ ] 真实浏览器视觉验收（retain-next，无浏览器通道）

import { vi } from 'vitest'

// Node-only contract tests do not load the host package's unrelated KaTeX CSS.
// The browser fixture supplies the same semantic Button boundary.
vi.mock('@deepseek-ai/dsh-client-ui-primitives', async () => {
  const { createElement } = await import('react')
  return { Button: (props: import('react').ButtonHTMLAttributes<HTMLButtonElement>) => createElement('button', props) }
})

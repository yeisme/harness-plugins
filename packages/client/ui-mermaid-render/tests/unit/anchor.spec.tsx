// @vitest-environment jsdom
/**
 * 锚点回归测试：用真实宿主 CodeBlock 钉死两种 fence 形态的识别。
 * 上游改 DOM 结构时这里先红，graft 层再迁 seam。
 */
import { render } from '@testing-library/react'
import { CodeBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import { findMermaidFenceCodes } from '../../src/client/observer.ts'
import { describe, expect, it } from 'vitest'

describe('mermaid fence anchor', () => {
  it('settled CodeBlock: md-code-block card with lang label is found', () => {
    const { container } = render(<CodeBlock code={'graph TD\nA-->B'} lang="mermaid" />)
    expect(container.querySelector('div.md-code-block pre > code')).not.toBeNull()
    const found = findMermaidFenceCodes(container)
    expect(found).toHaveLength(1)
    expect(found[0]?.textContent).toContain('graph TD')
  })

  it('settled CodeBlock: non-mermaid langs are not found', () => {
    const { container } = render(<CodeBlock code={'console.log(1)'} lang="ts" />)
    expect(findMermaidFenceCodes(container)).toHaveLength(0)
  })

  it('settled CodeBlock: no lang is not found', () => {
    const { container } = render(<CodeBlock code={'plain'} />)
    expect(findMermaidFenceCodes(container)).toHaveLength(0)
  })

  it('streaming shape: bare pre > code.language-mermaid is found', () => {
    const scope = document.createElement('div')
    const pre = document.createElement('pre')
    const code = document.createElement('code')
    code.className = 'language-mermaid'
    code.textContent = 'A-->B'
    pre.append(code)
    scope.append(pre)
    document.body.append(scope)
    try {
      expect(findMermaidFenceCodes(scope)).toHaveLength(1)
    } finally {
      scope.remove()
    }
  })
})

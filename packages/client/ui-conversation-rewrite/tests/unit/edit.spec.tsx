// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { EditInlineEditor } from '../../src/client/edit.tsx'

afterEach(cleanup)

const base = {
  initialText: 'hello',
  saveLabel: '保存',
  cancelLabel: '取消',
  savingLabel: '保存中…',
  emptyLabel: '消息内容不能为空',
  placeholder: '编辑消息…',
  hint: '保存后将创建新分支，原对话保留。',
  onSave: () => {},
  onCancel: () => {},
}

describe('EditInlineEditor', () => {
  it('saves the edited text', () => {
    const onSave = vi.fn()
    render(<EditInlineEditor {...base} onSave={onSave} />)
    const textarea = screen.getByRole('textbox', { name: '编辑消息…' })
    fireEvent.change(textarea, { target: { value: 'edited' } })
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSave).toHaveBeenCalledWith('edited')
  })

  it('does not submit empty content', () => {
    const onSave = vi.fn()
    render(<EditInlineEditor {...base} initialText="" onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: '保存' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toBe('消息内容不能为空')
  })

  it('cancels and does not save', () => {
    const onCancel = vi.fn()
    const onSave = vi.fn()
    render(<EditInlineEditor {...base} onCancel={onCancel} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('Escape cancels without submitting', () => {
    const onCancel = vi.fn()
    const onSave = vi.fn()
    render(<EditInlineEditor {...base} onCancel={onCancel} onSave={onSave} />)
    fireEvent.keyDown(screen.getByRole('textbox', { name: '编辑消息…' }), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('shows saving state and disables controls', () => {
    render(<EditInlineEditor {...base} saving />)
    expect(screen.getByRole('button', { name: '保存中…' }).disabled).toBe(true)
    expect(screen.getByRole('textbox', { name: '编辑消息…' }).disabled).toBe(true)
  })

  it('shows a save error', () => {
    render(<EditInlineEditor {...base} error="保存失败" />)
    expect(screen.getByRole('alert').textContent).toBe('保存失败')
  })
})

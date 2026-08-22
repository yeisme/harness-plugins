import { describe, expect, it } from 'vitest'
import { createWorkbenchHostSlotRegistrar, registerComposedWorkbenchHost, registerWhenHostSlotAvailable } from '../src/host-slot.ts'

describe('WorkbenchHostSlotRegistrar', () => {
  it('allows one registration and dispose', () => {
    const registrar = createWorkbenchHostSlotRegistrar()
    expect(registrar.registered).toBe(false)
    const handle = registrar.register()
    expect(registrar.registered).toBe(true)
    handle.dispose()
    expect(registrar.registered).toBe(false)
  })

  it('rejects duplicate registration', () => {
    const registrar = createWorkbenchHostSlotRegistrar()
    registrar.register()
    expect(() => registrar.register()).toThrow(/already registered/)
  })

  it('registers only when the official host slot is available', () => {
    const registrar = createWorkbenchHostSlotRegistrar()
    let available = false
    const gate = { isAvailable: () => available }

    expect(registerWhenHostSlotAvailable(gate, registrar)).toBeNull()
    expect(registrar.registered).toBe(false)

    available = true
    const handle = registerWhenHostSlotAvailable(gate, registrar)
    expect(handle).not.toBeNull()
    expect(registrar.registered).toBe(true)
    handle?.dispose()
    expect(registrar.registered).toBe(false)
  })

  it('registers the composed workbench host through the convenience wrapper', () => {
    const handle = registerComposedWorkbenchHost({ isAvailable: () => true })
    expect(handle).not.toBeNull()
    handle?.dispose()
  })
})

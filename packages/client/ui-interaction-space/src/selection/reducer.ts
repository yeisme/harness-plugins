/**
 * Selection interaction 状态机（纯 reducer）。
 *
 * `idle → candidate → stable → actions-visible → dispatching → surface →
 * dismissed/pinned`。candidate 不渲染浮层；reselect/scroll/resize/Esc/
 * outside/invalid 均关闭临时表面（surface 上的 Composer 草稿除外——只被显式
 * dismiss/Esc 关闭）；Pin 是唯一把临时交互提升为可恢复 entry 的动作。
 *
 * @module @yeisme/dsh-client-ui-interaction-space/selection
 */

import type { SelectionContextV2 } from './contracts.ts'

export type SelectionSurfaceKind = 'more' | 'bottom-sheet' | 'composer' | 'owner'

export type SelectionInteractionState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'candidate'; readonly contextId: string }
  | { readonly phase: 'stable'; readonly context: SelectionContextV2 }
  | { readonly phase: 'actions-visible'; readonly context: SelectionContextV2 }
  | { readonly phase: 'dispatching'; readonly context: SelectionContextV2; readonly actionId: string }
  | { readonly phase: 'surface'; readonly context: SelectionContextV2; readonly surface: SelectionSurfaceKind; readonly actionId: string }
  | { readonly phase: 'dismissed' }
  | { readonly phase: 'pinned'; readonly context: SelectionContextV2 }

export type SelectionInteractionEvent =
  | { readonly type: 'selection-candidate'; readonly contextId: string }
  | { readonly type: 'selection-stable'; readonly context: SelectionContextV2 }
  | { readonly type: 'show-actions' }
  | { readonly type: 'action-dispatch'; readonly actionId: string }
  | { readonly type: 'dispatch-settled'; readonly surface?: 'composer' | 'owner'; readonly local?: boolean }
  | { readonly type: 'surface-open'; readonly surface: SelectionSurfaceKind; readonly actionId?: string }
  | { readonly type: 'surface-close' }
  | { readonly type: 'scroll' }
  | { readonly type: 'resize' }
  | { readonly type: 'esc' }
  | { readonly type: 'outside-pointer' }
  | { readonly type: 'context-invalid' }
  | { readonly type: 'selection-excluded' }
  | { readonly type: 'pin' }
  | { readonly type: 'dismiss' }
  | { readonly type: 'reset' }

/** 是否存在由当前交互层渲染的临时表面（pinned 不算临时）。 */
export function hasTransientSurface(state: SelectionInteractionState): boolean {
  return state.phase === 'candidate' || state.phase === 'stable' || state.phase === 'actions-visible'
    || state.phase === 'dispatching' || state.phase === 'surface'
}

/**
 * 纯 reducer。任何未知事件组合保持原状态（fail-safe，不抛错）。
 */
export function selectionInteractionReducer(state: SelectionInteractionState, event: SelectionInteractionEvent): SelectionInteractionState {
  switch (event.type) {
    case 'selection-candidate': {
      // 重选即接管：旧 context（含 pinned）立即失效，动作不再 dispatch。
      return { phase: 'candidate', contextId: event.contextId }
    }
    case 'selection-excluded': {
      return state.phase === 'surface' ? state : { phase: 'idle' }
    }
    case 'selection-stable': {
      if (state.phase !== 'candidate' && state.phase !== 'stable') {
        // 非候选状态下收到稳定选区：视为重选的稳定结果。
        return { phase: 'stable', context: event.context }
      }
      return { phase: 'stable', context: event.context }
    }
    case 'show-actions': {
      return state.phase === 'stable' ? { phase: 'actions-visible', context: state.context } : state
    }
    case 'action-dispatch': {
      if (state.phase !== 'actions-visible' && state.phase !== 'surface') return state
      return { phase: 'dispatching', context: state.context, actionId: event.actionId }
    }
    case 'dispatch-settled': {
      if (state.phase !== 'dispatching') return state
      if (event.local === true) return { phase: 'dismissed' }
      if (event.surface !== undefined) return { phase: 'surface', context: state.context, surface: event.surface, actionId: state.actionId }
      return { phase: 'dismissed' }
    }
    case 'surface-open': {
      if (state.phase !== 'actions-visible' && state.phase !== 'stable') return state
      return { phase: 'surface', context: state.context, surface: event.surface, actionId: event.actionId ?? '' }
    }
    case 'surface-close': {
      if (state.phase !== 'surface') return state
      return { phase: 'actions-visible', context: state.context }
    }
    case 'scroll':
    case 'resize': {
      // 滚动/resize 关闭临时 Actions；Composer/owner surface 上的草稿不受影响。
      if (state.phase === 'surface') return state
      if (state.phase === 'candidate' || state.phase === 'stable' || state.phase === 'actions-visible' || state.phase === 'dispatching') {
        return { phase: 'dismissed' }
      }
      return state
    }
    case 'esc': {
      if (state.phase === 'surface') {
        return { phase: 'actions-visible', context: state.context }
      }
      if (state.phase === 'actions-visible' || state.phase === 'dispatching' || state.phase === 'candidate' || state.phase === 'stable') {
        return { phase: 'dismissed' }
      }
      return state
    }
    case 'outside-pointer': {
      if (state.phase === 'surface') return state
      if (state.phase === 'actions-visible' || state.phase === 'dispatching' || state.phase === 'candidate' || state.phase === 'stable') {
        return { phase: 'dismissed' }
      }
      return state
    }
    case 'context-invalid': {
      // 上下文失效对一切状态（含 pinned）成立：不保留可执行的陈旧 context。
      if (state.phase === 'idle' || state.phase === 'dismissed') return { phase: 'idle' }
      return { phase: 'dismissed' }
    }
    case 'pin': {
      if (state.phase === 'actions-visible' || state.phase === 'stable') {
        return { phase: 'pinned', context: state.context }
      }
      return state
    }
    case 'dismiss': {
      if (state.phase === 'idle') return state
      return { phase: 'dismissed' }
    }
    case 'reset': {
      return { phase: 'idle' }
    }
  }
}

/**
 * DSH Pane Workbench browser entry.
 *
 * 直接复用 `@yeisme/dsh-client-ui-pane-workbench/client` 的双 workspace
 * slot 注册与共享 controller 装配；本文件只做 re-export，不复制业务状态。
 *
 * @module @yeisme/dsh-pane-workbench/client
 */

export {
  PaneWorkbenchClientPlugin,
  apply,
  inject,
} from '@yeisme/dsh-client-ui-pane-workbench/client'
export { default } from '@yeisme/dsh-client-ui-pane-workbench/client'

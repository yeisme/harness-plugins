// The node half is intentionally inert. The dsh.client manifest points the
// browser runner at ./client while the host Loader gets a lifecycle-safe row.
export const name = 'pane-subagent'
export const inject = []
export function apply() {}
export default { name, inject, apply }

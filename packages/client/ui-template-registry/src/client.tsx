export { TemplateStudio } from './studio.js'
export const inject = ['locale', 'sessions'] as const
export function apply(): () => void { return () => {} }

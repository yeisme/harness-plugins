import { cloneElement, type ComponentProps, type ReactElement, type ReactNode } from 'react'

type IconProps = ComponentProps<'svg'> & { readonly size?: number }

function icon(name: string) {
  return function MockIcon({ size = 16, ...props }: IconProps) {
    return <svg {...props} data-test-icon={name} height={size} width={size} />
  }
}

export const IconEditOutline16 = icon('edit')
export const IconCheckOutline16 = icon('check')
export const IconCloseOutline16 = icon('close')
export const IconLoadingOutline16 = icon('loading')
export const IconRefreshOutline16 = icon('refresh')

export function Tooltip({ children }: { readonly children: ReactElement }) {
  return cloneElement(children)
}

export function Button({ icon: leading, children, ...props }: ComponentProps<'button'> & { readonly icon?: ReactNode }) {
  return <button {...props}>{leading}{children}</button>
}

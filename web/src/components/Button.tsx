import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { Link, type LinkProps } from 'react-router'
import styles from './Button.module.css'

export type ButtonVariant = 'secondary' | 'primary' | 'danger'
export type ButtonSize = 'regular' | 'compact' | 'icon' | 'square'

interface SharedButtonProps {
  variant?: ButtonVariant | undefined
  size?: ButtonSize | undefined
  className?: string | undefined
}

function buttonClassName({
  variant = 'secondary',
  size = 'regular',
  className,
}: SharedButtonProps) {
  return `${styles.root} ${styles[variant]} ${styles[size]}${
    className ? ` ${className}` : ''
  }`
}

export const Button = forwardRef<
  HTMLButtonElement,
  SharedButtonProps & ComponentPropsWithoutRef<'button'>
>(function Button({ variant, size, className, ...props }, ref) {
  return (
    <button
      {...props}
      ref={ref}
      className={buttonClassName({ variant, size, className })}
      data-button-variant={variant ?? 'secondary'}
    />
  )
})

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: SharedButtonProps & LinkProps) {
  return (
    <Link
      {...props}
      className={buttonClassName({ variant, size, className })}
      data-button-variant={variant ?? 'secondary'}
    />
  )
}

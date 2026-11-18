import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { lockModalScroll } from '../lib/modalScrollLock.js'

export default function Modal({ children, className = '', ...props }) {
  const backdropRef = useRef(null)
  const dismissRef = useRef(props.onClick)
  useLayoutEffect(() => { dismissRef.current = props.onClick }, [props.onClick])

  useLayoutEffect(() => lockModalScroll(backdropRef.current), [])
  useLayoutEffect(() => {
    const root = backdropRef.current
    const closeOnEscape = (event) => {
      if (Array.from(document.querySelectorAll('.modal-backdrop')).at(-1) !== root) return
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); dismissRef.current?.(event); return }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [])

  return createPortal(
    <div {...props} className={`modal-backdrop ${className}`.trim()} role="presentation" ref={backdropRef}>
      {children}
    </div>,
    document.body
  )
}

import { useLayoutEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { lockModalScroll } from '../lib/modalScrollLock.js'

export default function Modal({ children, className = '', ...props }) {
  const backdropRef = useRef(null)

  useLayoutEffect(() => lockModalScroll(backdropRef.current), [])

  return createPortal(
    <div {...props} className={`modal-backdrop ${className}`.trim()} role="presentation" ref={backdropRef}>
      {children}
    </div>,
    document.body
  )
}

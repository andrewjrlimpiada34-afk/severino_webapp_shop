import { useEffect, useId, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import StoreIcon from './StoreIcon.jsx'

export default function HeaderSearch() {
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const container = useRef(null)
  const input = useRef(null)
  const trigger = useRef(null)
  const fieldId = useId()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!expanded) return undefined
    input.current?.focus()
    const dismiss = (event) => {
      if (!container.current?.contains(event.target)) setExpanded(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [expanded])

  const close = () => {
    setExpanded(false)
    trigger.current?.focus()
  }

  return (
    <div className="header-search" ref={container} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
    }}>
      <button className="icon-button header-search-trigger" type="button" ref={trigger} aria-label="Search the collection" title="Search the collection" aria-expanded={expanded} aria-controls={expanded ? `${fieldId}-form` : undefined} onClick={() => {
        if (!expanded) setQuery(new URLSearchParams(location.search).get('q') || '')
        setExpanded((open) => !open)
      }}><StoreIcon name="search" /></button>
      {expanded && <form id={`${fieldId}-form`} className="header-search-form" role="search" onSubmit={(event) => {
        event.preventDefault()
        const params = new URLSearchParams(location.pathname === '/shop' ? location.search : '')
        if (query.trim()) params.set('q', query.trim())
        else params.delete('q')
        navigate({ pathname: '/shop', search: params.size ? `?${params}` : '' })
        close()
      }}>
        <label className="sr-only" htmlFor={fieldId}>Search scents or notes</label>
        <input id={fieldId} ref={input} name="q" type="search" placeholder="Search scents or notes..." value={query} onChange={(event) => setQuery(event.target.value)} />
        <button className="icon-button header-search-submit" type="submit" aria-label="Find scents"><StoreIcon name="arrow" /></button>
        <button className="icon-button header-search-close" type="button" onClick={close} aria-label="Close search"><StoreIcon name="close" /></button>
      </form>}
    </div>
  )
}

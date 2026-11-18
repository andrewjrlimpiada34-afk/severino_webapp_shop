import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Modal from './Modal.jsx'
import StoreIcon from './StoreIcon.jsx'
import SpeechControls from './SpeechControls.jsx'

const storageKey = 'severino_accessibility_v1'
const defaults = { focus: false, links: false, large: false, motion: false, contrast: false }
function readPreferences() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey))
    return Object.fromEntries(Object.keys(defaults).map(key => [key, saved?.[key] === true]))
  } catch { return defaults }
}
const sections = [
  ['Navigation', [['focus', 'Keyboard focus', 'keyboard'], ['links', 'Underline links', 'link']]],
  ['Text and display', [['large', 'Larger text', 'type'], ['contrast', 'High contrast', 'contrast'], ['motion', 'Reduce motion', 'motion']]]
]

export default function AccessibilityPanel() {
  const { pathname } = useLocation()
  const [panel, setPanel] = useState(null)
  const [prefs, setPrefs] = useState(readPreferences)
  useEffect(() => {
    const root = document.documentElement
    for (const [name, enabled] of Object.entries(prefs)) root.toggleAttribute('data-access-' + name, enabled)
    try { localStorage.setItem(storageKey, JSON.stringify(prefs)) } catch { /* Preferences still apply to this visit. */ }
    return () => { for (const name of Object.keys(defaults)) root.removeAttribute('data-access-' + name) }
  }, [prefs])
  const open = () => {
    const selection = window.getSelection()?.toString().trim()
    const content = Array.from(document.querySelectorAll('main h1, main h2, main h3, main p'))
      .filter(node => node.getClientRects().length && !node.closest('[hidden], [aria-hidden="true"]'))
      .map(node => node.innerText.trim()).filter(Boolean).join('. ')
    setPanel({ path: pathname, text: selection || content, selected: Boolean(selection) })
  }
  return <>
    <button type="button" className="access-launcher" onClick={open} aria-label="Open accessibility settings" aria-haspopup="dialog" title="Accessibility settings">
      <StoreIcon name="accessibility" />
    </button>
    {panel?.path === pathname && <Modal className="access-backdrop" onClick={() => setPanel(null)}>
      <section className="modal-card access-panel" role="dialog" aria-modal="true" aria-labelledby="access-title" onClick={event => event.stopPropagation()}>
        <header><StoreIcon name="accessibility"/><h2 id="access-title">Accessibility</h2>
          <button type="button" className="access-close" aria-label="Close accessibility settings" onClick={() => setPanel(null)}><StoreIcon name="close"/></button>
        </header>
        <div className="access-body">
          {sections.map(([title, options]) => <section key={title}>
            <h3>{title}</h3><div className="access-grid">
              {options.map(([key, label, icon]) => <button key={key} type="button" aria-pressed={prefs[key]} onClick={() => setPrefs(previous => ({ ...previous, [key]: !previous[key] }))}>
                <StoreIcon name={icon}/><span>{label}</span>{prefs[key] && <StoreIcon className="access-check" name="check"/>}
              </button>)}
            </div>
          </section>)}
          <section><h3>{panel.selected ? 'Read selected text' : 'Read this page'}</h3>
            <SpeechControls text={panel.text} label={panel.selected ? 'selected text' : 'page content'} />
          </section>
          <button type="button" className="access-reset" onClick={() => setPrefs(defaults)} disabled={!Object.values(prefs).some(Boolean)}>
            <StoreIcon name="reset"/>Reset settings
          </button>
        </div>
      </section>
    </Modal>}
  </>
}

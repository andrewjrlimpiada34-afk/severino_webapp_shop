import { useEffect, useRef, useState } from 'react'
import Modal from './Modal.jsx'
import { policies, policyUpdated } from '../data/policies.js'

export default function PolicyModal({ initialPolicy = 'terms', onClose }) {
  const [selected, setSelected] = useState(initialPolicy in policies ? initialPolicy : 'terms')
  const dialog = useRef(null)
  const policy = policies[selected]

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <Modal className="policy-backdrop" onClick={onClose}>
      <div className="modal-card terms-modal" role="dialog" aria-modal="true" aria-labelledby="terms-title" ref={dialog} onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>×</button>
        <div className="terms-content">
          <div className="policy-selector" role="group" aria-label="Policy documents">
            {Object.entries(policies).map(([key, item]) => <button key={key} type="button" aria-pressed={selected === key} aria-controls="policy-document" onClick={() => {
              setSelected(key)
              dialog.current.scrollTop = 0
            }}>{item.label}</button>)}
          </div>
          <div id="policy-document">
            <header className="terms-document-header">
              <div className="terms-document-heading">
                <h2 id="terms-title">{policy.title}</h2>
                <span className="terms-updated">Last updated: {policyUpdated}</span>
                <p>{policy.summary}</p>
              </div>
            </header>
            <div className="terms-section-stack">
              {policy.sections.map((section) => <article className="terms-law-card" key={`${selected}-${section.number}`}>
                <div className="terms-card-copy">
                  <div className="terms-card-title-row"><span className="terms-card-number">{section.number}.</span><h3>{section.title}</h3></div>
                  <p>{section.body}</p>
                  <div className="terms-clause-list">
                    {section.items.map(([label, description]) => <div className="terms-clause" key={label}><span>{label}</span><p>{description}</p></div>)}
                  </div>
                </div>
              </article>)}
            </div>
            <footer className="terms-document-footer"><p>{policy.footer}</p></footer>
          </div>
        </div>
      </div>
    </Modal>
  )
}

import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'
import { facebookPageUrl } from '../lib/social.js'
import SpeechControls from '../components/SpeechControls.jsx'

function FAQs() {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    const load = async () => {
      setStatus({ loading: true, error: '' })
      try {
        const data = await api.faqs()
        if (active) {
          setItems(data)
          setStatus({ loading: false, error: '' })
        }
      } catch (error) {
        if (active) setStatus({ loading: false, error: error.message || 'Unable to load FAQs.' })
      }
    }
    load()
    return () => { active = false }
  }, [attempt])

  return (
    <section className="boutique-page faq-page" aria-labelledby="faq-title">
      <header className="store-page-heading">
        <h1 id="faq-title">Frequently asked questions</h1>
        <p>Help with your account, perfumes, and Severino orders.</p>
      </header>

      <div className="faq-layout">
        <div className="faq-list" aria-busy={status.loading}>
          {status.loading && <p className="faq-message" role="status">Loading FAQs...</p>}
          {status.error && (
            <div className="store-notice">
              <p role="alert">{status.error}</p>
              <button className="button secondary" type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
            </div>
          )}
          {!status.loading && !status.error && items.length === 0 && (
            <p className="faq-message">Questions and answers will appear here soon. Contact Severino for help.</p>
          )}
          {!status.loading && !status.error && items.map((item) => (
            <details className="faq-item" key={item.id}>
              <summary>{item.question}</summary>
              <p className="faq-answer">{item.answer}</p>
              <SpeechControls text={`${item.question}. ${item.answer}`} label={item.question} />
            </details>
          ))}
        </div>

        <aside className="faq-support" aria-labelledby="faq-support-title">
          <h2 id="faq-support-title">Still need help?</h2>
          <p>Contact Severino for questions about your order or a perfume.</p>
          <a href="mailto:uvervidallonguevara@gmail.com">uvervidallonguevara@gmail.com</a>
          <a href="tel:+639164352483">+63 916 435 2483</a>
          <a href={facebookPageUrl} target="_blank" rel="noreferrer">Message us on Facebook</a>
        </aside>
      </div>
    </section>
  )
}

export default FAQs

import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'

const emptyForm = { question: '', answer: '' }

function AdminFAQs() {
  const [items, setItems] = useState([])
  const [loadStatus, setLoadStatus] = useState({ loading: true, error: '' })
  const [attempt, setAttempt] = useState(0)
  const [editingId, setEditingId] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [deleteId, setDeleteId] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState({ error: '', success: '' })
  const pending = useRef(false)
  const questionRef = useRef(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoadStatus({ loading: true, error: '' })
      try {
        const data = await api.adminFaqs()
        if (active) {
          setItems(data)
          setLoadStatus({ loading: false, error: '' })
        }
      } catch (error) {
        if (active) setLoadStatus({ loading: false, error: error.message || 'Unable to load FAQs.' })
      }
    }
    load()
    return () => { active = false }
  }, [attempt])

  const resetForm = () => {
    setEditingId('')
    setForm(emptyForm)
  }

  const startEdit = (item) => {
    setEditingId(item.id)
    setForm({ question: item.question, answer: item.answer })
    setDeleteId('')
    setMessage({ error: '', success: '' })
    questionRef.current?.focus()
  }

  const save = async (event) => {
    event.preventDefault()
    if (pending.current) return
    const data = { question: form.question.trim(), answer: form.answer.trim() }
    if (!data.question || !data.answer) {
      setMessage({ error: 'Enter a question and an answer.', success: '' })
      return
    }
    pending.current = true
    setBusy(true)
    setMessage({ error: '', success: '' })
    try {
      const saved = editingId ? await api.updateFaq(editingId, data) : await api.createFaq(data)
      setItems((current) => editingId
        ? current.map((item) => item.id === editingId ? saved : item)
        : [...current, saved])
      resetForm()
      setMessage({ error: '', success: 'FAQ saved. The customer FAQ page is updated.' })
    } catch (error) {
      setMessage({ error: error.message || 'Unable to save the FAQ. Please try again.', success: '' })
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  const remove = async (id) => {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setMessage({ error: '', success: '' })
    try {
      await api.deleteFaq(id)
      setItems((current) => current.filter((item) => item.id !== id))
      if (editingId === id) resetForm()
      setDeleteId('')
      setMessage({ error: '', success: 'FAQ deleted.' })
    } catch (error) {
      setMessage({ error: error.message || 'Unable to delete the FAQ. Please try again.', success: '' })
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  return (
    <section className="admin-faq-page" aria-labelledby="admin-faq-title">
      <header>
        <h1 className="section-title" id="admin-faq-title">FAQs</h1>
        <p className="section-subtitle">Manage the questions and answers shown on the customer FAQ page.</p>
      </header>

      {message.error && <div className="card" role="alert">{message.error}</div>}
      {message.success && <div className="card" role="status">{message.success}</div>}
      {loadStatus.loading && <div className="card" role="status">Loading FAQs...</div>}
      {loadStatus.error && (
        <div className="card admin-faq-actions">
          <p role="alert">{loadStatus.error}</p>
          <button className="button secondary" type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
        </div>
      )}

      {!loadStatus.loading && !loadStatus.error && (
        <div className="admin-faq-layout" aria-busy={busy}>
          <div className="admin-faq-list">
            <h2>Published questions ({items.length})</h2>
            {items.length === 0 && <div className="card">Add your first question using the FAQ form.</div>}
            {items.map((item) => (
              <article className="card admin-faq-card" key={item.id} aria-labelledby={`faq-heading-${item.id}`}>
                <h3 id={`faq-heading-${item.id}`}>{item.question}</h3>
                <p className="admin-faq-answer">{item.answer}</p>
                {deleteId === item.id ? (
                  <div className="admin-faq-confirm" role="group" aria-label={`Confirm deletion of ${item.question}`}>
                    <p>Delete this question from the customer FAQ page?</p>
                    <div className="admin-faq-actions">
                      <button className="button danger" type="button" disabled={busy} onClick={() => remove(item.id)}>Confirm delete</button>
                      <button className="button secondary" type="button" disabled={busy} onClick={() => setDeleteId('')}>Keep FAQ</button>
                    </div>
                  </div>
                ) : (
                  <div className="admin-faq-actions">
                    <button className="button secondary" type="button" disabled={busy} onClick={() => startEdit(item)} aria-label={`Edit ${item.question}`}>Edit</button>
                    <button className="button danger" type="button" disabled={busy} onClick={() => setDeleteId(item.id)} aria-label={`Delete ${item.question}`}>Delete</button>
                  </div>
                )}
              </article>
            ))}
          </div>

          <form className="card admin-faq-form" onSubmit={save}>
            <h2>{editingId ? 'Edit FAQ' : 'Add FAQ'}</h2>
            <fieldset disabled={busy}>
              <div>
                <label className="label" htmlFor="faq-question">Question</label>
                <input className="input" id="faq-question" ref={questionRef} required maxLength={200} value={form.question} onChange={(event) => setForm((current) => ({ ...current, question: event.target.value }))} />
              </div>
              <div>
                <label className="label" htmlFor="faq-answer">Answer</label>
                <textarea className="input" id="faq-answer" required maxLength={3000} rows={8} value={form.answer} onChange={(event) => setForm((current) => ({ ...current, answer: event.target.value }))} />
              </div>
              <p className="section-subtitle">Saving publishes this answer immediately.</p>
              <div className="admin-faq-actions">
                <button className="button" type="submit">{busy ? 'Please wait...' : 'Save FAQ'}</button>
                {editingId && <button className="button secondary" type="button" onClick={resetForm}>Cancel edit</button>}
              </div>
            </fieldset>
          </form>
        </div>
      )}
    </section>
  )
}

export default AdminFAQs

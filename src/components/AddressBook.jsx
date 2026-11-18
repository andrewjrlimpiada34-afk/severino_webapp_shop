import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api.js'
import Modal from './Modal.jsx'

const emptyAddress = {
  label: 'Home',
  name: '',
  phone: '',
  addressLine: '',
  barangay: '',
  city: '',
  province: '',
  zip: '',
  country: 'Philippines',
  isDefault: false
}
const addressFields = [
  ['label', 'Label'],
  ['name', 'Recipient name'],
  ['phone', 'Mobile number'],
  ['addressLine', 'Street address (optional)'],
  ['barangay', 'Barangay'],
  ['city', 'City / Municipality'],
  ['province', 'Province / State'],
  ['zip', 'ZIP code'],
  ['country', 'Country']
]
export default function AddressBook({
  selectedId,
  onSelect,
  onLoaded,
  disabled = false
}) {
  const [addresses, setAddresses] = useState([])
  const [editing, setEditing] = useState(null)
  const [status, setStatus] = useState({
    loading: true,
    saving: false,
    error: ''
  })
  const callbacks = useRef({ onSelect, onLoaded })
  callbacks.current = { onSelect, onLoaded }
  const savingRef = useRef(false)
  useEffect(() => {
    let active = true
    api
      .addresses()
      .then((items) => {
        if (!active) return
        setAddresses(items)
        callbacks.current.onLoaded?.(items)
        callbacks.current.onSelect?.(
          items.find((address) => address.isDefault) || items[0] || null
        )
        setStatus({ loading: false, saving: false, error: '' })
      })
      .catch((error) => {
        if (active)
          setStatus({ loading: false, saving: false, error: error.message })
      })
    return () => {
      active = false
    }
  }, [])
  const select = (address) => callbacks.current.onSelect?.(address)
  const save = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (savingRef.current) return
    savingRef.current = true
    setStatus((previous) => ({ ...previous, saving: true, error: '' }))
    try {
      const saved = await api.saveAddress(editing, editing.id)
      const updated = await api.addresses()
      setAddresses(updated)
      select(saved)
      setEditing(null)
    } catch (error) {
      setStatus((previous) => ({ ...previous, error: error.message }))
    } finally {
      savingRef.current = false
      setStatus((previous) => ({ ...previous, saving: false }))
    }
  }
  const remove = async (address) => {
    if (savingRef.current || !window.confirm(`Delete ${address.label}?`)) return
    savingRef.current = true
    setStatus((previous) => ({ ...previous, saving: true, error: '' }))
    try {
      await api.deleteAddress(address.id)
      const updated = await api.addresses()
      setAddresses(updated)
      if (selectedId === address.id)
        select(updated.find((entry) => entry.isDefault) || updated[0] || null)
    } catch (error) {
      setStatus((previous) => ({ ...previous, error: error.message }))
    } finally {
      savingRef.current = false
      setStatus((previous) => ({ ...previous, saving: false }))
    }
  }
  return (
    <section
      className="address-book"
      aria-label="Saved shipping addresses"
      aria-busy={status.loading || status.saving}
    >
      <h2>Shipping addresses</h2>
      {status.loading && <p role="status">Loading saved addresses…</p>}
      {status.error && <p role="alert">{status.error}</p>}
      <div className="address-options">
        {addresses.map((address) => (
          <article
            className={`address-option ${selectedId === address.id ? 'is-selected' : ''}`}
            key={address.id}
          >
            {onSelect ? (
              <label>
                <input
                  type="radio"
                  name="shipping-address"
                  checked={selectedId === address.id}
                  disabled={disabled || status.saving}
                  onChange={() => select(address)}
                />
                <strong>
                  {address.label}
                  {address.isDefault ? ' · Default' : ''}
                </strong>
              </label>
            ) : (
              <strong>
                {address.label}
                {address.isDefault ? ' · Default' : ''}
              </strong>
            )}
            <p>
              {address.name}
              <br />
              {[
                address.addressLine,
                address.barangay,
                address.city,
                address.province,
                address.zip,
                address.country
              ]
                .filter(Boolean)
                .join(', ')}
              <br />
              {address.phone}
            </p>
            <div className="address-actions">
              <button
                className="button secondary"
                type="button"
                disabled={disabled || status.saving}
                onClick={() => setEditing({ ...address })}
              >
                Edit address
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={disabled || status.saving}
                onClick={() => remove(address)}
              >
                Delete address
              </button>
            </div>
          </article>
        ))}
      </div>
      {!status.loading && (
        <button
          className="button secondary"
          type="button"
          disabled={disabled || status.saving}
          onClick={() =>
            setEditing({ ...emptyAddress, isDefault: !addresses.length })
          }
        >
          Add New Address
        </button>
      )}
      {editing && (
        <Modal
          onClick={() => {
            if (!savingRef.current) setEditing(null)
          }}
        >
          <div
            className="modal-card address-editor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="address-editor-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="address-editor-title">
              {editing.id ? 'Edit shipping address' : 'Add shipping address'}
            </h2>
            <form className="form" onSubmit={save}>
              <fieldset disabled={status.saving}>
                <div className="address-editor-fields">
                  {addressFields.map(([key, label]) => (
                    <div key={key}>
                      <label className="label" htmlFor={`saved-${key}`}>
                        {label}
                      </label>
                      <input
                        className="input"
                        id={`saved-${key}`}
                        required={key !== 'addressLine'}
                        maxLength={
                          key === 'label'
                            ? 60
                            : key === 'addressLine'
                              ? 255
                              : 150
                        }
                        type={key === 'phone' ? 'tel' : 'text'}
                        value={editing[key]}
                        onChange={(event) =>
                          setEditing((previous) => ({
                            ...previous,
                            [key]: event.target.value
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
                <label className="terms-check">
                  <input
                    type="checkbox"
                    checked={editing.isDefault}
                    onChange={(event) =>
                      setEditing((previous) => ({
                        ...previous,
                        isDefault: event.target.checked
                      }))
                    }
                  />
                  Use as default address
                </label>
              </fieldset>
              {status.error && <p role="alert">{status.error}</p>}
              <div className="address-actions">
                <button className="button" disabled={status.saving}>
                  {status.saving ? 'Saving…' : 'Save address'}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  disabled={status.saving}
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </section>
  )
}

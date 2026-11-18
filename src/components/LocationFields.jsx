import { useEffect, useLayoutEffect, useState } from 'react'
import { areaRegions } from '../../server/shared/places/index.js'

const provinces = Object.keys(areaRegions).sort((a, b) => a.localeCompare(b, 'en'))

export default function LocationFields({ prefix, value, onChange, disabled = false, onValidity, errors = {}, touched = {} }) {
  const { province, city, barangay } = value
  const region = Object.hasOwn(areaRegions, province) ? areaRegions[province] : ''
  const [loaded, setLoaded] = useState(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!region) return
    let active = true
    import(`../../server/shared/places/${region}.json`)
      .then(({ default: directory }) => { if (active) setLoaded({ region, directory }) })
      .catch(() => { if (active) setLoaded({ region, failed: true }) })
    return () => { active = false }
  }, [region, attempt])

  const current = loaded?.region === region ? loaded : null
  const cities = current?.directory?.[province] || {}
  const barangays = Object.hasOwn(cities, city) ? cities[city] : []
  const valid = barangays.includes(barangay)
  useLayoutEffect(() => { onValidity?.(valid) }, [valid, onValidity])

  function select(field, title, options, enabled, patch) {
    const error = touched[field] && errors[field]
    return <div className="locality-field">
      <label className="label" htmlFor={`${prefix}-${field}`}>{title}</label>
      <select className="input" id={`${prefix}-${field}`} name={field} required
        value={options.includes(value[field]) ? value[field] : ''} disabled={disabled || !enabled}
        aria-invalid={Boolean(error)} aria-describedby={error ? `${prefix}-${field}-error` : undefined}
        onChange={event => onChange({ ...patch, [field]: event.target.value, country: 'Philippines' })}>
        <option value="">Select {title.toLowerCase()}</option>
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
      {error && <p className="checkout-field-error" id={`${prefix}-${field}-error`}>{error}</p>}
    </div>
  }
  return <div className="locality-fields">
    {select('province', 'Province or area', provinces, true, { city: '', barangay: '' })}
    {select('city', 'City or municipality', Object.keys(cities).sort(), Boolean(current?.directory), { barangay: '' })}
    {select('barangay', 'Barangay', barangays, barangays.length > 0, {})}
    {region && !current && <p role="status">Loading places…</p>}
    {current?.failed && <p role="alert">Places could not load. <button type="button" className="terms-link" onClick={() => { setLoaded(null); setAttempt(n => n + 1) }}>Try again</button></p>}
  </div>
}

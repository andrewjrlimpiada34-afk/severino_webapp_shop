import { useState } from 'react'
import PolicyModal from './PolicyModal.jsx'

export default function TermsAcceptance({
  checked,
  onChange,
  disabled = false
}) {
  const [policy, setPolicy] = useState('')
  return (
    <div className="registration-acceptance">
      <label className="terms-check">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          required
          onChange={(event) => onChange(event.target.checked)}
        />
        <span>I accept the Terms and Conditions.</span>
      </label>
      <p>
        <button
          className="terms-link"
          type="button"
          onClick={() => setPolicy('terms')}
        >
          Read Terms and Conditions
        </button>
        {' · '}
        <button
          className="terms-link"
          type="button"
          onClick={() => setPolicy('privacy')}
        >
          Read Privacy Notice
        </button>
      </p>
      {policy && (
        <PolicyModal initialPolicy={policy} onClose={() => setPolicy('')} />
      )}
    </div>
  )
}

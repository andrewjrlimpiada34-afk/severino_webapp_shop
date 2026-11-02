import { useId, useState } from 'react'

const descriptions = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent']

function Star({ filled }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    </svg>
  )
}

export default function RatingStars({ value, onChange, disabled = false, readOnly = false }) {
  const id = useId()
  const [preview, setPreview] = useState(0)
  const rating = Math.max(0, Math.min(5, Number(value) || 0))

  if (readOnly) {
    return (
      <div className="rating-display" role="img" aria-label={`${rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => <span key={star} className={star <= rating ? 'is-filled' : ''}><Star filled={star <= rating} /></span>)}
      </div>
    )
  }

  return (
    <fieldset className="rating-picker" disabled={disabled} onMouseLeave={() => setPreview(0)}>
      <legend className="label">Rating</legend>
      <div className="rating-picker-choices">
        {[1, 2, 3, 4, 5].map((star) => (
          <label key={star} className={`rating-picker-choice ${star <= (preview || rating) ? 'is-filled' : ''}`} onMouseEnter={() => { if (!disabled) setPreview(star) }} title={`${star} ${star === 1 ? 'star' : 'stars'} · ${descriptions[star - 1]}`}>
            <input type="radio" name={`rating-${id}`} value={star} checked={rating === star} onChange={() => { setPreview(0); onChange(star) }} aria-label={`${star} ${star === 1 ? 'star' : 'stars'}: ${descriptions[star - 1]}`} />
            <Star filled={star <= (preview || rating)} />
          </label>
        ))}
      </div>
      <p className="rating-picker-hint" aria-live="polite">{rating} / 5 <span aria-hidden="true">·</span> {descriptions[rating - 1] || 'Choose a rating'}</p>
    </fieldset>
  )
}

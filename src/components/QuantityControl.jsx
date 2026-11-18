import { useId } from 'react'

export default function QuantityControl({
  value,
  maximum,
  onChange,
  disabled = false
}) {
  const id = useId()
  const max = Math.max(0, Math.min(100, maximum))
  const quantity = Math.min(Math.max(1, Number(value) || 1), Math.max(1, max))
  return (
    <div className="quantity-control">
      <label className="label" htmlFor={id}>
        Quantity
      </label>
      <div className="quantity-stepper">
        <button
          className="button secondary"
          type="button"
          aria-label="Decrease quantity"
          disabled={disabled || quantity <= 1 || !max}
          onClick={() => onChange(quantity - 1)}
        >
          −
        </button>
        <input
          id={id}
          className="input"
          type="number"
          min="1"
          max={Math.max(1, max)}
          step="1"
          value={quantity}
          disabled={disabled || !max}
          onChange={(event) =>
            onChange(
              Math.max(
                1,
                Math.min(max, Math.trunc(Number(event.target.value)) || 1)
              )
            )
          }
        />
        <button
          className="button secondary"
          type="button"
          aria-label="Increase quantity"
          disabled={disabled || quantity >= max}
          onClick={() => onChange(quantity + 1)}
        >
          +
        </button>
      </div>
      <p className="quantity-limit" role="status">
        {!max
          ? 'No additional stock available.'
          : quantity >= max
            ? 'Maximum available quantity reached.'
            : `${max} available to add`}
      </p>
    </div>
  )
}

function AdaptiveScentToggle({ enabled, onChange, compact = false }) {
  return (
    <div className={`adaptive-toggle ${compact ? 'compact' : ''}`}>
      <div>
        <div className="tag">Adaptive Scent</div>
        {!compact && (
          <p className="section-subtitle">
            Weather-aware picks based on your forecast and product notes.
          </p>
        )}
      </div>
      <button
        className={`adaptive-switch ${enabled ? 'on' : ''}`}
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
      >
        <span className="adaptive-switch__thumb" />
        <span className="adaptive-switch__text">{enabled ? 'ON' : 'OFF'}</span>
      </button>
    </div>
  )
}

export default AdaptiveScentToggle

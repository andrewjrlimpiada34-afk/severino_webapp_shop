function EmailConfirmation() {
  return (
    <section className="grid" style={{ gap: '24px', maxWidth: '980px', margin: '0 auto' }}>
      <div>
        <h1 className="section-title">Email Order Confirmation</h1>
        <p className="section-subtitle">
          Preview the confirmation email sent after COD order placement.
        </p>
      </div>

      <div className="card">
        <div className="tag">Severino</div>
        <h2 className="section-title" style={{ fontSize: '28px' }}>
          Your order is secured
        </h2>
        <p className="section-subtitle">
          Order ID: <strong>ORD-2026-024</strong>
        </p>
        <div className="grid two" style={{ marginTop: '16px' }}>
          <div className="card">
            <div className="tag">Delivery</div>
            <p>24 Olive Street, Makati City</p>
            <p>Expected: 24-48 hours</p>
          </div>
          <div className="card">
            <div className="tag">Payment</div>
            <p>Cash on Delivery</p>
            <p>One-time delivery PIN: 483-921</p>
          </div>
        </div>
        <div style={{ marginTop: '18px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="button">Resend Email</button>
          <button className="button secondary">Download Receipt</button>
        </div>
      </div>
    </section>
  )
}

export default EmailConfirmation

function Billing() {
  return (
    <section className="grid" style={{ gap: '24px' }}>
      <div>
        <h1 className="section-title">Billing Page</h1>
        <p className="section-subtitle">
          Cash on Delivery only. Receipts are emailed after delivery confirmation.
        </p>
      </div>

      <div className="grid two">
        <div className="card form">
          <div>
            <div className="label">Billing Name</div>
            <input className="input" placeholder="Name on receipt" />
          </div>
          <div>
            <div className="label">Mobile Number</div>
            <input className="input" placeholder="+63 9xx xxx xxxx" />
          </div>
          <div>
            <div className="label">Delivery Address</div>
            <textarea className="input" rows="3" placeholder="Complete address" />
          </div>
          <div className="pill">COD only · Secure delivery confirmation</div>
          <button className="button">Confirm Billing</button>
        </div>

        <div className="card">
          <div className="tag">Security Notes</div>
          <h2 className="section-title" style={{ fontSize: '26px' }}>
            Safe COD Handling
          </h2>
          <ul>
            <li>Delivery rider verifies your order with a one-time PIN.</li>
            <li>Payments are collected only upon successful handover.</li>
            <li>Receipts are issued after verification.</li>
          </ul>
        </div>
      </div>
    </section>
  )
}

export default Billing

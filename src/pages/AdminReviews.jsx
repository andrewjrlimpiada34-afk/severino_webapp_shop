function AdminReviews() {
  return (
    <section className="grid" style={{ gap: '24px' }}>
      <div>
        <h1 className="section-title">Admin Reviews</h1>
        <p className="section-subtitle">
          Moderate reviews before publishing to protect quality and trust.
        </p>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Reviewer</th>
              <th>Product</th>
              <th>Rating</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {['Mila', 'Carlo', 'Joyce'].map((name, index) => (
              <tr key={name}>
                <td>{name} Reyes</td>
                <td>{index === 0 ? 'Bacc540' : index === 1 ? 'MsDior' : 'LacosteBlack'}</td>
                <td>5 ★</td>
                <td><span className="badge">Pending</span></td>
                <td>
                  <button className="button ghost">Approve</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AdminReviews

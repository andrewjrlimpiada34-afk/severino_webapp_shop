import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

export default function InventoryLog({ revision = 0 }) {
  const [page, setPage] = useState(0)
  const [entries, setEntries] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })
  useEffect(() => {
    let active = true
    api
      .inventoryLogs(page)
      .then((data) => {
        if (active) {
          setEntries(data)
          setStatus({ loading: false, error: '' })
        }
      })
      .catch((error) => {
        if (active) setStatus({ loading: false, error: error.message })
      })
    return () => {
      active = false
    }
  }, [page, revision])
  return (
    <details className="card inventory-log">
      <summary>Inventory transaction log</summary>
      {status.error && <p role="alert">{status.error}</p>}
      {status.loading && <p role="status">Loading inventory history…</p>}
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Product</th>
              <th>Action</th>
              <th>Physical change</th>
              <th>Reserved change</th>
              <th>Physical balance</th>
              <th>Reserved balance</th>
              <th>Recorded by</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.created_at).toLocaleString('en-PH')}</td>
                <td>{entry.product_name}</td>
                <td>{entry.action.replaceAll('_', ' ')}</td>
                <td>{entry.stock_delta}</td>
                <td>{entry.reserved_delta}</td>
                <td>{entry.stock_after}</td>
                <td>{entry.reserved_after}</td>
                <td>{entry.actor_name || 'System migration'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!status.loading && !entries.length && (
        <p>No inventory transactions on this page.</p>
      )}
      <div className="address-actions">
        <button
          className="button secondary"
          type="button"
          disabled={!page}
          onClick={() => setPage((value) => value - 1)}
        >
          Previous
        </button>
        <span>Page {page + 1}</span>
        <button
          className="button secondary"
          type="button"
          disabled={entries.length < 100}
          onClick={() => setPage((value) => value + 1)}
        >
          Next
        </button>
      </div>
    </details>
  )
}

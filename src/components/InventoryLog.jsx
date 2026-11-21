import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

const columns = [
  ['created_at', 'Date'],
  ['product_name', 'Product'],
  ['action', 'Action'],
  ['stock_delta', 'Physical change'],
  ['reserved_delta', 'Reserved change'],
  ['stock_after', 'Physical balance'],
  ['reserved_after', 'Reserved balance'],
  ['actor_name', 'Recorded by'],
]

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
              {columns.map(([key, label]) => <th key={key} scope="col">{label}</th>)}
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const values = {
                ...entry,
                created_at: <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString('en-PH')}</time>,
                action: entry.action.replaceAll('_', ' '),
                actor_name: entry.actor_name || 'System migration',
              }
              return <tr key={entry.id}>
                {columns.map(([key, label]) => <td key={key} data-field={key}>
                  <span className="inventory-field-label" aria-hidden="true">{label}</span>
                  {values[key]}
                </td>)}
              </tr>
            })}
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

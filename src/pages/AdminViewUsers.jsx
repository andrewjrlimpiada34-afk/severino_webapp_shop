import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

function AdminViewUsers() {
  const [users, setUsers] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })

  useEffect(() => {
    const load = async () => {
      try {
        setStatus({ loading: true, error: '' })
        const data = await api.adminUsers()
        setUsers(data)
        setStatus({ loading: false, error: '' })
      } catch (error) {
        setStatus({ loading: false, error: error.message })
      }
    }
    load()
  }, [])

  return (
    <section className="grid" style={{ gap: '24px' }}>
      <div>
        <h1 className="section-title">View Users</h1>
        <p className="section-subtitle">User data is protected with role-based access.</p>
      </div>

      {status.loading && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="loader" />
          Loading users...
        </div>
      )}
      {status.error && <div className="card">Error: {status.error}</div>}
      <div className="card table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id || user.email}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <span className="badge">{user.role}</span>
                </td>
                <td>
                  {user.role !== 'admin' && (
                    <button
                      className="button ghost"
                      type="button"
                      onClick={async () => {
                        try {
                          const ok = window.confirm('Remove this user? This cannot be undone.')
                          if (!ok) return
                          await api.deleteUser(user.id)
                          setUsers((prev) => prev.filter((entry) => entry.id !== user.id))
                        } catch (error) {
                          setStatus((prev) => ({ ...prev, error: error.message }))
                        }
                      }}
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default AdminViewUsers

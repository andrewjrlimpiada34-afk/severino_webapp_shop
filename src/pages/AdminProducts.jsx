import { useEffect, useState } from 'react'
import { api } from '../lib/api.js'

function AdminProducts() {
  const [items, setItems] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '', success: '' })
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({
    name: '',
    price: 300,
    stock: 0,
    notes: '',
    size: '100ml',
    category: 'Unisex',
    description: '',
    imageUrl1: '',
    imageUrl2: '',
    imageUrl3: '',
    imageUrl4: '',
  })

  const load = async () => {
    try {
      setStatus({ loading: true, error: '', success: '' })
      const data = await api.products()
      setItems(data)
      setStatus({ loading: false, error: '', success: '' })
    } catch (error) {
      setStatus({ loading: false, error: error.message, success: '' })
    }
  }

  useEffect(() => {
    load()
  }, [])

  const startEdit = (product) => {
    setEditingId(product.id)
    setForm({
      name: product.name,
      price: product.price,
      stock: product.stock,
      notes: product.notes,
      size: product.size || '100ml',
      category: product.category || 'Unisex',
      description: product.description || '',
      imageUrl1: product.imageUrls?.[0] || product.imageUrl || '',
      imageUrl2: product.imageUrls?.[1] || '',
      imageUrl3: product.imageUrls?.[2] || '',
      imageUrl4: product.imageUrls?.[3] || '',
    })
  }

  const handleFile = (event, index) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () =>
      setForm((prev) => {
        if (index === 3) return { ...prev, imageUrl4: String(reader.result) }
        if (index === 2) return { ...prev, imageUrl3: String(reader.result) }
        if (index === 1) return { ...prev, imageUrl2: String(reader.result) }
        return { ...prev, imageUrl1: String(reader.result) }
      })
    reader.readAsDataURL(file)
  }

  const save = async (event) => {
    event.preventDefault()
    if (!editingId) return
    try {
      setStatus({ loading: true, error: '', success: '' })
      const updated = await api.updateProduct(editingId, {
        name: form.name,
        price: Number(form.price),
        stock: Number(form.stock),
        notes: form.notes,
        size: form.size,
        category: form.category,
        description: form.description,
        imageUrls: [form.imageUrl1, form.imageUrl2, form.imageUrl3, form.imageUrl4].filter(Boolean),
      })
      setItems((prev) => prev.map((item) => (item.id === updated.id ? updated : item)))
      setStatus({ loading: false, error: '', success: 'Product updated.' })
    } catch (error) {
      setStatus({ loading: false, error: error.message, success: '' })
    }
  }

  return (
    <section className="grid" style={{ gap: '24px' }}>
      <div>
        <h1 className="section-title">Modify Products</h1>
        <p className="section-subtitle">
          Update live products, images, descriptions, and pricing.
        </p>
      </div>

      {status.loading && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="loader" />
          Loading products...
        </div>
      )}
      {status.error && <div className="card">Error: {status.error}</div>}
      {status.success && <div className="card">{status.success}</div>}

      <div className="grid two">
        <div className="card table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((product) => (
                <tr key={product.id}>
                  <td>{product.name}</td>
                  <td>₱{product.price}</td>
                  <td>{product.stock}</td>
                  <td>
                    <button className="button ghost" onClick={() => startEdit(product)}>
                      Modify
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form className="card form" onSubmit={save}>
          <div className="label">Name</div>
          <input
            className="input"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <div className="grid two">
            <div>
              <div className="label">Price</div>
              <input
                className="input"
                type="number"
                value={form.price}
                onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
              />
            </div>
            <div>
              <div className="label">Stock</div>
              <input
                className="input"
                type="number"
                value={form.stock}
                onChange={(event) => setForm((prev) => ({ ...prev, stock: event.target.value }))}
              />
            </div>
          </div>
          <div className="label">Notes</div>
          <textarea
            className="input"
            rows="2"
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
          />
          <div className="grid two">
            <div>
              <div className="label">Size</div>
              <input
                className="input"
                value={form.size}
                onChange={(event) => setForm((prev) => ({ ...prev, size: event.target.value }))}
              />
            </div>
            <div>
              <div className="label">Category</div>
              <select
                className="input"
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
              >
                <option>Men</option>
                <option>Women</option>
                <option>Unisex</option>
              </select>
            </div>
          </div>
          <div className="label">Description</div>
          <textarea
            className="input"
            rows="3"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          />
          <div className="label">Image URL 1</div>
          <input
            className="input"
            placeholder="https://..."
            value={form.imageUrl1}
            onChange={(event) => setForm((prev) => ({ ...prev, imageUrl1: event.target.value }))}
          />
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(event) => handleFile(event, 0)}
          />
          <div className="label">Image URL 2</div>
          <input
            className="input"
            placeholder="https://..."
            value={form.imageUrl2}
            onChange={(event) => setForm((prev) => ({ ...prev, imageUrl2: event.target.value }))}
          />
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(event) => handleFile(event, 1)}
          />
          <div className="label">Image URL 3</div>
          <input
            className="input"
            placeholder="https://..."
            value={form.imageUrl3}
            onChange={(event) => setForm((prev) => ({ ...prev, imageUrl3: event.target.value }))}
          />
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(event) => handleFile(event, 2)}
          />
          <div className="label">Image URL 4</div>
          <input
            className="input"
            placeholder="https://..."
            value={form.imageUrl4}
            onChange={(event) => setForm((prev) => ({ ...prev, imageUrl4: event.target.value }))}
          />
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(event) => handleFile(event, 3)}
          />
          <button className="button" type="submit" disabled={!editingId}>
            Save Changes
          </button>
        </form>
      </div>
    </section>
  )
}

export default AdminProducts

import { useState } from 'react'
import { api } from '../lib/api.js'

function AdminAddProduct() {
  const [form, setForm] = useState({
    name: '',
    sku: '',
    price: '',
    stock: '',
    notes: '',
    size: '100ml',
    description: '',
    imageUrl1: '',
    imageUrl2: '',
    imageUrl3: '',
    imageUrl4: '',
    category: 'Signature',
    status: 'Active',
  })
  const [status, setStatus] = useState({ loading: false, error: '', success: '' })

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleFile = (event, key) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => updateField(key, String(reader.result))
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    try {
      setStatus({ loading: true, error: '', success: '' })
      await api.createProduct({
        name: form.name,
        price: Number(form.price),
        stock: Number(form.stock),
        notes: form.notes || `${form.category} blend`,
        size: form.size,
        description: form.description,
        imageUrls: [form.imageUrl1, form.imageUrl2, form.imageUrl3, form.imageUrl4].filter(Boolean),
        category: form.category,
        active: form.status === 'Active',
      })
      setStatus({ loading: false, error: '', success: 'Product added.' })
    } catch (error) {
      setStatus({ loading: false, error: error.message, success: '' })
    }
  }
  return (
    <section className="grid" style={{ gap: '24px' }}>
      <div>
        <h1 className="section-title">Add Product</h1>
        <p className="section-subtitle">Create a new listing with inventory controls.</p>
      </div>

      <form className="card form" onSubmit={handleSubmit}>
        <div className="grid two">
          <div>
            <div className="label">Product Name</div>
            <input
              className="input"
              placeholder="Product name"
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
            />
          </div>
          <div>
            <div className="label">SKU</div>
            <input
              className="input"
              placeholder="SKU-0001"
              value={form.sku}
              onChange={(event) => updateField('sku', event.target.value)}
            />
          </div>
        </div>
        <div className="grid two">
          <div>
            <div className="label">Price</div>
            <input
              className="input"
              type="number"
              placeholder="0.00"
              value={form.price}
              onChange={(event) => updateField('price', event.target.value)}
            />
          </div>
          <div>
            <div className="label">Stock</div>
            <input
              className="input"
              type="number"
              placeholder="0"
              value={form.stock}
              onChange={(event) => updateField('stock', event.target.value)}
            />
          </div>
        </div>
        <div>
          <div className="label">Size</div>
          <input
            className="input"
            placeholder="100ml"
            value={form.size}
            onChange={(event) => updateField('size', event.target.value)}
          />
        </div>
        <div>
          <div className="label">Notes</div>
          <textarea
            className="input"
            rows="3"
            placeholder="Notes and profile"
            value={form.notes}
            onChange={(event) => updateField('notes', event.target.value)}
          />
        </div>
        <div>
          <div className="label">Short Description</div>
          <textarea
            className="input"
            rows="3"
            placeholder="Short description"
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
          />
        </div>
        <div>
          <div className="label">Image URL 1</div>
          <input
            className="input"
            placeholder="https://..."
            value={form.imageUrl1}
            onChange={(event) => updateField('imageUrl1', event.target.value)}
          />
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(event) => handleFile(event, 'imageUrl1')}
          />
        </div>
        <div>
          <div className="label">Image URL 2</div>
          <input
            className="input"
            placeholder="https://..."
            value={form.imageUrl2}
            onChange={(event) => updateField('imageUrl2', event.target.value)}
          />
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(event) => handleFile(event, 'imageUrl2')}
          />
        </div>
        <div>
          <div className="label">Image URL 3</div>
          <input
            className="input"
            placeholder="https://..."
            value={form.imageUrl3}
            onChange={(event) => updateField('imageUrl3', event.target.value)}
          />
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(event) => handleFile(event, 'imageUrl3')}
          />
        </div>
        <div>
          <div className="label">Image URL 4</div>
          <input
            className="input"
            placeholder="https://..."
            value={form.imageUrl4}
            onChange={(event) => updateField('imageUrl4', event.target.value)}
          />
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(event) => handleFile(event, 'imageUrl4')}
          />
        </div>
        <div className="grid two">
          <div>
            <div className="label">Category</div>
            <select
              className="input"
              value={form.category}
              onChange={(event) => updateField('category', event.target.value)}
            >
              <option>Signature</option>
              <option>Fresh</option>
              <option>Floral</option>
              <option>Amber</option>
            </select>
          </div>
          <div>
            <div className="label">Status</div>
            <select
              className="input"
              value={form.status}
              onChange={(event) => updateField('status', event.target.value)}
            >
              <option>Active</option>
              <option>Draft</option>
              <option>Out of Stock</option>
            </select>
          </div>
        </div>
        {status.error && <div className="card">Error: {status.error}</div>}
        {status.success && <div className="card">{status.success}</div>}
        <button className="button" type="submit" disabled={status.loading}>
          {status.loading ? 'Saving...' : 'Save Product'}
        </button>
      </form>
    </section>
  )
}

export default AdminAddProduct

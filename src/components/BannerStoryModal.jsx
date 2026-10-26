import { useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Modal from './Modal.jsx'
import DriveVideoPlayer from './DriveVideoPlayer.jsx'
import { api } from '../lib/api.js'
import { buildCloudinaryUrl } from '../lib/image.js'
import { googleDriveVideo, groupProductsByNote } from '../../server/shared/bannerContent.js'

const priceFormat = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

function NoteProduct({ product, onClose }) {
  const [imageFailed, setImageFailed] = useState(false)
  const image = product.imageUrl || product.imageUrls?.find(Boolean)
  return (
    <Link className="banner-note-product" to={`/product/${encodeURIComponent(product.id)}`} onClick={onClose}>
      <div className="banner-note-product__image">
        {image && !imageFailed ? (
          <img src={buildCloudinaryUrl(image, { width: 360 })} alt={product.name} loading="lazy" decoding="async" onError={() => setImageFailed(true)} />
        ) : <span aria-hidden="true">Severino</span>}
      </div>
      <div className="banner-note-product__copy">
        <h4>{product.name}</h4>
        <p>{[product.category, product.size].filter(Boolean).join(' · ')}</p>
        {Number.isFinite(Number(product.price)) && <strong>{priceFormat.format(Number(product.price))}</strong>}
        {product.stock <= 0 && <span className="banner-note-product__stock">Out of stock</span>}
        <span className="banner-note-product__details">View scent <span aria-hidden="true">→</span></span>
      </div>
    </Link>
  )
}

function FeaturedNotes({ onClose }) {
  const [products, setProducts] = useState([])
  const [status, setStatus] = useState({ loading: true, error: '' })
  const [retry, setRetry] = useState(0)
  const [selectedNote, setSelectedNote] = useState('')
  const id = `banner-notes-${useId().replace(/:/g, '')}`
  const groups = useMemo(() => groupProductsByNote(products), [products])
  const selected = groups.find((group) => group.key === selectedNote) || groups[0]

  useEffect(() => {
    let active = true
    api.products().then((items) => {
      if (!active) return
      setProducts(items)
      setStatus({ loading: false, error: '' })
    }).catch(() => {
      if (active) setStatus({ loading: false, error: 'We could not load the scents. Please try again.' })
    })
    return () => { active = false }
  }, [retry])

  if (status.loading) return <div className="banner-notes-status" role="status"><span className="loader" /> Loading scents...</div>
  if (status.error) return (
    <div className="banner-notes-status" role="alert">
      <p>{status.error}</p>
      <button className="button secondary" type="button" onClick={() => { setStatus({ loading: true, error: '' }); setRetry((value) => value + 1) }}>Try again</button>
    </div>
  )
  if (!groups.length) return <p className="banner-notes-status">No scents to explore yet. Please check back soon.</p>

  return (
    <section className="banner-notes" aria-label="Featured notes">
      <h3 className="banner-notes__heading">Featured Notes</h3>
      <p className="banner-notes__intro">Choose a note to discover the scents that share it.</p>
      <div className="banner-note-tabs" role="tablist" aria-label="Fragrance notes">
        {groups.map((group, index) => (
          <button
            key={group.key}
            id={`${id}-tab-${index}`}
            className="banner-note-tab"
            type="button"
            role="tab"
            aria-selected={selected.key === group.key}
            aria-controls={`${id}-products`}
            tabIndex={selected.key === group.key ? 0 : -1}
            onClick={() => setSelectedNote(group.key)}
            onKeyDown={(event) => {
              let next
              if (event.key === 'ArrowRight') next = (index + 1) % groups.length
              else if (event.key === 'ArrowLeft') next = (index - 1 + groups.length) % groups.length
              else if (event.key === 'Home') next = 0
              else if (event.key === 'End') next = groups.length - 1
              else return
              event.preventDefault()
              setSelectedNote(groups[next].key)
              event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus({ preventScroll: true })
            }}
          >
            {group.name} <span>({group.products.length})</span>
          </button>
        ))}
      </div>
      <div id={`${id}-products`} role="tabpanel" aria-labelledby={`${id}-tab-${groups.indexOf(selected)}`} tabIndex={0}>
        <div className="banner-note-products">
          {selected.products.map((product) => <NoteProduct key={product.id} product={product} onClose={onClose} />)}
        </div>
      </div>
    </section>
  )
}

export default function BannerStoryModal({ story, onClose }) {
  const notes = story.id === 'banner-4'
  const video = story.id === 'banner-5' && googleDriveVideo(story.videoUrl)
  const message = story.message?.trim() || ''
  return (
    <Modal onClick={onClose}>
      <div className={`modal-card announcement-modal banner-story-modal ${notes || video ? 'banner-story-modal--rich' : ''}`} role="dialog" aria-modal="true" aria-labelledby="home-banner-story-title" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" type="button" aria-label="Close" onClick={onClose}>X</button>
        <div className="announcement-modal__badge">Severino Banner</div>
        <h2 id="home-banner-story-title" className="section-title" style={{ fontSize: '28px' }}>{story.title}</h2>
        {video && <DriveVideoPlayer url={story.videoUrl} title="Why Severino? video" />}
        {(message || (!notes && !video)) && <p className="announcement-modal__message">{message || 'No message yet for this banner.'}</p>}
        {notes && <FeaturedNotes onClose={onClose} />}
      </div>
    </Modal>
  )
}

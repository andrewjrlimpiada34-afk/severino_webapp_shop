import Modal from './Modal.jsx'
import StoreIcon from './StoreIcon.jsx'

export default function WelcomeOfferModal({ image, onClose }) {
  return (
    <Modal className="welcome-offer-backdrop" onClick={onClose} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.stopPropagation(); onClose() }
    }}>
      <div className="modal-card welcome-offer" role="dialog" aria-modal="true" aria-labelledby="welcome-offer-title" onClick={(event) => event.stopPropagation()}>
        <div className="welcome-offer-header">
          <span id="welcome-offer-title">Welcome to Severino</span>
          <button className="icon-button welcome-offer-close" type="button" aria-label="Close welcome offer" onClick={onClose}><StoreIcon name="close" /></button>
        </div>
        <div className="welcome-offer-media"><img src={image} alt="Severino welcome offer" /></div>
      </div>
    </Modal>
  )
}

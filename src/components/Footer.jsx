import { Link } from 'react-router-dom'

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-main">
        <div className="footer-heading">
          <div className="footer-eyebrow">Support</div>
          <h2>Severino</h2>
          <p className="footer-description">
            Premium scent studio blending elegance with modern craftsmanship.
          </p>
        </div>

        <div className="footer-grid">
          <div className="footer-contact">
            <div className="footer-contact__label">
              <svg className="footer-contact__icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 6h16v12H4V6Zm0 0 8 7 8-7"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
              <span>Email</span>
            </div>
            <a className="footer-contact__value" href="mailto:uvervidallonguevara@gmail.com">
              uvervidallonguevara@gmail.com
            </a>
          </div>
          <div className="footer-contact">
            <div className="footer-contact__label">
              <svg className="footer-contact__icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6.6 3.8 9.2 6.4 7.5 9c.9 1.9 2.5 3.5 4.4 4.4l2.6-1.7 2.6 2.6-1.2 3.1c-.3.7-1 1.1-1.8 1A14.2 14.2 0 0 1 5.5 9.8c-.1-.8.3-1.5 1-1.8l.1-4.2Z"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                />
              </svg>
              <span>Phone</span>
            </div>
            <a className="footer-contact__value" href="tel:+639164352483">
              +63 916 435 2483
            </a>
          </div>
          <div className="footer-contact">
            <div className="footer-contact__label">
              <svg className="footer-contact__icon" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M15 8h-2a2 2 0 0 0-2 2v2H9v3h2v6h3v-6h2.3l.7-3h-3v-1.5c0-.6.4-1 1-1h2V6h-2Z"
                  fill="currentColor"
                />
              </svg>
              <span>Facebook</span>
            </div>
            <a
              className="footer-contact__value"
              href="https://www.facebook.com/uver.guevara.9"
              target="_blank"
              rel="noreferrer"
            >
              www.facebook.com/uver.guevara.9
            </a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <Link className="footer-logo" to="/" aria-label="Severino home">
          <img src="/logo.svg" alt="Severino" width="150" height="86" />
        </Link>
        <div className="footer-policies">
          <div className="footer-eyebrow">Policies</div>
          <p>COD only. Secure checkout & verified deliveries.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer

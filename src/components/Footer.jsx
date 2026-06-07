function Footer() {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div className="nav-logo">Severino</div>
          <p>
            Premium scent studio blending elegance with modern craftsmanship.
          </p>
        </div>
        <div>
          <div className="tag">Support</div>
          <p className="footer-contact">
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
            <span>uvervidallonguevara@gmail.com</span>
          </p>
          <p className="footer-contact">
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
            <span>+63 916 435 2483</span>
          </p>
          <p className="footer-contact">
            <svg className="footer-contact__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M15 8h-2a2 2 0 0 0-2 2v2H9v3h2v6h3v-6h2.3l.7-3h-3v-1.5c0-.6.4-1 1-1h2V6h-2Z"
                fill="currentColor"
              />
            </svg>
            <span>www.facebook.com/uver.guevara.9</span>
          </p>
        </div>
        <div>
          <div className="tag">Policies</div>
          <p>COD only. Secure checkout & verified deliveries.</p>
        </div>
      </div>
    </footer>
  )
}

export default Footer

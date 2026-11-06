import { useEffect, useRef, useState } from 'react'
import { facebookPageUrl } from '../lib/social.js'
import StoreIcon from './StoreIcon.jsx'

const feedHeight = 420

export default function FacebookPageCard() {
  const [showFeed, setShowFeed] = useState(false)
  const [feedWidth, setFeedWidth] = useState(0)
  const feedContainer = useRef(null)

  useEffect(() => {
    if (!showFeed) return undefined
    const container = feedContainer.current
    const updateWidth = () => {
      setFeedWidth(Math.max(180, Math.min(500, Math.floor(container.getBoundingClientRect().width))))
    }
    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(container)
    return () => observer.disconnect()
  }, [showFeed])

  const pluginUrl = new URL('https://www.facebook.com/plugins/page.php')
  pluginUrl.search = new URLSearchParams({
    href: facebookPageUrl,
    tabs: 'timeline',
    width: String(feedWidth),
    height: String(feedHeight),
    small_header: 'true',
    adapt_container_width: 'true',
    hide_cover: 'false',
    show_facepile: 'false',
  }).toString()

  return (
    <div className="store-facebook-card">
      <a className="store-facebook-preview" href={facebookPageUrl} target="_blank" rel="noreferrer" aria-label="Visit Severino Fragrance Co. on Facebook (opens in a new tab)">
        <img src="/images/severino-editorial.webp" alt="" loading="lazy" decoding="async" />
        <span className="store-facebook-preview-copy">
          <span className="store-eyebrow">Severino Fragrance Co.</span>
          <span className="store-facebook-preview-title">A little everyday elegance.</span>
          <span className="store-facebook-preview-link">Discover more on Facebook <StoreIcon name="arrow" /></span>
        </span>
      </a>
      <div className="store-facebook-feed-controls">
        <button className="store-text-link" type="button" aria-expanded={showFeed} aria-controls="severino-facebook-feed" onClick={() => setShowFeed((visible) => !visible)}>
          {showFeed ? 'Hide live Facebook feed' : 'Show live Facebook feed'}
        </button>
      </div>
      <div className="store-facebook-feed" id="severino-facebook-feed" hidden={!showFeed}>
        <p className="store-facebook-feed-note">If Facebook doesn’t show posts here, <a className="store-text-link" href={facebookPageUrl} target="_blank" rel="noreferrer">visit our page directly</a>.</p>
        <div ref={feedContainer}>
          {showFeed && feedWidth > 0 && <iframe title="Severino Facebook posts" src={pluginUrl.toString()} width={feedWidth} height={feedHeight} style={{ width: feedWidth, height: feedHeight }} allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" />}
        </div>
      </div>
    </div>
  )
}

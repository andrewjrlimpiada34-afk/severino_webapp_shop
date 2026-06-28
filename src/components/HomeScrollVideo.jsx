import { useEffect, useMemo, useRef, useState } from 'react'

const THEME_VIDEO_MAP = {
  Default: { desktop: '/desktop_homevideo/default.mp4', mobile: '/mobile_homevideo/defaultm.mp4' },
  Daylight: { desktop: '/desktop_homevideo/daylight.mp4', mobile: '/mobile_homevideo/daylightm.mp4' },
  'Pink Splush': { desktop: '/desktop_homevideo/pink.mp4', mobile: '/mobile_homevideo/pinkm.mp4' },
  'Blazing Maroon': { desktop: '/desktop_homevideo/maroon.mp4', mobile: '/mobile_homevideo/maroonm.mp4' },
  'Forest Brown': { desktop: '/desktop_homevideo/forest.mp4', mobile: '/mobile_homevideo/forestm.mp4' },
  'Beach Blue': { desktop: '/desktop_homevideo/beach.mp4', mobile: '/mobile_homevideo/beachm.mp4' },
  'Luxurious Gold': { desktop: '/desktop_homevideo/gold.mp4', mobile: '/mobile_homevideo/goldm.mp4' },
  'Shadow Dark Mode': { desktop: '/desktop_homevideo/dark.mp4', mobile: '/mobile_homevideo/darkm.mp4' },
}

function getCurrentTheme() {
  if (typeof document === 'undefined') return 'Default'
  return document.documentElement.getAttribute('data-theme') || 'Default'
}

function getIsMobile() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 720px)').matches
}

function clamp(value, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max)
}

function HomeScrollVideo() {
  const sectionRef = useRef(null)
  const videoRef = useRef(null)
  const frameRef = useRef(0)
  const [theme, setTheme] = useState(getCurrentTheme)
  const [isMobile, setIsMobile] = useState(getIsMobile)
  const [duration, setDuration] = useState(0)

  const source = useMemo(() => {
    const videos = THEME_VIDEO_MAP[theme] || THEME_VIDEO_MAP.Default
    return isMobile ? videos.mobile : videos.desktop
  }, [isMobile, theme])

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(getCurrentTheme()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 720px)')
    const updateMobileState = () => setIsMobile(mediaQuery.matches)

    updateMobileState()
    mediaQuery.addEventListener('change', updateMobileState)
    return () => mediaQuery.removeEventListener('change', updateMobileState)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined

    setDuration(0)
    video.pause()
    video.currentTime = 0
    video.load()

    const handleMetadata = () => {
      setDuration(Number.isFinite(video.duration) ? video.duration : 0)
      video.pause()
    }

    video.addEventListener('loadedmetadata', handleMetadata)
    return () => video.removeEventListener('loadedmetadata', handleMetadata)
  }, [source])

  useEffect(() => {
    const updateFrame = () => {
      frameRef.current = 0
      const section = sectionRef.current
      const video = videoRef.current
      if (!section || !video || !duration) return

      const rect = section.getBoundingClientRect()
      const scrollRange = Math.max(section.offsetHeight - window.innerHeight, 1)
      const progress = clamp(-rect.top / scrollRange)
      const nextTime = progress * duration

      if (Math.abs(video.currentTime - nextTime) > 0.035) {
        video.currentTime = nextTime
      }
      video.pause()
    }

    const requestUpdate = () => {
      if (frameRef.current) return
      frameRef.current = window.requestAnimationFrame(updateFrame)
    }

    updateFrame()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)
    return () => {
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
    }
  }, [duration, source])

  return (
    <section className="home-scroll-video" ref={sectionRef} aria-label="Severino cinematic preview">
      <div className="home-scroll-video__stage">
        <video
          ref={videoRef}
          className="home-scroll-video__media"
          src={source}
          muted
          playsInline
          preload="metadata"
          aria-label={`${theme} Severino homepage video preview`}
        />
        <div className="home-scroll-video__hint">
          <span>Scroll to preview</span>
        </div>
      </div>
    </section>
  )
}

export default HomeScrollVideo

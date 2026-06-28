import { useEffect, useMemo, useRef, useState } from 'react'

const FRAME_FOLDERS = {
  Default: 'default',
  Daylight: 'daylight',
  'Pink Splush': 'pink',
  'Blazing Maroon': 'maroon',
  'Forest Brown': 'forest',
  'Beach Blue': 'beach',
  'Luxurious Gold': 'gold',
  'Shadow Dark Mode': 'dark',
}

const MAX_DISCOVERY_FRAMES = 420
const FRAME_STEP_EASE = 0.34

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

function framePath(folder, index, isMobile) {
  const rootFolder = isMobile ? 'mobile_homevideo' : 'desktop_homevideo'
  return `/${rootFolder}/${folder}/ezgif-frame-${String(index).padStart(3, '0')}.jpg`
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function drawCoverImage(canvas, image) {
  const context = canvas.getContext('2d')
  if (!context || !image) return

  const canvasWidth = canvas.width
  const canvasHeight = canvas.height
  const imageRatio = image.naturalWidth / image.naturalHeight
  const canvasRatio = canvasWidth / canvasHeight
  let drawWidth = canvasWidth
  let drawHeight = canvasHeight
  let offsetX = 0
  let offsetY = 0

  if (imageRatio > canvasRatio) {
    drawHeight = canvasHeight
    drawWidth = drawHeight * imageRatio
    offsetX = (canvasWidth - drawWidth) / 2
  } else {
    drawWidth = canvasWidth
    drawHeight = drawWidth / imageRatio
    offsetY = (canvasHeight - drawHeight) / 2
  }

  context.clearRect(0, 0, canvasWidth, canvasHeight)
  context.drawImage(image, offsetX, offsetY, drawWidth, drawHeight)
}

function resizeCanvas(canvas) {
  const rect = canvas.getBoundingClientRect()
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.max(Math.round(rect.width * pixelRatio), 1)
  const height = Math.max(Math.round(rect.height * pixelRatio), 1)

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }
}

function HomeScrollVideo() {
  const sectionRef = useRef(null)
  const canvasRef = useRef(null)
  const imagesRef = useRef([])
  const latestFrameRef = useRef(0)
  const renderedFrameRef = useRef(-1)
  const animationFrameRef = useRef(0)
  const preloadRunRef = useRef(0)
  const [theme, setTheme] = useState(getCurrentTheme)
  const [isMobile, setIsMobile] = useState(getIsMobile)
  const [loadedCount, setLoadedCount] = useState(0)
  const [frameCount, setFrameCount] = useState(0)

  const folder = useMemo(() => FRAME_FOLDERS[theme] || FRAME_FOLDERS.Default, [theme])

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
    const runId = preloadRunRef.current + 1
    preloadRunRef.current = runId
    imagesRef.current = []
    renderedFrameRef.current = -1
    latestFrameRef.current = 0
    setLoadedCount(0)
    setFrameCount(0)

    let cancelled = false

    const discoverAndPreload = async () => {
      for (let frameNumber = 1; frameNumber <= MAX_DISCOVERY_FRAMES; frameNumber += 1) {
        if (cancelled || preloadRunRef.current !== runId) return

        try {
          const image = await loadImage(framePath(folder, frameNumber, isMobile))
          if (cancelled || preloadRunRef.current !== runId) return

          imagesRef.current[frameNumber - 1] = image
          setLoadedCount(frameNumber)
          setFrameCount(frameNumber)

          if (frameNumber === 1) {
            const canvas = canvasRef.current
            if (canvas) {
              resizeCanvas(canvas)
              drawCoverImage(canvas, image)
            }
          }
        } catch {
          if (frameNumber === 1 && folder !== FRAME_FOLDERS.Default) {
            const fallback = FRAME_FOLDERS.Default
            try {
              const image = await loadImage(framePath(fallback, 1, isMobile))
              if (cancelled || preloadRunRef.current !== runId) return
              imagesRef.current[0] = image
              setLoadedCount(1)
              setFrameCount(1)
              const canvas = canvasRef.current
              if (canvas) {
                resizeCanvas(canvas)
                drawCoverImage(canvas, image)
              }
            } catch {
              return
            }
          }
          return
        }
      }
    }

    discoverAndPreload()
    return () => {
      cancelled = true
    }
  }, [folder, isMobile])

  useEffect(() => {
    const drawCurrentFrame = () => {
      animationFrameRef.current = 0
      const canvas = canvasRef.current
      const images = imagesRef.current
      if (!canvas || images.length === 0) return

      resizeCanvas(canvas)
      const highestLoadedIndex = Math.max(loadedCount - 1, 0)
      const targetFrame = Math.min(Math.round(latestFrameRef.current), highestLoadedIndex)
      const image = images[targetFrame] || images[0]

      if (image && renderedFrameRef.current !== targetFrame) {
        drawCoverImage(canvas, image)
        renderedFrameRef.current = targetFrame
      }
    }

    const requestDraw = () => {
      if (animationFrameRef.current) return
      animationFrameRef.current = window.requestAnimationFrame(drawCurrentFrame)
    }

    const updateByScroll = () => {
      const section = sectionRef.current
      if (!section) return
      const rect = section.getBoundingClientRect()
      const scrollRange = Math.max(section.offsetHeight - window.innerHeight, 1)
      const progress = clamp(-rect.top / scrollRange)
      const totalFrames = Math.max(frameCount, loadedCount, 1)
      const destination = progress * (totalFrames - 1)

      latestFrameRef.current += (destination - latestFrameRef.current) * FRAME_STEP_EASE
      requestDraw()
    }

    updateByScroll()
    window.addEventListener('scroll', updateByScroll, { passive: true })
    window.addEventListener('resize', updateByScroll)
    return () => {
      window.removeEventListener('scroll', updateByScroll)
      window.removeEventListener('resize', updateByScroll)
      if (animationFrameRef.current) window.cancelAnimationFrame(animationFrameRef.current)
    }
  }, [frameCount, loadedCount])

  return (
    <section className="home-scroll-video" ref={sectionRef} aria-label="Severino cinematic preview">
      <div className="home-scroll-video__stage">
        <canvas
          ref={canvasRef}
          className="home-scroll-video__media"
          aria-label={`${theme} Severino homepage frame preview`}
          role="img"
        />
        <div className="home-scroll-video__hint">
          <span>{loadedCount ? 'Scroll to preview' : 'Loading preview'}</span>
        </div>
      </div>
    </section>
  )
}

export default HomeScrollVideo

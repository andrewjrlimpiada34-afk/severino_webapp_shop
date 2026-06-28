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
const SEQUENCE_END_PROGRESS = 0.86
const PRELOAD_BATCH_SIZE = 8
const FRAME_SMOOTHING = 0.18

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

function getCoverRect(canvasWidth, canvasHeight, image) {
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

  return { drawWidth, drawHeight, offsetX, offsetY }
}

function getContainRect(canvasWidth, canvasHeight, image) {
  const imageRatio = image.naturalWidth / image.naturalHeight
  const canvasRatio = canvasWidth / canvasHeight
  let drawWidth = canvasWidth
  let drawHeight = canvasHeight
  let offsetX = 0
  let offsetY = 0

  if (imageRatio > canvasRatio) {
    drawWidth = canvasWidth
    drawHeight = drawWidth / imageRatio
    offsetY = (canvasHeight - drawHeight) / 2
  } else {
    drawHeight = canvasHeight
    drawWidth = drawHeight * imageRatio
    offsetX = (canvasWidth - drawWidth) / 2
  }

  return { drawWidth, drawHeight, offsetX, offsetY }
}

function drawImageRect(context, image, rect) {
  context.drawImage(image, rect.offsetX, rect.offsetY, rect.drawWidth, rect.drawHeight)
}

function drawCinematicFrame(canvas, image, nextImage, blend = 0) {
  const context = canvas.getContext('2d')
  if (!context || !image) return

  const canvasWidth = canvas.width
  const canvasHeight = canvas.height
  const coverRect = getCoverRect(canvasWidth, canvasHeight, image)
  const containRect = getContainRect(canvasWidth, canvasHeight, image)

  context.clearRect(0, 0, canvasWidth, canvasHeight)

  context.save()
  context.filter = `blur(${Math.max(canvasWidth, canvasHeight) * 0.018}px)`
  context.globalAlpha = 0.58
  drawImageRect(context, image, coverRect)
  context.restore()

  const backdrop = context.createLinearGradient(0, 0, canvasWidth, canvasHeight)
  backdrop.addColorStop(0, 'rgba(8, 10, 7, 0.24)')
  backdrop.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)')
  backdrop.addColorStop(1, 'rgba(8, 10, 7, 0.28)')
  context.fillStyle = backdrop
  context.fillRect(0, 0, canvasWidth, canvasHeight)

  context.save()
  context.shadowColor = 'rgba(0, 0, 0, 0.22)'
  context.shadowBlur = Math.max(canvasWidth, canvasHeight) * 0.02
  context.shadowOffsetY = Math.max(canvasHeight * 0.012, 4)
  drawImageRect(context, image, containRect)
  context.restore()

  if (nextImage && blend > 0.02) {
    context.save()
    context.globalAlpha = Math.min(blend, 0.82)
    drawImageRect(context, nextImage, getContainRect(canvasWidth, canvasHeight, nextImage))
    context.restore()
  }
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
  const currentFrameRef = useRef(0)
  const targetFrameRef = useRef(0)
  const renderedFrameRef = useRef(-1)
  const lastBlendRef = useRef(-1)
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
    lastBlendRef.current = -1
    currentFrameRef.current = 0
    targetFrameRef.current = 0
    setLoadedCount(0)
    setFrameCount(0)

    let cancelled = false

    const discoverAndPreload = async () => {
      for (let frameNumber = 1; frameNumber <= MAX_DISCOVERY_FRAMES; frameNumber += PRELOAD_BATCH_SIZE) {
        if (cancelled || preloadRunRef.current !== runId) return

        const batchIndexes = Array.from(
          { length: PRELOAD_BATCH_SIZE },
          (_, index) => frameNumber + index
        ).filter((index) => index <= MAX_DISCOVERY_FRAMES)
        const results = await Promise.allSettled(
          batchIndexes.map((index) => loadImage(framePath(folder, index, isMobile)))
        )
        const firstMissingIndex = results.findIndex((result) => result.status === 'rejected')
        const loadedResults =
          firstMissingIndex === -1 ? results : results.slice(0, firstMissingIndex)

        if (loadedResults.length === 0) {
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
                drawCinematicFrame(canvas, image)
              }
            } catch {
              return
            }
          }
          return
        }

        loadedResults.forEach((result, index) => {
          imagesRef.current[frameNumber + index - 1] = result.value
        })

        if (cancelled || preloadRunRef.current !== runId) return

        const nextCount = frameNumber + loadedResults.length - 1
        setLoadedCount(nextCount)
        setFrameCount(nextCount)

        if (frameNumber === 1) {
          const canvas = canvasRef.current
          const image = loadedResults[0]?.value
          if (canvas && image) {
            resizeCanvas(canvas)
            drawCinematicFrame(canvas, image)
          }
        }

        if (firstMissingIndex !== -1) return
      }
    }

    discoverAndPreload()
    return () => {
      cancelled = true
    }
  }, [folder, isMobile])

  useEffect(() => {
    const drawCurrentFrame = () => {
      const canvas = canvasRef.current
      const images = imagesRef.current
      if (!canvas || images.length === 0) {
        animationFrameRef.current = 0
        return
      }

      resizeCanvas(canvas)
      const highestLoadedIndex = Math.max(loadedCount - 1, 0)
      const safeTarget = Math.min(targetFrameRef.current, highestLoadedIndex)
      const distance = safeTarget - currentFrameRef.current

      if (Math.abs(distance) < 0.025) {
        currentFrameRef.current = safeTarget
      } else {
        currentFrameRef.current += distance * FRAME_SMOOTHING
      }

      const frameValue = clamp(currentFrameRef.current, 0, highestLoadedIndex)
      const baseFrame = Math.min(Math.floor(frameValue), highestLoadedIndex)
      const nextFrame = Math.min(baseFrame + 1, highestLoadedIndex)
      const blend = frameValue - baseFrame
      const image = images[baseFrame] || images[0]
      const nextImage = images[nextFrame]
      const roundedBlend = Math.round(blend * 100) / 100

      if (
        image &&
        (renderedFrameRef.current !== baseFrame || lastBlendRef.current !== roundedBlend)
      ) {
        drawCinematicFrame(canvas, image, nextImage, blend)
        renderedFrameRef.current = baseFrame
        lastBlendRef.current = roundedBlend
      }

      if (Math.abs(targetFrameRef.current - currentFrameRef.current) > 0.025) {
        animationFrameRef.current = window.requestAnimationFrame(drawCurrentFrame)
      } else {
        animationFrameRef.current = 0
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
      const sequenceProgress = clamp(progress / SEQUENCE_END_PROGRESS)
      const totalFrames = Math.max(frameCount, loadedCount, 1)
      const destination = sequenceProgress * (totalFrames - 1)

      targetFrameRef.current = destination
      if (sequenceProgress >= 1) {
        currentFrameRef.current = destination
      }
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

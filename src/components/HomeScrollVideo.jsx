import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
const MOBILE_BREAKPOINT = 768
const SMOOTHING_FACTOR = 0.14
const MOBILE_SMOOTHING_FACTOR = 0.24
const PROGRESS_EPSILON = 0.0012

function getCurrentTheme() {
  if (typeof document === 'undefined') return 'Default'
  return document.documentElement.getAttribute('data-theme') || 'Default'
}

function getIsMobile() {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= MOBILE_BREAKPOINT
}

function clamp(value, min = 0, max = 1) {
  return Math.min(Math.max(value, min), max)
}

function framePath(folder, index, isMobile) {
  const rootFolder = isMobile ? 'mobile_homevideo' : 'desktop_homevideo'
  return `/${rootFolder}/${folder}/ezgif-frame-${String(index).padStart(3, '0')}.jpg`
}

function loadFrame(src) {
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

  if (canvasRatio > imageRatio) {
    const drawWidth = canvasWidth
    const drawHeight = drawWidth / imageRatio
    return {
      drawWidth,
      drawHeight,
      offsetX: 0,
      offsetY: (canvasHeight - drawHeight) / 2,
    }
  }

  const drawHeight = canvasHeight
  const drawWidth = drawHeight * imageRatio
  return {
    drawWidth,
    drawHeight,
    offsetX: (canvasWidth - drawWidth) / 2,
    offsetY: 0,
  }
}

function getContainRect(canvasWidth, canvasHeight, image) {
  const imageRatio = image.naturalWidth / image.naturalHeight
  const canvasRatio = canvasWidth / canvasHeight

  if (canvasRatio > imageRatio) {
    const drawHeight = canvasHeight
    const drawWidth = drawHeight * imageRatio
    return {
      drawWidth,
      drawHeight,
      offsetX: (canvasWidth - drawWidth) / 2,
      offsetY: 0,
    }
  }

  const drawWidth = canvasWidth
  const drawHeight = drawWidth / imageRatio
  return {
    drawWidth,
    drawHeight,
    offsetX: 0,
    offsetY: (canvasHeight - drawHeight) / 2,
  }
}

function drawImage(context, image, rect) {
  context.drawImage(image, rect.offsetX, rect.offsetY, rect.drawWidth, rect.drawHeight)
}

function HomeScrollVideo() {
  const sectionRef = useRef(null)
  const canvasRef = useRef(null)
  const framesRef = useRef([])
  const animationFrameRef = useRef(null)
  const loadedRef = useRef(false)
  const lastFrameRef = useRef(-1)
  const preloadRunRef = useRef(0)
  const targetProgressRef = useRef(0)
  const currentProgressRef = useRef(0)
  const isSectionActiveRef = useRef(false)
  const isMobileRef = useRef(getIsMobile())
  const progressFillRef = useRef(null)
  const sequenceReadoutRef = useRef(null)

  const [theme, setTheme] = useState(getCurrentTheme)
  const [isMobile, setIsMobile] = useState(getIsMobile)
  const [frameCount, setFrameCount] = useState(0)
  const [loadProgress, setLoadProgress] = useState(0)

  const folder = useMemo(() => FRAME_FOLDERS[theme] || FRAME_FOLDERS.Default, [theme])

  const drawFrame = useCallback((index) => {
    const canvas = canvasRef.current
    const image = framesRef.current[index]
    if (!canvas || !image || !image.complete || !image.naturalWidth) return

    const context = canvas.getContext('2d')
    if (!context) return

    const canvasWidth = canvas.width
    const canvasHeight = canvas.height
    const isMobileCanvas = isMobileRef.current
    const coverRect = getCoverRect(canvasWidth, canvasHeight, image)
    const containRect = getContainRect(canvasWidth, canvasHeight, image)

    context.clearRect(0, 0, canvasWidth, canvasHeight)

    context.save()
    if (!isMobileCanvas) {
      context.filter = `blur(${Math.max(canvasWidth, canvasHeight) * 0.018}px)`
    }
    context.globalAlpha = isMobileCanvas ? 0.42 : 0.56
    drawImage(context, image, coverRect)
    context.restore()

    const vignette = context.createRadialGradient(
      canvasWidth / 2,
      canvasHeight * 0.55,
      canvasHeight * 0.15,
      canvasWidth / 2,
      canvasHeight * 0.55,
      Math.max(canvasWidth, canvasHeight) * 0.74
    )
    vignette.addColorStop(0, 'rgba(255, 255, 255, 0.05)')
    vignette.addColorStop(0.62, 'rgba(12, 14, 10, 0.16)')
    vignette.addColorStop(1, 'rgba(12, 14, 10, 0.62)')
    context.fillStyle = vignette
    context.fillRect(0, 0, canvasWidth, canvasHeight)

    context.save()
    if (!isMobileCanvas) {
      context.shadowColor = 'rgba(0, 0, 0, 0.24)'
      context.shadowBlur = Math.max(canvasWidth, canvasHeight) * 0.018
      context.shadowOffsetY = Math.max(canvasHeight * 0.01, 3)
    }
    drawImage(context, image, containRect)
    context.restore()
  }, [])

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const devicePixelRatio = isMobileRef.current
      ? Math.min(window.devicePixelRatio || 1, 1.5)
      : Math.min(window.devicePixelRatio || 1, 2)
    const width = Math.max(Math.round(rect.width * devicePixelRatio), 1)
    const height = Math.max(Math.round(rect.height * devicePixelRatio), 1)

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    drawFrame(lastFrameRef.current >= 0 ? lastFrameRef.current : 0)
  }, [drawFrame])

  const updateProgressUi = useCallback((progress, frameIndex, loadedFrames) => {
    if (progressFillRef.current) {
      progressFillRef.current.style.transform = `scaleX(${progress})`
    }

    if (sequenceReadoutRef.current) {
      sequenceReadoutRef.current.textContent = `SEQ ${String(frameIndex + 1).padStart(
        3,
        '0'
      )} / ${loadedFrames}`
    }
  }, [])

  const renderProgressFrame = useCallback((progress) => {
    const loadedFrames = framesRef.current.length
    if (!loadedRef.current || loadedFrames === 0) return

    const clampedProgress = clamp(progress)
    const frameIndex = loadedFrames === 1
      ? 0
      : Math.round(clampedProgress * (loadedFrames - 1))

    updateProgressUi(clampedProgress, frameIndex, loadedFrames)

    if (frameIndex !== lastFrameRef.current) {
      lastFrameRef.current = frameIndex
      drawFrame(frameIndex)
    }
  }, [drawFrame, updateProgressUi])

  const stopRenderLoop = useCallback(() => {
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
  }, [])

  const startRenderLoop = useCallback(() => {
    if (animationFrameRef.current) return

    const render = () => {
      const targetProgress = clamp(targetProgressRef.current)
      const currentProgress = clamp(currentProgressRef.current)
      const distance = targetProgress - currentProgress
      const smoothingFactor = isMobileRef.current ? MOBILE_SMOOTHING_FACTOR : SMOOTHING_FACTOR
      const shouldSnap = Math.abs(distance) <= PROGRESS_EPSILON
      const nextProgress = shouldSnap
        ? targetProgress
        : currentProgress + distance * smoothingFactor

      currentProgressRef.current = clamp(nextProgress)
      renderProgressFrame(currentProgressRef.current)

      const stillMoving = Math.abs(targetProgressRef.current - currentProgressRef.current) > PROGRESS_EPSILON
      const keepRendering = isSectionActiveRef.current || stillMoving

      if (keepRendering) {
        animationFrameRef.current = window.requestAnimationFrame(render)
        return
      }

      animationFrameRef.current = null
    }

    animationFrameRef.current = window.requestAnimationFrame(render)
  }, [renderProgressFrame])

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(getCurrentTheme()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const updateMobileState = () => {
      const nextIsMobile = getIsMobile()
      isMobileRef.current = nextIsMobile
      setIsMobile(nextIsMobile)
    }

    updateMobileState()
    window.addEventListener('resize', updateMobileState)
    return () => window.removeEventListener('resize', updateMobileState)
  }, [])

  useEffect(() => {
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [resizeCanvas])

  useEffect(() => {
    const runId = preloadRunRef.current + 1
    preloadRunRef.current = runId
    loadedRef.current = false
    framesRef.current = []
    lastFrameRef.current = -1
    targetProgressRef.current = 0
    currentProgressRef.current = 0
    setFrameCount(0)
    setLoadProgress(0)
    updateProgressUi(0, 0, '---')

    let cancelled = false
    let loadedCount = 0
    const stateUpdateStride = isMobile ? 12 : 4
    const images = []

    const loadSequence = async () => {
      for (let index = 1; index <= MAX_DISCOVERY_FRAMES; index += 1) {
        if (cancelled || preloadRunRef.current !== runId) return

        try {
          const image = await loadFrame(framePath(folder, index, isMobile))
          if (cancelled || preloadRunRef.current !== runId) return

          images.push(image)
          framesRef.current = images
          loadedCount += 1

          if (loadedCount === 1 || loadedCount % stateUpdateStride === 0) {
            setFrameCount(loadedCount)
            setLoadProgress(Math.min(loadedCount / MAX_DISCOVERY_FRAMES, 0.96))
          }

          if (loadedCount === 1) {
            loadedRef.current = true
            setLoadProgress(1)
            lastFrameRef.current = 0
            targetProgressRef.current = 0
            currentProgressRef.current = 0
            resizeCanvas()
            drawFrame(0)
            updateProgressUi(0, 0, 1)
          }
        } catch {
          if (index === 1 && folder !== FRAME_FOLDERS.Default) {
            try {
              const fallback = await loadFrame(framePath(FRAME_FOLDERS.Default, 1, isMobile))
              if (cancelled || preloadRunRef.current !== runId) return
              framesRef.current = [fallback]
              loadedCount = 1
              loadedRef.current = true
              setFrameCount(1)
              setLoadProgress(1)
              lastFrameRef.current = 0
              targetProgressRef.current = 0
              currentProgressRef.current = 0
              resizeCanvas()
              drawFrame(0)
              updateProgressUi(0, 0, 1)
            } catch {
              return
            }
          }
          setLoadProgress(1)
          setFrameCount(loadedCount)
          return
        }
      }
      setFrameCount(loadedCount)
      setLoadProgress(1)
    }

    loadSequence()
    return () => {
      cancelled = true
    }
  }, [drawFrame, folder, isMobile, resizeCanvas, updateProgressUi])

  useEffect(() => {
    const handleScroll = () => {
      const section = sectionRef.current
      if (!section || !loadedRef.current || framesRef.current.length === 0) return

      const rect = section.getBoundingClientRect()
      const scrollable = Math.max(section.offsetHeight - window.innerHeight, 1)
      const progress = clamp(-rect.top / scrollable)

      targetProgressRef.current = progress
      isSectionActiveRef.current = rect.bottom > 0 && rect.top < window.innerHeight

      if (progress === 0 || progress === 1) {
        targetProgressRef.current = progress
        currentProgressRef.current = progress
        renderProgressFrame(progress)
      }

      startRenderLoop()
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)
    return () => {
      stopRenderLoop()
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [renderProgressFrame, startRenderLoop, stopRenderLoop])

  return (
    <section className="home-scroll-video" ref={sectionRef} aria-label="Severino cinematic preview">
      <div className="home-scroll-video__stage">
        <canvas
          ref={canvasRef}
          className="home-scroll-video__media"
          aria-label={`${theme} Severino homepage frame preview`}
          role="img"
        />
        <div className="home-scroll-video__hud">
          <span ref={sequenceReadoutRef}>SEQ 001 / {frameCount || '---'}</span>
          <span>{frameCount ? `${frameCount} frames` : 'Loading'}</span>
        </div>
        <div className="home-scroll-video__progress" aria-hidden="true">
          <span ref={progressFillRef} style={{ transform: `scaleX(${loadProgress})` }} />
        </div>
        <div className="home-scroll-video__hint">
          <span>{frameCount ? 'Scroll to preview' : 'Loading preview'}</span>
        </div>
      </div>
    </section>
  )
}

export default HomeScrollVideo

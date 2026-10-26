import { useCallback, useEffect, useId, useState } from 'react'
import Modal from './Modal.jsx'

// Paths follow the two sweeping strokes of the S in public/logooff.png.
const fineTrace = 'M 746 580 L 742 810 C 731 650 653 570 505 570 C 375 570 298 645 298 738 C 296 850 393 899 550 972 C 720 1052 805 1143 805 1287'
const mainTrace = 'M 270 635 C 177 802 280 912 496 1006 C 688 1089 763 1187 713 1319 C 663 1452 516 1502 368 1446 C 272 1410 230 1338 226 1190 L 225 1470'

export default function BrandIntro() {
  const [phase, setPhase] = useState('loading')
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const id = `brand-intro-${useId().replace(/:/g, '')}`
  const finish = useCallback(() => setPhase((current) => current === 'done' ? current : 'leaving'), [])

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(preference.matches)
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (phase === 'done') return undefined
    const delay = phase === 'loading' ? 4500
      : phase === 'leaving' ? reducedMotion ? 100 : 380
        : reducedMotion ? 650 : 2850
    const timer = window.setTimeout(() => {
      setPhase(phase === 'loading' || phase === 'leaving' ? 'done' : 'leaving')
    }, delay)
    return () => window.clearTimeout(timer)
  }, [phase, reducedMotion])

  if (phase === 'done') return null

  return (
    <Modal
      className={`brand-intro ${phase === 'leaving' ? 'brand-intro--leaving' : ''} ${reducedMotion ? 'brand-intro--reduced' : ''}`}
      onKeyDown={(event) => { if (event.key === 'Escape') finish() }}
    >
      <div className="modal-card brand-intro__card" role="dialog" aria-modal="true" aria-label="Welcome to Severino">
        <img
          className="brand-intro__preload"
          src="/logooff.png"
          alt=""
          aria-hidden="true"
          onLoad={() => setPhase((current) => current === 'loading' ? 'drawing' : current)}
          onError={() => setPhase('done')}
        />
        {phase !== 'loading' && (
          <svg className="brand-intro__logo" viewBox="145 500 1710 1050" role="img" aria-label="Severino">
            <defs>
              <filter id={`${id}-glow`} x="-150%" y="-150%" width="400%" height="400%">
                <feGaussianBlur stdDeviation="9" />
              </filter>
              <mask id={`${id}-logo`} maskUnits="userSpaceOnUse" x="0" y="0" width="2000" height="2000" style={{ maskType: 'alpha' }}>
                <image href="/logooff.png" width="2000" height="2000" />
              </mask>
              <mask id={`${id}-reveal`} maskUnits="userSpaceOnUse" x="145" y="500" width="700" height="1050">
                <path className="brand-intro__trace brand-intro__trace--fine" d={fineTrace} pathLength="1" strokeWidth="85" />
                <path className="brand-intro__trace brand-intro__trace--main" d={mainTrace} pathLength="1" strokeWidth="190" />
              </mask>
              <clipPath id={`${id}-initial`}><path d="M 180 500 H 780 V 1115 H 830 V 1540 H 180 Z" /></clipPath>
              <clipPath id={`${id}-word`}><rect x="780" y="780" width="1060" height="365" /></clipPath>
              <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="0.2" y2="1">
                <stop offset="0" stopColor="#9b8231" />
                <stop offset="0.35" stopColor="#baa04c" />
                <stop offset="0.6" stopColor="#887124" />
                <stop offset="0.82" stopColor="#b79c46" />
                <stop offset="1" stopColor="#806a24" />
              </linearGradient>
              <linearGradient id={`${id}-shimmer`}>
                <stop offset="0" stopColor="#fff7db" stopOpacity="0" />
                <stop offset="0.5" stopColor="#fff7db" stopOpacity="0.9" />
                <stop offset="1" stopColor="#fff7db" stopOpacity="0" />
              </linearGradient>
            </defs>

            <g mask={`url(#${id}-logo)`}>
              <g clipPath={`url(#${id}-initial)`}>
                <rect x="180" y="500" width="650" height="1040" fill={`url(#${id}-gold)`} mask={`url(#${id}-reveal)`} />
                <rect className="brand-intro__initial-finish" x="180" y="500" width="650" height="1040" fill={`url(#${id}-gold)`} />
              </g>
              <g className="brand-intro__word" clipPath={`url(#${id}-word)`}>
                <rect x="780" y="780" width="1060" height="365" fill={`url(#${id}-gold)`} />
                <rect className="brand-intro__shimmer" x="600" y="740" width="300" height="430" fill={`url(#${id}-shimmer)`} />
              </g>
            </g>

            {!reducedMotion && (
              <>
                <g className="brand-intro__spark brand-intro__spark--fine">
                  <circle r="17" fill="#e6bd62" filter={`url(#${id}-glow)`} />
                  <circle r="5" fill="#fff2c6" />
                  <animateMotion path={fineTrace} dur="0.95s" fill="freeze" calcMode="paced" />
                </g>
                <g className="brand-intro__spark brand-intro__spark--main">
                  <circle r="18" fill="#e6bd62" filter={`url(#${id}-glow)`} />
                  <circle r="5" fill="#fff2c6" />
                  <animateMotion path={mainTrace} begin="0.9s" dur="1.15s" fill="freeze" calcMode="paced" />
                </g>
              </>
            )}
          </svg>
        )}
        <button className="brand-intro__skip" type="button" onClick={finish}>Skip intro</button>
      </div>
    </Modal>
  )
}

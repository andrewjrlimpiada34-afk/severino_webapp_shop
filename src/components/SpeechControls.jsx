import { useEffect, useRef, useState } from 'react'

let activeSpeech = null

export default function SpeechControls({ text, label = 'this content' }) {
  const supported =
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis?.speak === 'function' &&
    typeof window.SpeechSynthesisUtterance === 'function'
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')
  const utteranceRef = useRef(null)

  useEffect(
    () => () => {
      if (activeSpeech?.utterance === utteranceRef.current) activeSpeech.stop()
    },
    [text]
  )

  if (!supported)
    return (
      <p className="speech-fallback">
        Read aloud is unavailable in this browser.
      </p>
    )
  const play = () => {
    activeSpeech?.stop()
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-PH'
    utteranceRef.current = utterance
    const stop = () => {
      utterance.onend = null
      utterance.onerror = null
      window.speechSynthesis.cancel()
      activeSpeech = null
      setState('idle')
    }
    activeSpeech = { utterance, stop }
    utterance.onend = () => {
      if (activeSpeech?.utterance === utterance) {
        activeSpeech = null
        setState('idle')
      }
    }
    utterance.onerror = () => {
      if (activeSpeech?.utterance === utterance) {
        activeSpeech = null
        setState('idle')
        setError(
          'Speech playback is unavailable. Try again or read the text below.'
        )
      }
    }
    setError('')
    setState('playing')
    window.speechSynthesis.speak(utterance)
  }
  const pause = () => {
    if (state === 'paused') {
      window.speechSynthesis.resume()
      setState('playing')
    } else {
      window.speechSynthesis.pause()
      setState('paused')
    }
  }
  return (
    <div
      className="speech-controls"
      role="group"
      aria-label={`Read aloud ${label}`}
    >
      <span>Read aloud</span>
      <button
        className="button secondary"
        type="button"
        onClick={play}
        disabled={!text?.trim()}
      >
        {state === 'idle' ? 'Play' : 'Replay'}
      </button>
      <button
        className="button secondary"
        type="button"
        disabled={state === 'idle'}
        onClick={pause}
      >
        {state === 'paused' ? 'Resume' : 'Pause'}
      </button>
      <button
        className="button secondary"
        type="button"
        disabled={state === 'idle'}
        onClick={() => activeSpeech?.stop()}
      >
        Stop
      </button>
      <span role="status" className="speech-status">
        {error ||
          (state === 'playing'
            ? 'Reading aloud'
            : state === 'paused'
              ? 'Paused'
              : '')}
      </span>
    </div>
  )
}

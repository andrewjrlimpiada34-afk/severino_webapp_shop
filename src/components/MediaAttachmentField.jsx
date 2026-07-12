import { useEffect, useId, useRef, useState } from 'react'

const MAX_MEDIA_BYTES = 15 * 1024 * 1024
const MAX_VIDEO_SECONDS = 30
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes)) return ''
  return `${(bytes / (1024 * 1024)).toFixed(bytes >= 1024 * 1024 ? 1 : 2)} MB`
}

const readVideoDuration = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const cleanUp = () => URL.revokeObjectURL(url)
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = video.duration
      cleanUp()
      resolve(duration)
    }
    video.onerror = () => {
      cleanUp()
      reject(new Error('This video could not be read. Please choose another file.'))
    }
    video.src = url
  })

async function validateMedia(file) {
  const isImage = file.type.startsWith('image/')
  const isVideo = SUPPORTED_VIDEO_TYPES.includes(file.type)
  if (!isImage && !isVideo) {
    throw new Error('Choose an image, MP4, WebM, or MOV video.')
  }
  if (file.size > MAX_MEDIA_BYTES) {
    throw new Error('Attachment must be 15 MB or smaller.')
  }
  if (isVideo) {
    const duration = await readVideoDuration(file)
    if (!Number.isFinite(duration) || duration > MAX_VIDEO_SECONDS) {
      throw new Error(`Video must be ${MAX_VIDEO_SECONDS} seconds or shorter.`)
    }
  }
}

export function MediaAttachmentDisplay({ attachment, className = '' }) {
  if (!attachment?.url) return null
  const isVideo = attachment.mediaType === 'video'
  return (
    <div className={`submitted-media ${className}`.trim()}>
      {isVideo ? (
        <video controls preload="metadata" src={attachment.url} />
      ) : (
        <img src={attachment.url} alt="Customer attachment" loading="lazy" decoding="async" />
      )}
    </div>
  )
}

function MediaAttachmentField({ file, onChange, onError, disabled = false, label = 'Attachment' }) {
  const generatedId = useId()
  const inputId = `media-attachment-${generatedId.replace(/:/g, '')}`
  const inputRef = useRef(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [validating, setValidating] = useState(false)

  useEffect(() => {
    if (!file) {
      setPreviewUrl('')
      return undefined
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const clearSelection = () => {
    onChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleFileChange = async (event) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return
    setValidating(true)
    onError?.('')
    try {
      await validateMedia(selectedFile)
      onChange(selectedFile)
    } catch (error) {
      clearSelection()
      onError?.(error.message)
    } finally {
      setValidating(false)
    }
  }

  return (
    <div className="media-attachment-field">
      <div className="label">{label} (Optional)</div>
      {!file ? (
        <label
          className={`media-attachment-picker ${disabled || validating ? 'disabled' : ''}`}
          htmlFor={inputId}
        >
          <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="9" cy="10" r="1.7" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="m5.5 17 4.2-4 3.1 2.8 2.2-2 3.5 3.2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>{validating ? 'Checking media...' : 'Attach photo or short video'}</span>
        </label>
      ) : (
        <div className="media-attachment-preview">
          {file.type.startsWith('video/') ? (
            <video controls preload="metadata" src={previewUrl} />
          ) : (
            <img src={previewUrl} alt="Selected attachment preview" />
          )}
          <div className="media-attachment-meta">
            <span>{file.name}</span>
            <small>{formatFileSize(file.size)}</small>
          </div>
          <button
            className="media-attachment-remove"
            type="button"
            aria-label="Remove attachment"
            title="Remove attachment"
            onClick={clearSelection}
            disabled={disabled}
          >
            <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}
      <input
        ref={inputRef}
        id={inputId}
        className="media-attachment-input"
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime"
        onChange={handleFileChange}
        disabled={disabled || validating}
      />
      <p className="media-attachment-help">Images or videos up to 30 seconds and 15 MB.</p>
    </div>
  )
}

export default MediaAttachmentField

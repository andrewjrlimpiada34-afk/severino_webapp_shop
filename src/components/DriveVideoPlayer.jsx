import { googleDriveVideo } from '../../server/shared/bannerContent.js'

export default function DriveVideoPlayer({ url, title }) {
  const video = googleDriveVideo(url)
  if (!video) return null

  return (
    <div className="banner-video">
      <div className="banner-video__frame">
        <iframe
          src={video.embedUrl}
          title={title}
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          allowFullScreen
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
      <a className="banner-video__link" href={video.shareUrl} target="_blank" rel="noopener noreferrer">
        Open video in Google Drive
      </a>
    </div>
  )
}

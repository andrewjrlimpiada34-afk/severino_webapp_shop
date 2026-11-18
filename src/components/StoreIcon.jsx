const paths = {
  accessibility: <><circle cx="12" cy="4" r="2" /><path d="m3 8 9 2 9-2m-9 2v5m0 0-5 7m5-7 5 7" /></>,
  keyboard: <><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 10h1m3 0h1m3 0h1m3 0h.1M7 15h10"/></>,
  link: <><path d="m9 15 6-6m-4-2 2-2a4 4 0 0 1 6 6l-2 2m-4 4-2 2a4 4 0 0 1-6-6l2-2"/></>,
  contrast: <><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor"/></>,
  motion: <><path d="M3 8h7M2 12h5M4 16h5"/><circle cx="15" cy="12" r="6"/></>,
  read: <><path d="M3 5c3-1 6 0 9 2 3-2 6-3 9-2v13c-3-1-6 0-9 2-3-2-6-3-9-2ZM12 7v13"/></>,
  volume: <><path d="M3 9h4l5-4v14l-5-4H3Zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
  pause: <path d="M8 5v14m8-14v14" strokeWidth="3"/>,
  play: <path d="m7 4 13 8-13 8Z"/>,
  stop: <rect x="6" y="6" width="12" height="12" rx="1"/>,
  reset: <><path d="M4 11a8 8 0 1 1 2 7M4 4v7h7"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  list: <><path d="M9 5h12M9 12h12M9 19h12" /><path d="M3 5h.01M3 12h.01M3 19h.01" strokeWidth="3" /></>,
  filter: <><path d="M3 6h18M3 12h18M3 18h18" /><path d="M8 3v6M16 9v6M8 15v6" /></>,
  heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z" />,
  bag: <><path d="M5 7h14l2 14H3L5 7Z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
  cart: <><path d="M6 6h14l-1.6 7.5a2 2 0 0 1-2 1.5H9.2a2 2 0 0 1-2-1.5L5.4 4.5H3" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></>,
  type: <><path d="M4 5V3h16v2M12 3v18M8 21h8" /></>,
  arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
  chevron: <path d="m9 5 7 7-7 7" />,
  box: <><path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10M7.5 4.5l9 5" /></>,
  palette: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8M12 17v4" /></>,
  shield: <><path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z" /><path d="m8 12 3 3 5-6" /></>,
  bottle: <><path d="M9 3h6v5H9zM8 8h8l3 4v9H5v-9l3-4Z" /><path d="M9 13h6v4H9z" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
}

export default function StoreIcon({ name, className = '', ...props }) {
  return <svg className={`store-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.arrow}</svg>
}

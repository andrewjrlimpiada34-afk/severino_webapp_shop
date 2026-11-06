const paths = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  list: <><path d="M9 5h12M9 12h12M9 19h12" /><path d="M3 5h.01M3 12h.01M3 19h.01" strokeWidth="3" /></>,
  filter: <><path d="M3 6h18M3 12h18M3 18h18" /><path d="M8 3v6M16 9v6M8 15v6" /></>,
  heart: <path d="M20.8 5.6a5.5 5.5 0 0 0-8.8 1 5.5 5.5 0 0 0-8.8 6.3L12 21l8.8-8.1a5.5 5.5 0 0 0 0-7.3Z" />,
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

const paths = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  banners: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="8" cy="9" r="1.5" /><path d="m3 16 5-4 4 3 4-5 5 6" /></>,
  stories: <><path d="M7 3h9l4 4v13a1 1 0 0 1-1 1H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M15 3v5h5M9 12h7M9 16h5" /></>,
  featured: <><rect x="3" y="7" width="14" height="14" rx="2" /><path d="M7 3h12a2 2 0 0 1 2 2v12M3 17l4-4 3 3 3-4 4 5" /></>,
  details: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M7 8h4M7 12h10M7 16h7M15 7h2v2h-2z" /></>,
  hero: <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 10h18M8 4v6M7 14h5M7 17h9" /></>,
  notices: <><path d="m4 10 12-5v14L4 14v-4ZM8 16l1 5H6l-1-6M20 8l1-1M20 16l1 1M20 12h2" /></>,
  popup: <><rect x="3" y="5" width="18" height="15" rx="3" /><path d="M3 10h18M7 7.5h.01M10 7.5h.01M10 14l4 2-4 2v-4Z" /></>,
  sales: <><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" /></>,
  feedback: <><path d="M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0Z" /><path d="M7 9h10M7 13h7" /></>,
  add: <><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M12 7v10M7 12h10" /></>,
  products: <><path d="m12 3 9 5v9l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v9M7.5 5.5l9 5" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 5a3 3 0 0 1 0 6M21 21v-3a6 6 0 0 0-3-5" /></>,
  orders: <><path d="M6 3h12l2 18-4-2-4 2-4-2-4 2L6 3Z" /><path d="M9 8h6M9 12h6" /></>,
  logout: <><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 7l5 5-5 5M8 12h13" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4M17 3v4M3 11h18M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01" /></>,
  trophy: <><path d="M8 3h8v5a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 12v5M8 21h8M9 17h6v4H9z" /></>,
  bottle: <><path d="M9 3h6v4H9zM8 7h8v3l3 3v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7l3-3V7Z" /><path d="M8 14h8v4H8z" /></>,
  print: <><path d="M7 8V3h10v5M7 17H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-3" /><path d="M7 14h10v7H7zM17 11h.01" /></>,
  left: <path d="m14 6-6 6 6 6" />,
  right: <path d="m10 6 6 6-6 6" />,
}

export default function AdminIcon({ name, className = '', ...props }) {
  return (
    <svg className={`admin-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      {paths[name] || paths.overview}
    </svg>
  )
}

// A desktop tab can switch to a phone layout through the browser's device toolbar.
// Users who start on a phone should always get the storefront.
const desktop = window.matchMedia('(min-width: 901px) and (pointer: fine)')
const phone = window.matchMedia('(max-width: 640px) and (pointer: coarse)')
const desktopMarker = 'severino_desktop_viewport'
let wasDesktop = desktop.matches
let openingPreview = false
let storefront

// Some device toolbars reload the current document when the device changes.
// Only carry the marker over a reload, so following "Open shop" starts fresh.
try {
  if (performance.getEntriesByType('navigation')[0]?.type === 'reload') {
    wasDesktop ||= sessionStorage.getItem(desktopMarker) === '1'
  } else {
    sessionStorage.removeItem(desktopMarker)
  }
} catch {
  // The in-page transition also works when tab storage is unavailable.
}

function checkViewport() {
  if (openingPreview) return

  if (desktop.matches) {
    wasDesktop = true
    try {
      sessionStorage.setItem(desktopMarker, '1')
    } catch {
      // Keep the marker in memory for this visit.
    }
  } else if (wasDesktop && phone.matches) {
    openingPreview = true
    storefront?.unmount()
    window.location.replace('/preview.html')
  }
}

desktop.addEventListener('change', checkViewport)
phone.addEventListener('change', checkViewport)
window.addEventListener('pageshow', checkViewport)
checkViewport()

if (!openingPreview) {
  import('./main.jsx').then(({ mountStorefront }) => {
    if (!openingPreview) storefront = mountStorefront()
  })
}

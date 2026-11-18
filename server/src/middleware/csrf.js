export function protectCookieMutations(req, res, next) {
  if (
    ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ||
    !(req.cookies?.token || req.cookies?.google_onboarding)
  )
    return next()
  if (req.get('X-Severino-Request') !== '1')
    return res
      .status(403)
      .json({ message: 'Refresh the page before trying this action again.' })
  return next()
}

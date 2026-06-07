# TODO

## Featured banners separation (carousel vs featured)

- [ ] Implement new DB dataset `featured_banners` in `server/src/db/banners.js` (max 3)
- [ ] Add admin endpoints in `server/src/routes/admin.js`: GET/PUT `/featured-banners`
- [ ] Add public endpoint in `server/src/routes/public.js`: GET `/featured-banners`
- [ ] Extend client API in `src/lib/api.js` for admin/public featured banners
- [ ] Update `src/pages/Home.jsx` to render featured cards using `/featured-banners` (max 3) with per-card popup message
- [ ] Update `src/pages/AdminDashboard.jsx` to manage featured banners (upload up to 3 images, edit title + popup message, save)
- [ ] Verify build/lint for root + server


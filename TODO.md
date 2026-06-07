# TODO

- [ ] Inspect current `src/lib/api.js` and add item-level methods.
- [ ] Backend: update order item creation to include stable per-line `itemId`.
- [ ] Backend: add endpoints for item-level cancel / status transition.
- [ ] Backend: ensure order fetch/normalize includes `itemId` for existing documents.
- [ ] Frontend (User): update `src/pages/OrderHistory.jsx` buttons to be per-item, keyed by `itemId`.
- [ ] Frontend (Admin): update `src/pages/AdminViewOrders.jsx` to render actions per item row and call item-level endpoints.
- [ ] Run build / smoke test.


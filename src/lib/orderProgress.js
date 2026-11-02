export async function advanceOrderItem(request, orderId, itemId, status) {
  try {
    // Older servers accept arbitrary statuses on /status without deducting stock.
    // A separate route keeps rollout safe without disabling valid pending orders.
    return await request(`/api/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  } catch (error) {
    if (error.status === 404 && error.message !== 'Order item no longer exists. Refresh orders.') {
      error.message = 'Order approval requires the latest Node backend. Deploy it on Render, then retry this action.'
    }
    throw error
  }
}

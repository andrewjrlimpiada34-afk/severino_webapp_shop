import { createApiClient } from './apiClient.js'

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '')
const { request, upload, clearCache } = createApiClient({ baseUrl: API_URL })
const publicCache = { cacheTtl: 60000 }

export const api = {
  clearCache,
  login: (data) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  sendRegisterOtp: (email) =>
    request('/api/auth/otp/send', { method: 'POST', body: JSON.stringify({ email }) }),
  verifyRegisterOtp: (data) =>
    request('/api/auth/otp/verify', { method: 'POST', body: JSON.stringify(data) }),
  verify2fa: (data) => request('/api/auth/verify', { method: 'POST', body: JSON.stringify(data) }),
  resendVerifyOtp: (data) =>
    request('/api/auth/verify/resend', { method: 'POST', body: JSON.stringify(data) }),
  register: (data) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request('/api/auth/me'),
  profile: () => request('/api/users/me'),
  updateProfile: (data) => request('/api/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  updateTheme: (preferredTheme) =>
    request('/api/users/theme', { method: 'PATCH', body: JSON.stringify({ preferredTheme }) }),
  updatePassword: (data) =>
    request('/api/users/password', { method: 'PATCH', body: JSON.stringify(data) }),
  products: (options = {}) => request('/api/products', options),
  product: (id) => request(`/api/products/${id}`),
  createProduct: (data) =>
    request('/api/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) =>
    request(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  cart: () => request('/api/cart'),
  updateCart: (items) => request('/api/cart', { method: 'PUT', body: JSON.stringify({ items }) }),
  orders: () => request('/api/orders'),
  createOrder: (data) => request('/api/orders', { method: 'POST', body: JSON.stringify(data) }),
  cancelOrder: (id) => request(`/api/orders/${id}/cancel`, { method: 'PATCH' }),
  cancelOrderItem: (orderId, itemId) =>
    request(`/api/orders/${orderId}/items/${itemId}/cancel`, { method: 'PATCH' }),
  verifyOrder: (id) => request(`/api/orders/${id}/verify`, { method: 'PATCH' }),
  updateOrderStatus: (id, status) =>
    request(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateOrderItemStatus: (orderId, itemId, status) =>
    request(`/api/orders/${orderId}/items/${itemId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  deleteOrder: (id) => request(`/api/orders/${id}`, { method: 'DELETE' }),
  feedback: () => request('/api/feedback'),
  submitFeedback: (data) =>
    request('/api/feedback', { method: 'POST', body: JSON.stringify(data) }),
  adminSales: () => request('/api/admin/sales'),
  adminUsers: () => request('/api/admin/users'),
  deleteUser: (id) => request(`/api/admin/users/${id}`, { method: 'DELETE' }),
  adminInventory: () => request('/api/admin/inventory'),
  adminBanners: () => request('/api/admin/banners'),
  updateBanners: (images) =>
    request('/api/admin/banners', { method: 'PUT', body: JSON.stringify({ images }) }),
  adminBannerStories: () => request('/api/admin/banner-stories'),
  updateBannerStories: (stories) =>
    request('/api/admin/banner-stories', { method: 'PUT', body: JSON.stringify({ stories }) }),
  adminLoginPopup: () => request('/api/admin/login-popup'),
  updateLoginPopup: (image) =>
    request('/api/admin/login-popup', { method: 'PUT', body: JSON.stringify({ image }) }),
  adminLoginAnnouncement: () => request('/api/admin/login-announcement'),
  updateLoginAnnouncement: (announcements) =>
    request('/api/admin/login-announcement', {
      method: 'PUT',
      body: JSON.stringify({ announcements }),
    }),
  adminHeroImage: () => request('/api/admin/hero-image'),
  updateHeroImage: (image) =>
    request('/api/admin/hero-image', { method: 'PUT', body: JSON.stringify({ image }) }),
  uploadImage: (file) => upload('/api/uploads/image', file),
  uploadMedia: (file) => upload('/api/uploads/media', file, 'media'),
  loginPopup: () => request('/api/public/login-popup', publicCache),
  loginAnnouncement: () => request('/api/public/login-announcement', publicCache),
  bannerStories: () => request('/api/public/banner-stories', publicCache),
  heroImage: () => request('/api/public/hero-image', publicCache),
  banners: () => request('/api/public/banners', publicCache),
  featuredBanners: () => request('/api/public/featured-banners', publicCache),
  adminFeaturedBanners: () => request('/api/admin/featured-banners'),
  updateFeaturedBanners: (items) =>
    request('/api/admin/featured-banners', {
      method: 'PUT',
      body: JSON.stringify({ items }),
    }),

  productReviews: (productId) => request(`/api/reviews/${productId}`),
  addReview: (productId, data) =>
    request(`/api/reviews/${productId}`, { method: 'POST', body: JSON.stringify(data) }),
  deleteReview: (reviewId) => request(`/api/reviews/${reviewId}`, { method: 'DELETE' }),
}

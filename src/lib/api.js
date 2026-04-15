const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const message = payload.message || 'Request failed'
    const error = new Error(message)
    error.status = response.status
    throw error
  }
  return response.json()
}

async function upload(path, file) {
  const formData = new FormData()
  const filename = file?.name || 'upload.jpg'
  formData.append('image', file, filename)
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const message = payload.message || 'Upload failed'
    const error = new Error(message)
    error.status = response.status
    throw error
  }
  return response.json()
}

export const api = {
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
  products: () => request('/api/products'),
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
  verifyOrder: (id) => request(`/api/orders/${id}/verify`, { method: 'PATCH' }),
  updateOrderStatus: (id, status) =>
    request(`/api/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
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
  adminLoginPopup: () => request('/api/admin/login-popup'),
  updateLoginPopup: (image) =>
    request('/api/admin/login-popup', { method: 'PUT', body: JSON.stringify({ image }) }),
  adminLoginAnnouncement: () => request('/api/admin/login-announcement'),
  updateLoginAnnouncement: (data) =>
    request('/api/admin/login-announcement', { method: 'PUT', body: JSON.stringify(data) }),
  adminHeroImage: () => request('/api/admin/hero-image'),
  updateHeroImage: (image) =>
    request('/api/admin/hero-image', { method: 'PUT', body: JSON.stringify({ image }) }),
  uploadImage: (file) => upload('/api/uploads/image', file),
  loginPopup: () => request('/api/public/login-popup'),
  loginAnnouncement: () => request('/api/public/login-announcement'),
  heroImage: () => request('/api/public/hero-image'),
  banners: () => request('/api/public/banners'),
  productReviews: (productId) => request(`/api/reviews/${productId}`),
  addReview: (productId, data) =>
    request(`/api/reviews/${productId}`, { method: 'POST', body: JSON.stringify(data) }),
  deleteReview: (reviewId) => request(`/api/reviews/${reviewId}`, { method: 'DELETE' }),
}

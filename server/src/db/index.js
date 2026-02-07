import { getDb } from './mongo.js'
import { getProducts } from './products.js'
import { getUsers, getUserByEmail, getUserById, createUser, updateUser, removeUser, sanitizeUser } from './users.js'
import { getCartByUserId, createCart, updateCart, removeCartByUserId } from './carts.js'
import { getOrders, getOrdersByUserId, createOrder, updateOrderStatus, removeOrderById, removeOrdersByUserId } from './orders.js'
import { getFeedback, createFeedback } from './feedback.js'
import { getReviewsByProductId, createReview } from './reviews.js'
import { getBanners, updateBanners, getLoginPopup, updateLoginPopup } from './banners.js'
import { recordSale, getSalesSummary } from './inventory.js'
import { createOtp, getOtpById, consumeOtp } from './otps.js'

export {
  getDb,
  getProducts,
  getUsers,
  getUserByEmail,
  getUserById,
  createUser,
  updateUser,
  removeUser,
  sanitizeUser,
  getCartByUserId,
  createCart,
  updateCart,
  removeCartByUserId,
  getOrders,
  getOrdersByUserId,
  createOrder,
  updateOrderStatus,
  removeOrderById,
  removeOrdersByUserId,
  getFeedback,
  createFeedback,
  getReviewsByProductId,
  createReview,
  getBanners,
  updateBanners,
  getLoginPopup,
  updateLoginPopup,
  recordSale,
  getSalesSummary,
  createOtp,
  getOtpById,
  consumeOtp,
}

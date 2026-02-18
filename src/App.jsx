import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import NavBar from './components/NavBar.jsx'
import Footer from './components/Footer.jsx'
import AdminNav from './components/AdminNav.jsx'
import { useAuth } from './context/AuthContext.jsx'
import { api } from './lib/api.js'
import Home from './pages/Home.jsx'
import Shop from './pages/Shop.jsx'
import Search from './pages/Search.jsx'
import Cart from './pages/Cart.jsx'
import Checkout from './pages/Checkout.jsx'
import Billing from './pages/Billing.jsx'
import OrderHistory from './pages/OrderHistory.jsx'
import Account from './pages/Account.jsx'
import Feedback from './pages/Feedback.jsx'
import ProductDetail from './pages/ProductDetail.jsx'
import Favorites from './pages/Favorites.jsx'
import Notifications from './pages/Notifications.jsx'
import EmailConfirmation from './pages/EmailConfirmation.jsx'
import Login from './pages/Login.jsx'
import CreateAccount from './pages/CreateAccount.jsx'
import AdminLogin from './pages/AdminLogin.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminSalesReport from './pages/AdminSalesReport.jsx'
import AdminFeedback from './pages/AdminFeedback.jsx'
import AdminAddProduct from './pages/AdminAddProduct.jsx'
import AdminViewUsers from './pages/AdminViewUsers.jsx'
import AdminViewOrders from './pages/AdminViewOrders.jsx'
import AdminProducts from './pages/AdminProducts.jsx'

console.log('API URL:', import.meta.env.VITE_API_URL)

function AppLayout({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [popup, setPopup] = useState({ open: false, image: '' })
  const publicPaths = ['/login', '/create-account']
  const shouldRedirectAdmin =
    !loading && user?.role === 'admin' && !publicPaths.includes(location.pathname)

  useEffect(() => {
    if (!user || user.role === 'admin') return
    const popupSeenKey = `severino_login_popup_seen_${user.id}`
    const alreadyShown = sessionStorage.getItem(popupSeenKey)
    if (alreadyShown === '1') return
    let active = true
    api
      .loginPopup()
      .then((data) => {
        if (!active) return
        if (data?.image) {
          sessionStorage.setItem(popupSeenKey, '1')
          setPopup({ open: true, image: data.image })
        } else {
          sessionStorage.setItem(popupSeenKey, '1')
        }
      })
      .catch(() => {
        sessionStorage.setItem(popupSeenKey, '1')
      })
    return () => {
      active = false
    }
  }, [user])

  if (shouldRedirectAdmin) {
    return <Navigate to="/admin" replace />
  }

  return (
    <div className="app-shell">
      <NavBar />
      <main className="page">{children}</main>
      <Footer />
      {popup.open && (
        <div className="modal-backdrop" role="presentation">
          <div className="modal-card modal-card--wide" role="dialog" aria-modal="true">
            <button
              className="modal-close"
              type="button"
              aria-label="Close"
              onClick={() => {
                setPopup({ open: false, image: '' })
              }}
            >
              X
            </button>
            <div className="login-popup">
              {popup.image && <img src={popup.image} alt="Welcome offer" />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MinimalLayout({ children }) {
  return (
    <div className="app-shell">
      <main className="page">{children}</main>
    </div>
  )
}

function AdminLayout({ children }) {
  useEffect(() => {
    document.documentElement.removeAttribute('data-theme')
  }, [])
  return (
    <div className="admin-shell">
      <AdminNav />
      <main className="page admin-page">{children}</main>
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return <div className="page card">Checking session...</div>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return children
}

function AdminRoute({ children }) {
  const { user, loading, logout } = useAuth()
  if (loading) {
    return <div className="page card">Checking admin session...</div>
  }
  if (!user || user.role !== 'admin') {
    return <Navigate to="/admin/login" replace />
  }
  const adminSession = sessionStorage.getItem('admin_session')
  if (!adminSession) {
    logout()
    return <Navigate to="/admin/login" replace />
  }
  return children
}

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <AppLayout>
            <Home />
          </AppLayout>
        }
      />
      <Route
        path="/shop"
        element={
          <AppLayout>
            <Shop />
          </AppLayout>
        }
      />
      <Route
        path="/product/:id"
        element={
          <AppLayout>
            <ProductDetail />
          </AppLayout>
        }
      />
      <Route
        path="/search"
        element={
          <AppLayout>
            <ProtectedRoute>
              <Search />
            </ProtectedRoute>
          </AppLayout>
        }
      />
      <Route
        path="/favorites"
        element={
          <AppLayout>
            <ProtectedRoute>
              <Favorites />
            </ProtectedRoute>
          </AppLayout>
        }
      />
      <Route
        path="/notifications"
        element={
          <AppLayout>
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          </AppLayout>
        }
      />
      <Route
        path="/cart"
        element={
          <AppLayout>
            <ProtectedRoute>
              <Cart />
            </ProtectedRoute>
          </AppLayout>
        }
      />
      <Route
        path="/checkout"
        element={
          <AppLayout>
            <ProtectedRoute>
              <Checkout />
            </ProtectedRoute>
          </AppLayout>
        }
      />
      <Route
        path="/billing"
        element={
          <AppLayout>
            <ProtectedRoute>
              <Billing />
            </ProtectedRoute>
          </AppLayout>
        }
      />
      <Route
        path="/orders"
        element={
          <AppLayout>
            <ProtectedRoute>
              <OrderHistory />
            </ProtectedRoute>
          </AppLayout>
        }
      />
      <Route
        path="/account"
        element={
          <AppLayout>
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          </AppLayout>
        }
      />
      <Route
        path="/feedback"
        element={
          <AppLayout>
            <ProtectedRoute>
              <Feedback />
            </ProtectedRoute>
          </AppLayout>
        }
      />
      <Route
        path="/email-confirmation"
        element={
          <AppLayout>
            <EmailConfirmation />
          </AppLayout>
        }
      />
      <Route
        path="/login"
        element={
          <AppLayout>
            <Login />
          </AppLayout>
        }
      />
      <Route
        path="/create-account"
        element={
          <MinimalLayout>
            <CreateAccount />
          </MinimalLayout>
        }
      />

      <Route path="/admin/login" element={<AdminLogin />} />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout>
              <AdminDashboard />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/sales"
        element={
          <AdminRoute>
            <AdminLayout>
              <AdminSalesReport />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/feedback"
        element={
          <AdminRoute>
            <AdminLayout>
              <AdminFeedback />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/add-product"
        element={
          <AdminRoute>
            <AdminLayout>
              <AdminAddProduct />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/products"
        element={
          <AdminRoute>
            <AdminLayout>
              <AdminProducts />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/users"
        element={
          <AdminRoute>
            <AdminLayout>
              <AdminViewUsers />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route
        path="/admin/orders"
        element={
          <AdminRoute>
            <AdminLayout>
              <AdminViewOrders />
            </AdminLayout>
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App

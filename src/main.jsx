import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import BrandIntro from './components/BrandIntro.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ActionAnimationProvider } from './context/ActionAnimationContext.jsx'
import './index.css'
import './admin.css'
import './customer-desktop.css'
import './storefront.css'
import './accessibility-layout.css'

export function mountStorefront() {
  const root = ReactDOM.createRoot(document.getElementById('root'))
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <ActionAnimationProvider>
            <BrandIntro />
            <App />
          </ActionAnimationProvider>
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>,
  )
  return root
}

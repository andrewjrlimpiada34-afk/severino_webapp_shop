import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ActionAnimationProvider } from './context/ActionAnimationContext.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ActionAnimationProvider>
          <App />
        </ActionAnimationProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

import { Navigate, useLocation } from 'react-router-dom'

export default function ShopSearchRedirect() {
  const { search } = useLocation()
  return <Navigate to={{ pathname: '/shop', search }} replace />
}

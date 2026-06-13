import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/auth/Login'
import Dashboard from './pages/admin/Dashboard'
import Customers from './pages/admin/Customers'
import Quotations from './pages/admin/Quotations'
import Services from './pages/admin/Services'
import Inventory from './pages/admin/Inventory'
import ServiceCatalog from './pages/admin/ServiceCatalog'
import Reports from './pages/admin/Reports'

const ProtectedRoute = ({ children }) => {
  const { isAuth, loading } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        <p className="text-slate-500 text-sm">Loading...</p>
      </div>
    </div>
  )
  if (!isAuth) return <Navigate to="/login" replace />
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin/dashboard"  element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/admin/customers"  element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/admin/quotations" element={<ProtectedRoute><Quotations /></ProtectedRoute>} />
      <Route path="/admin/services"   element={<ProtectedRoute><Services /></ProtectedRoute>} />
      <Route path="/admin/inventory"  element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
      <Route path="/admin/catalog"    element={<ProtectedRoute><ServiceCatalog /></ProtectedRoute>} />
      <Route path="/admin/reports"    element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3000, style: { borderRadius: '12px', boxShadow: '0 10px 40px rgba(0,0,0,0.12)' } }} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

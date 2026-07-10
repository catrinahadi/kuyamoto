import React from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, FileText, Wrench, Package,
  BookOpen, BarChart3, LogOut, Car, Bell, ChevronRight
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

const navItems = [
  { to: '/admin/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/customers',  icon: Users,           label: 'Customers' },
  { to: '/admin/quotations', icon: FileText,         label: 'Quotations' },
  { to: '/admin/services',   icon: Wrench,           label: 'Services' },
  { to: '/admin/inventory',  icon: Package,          label: 'Inventory' },
  { to: '/admin/catalog',    icon: BookOpen,         label: 'Service Catalog' },
  { to: '/admin/reports',    icon: BarChart3,        label: 'Reports' },
]

const pageTitles = {
  '/admin/dashboard':  'Dashboard',
  '/admin/customers':  'Customers',
  '/admin/quotations': 'Quotations',
  '/admin/services':   'Services',
  '/admin/inventory':  'Inventory',
  '/admin/catalog':    'Service Catalog',
  '/admin/reports':    'Reports',
}

export default function AdminLayout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    signOut()
    navigate('/login')
  }

  const currentTitle = pageTitles[location.pathname] || 'Admin'

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-slate-900 flex flex-col z-30 shadow-2xl">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-700/50">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Car className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-none tracking-wider">KUYAMOTO</div>
            <div className="text-slate-400 text-xs mt-0.5">Management System</div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-slate-700/50">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut className="w-4.5 h-4.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Page content */}
        <main className="flex-1 p-6 animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  )
}

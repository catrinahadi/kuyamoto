import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext({})

// Hardcoded admin credentials - no email confirmation needed
const ADMIN_CREDENTIALS = [
  { username: 'lagado', password: 'magandasiategrabe28', name: 'Lagado Admin', role: 'admin' }
]

const SESSION_KEY = 'autoshop_admin_session'

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restore session from localStorage
    const saved = localStorage.getItem(SESSION_KEY)
    if (saved) {
      try {
        const session = JSON.parse(saved)
        setUser(session.user)
        setProfile(session.profile)
      } catch (e) {
        localStorage.removeItem(SESSION_KEY)
      }
    }
    setLoading(false)
  }, [])

  const signIn = (username, password) => {
    const match = ADMIN_CREDENTIALS.find(
      (c) => c.username === username.trim() && c.password === password
    )
    if (!match) {
      return { error: 'Invalid username or password.' }
    }

    const userData = { id: 'admin-001', username: match.username }
    const profileData = { role: match.role, full_name: match.name }

    setUser(userData)
    setProfile(profileData)
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user: userData, profile: profileData }))
    return { error: null }
  }

  const signOut = () => {
    setUser(null)
    setProfile(null)
    localStorage.removeItem(SESSION_KEY)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signOut,
        isAuth: !!user,
        isAdmin: profile?.role === 'admin',
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

"use client"

import { createContext, useContext, useState, useEffect, ReactNode } from "react"

export interface UserProfile {
  name: string
  email: string
  age: number
  height: number
  weight: number
  gender: string
  goal: string
  targetWeight: number
  conditions: string[]
  preference: string
  cuisinePreference: string
  likes: string[]
  dislikes: string[]
  avatar: string
}

interface UserContextType {
  user: UserProfile | null
  setUser: (user: UserProfile | null) => void
  updateUser: (updates: Partial<UserProfile>) => void
  isLoggedIn: boolean
  logout: () => void
}

const UserContext = createContext<UserContextType | undefined>(undefined)

const USER_KEY  = "nutridine-user"
const TOKEN_KEY = "nutridine-token"

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<UserProfile | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  // Persist to localStorage so session survives tab close
  useEffect(() => {
    try {
      const stored = localStorage.getItem(USER_KEY)
      if (stored) setUserState(JSON.parse(stored))
    } catch {
      localStorage.removeItem(USER_KEY)
    }
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(USER_KEY)
    }
  }, [user, isHydrated])

  const setUser = (newUser: UserProfile | null) => setUserState(newUser)

  const updateUser = (updates: Partial<UserProfile>) => {
    if (user) setUserState({ ...user, ...updates })
  }

  const logout = () => {
    setUserState(null)
    localStorage.removeItem(USER_KEY)
    localStorage.removeItem(TOKEN_KEY)
  }

  return (
    <UserContext.Provider value={{ user, setUser, updateUser, isLoggedIn: !!user, logout }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) throw new Error("useUser must be used within a UserProvider")
  return context
}

export { }

import { createContext } from 'react'

export const NavigationContext = createContext<{
    isOpen: boolean
    toggle: () => void
} | null>(null)

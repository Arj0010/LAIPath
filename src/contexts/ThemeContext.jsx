import React, { createContext, useContext, useEffect, useState } from 'react'
import { themes, DEFAULT_THEME } from '../themes.js'

const ThemeContext = createContext({})

export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

export const ThemeProvider = ({ children }) => {
  const [currentTheme, setCurrentTheme] = useState(() => {
    // Load theme from localStorage or use default
    const savedTheme = localStorage.getItem('laiTheme')
    return savedTheme && themes[savedTheme] ? savedTheme : DEFAULT_THEME
  })

  // Apply theme tokens to CSS variables
  useEffect(() => {
    const theme = themes[currentTheme]
    if (!theme) return

    const root = document.documentElement

    // Map theme tokens to CSS variables
    root.style.setProperty('--bg-primary', theme.background)
    root.style.setProperty('--bg-secondary', theme.surface)
    root.style.setProperty('--text-primary', theme.textPrimary)
    root.style.setProperty('--text-secondary', theme.textSecondary)
    root.style.setProperty('--accent-primary', theme.accent)
    root.style.setProperty('--border-visible', theme.border)

    // Derive additional CSS variables from base tokens
    // Background variants
    root.style.setProperty('--bg-tertiary', adjustOpacity(theme.surface, 0.4))
    root.style.setProperty('--bg-overlay', adjustOpacity(theme.background, 0.95))
    root.style.setProperty('--bg-hover', adjustOpacity(theme.surface, 0.8))

    // Text variants
    root.style.setProperty('--text-muted', adjustOpacity(theme.textSecondary, 0.7))

    // Accent variants
    root.style.setProperty('--accent-secondary', adjustOpacity(theme.accent, 0.8))
    root.style.setProperty('--accent-hover', adjustOpacity(theme.accent, 0.9))

    // Border variants
    root.style.setProperty('--border-subtle', adjustOpacity(theme.border, 0.6))
    root.style.setProperty('--border-accent', adjustOpacity(theme.accent, 0.3))

    // Save to localStorage
    localStorage.setItem('laiTheme', currentTheme)
  }, [currentTheme])

  const setTheme = (themeKey) => {
    if (themes[themeKey]) {
      setCurrentTheme(themeKey)
    }
  }

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Helper function to adjust opacity of a color
 * Works with both hex and rgba colors
 */
function adjustOpacity(color, opacity) {
  if (color.startsWith('rgba')) {
    // Extract RGB values and apply new opacity
    const match = color.match(/rgba?\(([^)]+)\)/)
    if (match) {
      const values = match[1].split(',').map(v => v.trim())
      const r = values[0]
      const g = values[1]
      const b = values[2]
      return `rgba(${r}, ${g}, ${b}, ${opacity})`
    }
  } else if (color.startsWith('#')) {
    // Convert hex to rgba
    const hex = color.replace('#', '')
    if (hex.length === 6) {
      const r = parseInt(hex.substring(0, 2), 16)
      const g = parseInt(hex.substring(2, 4), 16)
      const b = parseInt(hex.substring(4, 6), 16)
      return `rgba(${r}, ${g}, ${b}, ${opacity})`
    }
  }
  // Fallback: if color is already rgba-like or unknown format, try to extract RGB
  const rgbMatch = color.match(/(\d+),\s*(\d+),\s*(\d+)/)
  if (rgbMatch) {
    return `rgba(${rgbMatch[1]}, ${rgbMatch[2]}, ${rgbMatch[3]}, ${opacity})`
  }
  return color
}


/**
 * Theme Configuration
 * 
 * Central theme definitions using token-based architecture.
 * Each theme defines core tokens that are mapped to CSS variables.
 */

export const themes = {
  obsidian: {
    background: '#0a0e1a',
    surface: 'rgba(15, 23, 42, 0.6)',
    textPrimary: '#f1f5f9',
    textSecondary: '#94a3b8',
    accent: '#8b5cf6',
    border: 'rgba(255, 255, 255, 0.1)',
  },
  solar: {
    background: '#1a1a1a',
    surface: 'rgba(255, 152, 0, 0.1)',
    textPrimary: '#fff5e6',
    textSecondary: '#ffb84d',
    accent: '#ff9800',
    border: 'rgba(255, 152, 0, 0.2)',
  },
  midnight: {
    background: '#0d1117',
    surface: 'rgba(33, 38, 45, 0.8)',
    textPrimary: '#c9d1d9',
    textSecondary: '#8b949e',
    accent: '#58a6ff',
    border: 'rgba(88, 166, 255, 0.2)',
  },
  forest: {
    background: '#0d1b0f',
    surface: 'rgba(34, 68, 41, 0.6)',
    textPrimary: '#e8f5e9',
    textSecondary: '#a5d6a7',
    accent: '#4caf50',
    border: 'rgba(76, 175, 80, 0.2)',
  },
  rose: {
    background: '#1a0f14',
    surface: 'rgba(88, 47, 70, 0.6)',
    textPrimary: '#fce4ec',
    textSecondary: '#f8bbd0',
    accent: '#e91e63',
    border: 'rgba(233, 30, 99, 0.2)',
  },
}

/**
 * Default theme key
 */
export const DEFAULT_THEME = 'obsidian'


/**
 * Avatar Utilities
 * 
 * Generates consistent default avatars based on user name or ID
 * - Same user always gets same avatar
 * - Gradient backgrounds
 * - Initials or abstract patterns
 */

/**
 * Simple hash function to convert string to number
 * @param {string} str - String to hash
 * @returns {number} - Hash value
 */
function hashString(str) {
  if (!str) return 0
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return Math.abs(hash)
}

/**
 * Generate gradient colors based on hash
 * @param {string} identifier - User name or ID
 * @returns {Object} - Object with color1 and color2
 */
function generateGradientColors(identifier) {
  const hash = hashString(identifier)
  
  // Predefined color palette (luxury dark theme compatible)
  const colors = [
    { color1: '#8B5CF6', color2: '#6366F1' }, // Purple to Indigo
    { color1: '#EC4899', color2: '#F43F5E' }, // Pink to Rose
    { color1: '#10B981', color2: '#059669' }, // Emerald to Green
    { color1: '#3B82F6', color2: '#2563EB' }, // Blue to Blue
    { color1: '#F59E0B', color2: '#D97706' }, // Amber to Orange
    { color1: '#8B5CF6', color2: '#A78BFA' }, // Purple to Light Purple
    { color1: '#06B6D4', color2: '#0891B2' }, // Cyan to Cyan
    { color1: '#F97316', color2: '#EA580C' }, // Orange to Orange
    { color1: '#6366F1', color2: '#4F46E5' }, // Indigo to Indigo
    { color1: '#EC4899', color2: '#DB2777' }, // Pink to Pink
  ]
  
  // Select color pair based on hash
  const colorIndex = hash % colors.length
  return colors[colorIndex]
}

/**
 * Extract initials from name
 * @param {string} name - User name
 * @param {string} email - User email (fallback)
 * @returns {string} - Initials (1-2 characters)
 */
function getInitials(name, email) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      // First and last name initials
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    } else {
      // Single name - use first two characters
      return name.substring(0, 2).toUpperCase()
    }
  } else if (email) {
    // Use first letter of email
    return email.charAt(0).toUpperCase()
  }
  return 'U'
}

/**
 * Generate avatar props for a user
 * @param {string} userName - User name (optional)
 * @param {string} userId - User ID (optional)
 * @param {string} email - User email (optional)
 * @returns {Object} - Object with gradient, initials, and identifier
 */
export function generateAvatarProps(userName, userId, email) {
  // Use name if available, otherwise use ID, otherwise use email
  const identifier = userName || userId || email || 'default'
  const initials = getInitials(userName, email)
  const gradient = generateGradientColors(identifier)
  
  return {
    gradient,
    initials,
    identifier
  }
}

/**
 * Generate inline style for avatar background
 * @param {Object} gradient - Gradient object with color1 and color2
 * @returns {Object} - React style object
 */
export function getAvatarStyle(gradient) {
  return {
    background: `linear-gradient(135deg, ${gradient.color1} 0%, ${gradient.color2} 100%)`,
  }
}


import { useState, useEffect, useRef } from 'react'
import './App.css'
import DailyLearningPage from './DailyLearningPage.jsx'
import CalendarView from './CalendarView.jsx'
import LandingPage from './LandingPage.jsx'
import ProfilePage from './ProfilePage.jsx'
import LeaveModal from './LeaveModal.jsx'
import { useAuth } from './contexts/AuthContext.jsx'
import { useTheme } from './contexts/ThemeContext.jsx'
import { calculateXP, calculateStreak, calculateLevel, calculateMilestones, getXPForNextLevel, getXPProgress } from './gamificationUtils.js'
import { saveSyllabus, loadSyllabus, loadUserProfile } from './lib/syllabusStorage.js'
import { generateAvatarProps, getAvatarStyle } from './utils/avatarUtils.js'

/**
 * Main App Component
 * 
 * Supabase Auth Integration:
 * - Google OAuth login
 * - Session persistence
 * - Syllabus and profile data persistence
 */
function App() {
  const { user, session, loading: authLoading, signInWithGoogle, signOut } = useAuth()
  const { currentTheme, setTheme, themes } = useTheme()
  const [goal, setGoal] = useState('')
  const [hoursPerDay, setHoursPerDay] = useState(1)
  const [totalDays, setTotalDays] = useState(30)
  const [syllabus, setSyllabus] = useState(null)
  const [selectedDay, setSelectedDay] = useState(null)
  const [currentView, setCurrentView] = useState('dashboard') // 'dashboard', 'learning', 'calendar', or 'profile'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [loadingSyllabus, setLoadingSyllabus] = useState(true) // Start as true - will be set to false after hydration
  const [notification, setNotification] = useState(null)
  const prevGamificationRef = useRef({ xp: 0, streak: 0, level: 1 })
  const syllabusHydratedRef = useRef(false) // Track if we've attempted hydration
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [userName, setUserName] = useState(null)
  const profileDropdownRef = useRef(null)
  const [isMobile, setIsMobile] = useState(false)
  const bottomSheetRef = useRef(null)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveDay, setLeaveDay] = useState(null)

  // STATE RESTORATION: Load syllabus from Supabase on mount or when user changes
  // Runs after auth is ready (authLoading is false) and user is authenticated
  // Ensures syllabus is restored on page refresh
  useEffect(() => {
    // Only load if:
    // 1. Auth is ready (not loading)
    // 2. User is authenticated
    // 3. We haven't already attempted hydration
    if (!authLoading && user && !syllabusHydratedRef.current) {
      syllabusHydratedRef.current = true
      loadSyllabusFromSupabase()
    } else if (!authLoading && !user) {
      // Reset hydration flag when user is not authenticated
      syllabusHydratedRef.current = false
      setLoadingSyllabus(false)
      setSyllabus(null)
    }
  }, [user, authLoading])

  // Initialize previous gamification values when syllabus loads or changes
  useEffect(() => {
    if (syllabus && syllabus.days && syllabus.days.length > 0) {
      const days = syllabus.days
      const xp = calculateXP(days)
      const streak = calculateStreak(days)
      const level = calculateLevel(xp)
      prevGamificationRef.current = { xp, streak, level }
    } else if (!syllabus) {
      // Reset when syllabus is cleared
      prevGamificationRef.current = { xp: 0, streak: 0, level: 1 }
    }
  }, [syllabus]) // Update when syllabus changes

  // Load user profile name
  useEffect(() => {
    if (user) {
      loadUserProfile(user.id)
        .then(profile => {
          if (profile && profile.name) {
            setUserName(profile.name)
          } else {
            setUserName(user.email?.split('@')[0] || 'User')
          }
        })
        .catch(() => {
          setUserName(user.email?.split('@')[0] || 'User')
        })
    }
  }, [user])

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Close dropdown when clicking outside (desktop only)
  useEffect(() => {
    if (isMobile) return // Skip on mobile
    
    function handleClickOutside(event) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false)
      }
    }

    if (showProfileDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showProfileDropdown, isMobile])

  // Handle bottom sheet swipe to close (mobile only)
  useEffect(() => {
    if (!isMobile || !showProfileDropdown || !bottomSheetRef.current) return

    let startY = null
    let currentY = null

    const handleTouchStart = (e) => {
      // Only allow swipe from handle or top area
      const target = e.target
      const isHandle = target.classList.contains('bottom-sheet-handle') || 
                       target.closest('.bottom-sheet-handle')
      const isHeader = target.closest('.profile-dropdown-header')
      
      if (isHandle || isHeader) {
        startY = e.touches[0].clientY
        currentY = startY
      }
    }

    const handleTouchMove = (e) => {
      if (startY === null || !bottomSheetRef.current) return
      currentY = e.touches[0].clientY
      const deltaY = currentY - startY
      
      // Only allow downward swipe
      if (deltaY > 0) {
        e.preventDefault() // Prevent scrolling while swiping
        bottomSheetRef.current.style.transform = `translateY(${deltaY}px)`
      }
    }

    const handleTouchEnd = (e) => {
      if (startY === null || !bottomSheetRef.current) return
      const deltaY = currentY - startY
      
      // Close if swiped down more than 100px or 30% of viewport
      const threshold = Math.max(100, window.innerHeight * 0.3)
      if (deltaY > threshold) {
        setShowProfileDropdown(false)
      }
      
      // Reset transform with animation
      bottomSheetRef.current.style.transition = 'transform 0.2s ease-out'
      bottomSheetRef.current.style.transform = ''
      setTimeout(() => {
        if (bottomSheetRef.current) {
          bottomSheetRef.current.style.transition = ''
        }
      }, 200)
      
      startY = null
      currentY = null
    }

    const sheet = bottomSheetRef.current
    sheet.addEventListener('touchstart', handleTouchStart, { passive: false })
    sheet.addEventListener('touchmove', handleTouchMove, { passive: false })
    sheet.addEventListener('touchend', handleTouchEnd)

    return () => {
      sheet.removeEventListener('touchstart', handleTouchStart)
      sheet.removeEventListener('touchmove', handleTouchMove)
      sheet.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isMobile, showProfileDropdown])

  /**
   * STATE RESTORATION: Load syllabus from Supabase
   * 
   * Explicitly fetches ALL syllabi for the user, identifies active syllabus,
   * and loads its days. Only sets loadingSyllabus to false after fetch completes.
   * 
   * Falls back gracefully if Supabase is unavailable
   * Shows "Create Learning Plan" if no syllabus exists
   */
  const loadSyllabusFromSupabase = async () => {
    if (!user) {
      setLoadingSyllabus(false)
      return
    }
    
    // Ensure loading state is true before starting fetch
    setLoadingSyllabus(true)
    
    try {
      // Fetch ALL syllabi for the user (ordered by created_at DESC)
      // This identifies the most recent as active
      const savedSyllabus = await loadSyllabus(user.id)
      
      if (savedSyllabus) {
        // Active syllabus found - populate state
        setSyllabus(savedSyllabus)
        console.log('✅ Syllabus hydrated from Supabase:', savedSyllabus.goal)
      } else {
        // No syllabus exists - set to null and show create form
        setSyllabus(null)
        console.log('No saved syllabus found - showing create form')
      }
    } catch (error) {
      // Fallback already handled in loadSyllabus
      // Set syllabus to null to show create form on error
      setSyllabus(null)
      console.warn('State restoration failed, continuing with in-memory state:', error)
    } finally {
      // CRITICAL: Only set loading to false AFTER fetch completes
      // This ensures UI doesn't render prematurely
      setLoadingSyllabus(false)
    }
  }

  /**
   * PERSISTENCE: Save syllabus to Supabase
   * 
   * Called on:
   * - Syllabus generation
   * - Day completion
   * - Skip
   * - Leave
   * 
   * Falls back gracefully if Supabase is unavailable
   * Returns the UUID from Supabase (for new syllabi)
   */
  const saveSyllabusToSupabase = async (syllabusToSave) => {
    if (!user) return null
    
    // Fallback already handled in saveSyllabus
    const result = await saveSyllabus(user.id, syllabusToSave)
    
    // If this is a new syllabus (no id or invalid id), update the syllabus object with the returned UUID
    if (result && result.syllabusId) {
      // Guard: Ensure returned ID is valid UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(result.syllabusId) || result.syllabusId.includes('syl_')) {
        console.error('Invalid syllabus ID returned from Supabase:', result.syllabusId)
        return null
      }
      
      // Update syllabus state with valid UUID
      if (!syllabusToSave.id || !uuidRegex.test(syllabusToSave.id)) {
        setSyllabus({ ...syllabusToSave, id: result.syllabusId })
      }
      return result.syllabusId
    }
    
    return null
  }

  /**
   * Activate next pending day
   */
  const activateNextPendingDay = (days) => {
    const nextPendingIndex = days.findIndex(d => d.status === 'pending')
    if (nextPendingIndex !== -1) {
      days[nextPendingIndex] = {
        ...days[nextPendingIndex],
        status: 'active'
      }
    }
  }

  /**
   * Derive recent activity from syllabus state
   * Returns last 3 activities: day completed, streak updates, syllabus created
   */
  const getRecentActivity = (syllabus) => {
    if (!syllabus) return []

    const activities = []
    const days = syllabus.days || []

    // 1. Get completed days (sorted by completedAt if available, otherwise by dayNumber desc)
    const completedDays = days
      .filter(d => d.status === 'completed')
      .sort((a, b) => {
        if (a.completedAt && b.completedAt) {
          return new Date(b.completedAt) - new Date(a.completedAt)
        }
        // If no completedAt, use dayNumber (higher = more recent)
        return b.dayNumber - a.dayNumber
      })
      .slice(0, 3) // Last 3 completed days

    completedDays.forEach(day => {
      activities.push({
        type: 'day_completed',
        message: `Day ${day.dayNumber} completed`,
        topic: day.topic,
        timestamp: day.completedAt || day.date
      })
    })

    // 2. Streak info (if streak exists and meaningful)
    const streak = calculateStreak(days)
    if (streak >= 2) {
      // Only show streak if it's 2+ days (meaningful)
      activities.push({
        type: 'streak',
        message: `Streak: ${streak} day${streak !== 1 ? 's' : ''}`,
        timestamp: null
      })
    }

    // 3. Syllabus created (if syllabus exists, show as oldest activity)
    if (syllabus.goal) {
      activities.push({
        type: 'syllabus_created',
        message: `Learning plan created`,
        topic: syllabus.goal,
        timestamp: syllabus.startDate
      })
    }

    // Sort all activities by timestamp (most recent first)
    // Activities without timestamp go to the end
    activities.sort((a, b) => {
      if (!a.timestamp && !b.timestamp) return 0
      if (!a.timestamp) return 1
      if (!b.timestamp) return -1
      return new Date(b.timestamp) - new Date(a.timestamp)
    })

    // Return last 3 activities (most recent first)
    return activities.slice(0, 3)
  }

  /**
   * Format timestamp for display
   */
  const formatActivityTime = (timestamp) => {
    if (!timestamp) return null
    
    try {
      const date = new Date(timestamp)
      const now = new Date()
      const diffMs = now - date
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      
      if (diffDays === 0) return 'Today'
      if (diffDays === 1) return 'Yesterday'
      if (diffDays < 7) return `${diffDays} days ago`
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`
      return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) !== 1 ? 's' : ''} ago`
    } catch {
      return null
    }
  }

  /**
   * Generate micro-insight from syllabus data
   * Returns a single sentence insight about consistency, progress, or patterns
   */
  const getMicroInsight = (syllabus) => {
    if (!syllabus || !syllabus.days || syllabus.days.length === 0) {
      return null
    }

    const days = syllabus.days
    const completedDays = days.filter(d => d.status === 'completed')
    const totalDays = syllabus.totalDays || days.length
    const streak = calculateStreak(days)
    const completionRate = completedDays.length / totalDays

    // Calculate progress velocity (days completed per week)
    const completedWithDates = completedDays
      .filter(d => d.completedAt || d.date)
      .map(d => ({
        day: d,
        date: d.completedAt ? new Date(d.completedAt) : new Date(d.date)
      }))
      .sort((a, b) => b.date - a.date)

    if (completedWithDates.length === 0) {
      return null
    }

    // Calculate days between first and last completion
    const firstCompletion = completedWithDates[completedWithDates.length - 1].date
    const lastCompletion = completedWithDates[0].date
    const daysSpan = Math.max(1, Math.floor((lastCompletion - firstCompletion) / (1000 * 60 * 60 * 24)) + 1)
    const velocity = completedDays.length / Math.max(1, daysSpan) * 7 // per week

    // Insight 1: Consistency pattern (streak-based)
    if (streak >= 7) {
      return `You've maintained a ${streak}-day streak—consistent daily practice.`
    } else if (streak >= 3) {
      return `You're building momentum with a ${streak}-day streak.`
    } else if (streak > 0 && completedDays.length > streak) {
      return `You've completed ${completedDays.length} days with a current ${streak}-day streak.`
    }

    // Insight 2: Progress velocity
    if (velocity >= 5) {
      return `You're completing about ${Math.round(velocity)} days per week—strong pace.`
    } else if (velocity >= 3) {
      return `You're progressing at about ${Math.round(velocity)} days per week.`
    } else if (velocity > 0) {
      return `You're moving at about ${Math.round(velocity)} days per week.`
    }

    // Insight 3: Completion rate
    if (completionRate >= 0.8 && completedDays.length >= 5) {
      return `You've completed ${Math.round(completionRate * 100)}% of your plan—excellent progress.`
    } else if (completionRate >= 0.5 && completedDays.length >= 3) {
      return `You're ${Math.round(completionRate * 100)}% through your learning plan.`
    } else if (completedDays.length > 0) {
      return `You've completed ${completedDays.length} of ${totalDays} days.`
    }

    // Fallback
    return `Your learning journey is underway.`
  }

  /**
   * Handle Skip Day from Dashboard
   */
  const handleSkipDayFromDashboard = async (day) => {
    if (!syllabus || !syllabus.days) {
      setError('Unable to skip day. Please refresh the page and try again.')
      return
    }

    if (!window.confirm('Are you sure you want to skip this day? All future days will be shifted forward by 1 day.')) {
      return
    }

    try {
      const updatedDays = [...syllabus.days]
      const dayIndex = updatedDays.findIndex(d => d.dayNumber === day.dayNumber)
      
      if (dayIndex === -1) {
        throw new Error('Day not found in syllabus')
      }

      // Mark current day as skipped
      updatedDays[dayIndex] = {
        ...updatedDays[dayIndex],
        status: 'skipped'
      }

      // Shift all future days forward by 1 day
      for (let i = dayIndex + 1; i < updatedDays.length; i++) {
        const currentDate = new Date(updatedDays[i].date)
        currentDate.setDate(currentDate.getDate() + 1)
        updatedDays[i] = {
          ...updatedDays[i],
          date: currentDate.toISOString().split('T')[0]
        }
      }

      // Activate next pending day
      activateNextPendingDay(updatedDays)

      // Update syllabus
      const updatedSyllabus = {
        ...syllabus,
        days: updatedDays
      }

      await fetch('/api/update-syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedSyllabus })
      })

      // Find next active day
      const nextActiveDay = updatedDays.find(d => d.status === 'active')
      
      // Update state
      await handleSyllabusUpdate(updatedSyllabus, nextActiveDay)
    } catch (err) {
      console.error('Error skipping day:', err)
      setError('Unable to skip day at this time. Please try again.')
    }
  }

  /**
   * Handle Leave from Dashboard
   */
  const handleLeaveFromDashboard = async (day) => {
    if (!syllabus || !syllabus.days) {
      setNotification({
        type: 'error',
        message: 'Syllabus data is missing. Please refresh the page.'
      })
      setTimeout(() => setNotification(null), 5000)
      return
    }

    // Open leave modal
    setLeaveDay(day)
    setShowLeaveModal(true)
  }

  const handleLeaveConfirm = async (leaveDays) => {
    if (!syllabus || !syllabus.days || !leaveDay) return

    setShowLeaveModal(false)

    try {
      const updatedDays = [...syllabus.days]
      const dayIndex = updatedDays.findIndex(d => d.dayNumber === leaveDay.dayNumber)
      
      if (dayIndex === -1) {
        throw new Error('Day not found in syllabus')
      }

      // Mark current day as leave
      updatedDays[dayIndex] = {
        ...updatedDays[dayIndex],
        status: 'leave'
      }

      // Shift all future days forward by N days
      for (let i = dayIndex + 1; i < updatedDays.length; i++) {
        const currentDate = new Date(updatedDays[i].date)
        currentDate.setDate(currentDate.getDate() + leaveDays)
        updatedDays[i] = {
          ...updatedDays[i],
          date: currentDate.toISOString().split('T')[0]
        }
      }

      // Activate next pending day
      activateNextPendingDay(updatedDays)

      // Update syllabus
      const updatedSyllabus = {
        ...syllabus,
        days: updatedDays
      }

      await fetch('/api/update-syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedSyllabus })
      })

      // Find next active day
      const nextActiveDay = updatedDays.find(d => d.status === 'active')
      
      // Update state
      await handleSyllabusUpdate(updatedSyllabus, nextActiveDay)
      
      setNotification({
        type: 'success',
        message: `Leave applied successfully. ${leaveDays} day(s) added.`
      })
      setTimeout(() => setNotification(null), 5000)
    } catch (err) {
      setNotification({
        type: 'error',
        message: `Unable to apply leave: ${err.message || 'Please try again.'}`
      })
      setTimeout(() => setNotification(null), 5000)
    } finally {
      setLeaveDay(null)
    }
  }

  /**
   * Handle syllabus update from DailyLearningPage
   * Updates local state when day is completed/skipped/leave
   * Automatically navigates to next active day if available
   * Saves to Supabase
   * Shows gamification feedback when appropriate
   */
  const handleSyllabusUpdate = async (updatedSyllabus, nextActiveDay = null) => {
    // Get previous gamification values from ref
    const prevXP = prevGamificationRef.current.xp
    const prevStreak = prevGamificationRef.current.streak
    const prevLevel = prevGamificationRef.current.level
    
    // Update syllabus state
    setSyllabus(updatedSyllabus)
    
    // Calculate new gamification values
    const newDays = updatedSyllabus?.days || []
    const newXP = calculateXP(newDays)
    const newStreak = calculateStreak(newDays)
    const newLevel = calculateLevel(newXP)
    
    // Show feedback for gamification changes
    // Check if a day was just completed (new completed count > old completed count)
    const prevDays = syllabus?.days || []
    const prevCompleted = prevDays.filter(d => d.status === 'completed').length
    const newCompleted = newDays.filter(d => d.status === 'completed').length
    
    // Show notifications (only one at a time, priority: level > streak > xp)
    if (newLevel > prevLevel) {
      // Level increase takes priority
      setNotification({ type: 'level', message: `Level Up: Level ${newLevel}` })
      setTimeout(() => setNotification(null), 3000)
    } else if (newStreak > prevStreak && newStreak > 0) {
      // Streak increase
      setNotification({ type: 'streak', message: `🔥 Streak: ${newStreak} days` })
      setTimeout(() => setNotification(null), 3000)
    } else if (newCompleted > prevCompleted) {
      // Day was completed - show XP notification
      setNotification({ type: 'xp', message: 'Day completed +10 XP' })
      setTimeout(() => setNotification(null), 3000)
    }
    
    // Update previous values ref
    prevGamificationRef.current = { xp: newXP, streak: newStreak, level: newLevel }
    
    // Save to Supabase
    await saveSyllabusToSupabase(updatedSyllabus)
    
    // If next active day is provided, automatically navigate to it
    if (nextActiveDay) {
      console.log('Navigating to next active day:', nextActiveDay.dayNumber)
      // Set selectedDay first - this takes priority in rendering and will show DailyLearningPage
      setSelectedDay(nextActiveDay)
      // Also ensure we're not stuck in calendar view (though selectedDay takes priority)
      setCurrentView('learning')
    } else if (selectedDay) {
      // Update selected day if it exists in updated syllabus (for viewing completed days)
      const updatedDay = updatedSyllabus.days.find(d => d.dayNumber === selectedDay.dayNumber)
      if (updatedDay) {
        setSelectedDay(updatedDay)
      } else {
        // If current day no longer exists, clear selection
        setSelectedDay(null)
      }
    }
  }

  /**
   * Handle day selection
   * Only allows access to active days
   */
  const handleDayClick = (day) => {
    if (day.status === 'active') {
      setSelectedDay(day)
    } else if (day.status === 'pending') {
      // Show notification instead of console.log
      setNotification({
        type: 'info',
        message: 'Day is not yet active. Complete the current active day first.'
      })
      setTimeout(() => setNotification(null), 4000)
    } else {
      // Completed, skipped, or leave - can view but not interact
      setSelectedDay(day)
    }
  }

  /**
   * Get status badge text and class
   */
  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return { text: 'Active', class: 'status-active' }
      case 'completed':
        return { text: 'Completed', class: 'status-completed' }
      case 'skipped':
        return { text: 'Skipped', class: 'status-skipped' }
      case 'leave':
        return { text: 'Leave', class: 'status-leave' }
      default:
        return { text: 'Pending', class: 'status-pending' }
    }
  }

  /**
   * Handle form submission
   * Calls /api/generate-syllabus endpoint
   */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    
    // Validate inputs before submission
    if (!goal || goal.trim().length === 0) {
      setError('Please enter a learning goal')
      return
    }
    
    if (!hoursPerDay || isNaN(hoursPerDay) || hoursPerDay < 0.5 || hoursPerDay > 24) {
      setError('Please enter a valid number of hours per day (0.5 to 24)')
      return
    }
    
    if (!totalDays || isNaN(totalDays) || totalDays < 1 || totalDays > 365) {
      setError('Please enter a valid number of days (1 to 365)')
      return
    }
    
    setLoading(true)

    try {
      const response = await fetch('/api/generate-syllabus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          goal: goal.trim(),
          hoursPerDay,
          totalDays,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        // Handle unsafe domain error with proper message
        if (errorData.error === 'unsafe_domain') {
          throw new Error(errorData.message || 'This learning topic is not supported.')
        }
        throw new Error(errorData.message || errorData.error || 'Unable to create your learning plan. Please try again.')
      }

      const data = await response.json()
      setSyllabus(data)
      
      // PERSISTENCE: Save to Supabase (with fallback safety)
      await saveSyllabusToSupabase(data)
    } catch (err) {
      setError(err.message)
      console.error('Error:', err)
    } finally {
      setLoading(false)
    }
  }

  /**
   * Handle Google login
   */
  const handleGoogleLogin = async () => {
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('Login error:', error)
      setError('Unable to sign in at this time. Please try again.')
    }
  }

  /**
   * Handle logout
   */
  const handleLogout = async () => {
    try {
      await signOut()
      setSyllabus(null)
      setSelectedDay(null)
      setGoal('')
      setCurrentView('dashboard')
      syllabusHydratedRef.current = false // Reset hydration flag
      setLoadingSyllabus(false) // Reset loading state
      // Redirect to landing page
      window.location.href = '/'
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  // Calculate gamification stats for dropdown (works without syllabus)
  const days = syllabus?.days || []
  const xp = calculateXP(days)
  const streak = calculateStreak(days)
  const level = calculateLevel(xp)
  const milestone = calculateMilestones(level)

  // Generate avatar props (consistent for same user)
  const avatarProps = generateAvatarProps(userName, user?.id, user?.email)
  const avatarStyle = getAvatarStyle(avatarProps.gradient)

  // AUTH GATE: Single top-level conditional
  // Show loading state while checking auth (with timeout fallback)
  if (authLoading) {
    return (
      <div className="app" style={{ width: '100%', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <p className="loading-message">Preparing your workspace...</p>
        </div>
      </div>
    )
  }

  // Show landing page if not authenticated
  // Fallback: If no session/user, show landing page (works even if Supabase unavailable)
  if (!session || !user) {
    return (
      <div className="app" style={{ width: '100%', minHeight: '100vh', display: 'block' }}>
        <LandingPage onGetStarted={handleGoogleLogin} />
      </div>
    )
  }

  return (
    <div className="app">
      {/* Gamification Notification */}
      {notification && (
        <div className={`gamification-notification ${notification.type}`}>
          {notification.message}
        </div>
      )}
      
      {/* Left Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <h2 className="sidebar-logo">LAIPath</h2>
        </div>
        <nav className="sidebar-nav">
          <button
            onClick={() => {
              setCurrentView('dashboard')
              setSelectedDay(null)
            }}
            className={`nav-item ${currentView === 'dashboard' && !selectedDay ? 'active' : ''} ${!syllabus ? 'nav-hint' : ''}`}
            title={!syllabus ? 'Create a learning plan' : 'View dashboard'}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-label">Dashboard</span>
          </button>
          <button
            onClick={() => {
              if (syllabus) {
                setCurrentView('learning')
              setSelectedDay(null)
              }
            }}
            disabled={!syllabus}
            className={`nav-item ${currentView === 'learning' && !selectedDay ? 'active' : ''} ${!syllabus ? 'nav-disabled' : ''}`}
            title={!syllabus ? 'Create a learning plan first' : 'View today\'s learning'}
          >
            <span className="nav-icon">📚</span>
            <span className="nav-label">Learning</span>
            {!syllabus && <span className="nav-lock-icon">🔒</span>}
          </button>
          <button
            onClick={() => {
              if (syllabus) {
                setCurrentView('calendar')
              setSelectedDay(null)
              }
            }}
            disabled={!syllabus}
            className={`nav-item ${currentView === 'calendar' ? 'active' : ''} ${!syllabus ? 'nav-disabled' : ''}`}
            title={!syllabus ? 'Create a learning plan first' : 'View learning calendar'}
          >
            <span className="nav-icon">📅</span>
            <span className="nav-label">Calendar</span>
            {!syllabus && <span className="nav-lock-icon">🔒</span>}
          </button>
          <button
            onClick={() => {
              setCurrentView('profile')
              setSelectedDay(null)
            }}
            className={`nav-item ${currentView === 'profile' ? 'active' : ''}`}
            title="View profile"
          >
            <span className="nav-icon">👤</span>
            <span className="nav-label">Profile</span>
          </button>
        </nav>
      </aside>

      {/* Main Dashboard Area */}
      <div className="dashboard-container">
        {/* Top Bar */}
        <header className="topbar">
          <h1 className="topbar-title">LAIPath</h1>
          <div className="topbar-user" ref={profileDropdownRef}>
            <button
              className="profile-avatar-button"
              onClick={() => setShowProfileDropdown(!showProfileDropdown)}
              onMouseEnter={() => !isMobile && setShowProfileDropdown(true)}
              aria-label="Profile menu"
            >
              <div className="user-avatar" style={avatarStyle}>
                <span>{avatarProps.initials}</span>
            </div>
            </button>
            {showProfileDropdown && (
              <>
                {/* Desktop Dropdown */}
                {!isMobile && (
                  <div className="profile-dropdown" onMouseLeave={() => setShowProfileDropdown(false)}>
                    <div className="profile-dropdown-header">
                      <div className="profile-dropdown-avatar" style={avatarStyle}>
                        <span>{avatarProps.initials}</span>
                      </div>
                      <div className="profile-dropdown-info">
                        <button
                          className="profile-dropdown-name-button"
                          onClick={() => {
                            setCurrentView('profile')
                            setShowProfileDropdown(false)
                          }}
                        >
                          {userName || user.email?.split('@')[0] || 'User'}
                        </button>
                        <div className="profile-dropdown-email">{user.email || 'No email'}</div>
                      </div>
                    </div>
                    <div className="profile-dropdown-stats">
                      <div className="profile-dropdown-stat">
                        <span className="stat-label">Level</span>
                        <span className="stat-value">{level} {milestone}</span>
                      </div>
                      <div className="profile-dropdown-stat">
                        <span className="stat-label">XP</span>
                        <span className="stat-value">{xp}</span>
                      </div>
                      <div className="profile-dropdown-stat">
                        <span className="stat-label">Streak</span>
                        <span className="stat-value">{streak} days</span>
                      </div>
                    </div>
                    <div className="profile-dropdown-divider"></div>
                    <div className="profile-dropdown-section">
                      <div className="profile-dropdown-theme-info">
                        <label className="profile-dropdown-label">Theme</label>
                        <span className="profile-dropdown-theme-name">
                          {currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1)}
                        </span>
                      </div>
                      <div className="theme-selector">
                        {Object.keys(themes).map(themeKey => {
                          const theme = themes[themeKey]
                          const isActive = currentTheme === themeKey
                          return (
                            <button
                              key={themeKey}
                              className={`theme-option ${isActive ? 'theme-option-active' : ''}`}
                              onClick={() => setTheme(themeKey)}
                              aria-label={`Select ${themeKey} theme`}
                              title={themeKey.charAt(0).toUpperCase() + themeKey.slice(1)}
                            >
                              <div className="theme-preview">
                                <div 
                                  className="theme-preview-background" 
                                  style={{ backgroundColor: theme.background }}
                                />
                                <div 
                                  className="theme-preview-accent" 
                                  style={{ backgroundColor: theme.accent }}
                                />
                              </div>
                              <span className="theme-name">
                                {themeKey.charAt(0).toUpperCase() + themeKey.slice(1)}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    <div className="profile-dropdown-divider"></div>
                    <div className="profile-dropdown-actions">
                      <button
                        className="profile-dropdown-view-profile"
                        onClick={() => {
                          setCurrentView('profile')
                          setShowProfileDropdown(false)
                        }}
                      >
                        View Profile
                      </button>
                      <button onClick={handleLogout} className="profile-dropdown-logout">
              Logout
            </button>
                    </div>
                  </div>
                )}
                
                {/* Mobile Bottom Sheet */}
                {isMobile && (
                  <>
                    <div 
                      className="bottom-sheet-overlay"
                      onClick={() => setShowProfileDropdown(false)}
                      aria-hidden="true"
                    />
                    <div 
                      className="bottom-sheet"
                      ref={bottomSheetRef}
                      role="dialog"
                      aria-modal="true"
                      aria-label="Profile menu"
                    >
                      <div className="bottom-sheet-handle" aria-label="Swipe down to close" />
                      <div className="bottom-sheet-content">
                        <div className="profile-dropdown-header">
                          <div className="profile-dropdown-avatar" style={avatarStyle}>
                            <span>{avatarProps.initials}</span>
                          </div>
                          <div className="profile-dropdown-info">
                            <button
                              className="profile-dropdown-name-button"
                              onClick={() => {
                                setCurrentView('profile')
                                setShowProfileDropdown(false)
                              }}
                            >
                              {userName || user.email?.split('@')[0] || 'User'}
                            </button>
                            <div className="profile-dropdown-email">{user.email || 'No email'}</div>
                          </div>
                        </div>
                        <div className="profile-dropdown-stats">
                          <div className="profile-dropdown-stat">
                            <span className="stat-label">Level</span>
                            <span className="stat-value">{level} {milestone}</span>
                          </div>
                          <div className="profile-dropdown-stat">
                            <span className="stat-label">XP</span>
                            <span className="stat-value">{xp}</span>
                          </div>
                          <div className="profile-dropdown-stat">
                            <span className="stat-label">Streak</span>
                            <span className="stat-value">{streak} days</span>
                          </div>
                        </div>
                        <div className="profile-dropdown-divider"></div>
                        <div className="profile-dropdown-section">
                          <div className="profile-dropdown-theme-info">
                            <label className="profile-dropdown-label">Theme</label>
                            <span className="profile-dropdown-theme-name">
                              {currentTheme.charAt(0).toUpperCase() + currentTheme.slice(1)}
                            </span>
                          </div>
                          <div className="theme-selector">
                            {Object.keys(themes).map(themeKey => {
                              const theme = themes[themeKey]
                              const isActive = currentTheme === themeKey
                              return (
                                <button
                                  key={themeKey}
                                  className={`theme-option ${isActive ? 'theme-option-active' : ''}`}
                                  onClick={() => setTheme(themeKey)}
                                  aria-label={`Select ${themeKey} theme`}
                                  title={themeKey.charAt(0).toUpperCase() + themeKey.slice(1)}
                                >
                                  <div className="theme-preview">
                                    <div 
                                      className="theme-preview-background" 
                                      style={{ backgroundColor: theme.background }}
                                    />
                                    <div 
                                      className="theme-preview-accent" 
                                      style={{ backgroundColor: theme.accent }}
                                    />
                                  </div>
                                  <span className="theme-name">
                                    {themeKey.charAt(0).toUpperCase() + themeKey.slice(1)}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                        <div className="profile-dropdown-divider"></div>
                        <div className="profile-dropdown-actions">
                          <button
                            className="profile-dropdown-view-profile"
                            onClick={() => {
                              setCurrentView('profile')
                              setShowProfileDropdown(false)
                            }}
                          >
                            View Profile
                          </button>
                          <button onClick={handleLogout} className="profile-dropdown-logout">
                            Logout
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="main-content">
        {loadingSyllabus ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-message">Loading your learning plan...</p>
          </div>
        ) : selectedDay ? (
          // Daily Learning Page (requires syllabus - selectedDay implies syllabus exists)
          <DailyLearningPage
            day={selectedDay}
            syllabus={syllabus}
            onSyllabusUpdate={handleSyllabusUpdate}
            onBack={() => setSelectedDay(null)}
          />
        ) : currentView === 'learning' ? (
          // Learning View: Today's Learning (requires syllabus)
          !syllabus ? (
          <div className="form-container">
              <div className="form-header">
                <h2>Create Your Learning Plan</h2>
                <p className="form-subtitle">Define your learning goal and we'll create a personalized path for you.</p>
              </div>
            <form onSubmit={handleSubmit} className="form">
              <div className="form-group">
                <label htmlFor="goal">Learning Goal</label>
                <input
                  id="goal"
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g., Learn React.js"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="hoursPerDay">Hours per Day</label>
                <input
                  id="hoursPerDay"
                  type="number"
                  min="0.5"
                  max="24"
                  step="0.5"
                    value={hoursPerDay === '' ? '' : hoursPerDay}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value)
                      if (!isNaN(value) && value >= 0.5 && value <= 24) {
                        setHoursPerDay(value)
                      } else if (e.target.value === '') {
                        setHoursPerDay('')
                      }
                    }}
                  required
                />
                  <small className="input-hint">Enter a value between 0.5 and 24</small>
              </div>

              <div className="form-group">
                <label htmlFor="totalDays">Total Days</label>
                <input
                  id="totalDays"
                  type="number"
                  min="1"
                  max="365"
                    value={totalDays === '' ? '' : totalDays}
                    onChange={(e) => {
                      const value = parseInt(e.target.value)
                      if (!isNaN(value) && value >= 1 && value <= 365) {
                        setTotalDays(value)
                      } else if (e.target.value === '') {
                        setTotalDays('')
                      }
                    }}
                  required
                />
                  <small className="input-hint">Enter a value between 1 and 365</small>
              </div>

              <button type="submit" disabled={loading} className="submit-button">
                  {loading ? 'Creating your plan...' : 'Create Learning Plan'}
              </button>

                {error && (
                  <div className="error-message">
                    <p className="error-text">{error}</p>
                    <p className="error-hint">Please check your input and try again.</p>
                  </div>
                )}
            </form>
          </div>
          ) : (
            // Today's Learning Card
            <div className="syllabus-container">
              <button
                onClick={() => setCurrentView('dashboard')}
                className="back-button"
                aria-label="Go back to dashboard"
              >
                <span className="back-arrow">←</span>
                <span>Back to Dashboard</span>
              </button>
              <div className="card todays-learning-card">
                <div className="card-header">
                  <h2 className="page-title">Today's Learning</h2>
                  <p className="page-meta">
                    {syllabus.totalDays} days • {syllabus.hoursPerDay} hour{syllabus.hoursPerDay !== 1 ? 's' : ''} per day
                  </p>
                  <div className="syllabus-header-actions">
                    {(() => {
                      const activeDay = syllabus.days.find(d => d.status === 'active')
                      return activeDay ? (
                        <button
                          onClick={() => setSelectedDay(activeDay)}
                          className="resume-button"
                        >
                          Resume Day {activeDay.dayNumber}
                        </button>
                      ) : null
                    })()}
                    <button 
                      onClick={() => {
                        setSyllabus(null)
                        setSelectedDay(null)
                        setGoal('')
                        setCurrentView('dashboard')
                      }}
                      className="reset-button"
                    >
                      Create New Plan
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  {(() => {
                    const activeDay = syllabus.days.find(d => d.status === 'active')
                    if (!activeDay) {
                      const completedDays = syllabus.days.filter(d => d.status === 'completed').length
                      return (
                        <div className="no-active-day">
                          <p>All days completed! 🎉</p>
                          <p className="completion-meta">Completed {completedDays} of {syllabus.totalDays} days</p>
                        </div>
                      )
                    }
                    return (
                      <div className="day-summary">
                        <div className="day-header">
                          <h3 className="day-topic">{activeDay.topic}</h3>
                          <span className={`day-status-badge ${getStatusBadge(activeDay.status).class}`}>
                            {getStatusBadge(activeDay.status).text}
                          </span>
                        </div>
                        <div className="day-subtasks">
                          <h4 className="subtasks-title">Tasks:</h4>
                          <ul className="subtasks-list">
                            {activeDay.subtasks.map((task, idx) => (
                              <li key={idx}>{task}</li>
                            ))}
                          </ul>
                        </div>
                        <button
                          onClick={() => setSelectedDay(activeDay)}
                          className="start-learning-button"
                        >
                          Start Learning
                        </button>
                      </div>
                    )
                  })()}
                </div>
              </div>

              {/* Complete Syllabus View */}
              <div className="card complete-syllabus-card">
                <div className="card-header">
                  <h2 className="page-title">Complete Syllabus</h2>
                  <p className="page-meta">
                    {syllabus.goal} • {syllabus.totalDays} days total
                  </p>
                </div>
                <div className="card-body">
                  <div className="syllabus-list">
                    {syllabus.days.map((day) => (
                      <div 
                        key={day.dayNumber} 
                        className={`syllabus-day-item ${day.status}`}
                        onClick={() => {
                          if (day.status === 'active' || day.status === 'completed' || day.status === 'skipped' || day.status === 'leave') {
                            setSelectedDay(day)
                          }
                        }}
                        style={{ cursor: (day.status === 'active' || day.status === 'completed' || day.status === 'skipped' || day.status === 'leave') ? 'pointer' : 'default' }}
                      >
                        <div className="day-item-header">
                          <div className="day-item-number">Day {day.dayNumber}</div>
                          <span className={`day-status-badge ${getStatusBadge(day.status).class}`}>
                            {getStatusBadge(day.status).text}
                          </span>
                        </div>
                        <div className="day-item-topic">{day.topic}</div>
                        <div className="day-item-date">{day.date}</div>
                        {day.subtasks && day.subtasks.length > 0 && (
                          <div className="day-item-subtasks">
                            <ul>
                              {day.subtasks.map((subtask, idx) => (
                                <li key={idx}>{subtask}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        ) : currentView === 'calendar' ? (
          // Calendar View (requires syllabus, but handles null gracefully)
          <CalendarView
            syllabus={syllabus}
            onBack={() => setCurrentView('dashboard')}
          />
        ) : currentView === 'profile' ? (
          // Profile View
          <ProfilePage 
            syllabus={syllabus}
            onBack={() => setCurrentView('dashboard')}
          />
        ) : !syllabus ? (
          // Dashboard: Onboarding message when no syllabus
          <div className="syllabus-container">
            <div className="card onboarding-card">
              <div className="card-body">
                <div className="onboarding-content">
                  <h2 className="onboarding-title">Welcome to LAIPath</h2>
                  <div className="onboarding-description">
                    <p className="onboarding-line">A learning system that adapts to how you actually learn.</p>
                    <p className="onboarding-line">Daily syllabus, mandatory reflection, and a topic-scoped AI mentor guide your progress.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="form-container">
              <div className="form-header">
                <h2>Create Your Learning Plan</h2>
                <p className="form-subtitle">Define your learning goal and we'll create a personalized path for you.</p>
              </div>
            <form onSubmit={handleSubmit} className="form">
              <div className="form-group">
                <label htmlFor="goal">Learning Goal</label>
                <input
                  id="goal"
                  type="text"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="e.g., Learn React.js"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="hoursPerDay">Hours per Day</label>
                <input
                  id="hoursPerDay"
                  type="number"
                  min="0.5"
                  max="24"
                  step="0.5"
                  value={hoursPerDay || ''}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value)
                    if (!isNaN(value) && value >= 0.5 && value <= 24) {
                      setHoursPerDay(value)
                    } else if (e.target.value === '') {
                      setHoursPerDay('')
                    }
                  }}
                  required
                />
                <small className="input-hint">Enter a value between 0.5 and 24</small>
              </div>

              <div className="form-group">
                <label htmlFor="totalDays">Total Days</label>
                <input
                  id="totalDays"
                  type="number"
                  min="1"
                  max="365"
                  value={totalDays || ''}
                  onChange={(e) => {
                    const value = parseInt(e.target.value)
                    if (!isNaN(value) && value >= 1 && value <= 365) {
                      setTotalDays(value)
                    } else if (e.target.value === '') {
                      setTotalDays('')
                    }
                  }}
                  required
                />
                <small className="input-hint">Enter a value between 1 and 365</small>
              </div>

              <button type="submit" disabled={loading} className="submit-button">
                {loading ? 'Creating your plan...' : 'Create Learning Plan'}
              </button>

              {error && (
                <div className="error-message">
                  <p className="error-text">{error}</p>
                  <p className="error-hint">Please check your input and try again.</p>
                </div>
              )}
            </form>
          </div>
          </div>
        ) : (
          // Dashboard View: Today's Focus + Gamification Stats
          <div className="syllabus-container">
            {/* Today's Focus Card - Prominent at top */}
            {(() => {
              const activeDay = syllabus?.days?.find(d => d.status === 'active')
              const completedDays = syllabus?.days?.filter(d => d.status === 'completed').length || 0
              const totalDays = syllabus?.totalDays || 0
              
              return (
                <div className="card todays-focus-card">
                  <div className="card-header">
                    <h2 className="card-title">Today's Focus</h2>
                  </div>
                  <div className="card-body">
                    {!activeDay ? (
                      <div className="todays-focus-empty">
                        <p className="empty-message">All days completed! 🎉</p>
                        <p className="empty-hint">You've completed {completedDays} of {totalDays} days</p>
                      </div>
                    ) : (
                      <>
                        <div className="todays-focus-header">
                          <div className="focus-day-info">
                            <span className="day-counter">Day {activeDay.dayNumber} of {totalDays}</span>
                            <h3 className="focus-topic">{activeDay.topic}</h3>
                          </div>
                        </div>
                        <div className="todays-focus-subtasks">
                          <h4 className="subtasks-title">Tasks:</h4>
                          <ul className="subtasks-list">
                            {activeDay.subtasks && activeDay.subtasks.length > 0 ? (
                              activeDay.subtasks.map((task, idx) => (
                                <li key={idx}>{task}</li>
                              ))
                            ) : (
                              <li className="no-subtasks">No specific tasks for today</li>
                            )}
                          </ul>
                        </div>
                        <div className="todays-focus-actions">
                          <button
                            onClick={() => setSelectedDay(activeDay)}
                            className="btn-primary focus-action-primary"
                          >
                            Start Learning
                          </button>
                          <div className="focus-action-secondary">
                            <button
                              onClick={() => handleSkipDayFromDashboard(activeDay)}
                              className="btn-secondary focus-action-skip"
                            >
                              Skip Day
                            </button>
                            <button
                              onClick={() => handleLeaveFromDashboard(activeDay)}
                              className="btn-secondary focus-action-leave"
                            >
                              Apply Leave
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })()}
            
            {/* Gamification Stats Card */}
            {(() => {
              const days = syllabus?.days || [];
              const xp = calculateXP(days);
              const streak = calculateStreak(days);
              const level = calculateLevel(xp);
              const milestone = calculateMilestones(level);
              const xpForNext = getXPForNextLevel(level);
              const xpProgress = getXPProgress(xp, level);
              
              return (
                <div className="card gamification-card">
                  <div className="card-header">
                    <h3 className="card-title">Progress</h3>
                  </div>
                  <div className="card-body">
                    <div className="gamification-stats">
                      <div className="stat-item">
                        <div className="stat-value">
                          {level}
                          <span className="level-badge">{milestone}</span>
                        </div>
                        <div className="stat-label">Level</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-value">{xp}</div>
                        <div className="stat-label">XP</div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-value">{streak}</div>
                        <div className="stat-label">Streak</div>
                      </div>
                    </div>
                    <div className="xp-progress-bar">
                      <div className="xp-progress-label">
                        <span>XP to Level {level + 1}</span>
                        <span>{xp} / {xpForNext} XP</span>
                      </div>
                      <div className="xp-progress-track">
                        <div 
                          className="xp-progress-fill" 
                          style={{ width: `${xpProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            {/* Recent Activity Card */}
                {(() => {
              const activities = getRecentActivity(syllabus)
              
              if (activities.length === 0) return null
                
                return (
                <div className="card recent-activity-card">
                  <div className="card-header">
                    <h3 className="card-title">Recent Activity</h3>
                    </div>
                  <div className="card-body">
                    <div className="activity-list">
                      {activities.map((activity, idx) => (
                        <div key={idx} className="activity-item">
                          <div className="activity-content">
                            <p className="activity-message">{activity.message}</p>
                            {activity.topic && (
                              <p className="activity-topic">{activity.topic}</p>
                            )}
                          </div>
                          {activity.timestamp && (
                            <span className="activity-time">
                              {formatActivityTime(activity.timestamp)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  </div>
                )
            })()}
            
            {/* Micro Insight Card */}
            {(() => {
              const insight = getMicroInsight(syllabus)
              
              if (!insight) return null
              
              return (
                <div className="card micro-insight-card">
                  <div className="card-body">
                    <p className="micro-insight-text">{insight}</p>
            </div>
                </div>
              )
            })()}
          </div>
        )}
        </main>
      </div>

      {/* Leave Modal */}
      {showLeaveModal && (
        <LeaveModal
          onClose={() => {
            setShowLeaveModal(false)
            setLeaveDay(null)
          }}
          onConfirm={handleLeaveConfirm}
        />
      )}
    </div>
  )
}

export default App

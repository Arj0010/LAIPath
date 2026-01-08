import { useState, useEffect } from 'react'
import { calculateXP, calculateStreak, calculateLevel, calculateMilestones, calculateLongestStreak, getXPForNextLevel, getXPProgress } from './gamificationUtils.js'
import { useAuth } from './contexts/AuthContext.jsx'
import { useTheme } from './contexts/ThemeContext.jsx'
import { saveUserProfile, loadUserProfile, loadAllSyllabiMetadata, loadSyllabusById, deleteSyllabus } from './lib/syllabusStorage.js'
import './ProfilePage.css'

/**
 * Profile Page Component
 * 
 * Shows user profile information with editable fields
 * Saves to localStorage (no backend)
 */
function ProfilePage({ syllabus, onBack }) {
  const { user } = useAuth()
  const { currentTheme, setTheme, themes } = useTheme()
  const [name, setName] = useState('Demo User')
  const [preferredStudyTime, setPreferredStudyTime] = useState('20:00')
  const [isEditingName, setIsEditingName] = useState(false)
  const [isEditingTime, setIsEditingTime] = useState(false)
  const [loading, setLoading] = useState(true)
  const [allSyllabi, setAllSyllabi] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [selectedSyllabusDetails, setSelectedSyllabusDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [deletingSyllabusId, setDeletingSyllabusId] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null) // syllabusId to confirm

  // Load from Supabase on mount and when user changes
  // Also refresh history when syllabus prop changes (new syllabus created)
  useEffect(() => {
    if (user) {
      loadProfileFromSupabase()
      loadSyllabusHistory()
    }
  }, [user, syllabus])

  /**
   * Load profile from Supabase
   */
  const loadProfileFromSupabase = async () => {
    if (!user) return
    
    setLoading(true)
    try {
      const profile = await loadUserProfile(user.id)
      if (profile) {
        setName(profile.name || user.email?.split('@')[0] || 'User')
        setPreferredStudyTime(profile.preferred_study_time || '20:00')
      } else {
        // Fallback to email or default
        setName(user.email?.split('@')[0] || 'User')
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      // Fallback to localStorage
      const savedName = localStorage.getItem('laipath_user_name')
      const savedTime = localStorage.getItem('laipath_preferred_study_time')
      if (savedName) setName(savedName)
      if (savedTime) setPreferredStudyTime(savedTime)
    } finally {
      setLoading(false)
    }
  }

  // PERSISTENCE: Save name to Supabase (with fallback safety)
  const handleNameSave = async () => {
    if (user) {
      // Fallback already handled in saveUserProfile
      await saveUserProfile(user.id, {
        name: name,
        preferredStudyTime: preferredStudyTime
      })
      // Also save to localStorage as backup
      localStorage.setItem('laipath_user_name', name)
    } else {
      localStorage.setItem('laipath_user_name', name)
    }
    setIsEditingName(false)
  }

  // PERSISTENCE: Save study time to Supabase (with fallback safety)
  const handleTimeSave = async () => {
    if (user) {
      // Fallback already handled in saveUserProfile
      await saveUserProfile(user.id, {
        name: name,
        preferredStudyTime: preferredStudyTime
      })
      // Also save to localStorage as backup
      localStorage.setItem('laipath_preferred_study_time', preferredStudyTime)
    } else {
      localStorage.setItem('laipath_preferred_study_time', preferredStudyTime)
    }
    setIsEditingTime(false)
  }

  /**
   * Load all syllabi for history view
   */
  /**
   * Load all syllabi for history view
   * Fetches ALL syllabi from Supabase, ordered by created_at DESC
   * This is the source of truth for syllabus history
   */
  const loadSyllabusHistory = async () => {
    if (!user) return
    
    setLoadingHistory(true)
    try {
      const syllabi = await loadAllSyllabiMetadata(user.id)
      // syllabusHistory contains ALL syllabi
      setAllSyllabi(syllabi || [])
      console.log(`Profile: Loaded ${syllabi?.length || 0} syllabi for history display`)
    } catch (error) {
      console.error('Error loading syllabus history:', error)
      setAllSyllabi([])
    } finally {
      setLoadingHistory(false)
    }
  }

  /**
   * Handle clicking on a syllabus to view details
   */
  const handleSyllabusClick = async (syllabusId) => {
    if (!user || !syllabusId) return
    
    setLoadingDetails(true)
    try {
      const details = await loadSyllabusById(user.id, syllabusId)
      setSelectedSyllabusDetails(details)
    } catch (error) {
      console.error('Error loading syllabus details:', error)
      setSelectedSyllabusDetails(null)
    } finally {
      setLoadingDetails(false)
    }
  }

  /**
   * Close syllabus details modal
   */
  const handleCloseDetails = () => {
    setSelectedSyllabusDetails(null)
  }

  /**
   * Handle delete syllabus request
   */
  const handleDeleteRequest = (syllabusId, e) => {
    e.stopPropagation() // Prevent opening details modal
    setShowDeleteConfirm(syllabusId)
  }

  /**
   * Cancel delete confirmation
   */
  const handleCancelDelete = () => {
    setShowDeleteConfirm(null)
  }

  /**
   * Confirm and delete syllabus
   */
  const handleConfirmDelete = async (syllabusId) => {
    if (!user || !syllabusId) return

    setDeletingSyllabusId(syllabusId)
    setShowDeleteConfirm(null)

    try {
      console.log('🗑️  ProfilePage: Starting delete for syllabus:', syllabusId)
      const success = await deleteSyllabus(user.id, syllabusId)
      
      if (success) {
        console.log('✅ ProfilePage: Delete successful, refreshing history...')
        // Refresh history after deletion
        await loadSyllabusHistory()
        
        // If this was the active syllabus, close details modal
        if (selectedSyllabusDetails && selectedSyllabusDetails.id === syllabusId) {
          setSelectedSyllabusDetails(null)
        }
        
        // If this was the active syllabus (first in list), note that parent will need to refresh
        const deletedSyllabusIndex = allSyllabi.findIndex(s => s.id === syllabusId)
        if (deletedSyllabusIndex === 0) {
          console.log('⚠️  Active syllabus deleted. Page refresh recommended to reload active syllabus.')
        }
        
        console.log('✅ Syllabus deleted successfully')
      } else {
        console.error('❌ ProfilePage: Delete failed - check console for details')
        alert('Failed to delete syllabus. Please check the browser console for details.')
      }
    } catch (error) {
      console.error('❌ ProfilePage: Exception during delete:', error)
      alert(`Error deleting syllabus: ${error.message}`)
    } finally {
      setDeletingSyllabusId(null)
    }
  }

  /**
   * Format date for display
   */
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    } catch (error) {
      return dateString
    }
  }

  /**
   * Get status for a syllabus (Active if it's the most recent, Past otherwise)
   * Active syllabus is derived from syllabusHistory[0] (most recent by created_at)
   */
  const getSyllabusStatus = (syllabusMeta, index) => {
    // Active syllabus is the first one in the array (most recent by created_at DESC)
    if (index === 0) {
      return 'Active'
    }
    return 'Past'
  }

  /**
   * Get completed days count for a syllabus
   */
  const getCompletedDays = (syllabusDetails) => {
    if (!syllabusDetails || !syllabusDetails.days) return 0
    return syllabusDetails.days.filter(d => d.status === 'completed').length
  }

  // Calculate gamification stats
  const days = syllabus?.days || [];
  const xp = calculateXP(days);
  const streak = calculateStreak(days);
  const level = calculateLevel(xp);
  const milestone = calculateMilestones(level);
  const longestStreak = calculateLongestStreak(days);
  const xpForNext = getXPForNextLevel(level);
  const xpProgress = getXPProgress(xp, level);

  // Calculate progress summary
  const currentDay = syllabus ? syllabus.days.find(d => d.status === 'active')?.dayNumber || 
    syllabus.days.filter(d => d.status === 'completed').length : 0
  const totalDays = syllabus ? syllabus.totalDays : 0
  const completedDays = syllabus ? syllabus.days.filter(d => d.status === 'completed').length : 0

  return (
    <div className="profile-page">
      {onBack && (
        <button
          onClick={onBack}
          className="back-button"
          aria-label="Go back"
        >
          <span className="back-arrow">←</span>
          <span>Back</span>
        </button>
      )}
      <div className="card profile-card">
        <div className="card-header">
          <h2 className="card-title">Profile</h2>
        </div>
        <div className="card-body">
          {loading && (
            <div className="profile-loading">
              <p className="loading-message">Loading your profile...</p>
            </div>
          )}
          {!loading && (
            <>
          {/* Profile Summary */}
          <div className="profile-summary">
            <div className="profile-avatar-large">
              <span>{name.charAt(0).toUpperCase()}</span>
            </div>
            <div className="profile-name-section">
              {isEditingName ? (
                <div className="editable-field">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="editable-input"
                    autoFocus
                    onBlur={handleNameSave}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleNameSave()
                      } else if (e.key === 'Escape') {
                        setIsEditingName(false)
                        // Reload from Supabase
                        if (user) {
                          loadUserProfile(user.id).then(profile => {
                            if (profile) {
                              setName(profile.name || user.email?.split('@')[0] || 'User')
                            }
                          })
                        }
                      }
                    }}
                  />
                </div>
              ) : (
                <h3 
                  className="profile-name editable"
                  onClick={() => setIsEditingName(true)}
                  title="Click to edit"
                >
                  {name}
                  <span className="edit-icon">✏️</span>
                </h3>
              )}
              <p className="profile-email">{user?.email || 'demo@laipath.com'}</p>
            </div>
          </div>

          {/* Learning Information */}
          <div className="profile-section">
            <h4 className="profile-section-title">Learning Information</h4>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Current Goal</span>
                <span className="info-value">
                  {syllabus ? syllabus.goal : 'No active learning plan'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Preferred Study Time</span>
                {isEditingTime ? (
                  <div className="editable-field">
                    <input
                      type="time"
                      value={preferredStudyTime}
                      onChange={(e) => setPreferredStudyTime(e.target.value)}
                      className="editable-input time-input"
                      autoFocus
                      onBlur={handleTimeSave}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleTimeSave()
                      } else if (e.key === 'Escape') {
                        setIsEditingTime(false)
                        // Reload from Supabase
                        if (user) {
                          loadUserProfile(user.id).then(profile => {
                            if (profile) {
                              setPreferredStudyTime(profile.preferred_study_time || '20:00')
                            }
                          })
                        }
                      }
                    }}
                    />
                  </div>
                ) : (
                  <span 
                    className="info-value editable"
                    onClick={() => setIsEditingTime(true)}
                    title="Click to edit"
                  >
                    {preferredStudyTime}
                    <span className="edit-icon">✏️</span>
                  </span>
                )}
              </div>
              <div className="info-item">
                <span className="info-label">Hours per Day</span>
                <span className="info-value">
                  {syllabus ? `${syllabus.hoursPerDay} hour${syllabus.hoursPerDay !== 1 ? 's' : ''}` : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Theme Preferences */}
          <div className="profile-section">
            <h4 className="profile-section-title">Theme Preferences</h4>
            <div className="theme-selector-profile">
              {Object.keys(themes).map(themeKey => {
                const theme = themes[themeKey]
                const isActive = currentTheme === themeKey
                return (
                  <button
                    key={themeKey}
                    className={`theme-option-profile ${isActive ? 'theme-option-active' : ''}`}
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

          {/* Progress Overview */}
          <div className="profile-section">
            <h4 className="profile-section-title">Progress Overview</h4>
            <div className="progress-overview">
              <div className="overview-item">
                <span className="overview-label">Total XP</span>
                <span className="overview-value">{xp}</span>
              </div>
              <div className="overview-item">
                <span className="overview-label">Current Level</span>
                <span className="overview-value">
                  {level} <span className="milestone-badge">({milestone})</span>
                </span>
              </div>
              <div className="overview-item">
                <span className="overview-label">Longest Streak</span>
                <span className="overview-value">{longestStreak} days</span>
              </div>
            </div>
          </div>

          {/* Progress Summary */}
          {syllabus && (
            <div className="profile-section">
              <h4 className="profile-section-title">Progress Summary</h4>
              <div className="progress-summary">
                <div className="progress-item">
                  <span className="progress-label">Current Day</span>
                  <span className="progress-value">Day {currentDay || 0}</span>
                </div>
                <div className="progress-item">
                  <span className="progress-label">Total Days</span>
                  <span className="progress-value">{totalDays}</span>
                </div>
                <div className="progress-item">
                  <span className="progress-label">Completed</span>
                  <span className="progress-value">{completedDays} days</span>
                </div>
                <div className="progress-item">
                  <span className="progress-label">Progress</span>
                  <span className="progress-value">
                    {totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Gamification Stats */}
          <div className="profile-section">
            <h4 className="profile-section-title">Achievements</h4>
            <div className="gamification-stats">
              <div className="stat-item">
                <div className="stat-value">{level}</div>
                <div className="stat-label">Level</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{xp}</div>
                <div className="stat-label">Total XP</div>
              </div>
              <div className="stat-item">
                <div className="stat-value">{streak}</div>
                <div className="stat-label">Streak</div>
              </div>
            </div>
            <div className="xp-progress-bar">
              <div className="xp-progress-label">
                <span>Progress to Level {level + 1}</span>
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

          {/* Learning History */}
          <div className="profile-section">
            <h4 className="profile-section-title">Learning History</h4>
            {loadingHistory ? (
              <div className="history-loading">
                <p className="loading-message">Loading your learning history...</p>
              </div>
            ) : allSyllabi.length === 0 ? (
              <div className="history-empty">
                <p className="empty-message">No learning plans yet</p>
                <p className="empty-hint">Your learning history will appear here once you create your first plan.</p>
              </div>
            ) : (
              <div className="syllabus-history-list">
                {allSyllabi.map((syllabusMeta, index) => {
                  const status = getSyllabusStatus(syllabusMeta, index)
                  const isActive = status === 'Active'
                  
                  return (
                    <div 
                      key={syllabusMeta.id}
                      className={`syllabus-history-item ${isActive ? 'active' : ''} ${deletingSyllabusId === syllabusMeta.id ? 'deleting' : ''}`}
                      onClick={() => handleSyllabusClick(syllabusMeta.id)}
                    >
                      <div className="syllabus-history-header">
                        <h5 className="syllabus-history-goal">{syllabusMeta.goal}</h5>
                        <div className="syllabus-history-actions">
                          <span className={`syllabus-status-badge ${isActive ? 'status-active' : 'status-past'}`}>
                            {status}
                          </span>
                          <button
                            className="delete-syllabus-button"
                            onClick={(e) => handleDeleteRequest(syllabusMeta.id, e)}
                            title="Delete this learning plan"
                            disabled={deletingSyllabusId === syllabusMeta.id}
                          >
                            {deletingSyllabusId === syllabusMeta.id ? (
                              <span className="delete-spinner">⏳</span>
                            ) : (
                              '🗑️'
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="syllabus-history-meta">
                        <span className="syllabus-history-date">
                          Created: {formatDate(syllabusMeta.created_at)}
                        </span>
                      </div>
                      {showDeleteConfirm === syllabusMeta.id && (
                        <div className="delete-confirmation" onClick={(e) => e.stopPropagation()}>
                          <p className="delete-confirmation-text">
                            {isActive 
                              ? `Delete active learning plan "${syllabusMeta.goal}"? This will remove all progress. This cannot be undone.`
                              : `Delete "${syllabusMeta.goal}"? This cannot be undone.`
                            }
                          </p>
                          <div className="delete-confirmation-actions">
                            <button
                              className="confirm-delete-button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleConfirmDelete(syllabusMeta.id)
                              }}
                            >
                              Delete
                            </button>
                            <button
                              className="cancel-delete-button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCancelDelete()
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          </>
        )}
        </div>
      </div>

      {/* Syllabus Details Modal */}
      {selectedSyllabusDetails && (
        <div className="modal-overlay" onClick={handleCloseDetails}>
          <div className="modal-content syllabus-details-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Syllabus Details</h3>
              <button 
                onClick={handleCloseDetails}
                className="modal-close"
              >
                ×
              </button>
            </div>
            {loadingDetails ? (
              <div className="modal-body">
                <p className="loading-message">Loading details...</p>
              </div>
            ) : (
              <div className="modal-body">
                <div className="syllabus-details-section">
                  <div className="syllabus-details-item">
                    <span className="syllabus-details-label">Goal</span>
                    <span className="syllabus-details-value">{selectedSyllabusDetails.goal}</span>
                  </div>
                  <div className="syllabus-details-item">
                    <span className="syllabus-details-label">Total Days</span>
                    <span className="syllabus-details-value">{selectedSyllabusDetails.totalDays}</span>
                  </div>
                  <div className="syllabus-details-item">
                    <span className="syllabus-details-label">Completed Days</span>
                    <span className="syllabus-details-value">{getCompletedDays(selectedSyllabusDetails)}</span>
                  </div>
                  <div className="syllabus-details-item">
                    <span className="syllabus-details-label">Created</span>
                    <span className="syllabus-details-value">{formatDate(selectedSyllabusDetails.created_at)}</span>
                  </div>
                </div>
              </div>
            )}
            <div className="modal-actions">
              <button 
                onClick={handleCloseDetails}
                className="close-button"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProfilePage


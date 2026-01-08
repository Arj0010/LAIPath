import { useState, useEffect } from 'react'
import { generateCalendarEntries, generateICalText, getTodayDate } from './calendarUtils.js'
import './CalendarView.css'

/**
 * Calendar View Component
 * 
 * Day 4: Internal calendar system
 * - READ-ONLY view derived from syllabus
 * - Automatically regenerates when syllabus changes
 * - Shows daily commitment visually
 */
function CalendarView({ syllabus, onBack }) {
  const [calendarEntries, setCalendarEntries] = useState([])
  const [showExportModal, setShowExportModal] = useState(false)
  const [icalText, setIcalText] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)
  const [copyError, setCopyError] = useState(null)

  // Regenerate calendar whenever syllabus changes
  // This ensures calendar is always in sync with syllabus state
  useEffect(() => {
    if (syllabus) {
      const entries = generateCalendarEntries(syllabus)
      setCalendarEntries(entries)
    } else {
      // Clear entries when syllabus is null
      setCalendarEntries([])
    }
  }, [syllabus])

  /**
   * Handle Google Calendar export preview
   * Generates iCal format text (simulated, not real sync)
   */
  const handleExportPreview = () => {
    const ical = generateICalText(calendarEntries)
    setIcalText(ical)
    setShowExportModal(true)
  }

  /**
   * Copy iCal text to clipboard
   */
  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(icalText).then(() => {
      setCopySuccess(true)
      setCopyError(null)
      setTimeout(() => setCopySuccess(false), 3000)
    }).catch(err => {
      console.error('Failed to copy:', err)
      setCopyError('Unable to copy. Please try selecting and copying manually.')
      setTimeout(() => setCopyError(null), 5000)
    })
  }

  // "Today" is always Day 1's date (original start date)
  // This keeps the reference point consistent
  // getTodayDate safely handles null syllabus
  const todayDate = getTodayDate(syllabus)

  return (
    <div className="calendar-view">
      {onBack && (
        <button
          onClick={onBack}
          className="back-button"
          aria-label="Go back to dashboard"
        >
          <span className="back-arrow">←</span>
          <span>Back to Dashboard</span>
        </button>
      )}
      <div className="card calendar-main-card">
        <div className="calendar-header">
          <h2>Learning Calendar</h2>
          <p className="calendar-subtitle">
            This calendar updates automatically when your plan changes
          </p>
          {syllabus && (
            <button 
              onClick={handleExportPreview}
              className="export-button"
            >
              Preview Google Calendar Format
            </button>
          )}
        </div>

        <div className="card-body">
          <div className="calendar-cards-container">
            {!syllabus ? (
          <div className="card empty-card">
            <div className="card-body">
              <div className="empty-state">
                <p className="empty-message">Your learning calendar will appear here once you create a plan.</p>
                <p className="empty-hint">Start by creating your learning plan in the Today view.</p>
              </div>
            </div>
          </div>
        ) : calendarEntries.length === 0 ? (
          <div className="card empty-card">
            <div className="card-body">
              <div className="empty-state">
                <p className="empty-message">Your plan will appear here once it's generated.</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="calendar-cards-grid">
            {calendarEntries.map((entry, idx) => {
              const isToday = entry.date === todayDate
              const isActive = entry.status === 'active'
              
              return (
                <div 
                  key={idx} 
                  className={`card calendar-entry-card ${
                    isToday ? 'card-today' : ''} ${
                    isActive ? 'card-active' : ''} ${
                    entry.status === 'completed' ? 'card-completed' : ''} ${
                    entry.status === 'skipped' ? 'card-skipped' : ''} ${
                    entry.status === 'leave' ? 'card-leave' : ''}
                  `}
                >
                  <div className="card-header">
                    <div className="calendar-entry-header">
                      <span className="calendar-day">Day {entry.dayNumber}</span>
                      {isToday && <span className="today-badge">Today</span>}
                    </div>
                    <span className="calendar-date">{entry.date}</span>
                  </div>
                  <div className="card-body">
                    <h4 className="calendar-topic">{entry.topic}</h4>
                    <div className="calendar-meta">
                      <span className="calendar-time">{entry.time}</span>
                    </div>
                    <p className="calendar-notes">{entry.notes}</p>
                  </div>
                </div>
              )
            })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Google Calendar Export Preview Modal */}
      {showExportModal && (
        <div className="modal-overlay" onClick={() => setShowExportModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Google Calendar Format (iCal)</h3>
              <button 
                onClick={() => setShowExportModal(false)}
                className="modal-close"
              >
                ×
              </button>
            </div>
            <p className="modal-description">
              This is a simulated export. Copy the text below to preview what would sync to Google Calendar.
            </p>
            <textarea
              value={icalText}
              readOnly
              className="ical-textarea"
              rows={20}
            />
            <div className="modal-actions">
              {copySuccess && (
                <div className="success-message">
                  <span className="success-text">✓ Copied to clipboard</span>
                </div>
              )}
              {copyError && (
                <div className="error-message">
                  <span className="error-text">{copyError}</span>
                </div>
              )}
              <button 
                onClick={handleCopyToClipboard}
                className="copy-button"
              >
                Copy to Clipboard
              </button>
              <button 
                onClick={() => setShowExportModal(false)}
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

export default CalendarView


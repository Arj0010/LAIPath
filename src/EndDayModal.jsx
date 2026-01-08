import { useState } from 'react'
import './EndDayModal.css'
import LeaveModal from './LeaveModal.jsx'

/**
 * End Day Modal Component
 * 
 * Day 3: Mandatory blocking modal
 * - Requires 50+ character input
 * - Cannot be dismissed without submission
 * - Blocks progression to next day
 */
function EndDayModal({ day, onClose, onSubmit, onSkip, onLeave, submitting: isSubmitting = false }) {
  const [learningInput, setLearningInput] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  
  // Use prop if provided, otherwise use internal state
  const submittingState = isSubmitting || submitting

  const minLength = 50
  const currentLength = learningInput.trim().length
  const isValid = currentLength >= minLength

  /**
   * Handle form submission
   * Validates input and calls onSubmit callback
   */
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!isValid) {
      setError(`Please enter at least ${minLength} characters`)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      await onSubmit(learningInput.trim())
    } catch (err) {
      setError(err.message || 'Failed to submit learning input')
      setSubmitting(false)
    }
  }

  /**
   * Handle skip day
   */
  const handleSkip = () => {
    if (window.confirm('Are you sure you want to skip this day? All future days will be shifted forward by 1 day.')) {
      onSkip()
    }
  }

  /**
   * Handle leave application - opens modal instead of prompt
   */
  const handleLeave = () => {
    setShowLeaveModal(true)
  }

  /**
   * Handle leave confirmation from modal
   */
  const handleLeaveConfirm = (leaveDays) => {
    setShowLeaveModal(false)
    onLeave(leaveDays)
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-content-header">
          <h2>End Day {day.dayNumber}</h2>
          <p className="modal-subtitle">What did you learn today?</p>
          <p className="mandatory-warning">This reflection is mandatory</p>
        </div>
        <div className="modal-content-body">
          <form onSubmit={handleSubmit} className="end-day-form">
          <textarea
            value={learningInput}
            onChange={(e) => {
              setLearningInput(e.target.value)
              setError(null)
            }}
            placeholder="Describe what you learned today (minimum 50 characters)..."
            className="learning-input"
            rows={6}
            disabled={submittingState}
            autoFocus
          />
          
          <div className="input-counter">
            {currentLength} / {minLength} characters
            {isValid && <span className="valid-indicator">✓</span>}
          </div>

          {error && <div className="modal-error">{error}</div>}

          <div className="modal-actions">
            <button
              type="button"
              onClick={handleSkip}
              className="skip-button"
              disabled={submittingState}
            >
              Skip Day
            </button>
            
            <button
              type="button"
              onClick={handleLeave}
              className="leave-button"
              disabled={submittingState}
            >
              Apply Leave
            </button>

            <button
              type="submit"
              disabled={!isValid || submittingState}
              className="submit-button"
            >
              {submittingState ? 'Submitting...' : 'Submit Learning'}
            </button>
          </div>
        </form>
        </div>
      </div>

      {/* Leave Modal */}
      {showLeaveModal && (
        <LeaveModal
          onClose={() => setShowLeaveModal(false)}
          onConfirm={handleLeaveConfirm}
        />
      )}
    </div>
  )
}

export default EndDayModal


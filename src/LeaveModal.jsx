import { useState } from 'react'
import './LeaveModal.css'

/**
 * Leave Modal Component
 * Replaces prompt() with a proper modal for leave application
 */
function LeaveModal({ onClose, onConfirm }) {
  const [leaveDays, setLeaveDays] = useState('')
  const [error, setError] = useState(null)

  const handleSubmit = (e) => {
    e.preventDefault()
    setError(null)

    if (!leaveDays || leaveDays.trim() === '') {
      setError('Please enter the number of leave days')
      return
    }

    const numDays = parseInt(leaveDays)
    if (isNaN(numDays) || numDays <= 0 || numDays > 30) {
      setError('Please enter a number between 1 and 30')
      return
    }

    onConfirm(numDays)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="leave-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="leave-modal-header">
          <h3>Apply Leave</h3>
          <button className="leave-modal-close" onClick={onClose}>×</button>
        </div>
        <div className="leave-modal-body">
          <p className="leave-modal-description">
            How many days of leave do you want to apply? All future days will be shifted forward.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="leave-input-group">
              <label htmlFor="leaveDays">Number of Days</label>
              <input
                id="leaveDays"
                type="number"
                min="1"
                max="30"
                value={leaveDays}
                onChange={(e) => {
                  setLeaveDays(e.target.value)
                  setError(null)
                }}
                placeholder="Enter days (1-30)"
                autoFocus
              />
              {error && <div className="leave-error">{error}</div>}
            </div>
            <div className="leave-modal-actions">
              <button type="button" onClick={onClose} className="leave-cancel-button">
                Cancel
              </button>
              <button type="submit" className="leave-confirm-button">
                Apply Leave
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LeaveModal


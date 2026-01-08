import { useState, useEffect } from 'react'
import './DailyLearningPage.css'
import EndDayModal from './EndDayModal.jsx'

/**
 * Daily Learning Page Component
 * 
 * Day 3 Scope:
 * - Display day number, topic, subtasks
 * - "Ask AI Expert" button opens chat
 * - "End Day" button opens mandatory modal
 * - Handles day state transitions (completed/skipped/leave)
 */
function DailyLearningPage({ day, syllabus, onSyllabusUpdate, onBack }) {
  const [showChat, setShowChat] = useState(false)
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [error, setError] = useState(null)
  const [showEndDayModal, setShowEndDayModal] = useState(false)
  const [showLinkedInModal, setShowLinkedInModal] = useState(false)
  const [linkedInDraft, setLinkedInDraft] = useState('')
  const [linkedInLoading, setLinkedInLoading] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)
  const [submittingDay, setSubmittingDay] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [copyError, setCopyError] = useState(null)
  const [suggestedQuestions, setSuggestedQuestions] = useState({}) // Map of message index to questions

  // Clear chat when day changes
  useEffect(() => {
    setMessages([])
    setShowChat(false)
    setInputMessage('')
    setError(null)
    setSuggestedQuestions({})
  }, [day.dayNumber])

  /**
   * Generate AI-suggested follow-up questions
   * ⚠️ Frontend–backend contract: do not rename without updating both.
   * 
   * Calls backend endpoint with today's topic, subtasks, and last mentor answer
   * Returns null on failure (silent failure)
   * 
   * SAFETY: Only called after successful mentor answers (not refusals/errors)
   */
  async function generateSuggestedQuestions(lastAnswer, topic, subtasks, messageIndex) {
    if (!lastAnswer || !topic) return null

    try {
      const response = await fetch('/api/generate-suggested-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // ⚠️ Frontend–backend contract: field names must match exactly
        body: JSON.stringify({
          topic: topic,
          subtasks: subtasks || [],
          lastAnswer: lastAnswer,
        }),
      })

      if (!response.ok) {
        // Silent failure: return null
        return null
      }

      const data = await response.json()
      
      if (data.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        // Store questions for this message index
        setSuggestedQuestions(prev => ({
          ...prev,
          [messageIndex]: data.questions
        }))
        return data.questions
      }
      
      // No questions generated: silent failure
      return null
    } catch (err) {
      // Silent failure: don't show error, just return null
      console.error('Error generating suggested questions:', err)
      return null
    }
  }

  /**
   * Handle clicking a suggested question
   * Sends it as the next user question
   */
  async function handleSuggestedQuestionClick(question) {
    if (chatLoading || !question.trim()) return

    const userMessage = question.trim()
    setInputMessage('')
    setError(null)

    // Add user message to chat
    const newMessages = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setChatLoading(true)

    try {
      const response = await fetch('/api/topic-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage: userMessage,
          currentDayTopic: day.topic,
          currentDaySubtasks: day.subtasks || [],
          currentDayNotes: day.notes || null,
        }),
      })

      let data
      try {
        data = await response.json()
      } catch (parseError) {
        const text = await response.text()
        throw new Error(`Server error: ${text || 'Invalid response format'}`)
      }

      // SAFETY RULE: Suggested questions MUST NOT appear on refusals
      if (data.refused) {
        const refusalMessage = { role: 'assistant', content: data.message }
        setMessages([...newMessages, refusalMessage])
        // DO NOT generate suggested questions for refusals
        return
      }
      
      // SAFETY RULE: Suggested questions MUST ONLY be requested if mentor answered successfully
      if (data.response) {
        const assistantMessage = { role: 'assistant', content: data.response }
        const updatedMessagesWithAssistant = [...newMessages, assistantMessage]
        setMessages(updatedMessagesWithAssistant)
        
        // Generate suggested questions ONLY for successful answers
        const assistantIndex = updatedMessagesWithAssistant.length - 1
        generateSuggestedQuestions(
          data.response,
          day.topic,
          day.subtasks || [],
          assistantIndex
        ).catch(err => {
          // Silent failure
          console.error('Failed to generate suggestions:', err)
        })
      } else if (!response.ok) {
        // SAFETY RULE: Suggested questions MUST NOT appear on errors
        throw new Error(data.error || data.message || 'Failed to get AI response')
      } else {
        // SAFETY RULE: Suggested questions MUST NOT appear on fallbacks
        // If response is OK but no response field, use fallback (but don't generate suggestions)
        const fallbackResponse = `I understand you're asking about ${day.topic}. Let me help you with that based on today's learning content.`
        const fallbackMessage = { role: 'assistant', content: fallbackResponse }
        setMessages([...newMessages, fallbackMessage])
        // DO NOT generate suggested questions for fallback messages
      }
    } catch (err) {
      // SAFETY RULE: Suggested questions MUST NOT appear on errors
      console.error('Chat error:', err)
      
      if (err.message && (err.message.includes('fetch') || err.message.includes('network'))) {
        setError('Unable to connect to the AI service. Please check your connection and try again.')
      } else {
        setError(err.message || 'Unable to get AI response. Please try again.')
      }
      
      // Add error fallback message (but don't generate suggestions)
      const fallbackResponse = `I understand you're asking about ${day.topic}. Based on today's learning, here's what I can tell you: This topic is part of your current learning path. For more detailed information, please ensure the AI service is properly configured.`
      const errorFallbackMessage = { role: 'assistant', content: fallbackResponse }
      setMessages([...newMessages, errorFallbackMessage])
      // DO NOT generate suggested questions for error fallback messages
    } finally {
      setChatLoading(false)
    }
  }

  /**
   * Handle sending a message to the AI
   * Uses the day's aiExpertPrompt as system prompt
   */
  /**
   * Handle sending a message to the AI
   * Day 5: Added loading state and demo-safe error handling
   */
  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!inputMessage.trim() || chatLoading) return

    const userMessage = inputMessage.trim()
    setInputMessage('')
    setError(null)

    // Add user message to chat
    const newMessages = [...messages, { role: 'user', content: userMessage }]
    setMessages(newMessages)
    setChatLoading(true)

    try {
      const response = await fetch('/api/topic-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userMessage: userMessage,
          currentDayTopic: day.topic,
          currentDaySubtasks: day.subtasks || [],
          currentDayNotes: day.notes || null,
        }),
      })

      let data
      try {
        data = await response.json()
      } catch (parseError) {
        // If response is not JSON, try to get text
        const text = await response.text()
        throw new Error(`Server error: ${text || 'Invalid response format'}`)
      }

      // SAFETY RULE: Suggested questions MUST NOT appear on refusals
      if (data.refused) {
        // Show refusal message to user
        setMessages([...newMessages, { role: 'assistant', content: data.message }])
        // DO NOT generate suggested questions for refusals
        return
      }
      
      // SAFETY RULE: Suggested questions MUST ONLY be requested if mentor answered successfully
      if (data.response) {
        // Add AI response to chat
        const assistantMessage = { role: 'assistant', content: data.response }
        const updatedMessagesWithAssistant = [...newMessages, assistantMessage]
        setMessages(updatedMessagesWithAssistant)
        
        // Generate suggested questions ONLY for successful answers
        const assistantIndex = updatedMessagesWithAssistant.length - 1
        generateSuggestedQuestions(
          data.response,
          day.topic,
          day.subtasks || [],
          assistantIndex
        ).catch(err => {
          // Silent failure: already handled in generateSuggestedQuestions
          console.error('Failed to generate suggestions:', err)
        })
      } else if (!response.ok) {
        // SAFETY RULE: Suggested questions MUST NOT appear on errors
        throw new Error(data.error || data.message || 'Failed to get AI response')
      } else {
        // SAFETY RULE: Suggested questions MUST NOT appear on fallbacks
        // If response is OK but no response field, use fallback (but don't generate suggestions)
        const fallbackResponse = `I understand you're asking about ${day.topic}. Let me help you with that based on today's learning content.`
        const fallbackMessage = { role: 'assistant', content: fallbackResponse }
        setMessages([...newMessages, fallbackMessage])
        // DO NOT generate suggested questions for fallback messages
      }
    } catch (err) {
      // SAFETY RULE: Suggested questions MUST NOT appear on errors
      console.error('Chat error:', err)
      
      // Check if it's a network error or server error
      if (err.message && (err.message.includes('fetch') || err.message.includes('network'))) {
        setError('Unable to connect to the AI service. Please check your connection and try again.')
      } else {
        // For other errors, show a helpful message
        setError(err.message || 'Unable to get AI response. Please try again.')
      }
      
      // Add error fallback message (but don't generate suggestions)
      const fallbackResponse = `I understand you're asking about ${day.topic}. Based on today's learning, here's what I can tell you: This topic is part of your current learning path. For more detailed information, please ensure the AI service is properly configured.`
      const errorFallbackMessage = { role: 'assistant', content: fallbackResponse }
      setMessages([...newMessages, errorFallbackMessage])
      // DO NOT generate suggested questions for error fallback messages
    } finally {
      setChatLoading(false)
    }
  }

  /**
   * Regenerate future days using AI
   */
  async function regenerateFutureDays(goal, hoursPerDay, remainingDays, startDayNumber) {
    // Get the date of the day after the current day
    const currentDate = new Date(day.date)
    currentDate.setDate(currentDate.getDate() + 1)
    
    const response = await fetch('/api/regenerate-future-days', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal,
        hoursPerDay,
        startDayNumber,
        totalDays: remainingDays,
        currentDate: currentDate.toISOString().split('T')[0]
      })
    })

    if (!response.ok) {
      throw new Error('Failed to regenerate days')
    }

    const data = await response.json()
    return data.days
  }

  /**
   * Activate next pending day
   * Sets the lowest-numbered pending day to active
   */
  function activateNextPendingDay(days) {
    // Find first pending day
    const pendingDay = days.find(d => d.status === 'pending')
    if (pendingDay) {
      const index = days.findIndex(d => d.dayNumber === pendingDay.dayNumber)
      days[index] = {
        ...days[index],
        status: 'active'
      }
    }
  }

  /**
   * Handle End Day submission
   * Marks day as completed, evaluates learning, potentially regenerates future days
   * Day 5: Added loading state and error handling
   */
  async function handleEndDaySubmit(learningInput) {
    if (!syllabus || !syllabus.days) {
      setError('Syllabus data is missing. Please refresh the page.')
      setSubmittingDay(false)
      return
    }

    setSubmittingDay(true)
    setError(null)
    
    try {
      // Step 1: Evaluate learning input
      const evalResponse = await fetch('/api/evaluate-learning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: day.topic,
          subtasks: day.subtasks || [],
          learningInput: learningInput
        })
      })

      if (!evalResponse.ok) {
        throw new Error('Failed to evaluate learning')
      }

      const evalData = await evalResponse.json()
      // Map new recommended_action values to adjustment logic
      // "repeat" and "simplify" require adjustment, "continue" and "advance" do not
      const shouldAdjust = evalData.recommended_action === 'repeat' || evalData.recommended_action === 'simplify'

      // Step 2: Update day status to completed
      const updatedDays = [...syllabus.days]
      const dayIndex = updatedDays.findIndex(d => d.dayNumber === day.dayNumber)
      
      if (dayIndex === -1) {
        throw new Error('Day not found in syllabus')
      }

      updatedDays[dayIndex] = {
        ...updatedDays[dayIndex],
        status: 'completed',
        learningInput: learningInput,
        completedAt: new Date().toISOString()
      }

      // Step 3: If adjustment needed, regenerate future days
      if (shouldAdjust) {
        // Regenerate days after current day
        const remainingDays = updatedDays.length - (dayIndex + 1)
        if (remainingDays > 0) {
          const regeneratedDays = await regenerateFutureDays(
            syllabus.goal,
            syllabus.hoursPerDay,
            remainingDays,
            day.dayNumber + 1  // Start from next day number
          )
          
          // Replace future days with regenerated ones
          for (let i = 0; i < regeneratedDays.length; i++) {
            const newDayIndex = dayIndex + 1 + i
            if (newDayIndex < updatedDays.length) {
              updatedDays[newDayIndex] = {
                ...regeneratedDays[i],
                dayNumber: updatedDays[newDayIndex].dayNumber,
                date: updatedDays[newDayIndex].date,
                status: updatedDays[newDayIndex].status
              }
            }
          }
        }
      }

      // Step 4: Activate next pending day
      activateNextPendingDay(updatedDays)

      // Step 5: Update syllabus
      const updatedSyllabus = {
        ...syllabus,
        days: updatedDays
      }

      // Save to server
      await fetch('/api/update-syllabus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedSyllabus })
      })

      // Find next active day before updating
      const nextActiveDay = updatedDays.find(d => d.status === 'active')
      
      // Notify parent component with next active day for auto-navigation
      onSyllabusUpdate(updatedSyllabus, nextActiveDay)
      setShowEndDayModal(false)
    } catch (err) {
      console.error('Error ending day:', err)
      throw err
    }
  }

  /**
   * Handle Skip Day
   * Marks day as skipped and shifts all future days forward by 1 day
   */
  async function handleSkipDay() {
    if (!syllabus || !syllabus.days) {
      setError('Unable to skip day. Please refresh the page and try again.')
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

      // Find next active day before updating
      const nextActiveDay = updatedDays.find(d => d.status === 'active')
      
      // Notify parent component with next active day for auto-navigation
      onSyllabusUpdate(updatedSyllabus, nextActiveDay)
      setShowEndDayModal(false)
    } catch (err) {
      console.error('Error skipping day:', err)
      setError('Unable to skip day at this time. Please try again.')
    }
  }

  /**
   * Handle Leave
   * Marks day as leave and shifts all future days forward by N days
   */
  async function handleLeave(leaveDays) {
    if (!syllabus || !syllabus.days) {
      alert('Syllabus data is missing. Please refresh the page.')
      return
    }

    try {
      const updatedDays = [...syllabus.days]
      const dayIndex = updatedDays.findIndex(d => d.dayNumber === day.dayNumber)
      
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

      // Find next active day before updating
      const nextActiveDay = updatedDays.find(d => d.status === 'active')
      
      // Notify parent component with next active day for auto-navigation
      onSyllabusUpdate(updatedSyllabus, nextActiveDay)
      setShowEndDayModal(false)
    } catch (err) {
      setError(`Unable to apply leave: ${err.message || 'Please try again.'}`)
    }
  }

  /**
   * Handle LinkedIn draft generation
   * Day 5: LinkedIn draft generator
   */
  async function handleGenerateLinkedInDraft() {
    if (!day.learningInput) {
      setError('Please complete the day first to generate a LinkedIn post.')
      return
    }

    setLinkedInLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/generate-linkedin-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: day.topic,
          learningInput: day.learningInput
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate LinkedIn draft')
      }

      const data = await response.json()
      setLinkedInDraft(data.draft)
      setShowLinkedInModal(true)
    } catch (err) {
      console.error('Error generating LinkedIn draft:', err)
      // Demo safety: show fallback
      setError('LinkedIn draft generation is temporarily unavailable. Please try again later.')
      setLinkedInDraft(`Just completed ${day.topic}! 🚀\n\nKey learning: ${day.learningInput.substring(0, 150)}...\n\nExcited to continue this journey! 💪\n\n#Learning #Growth`)
      setShowLinkedInModal(true)
    } finally {
      setLinkedInLoading(false)
    }
  }

  /**
   * Copy LinkedIn draft to clipboard
   */
  function handleCopyLinkedInDraft() {
    navigator.clipboard.writeText(linkedInDraft).then(() => {
      setCopySuccess(true)
      setCopyError(null)
      setTimeout(() => setCopySuccess(false), 3000)
    }).catch(err => {
      console.error('Failed to copy:', err)
      setCopyError('Unable to copy. Please try selecting and copying manually.')
      setTimeout(() => setCopyError(null), 5000)
    })
  }

  return (
    <div className="daily-learning-page">
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
      <div className="daily-learning-header">
        <h2>Day {day.dayNumber}</h2>
        <p className="day-date">{day.date}</p>
      </div>

      <div className="daily-learning-content">
        {/* Today's Learning Card */}
        <div className="card learning-card">
          <div className="card-header">
            <h3 className="card-title">Today's Learning</h3>
            {day.status === 'active' && (
              <p className="mandatory-notice">You must complete this to proceed</p>
            )}
          </div>
          <div className="card-body">
            <h3 className="topic-title">{day.topic}</h3>
            
            {day.subtasks && day.subtasks.length > 0 && (
              <div className="subtasks-card">
                <h4 className="subtasks-header">Subtasks</h4>
                <ul className="subtasks-list">
                  {day.subtasks.map((subtask, idx) => (
                    <li key={idx}>{subtask}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="action-buttons">
            <button 
              onClick={() => setShowChat(!showChat)}
              className="ask-ai-button"
            >
              {showChat ? 'Hide AI Expert' : 'Ask AI Expert'}
            </button>
            
            {day.status === 'active' && (
              <button 
                onClick={() => setShowEndDayModal(true)}
                className="end-day-button"
                disabled={submittingDay}
              >
                {submittingDay ? 'Processing...' : 'End Day'}
              </button>
            )}
            
            {day.status === 'completed' && day.learningInput && (
              <button 
                onClick={handleGenerateLinkedInDraft}
                className="linkedin-button"
                disabled={linkedInLoading}
              >
                {linkedInLoading ? 'Generating...' : 'Generate LinkedIn Draft'}
              </button>
            )}
            </div>
          </div>
        </div>

        {showChat && (
          <div className="card chat-card">
            <div className="card-header">
              <h3 className="card-title">AI Expert Chat</h3>
            </div>
            <div className="card-body">
              <div className="chat-messages">
              {messages.length === 0 ? (
                <div className="chat-empty">
                  <p>Ask me anything about: <strong>{day.topic}</strong></p>
                  <p className="chat-hint">I'll only answer questions related to today's topic.</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  // Get suggestions for this message index (if available)
                  const suggestions = msg.role === 'assistant' ? suggestedQuestions[idx] : null

                  return (
                    <div key={idx} className={`chat-message ${msg.role}`}>
                      <div className="message-role">
                        {msg.role === 'user' ? 'You' : 'AI Expert'}
                      </div>
                      <div className="message-content">{msg.content}</div>
                      {suggestions && Array.isArray(suggestions) && suggestions.length > 0 && (
                        <div className="suggested-questions">
                          <div className="suggested-questions-label">Suggested questions:</div>
                          <div className="suggested-questions-list">
                            {suggestions.map((question, qIdx) => (
                              <button
                                key={qIdx}
                                type="button"
                                className="suggested-question-button"
                                onClick={() => handleSuggestedQuestionClick(question)}
                                disabled={chatLoading}
                              >
                                {question}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
              {chatLoading && (
                <div className="chat-message assistant">
                  <div className="message-role">AI Expert</div>
                  <div className="message-content">Thinking...</div>
                </div>
              )}
              </div>

              {error && <div className="chat-error">{error}</div>}

              <form onSubmit={handleSendMessage} className="chat-input-form">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask a question about today's topic..."
                disabled={chatLoading}
                className="chat-input"
              />
              <button 
                type="submit" 
                disabled={chatLoading || !inputMessage.trim()}
                className="chat-send-button"
              >
                {chatLoading ? 'Sending...' : 'Send'}
              </button>
            </form>
            </div>
          </div>
        )}
      </div>

      {/* End Day Modal - Blocks progression until submission */}
      {showEndDayModal && (
        <EndDayModal
          day={day}
          onClose={() => {}} // Modal cannot be closed without submission
          onSubmit={handleEndDaySubmit}
          onSkip={handleSkipDay}
          onLeave={handleLeave}
          submitting={submittingDay}
        />
      )}

      {/* LinkedIn Draft Modal */}
      {showLinkedInModal && (
        <div className="modal-overlay" onClick={() => setShowLinkedInModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>LinkedIn Post Draft</h3>
              <button 
                onClick={() => setShowLinkedInModal(false)}
                className="modal-close"
              >
                ×
              </button>
            </div>
            <p className="modal-description">
              Copy this draft to share your learning on LinkedIn.
            </p>
            <textarea
              value={linkedInDraft}
              readOnly
              className="linkedin-textarea"
              rows={8}
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
                onClick={handleCopyLinkedInDraft}
                className="copy-button"
              >
                Copy to Clipboard
              </button>
              <button 
                onClick={() => setShowLinkedInModal(false)}
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

export default DailyLearningPage


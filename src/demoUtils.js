/**
 * Demo Safety Utilities
 * 
 * Day 5: Demo safety controls
 * Ensures the demo never breaks by providing fallback responses
 */

/**
 * Check if demo safety mode is enabled
 * Day 5: Demo safety controls
 */
export function isDemoSafe() {
  // Always return true for demo safety
  // This ensures fallbacks are always used when errors occur
  return true;
}

/**
 * Get a safe fallback response for any error
 * Day 5: Demo safety
 */
export function getFallbackResponse(context) {
  const fallbacks = {
    chat: "I understand your question. This is a topic-specific expert response. For the full answer, please ensure the AI service is available.",
    linkedin: "Just completed today's learning! 🚀\n\nKey takeaway: Continued progress on my learning journey.\n\nExcited to keep learning! 💪\n\n#Learning #Growth",
    evaluation: { action: "continue" },
    syllabus: null // Will use mock syllabus
  };
  
  return fallbacks[context] || "Using fallback response for demo stability";
}

/**
 * Safe error handler that always returns something
 * Day 5: Demo safety
 */
export function handleDemoError(error, context, fallback) {
  console.error(`Demo error in ${context}:`, error);
  
  if (isDemoSafe()) {
    return fallback || getFallbackResponse(context);
  }
  
  throw error;
}


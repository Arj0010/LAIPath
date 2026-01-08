/**
 * AI Configuration Constants
 * 
 * Safety and cost control limits for OpenAI API calls.
 * All OpenAI API calls must use these constants.
 */

export const AI_LIMITS = {
  // Token limits per API call type
  SYLLABUS: 450,    // Syllabus generation (max 450 tokens - reduced for JSON efficiency)
  CHAT: 300,        // Topic-level chat (max 300 tokens)
  LINKEDIN: 200,    // LinkedIn draft generation (max 200 tokens)
  SUGGESTIONS: 250, // Suggested questions generation (max 250 tokens)
  EVALUATION: 300   // Learning evaluation (max 300 tokens)
};

export const AI_TEMPERATURES = {
  SYLLABUS: 0.2,    // Low temperature for structured syllabus generation
  CHAT: 0.3,        // Moderate temperature for topic chat
  LINKEDIN: 0.4,    // Slightly higher for creative LinkedIn posts
  SUGGESTIONS: 0.3, // Moderate temperature for question generation
  EVALUATION: 0.2   // Low temperature for conservative evaluation
};

/**
 * Verify that a token limit is within allowed bounds
 */
export function validateTokenLimit(callType, maxTokens) {
  const limit = AI_LIMITS[callType];
  if (!limit) {
    throw new Error(`Unknown call type: ${callType}`);
  }
  if (maxTokens > limit) {
    throw new Error(`max_tokens (${maxTokens}) exceeds limit for ${callType} (${limit})`);
  }
  return true;
}


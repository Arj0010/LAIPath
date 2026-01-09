/**
 * AI Configuration Constants
 * 
 * Safety and cost control limits for OpenAI API calls.
 * All OpenAI API calls must use these constants.
 */

export const AI_LIMITS = {
  // Token limits per API call type
  SYLLABUS: 900,    // Syllabus generation (max 900 tokens - increased for richer descriptions)
  CHAT: 1000,       // Topic-level chat (max 1000 tokens - increased for longer explanations)
  LINKEDIN: 200,    // LinkedIn draft generation (max 200 tokens)
  SUGGESTIONS: 300, // Suggested questions generation (max 300 tokens)
  EVALUATION: 280,  // Learning evaluation (max 280 tokens - optimized for faster response)
  CONCEPT_EXTRACTION: 150,  // Concept extraction from mentor answers (max 150 tokens)
  FIRST_MESSAGE: 250  // Mentor first message generation (max 250 tokens)
};

export const AI_TEMPERATURES = {
  SYLLABUS: 0.2,    // Low temperature for structured syllabus generation
  CHAT: 0.3,        // Moderate temperature for topic chat
  LINKEDIN: 0.4,    // Slightly higher for creative LinkedIn posts
  SUGGESTIONS: 0.3, // Moderate temperature for question generation
  EVALUATION: 0.2,  // Low temperature for conservative evaluation
  CONCEPT_EXTRACTION: 0.1,  // Very low temperature for deterministic concept extraction
  FIRST_MESSAGE: 0.2  // Low temperature for instructional first message
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


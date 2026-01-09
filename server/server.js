import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { AI_LIMITS, AI_TEMPERATURES, validateTokenLimit } from './aiConfig.js';

// Get the directory of the current module (server.js)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file in the server directory
// Also check parent directory as fallback
dotenv.config({ path: join(__dirname, '.env') });
// Fallback to root .env if server/.env doesn't exist
if (!process.env.OPENAI_API_KEY) {
  dotenv.config({ path: join(__dirname, '..', '.env') });
}

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory store for syllabus (Day 1: single syllabus only)
let syllabus = null;

/**
 * Generate syllabus using OpenAI API
 * Falls back to mock data if API key is missing
 */
async function generateSyllabus(goal, hoursPerDay, totalDays) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  // Mock data generator (used when API key is missing)
  function generateMockSyllabus() {
    const days = [];
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    
    for (let i = 1; i <= totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i - 1);
      const dateStr = date.toISOString().split('T')[0];
      
      // Day 1 is active, all others are pending
      const status = i === 1 ? "active" : "pending";  // i is 1-indexed in this loop
      
      days.push({
        dayNumber: i,
        date: dateStr,
        topic: `${goal} - Day ${i} Fundamentals`,
        subtasks: [
          `Introduction to Day ${i} concepts`,
          `Practice exercises for Day ${i}`,
          `Review Day ${i} materials`
        ],
        aiExpertPrompt: `You are an expert in ${goal}. Focus specifically on Day ${i} topics. Only answer questions related to Day ${i} content.`,
        status: status,
        learningInput: null,
        completedAt: null
      });
    }
    
    return days;
  }
  
  // If no API key, return mock data
  if (!apiKey) {
    console.log('⚠️  OPENAI_API_KEY not found. Using mock syllabus data.');
    return generateMockSyllabus();
  }
  
  // Real OpenAI API call
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });
    
    // Enforce token limit (increased to 900 for richer descriptions)
    const maxTokens = AI_LIMITS.SYLLABUS;
    validateTokenLimit('SYLLABUS', maxTokens);
    
    // STRICT PROMPT: Concise, structured, JSON-only
    const prompt = `You are a system that generates structured learning syllabi.

STRICT RULES:
- Respond with VALID JSON ONLY
- Do NOT include explanations, comments, or markdown
- Keep all text concise
- Each topic title must be <= 6 words
- Each subtask must be <= 8 words
- aiExpertPrompt must be <= 20 words

SUBTASK REQUIREMENTS:
- Each day must include exactly 3 or 4 subtasks
- Each subtask should be short (5-8 words), clear, and focused on a single concept
- Subtasks must be action-oriented and concise
- Do NOT include explanations, examples, or expanded descriptions

OUTPUT FORMAT (JSON ONLY):

{
  "days": [
    {
      "dayNumber": 1,
      "topic": "Topic title",
      "subtasks": ["task one", "task two", "task three", "task four"],
      "aiExpertPrompt": "You are an expert in this topic"
    }
  ]
}

CRITICAL: Each day MUST have exactly 3 or 4 subtasks in the "subtasks" array.
- NOT 1 subtask
- NOT 2 subtasks  
- NOT 5 or more subtasks
- MUST be 3 or 4 subtasks

INPUT:
Goal: ${goal}
Days: ${totalDays}
Hours per day: ${hoursPerDay}

Generate exactly ${totalDays} days. Each day MUST have exactly 3 or 4 subtasks (no exceptions).`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
      {
        role: "system",
        content: "You are a learning curriculum generator. Each day MUST have exactly 3 or 4 subtasks (NOT 1, NOT 2, NOT 5+). Return only valid JSON. No explanations."
      },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: AI_TEMPERATURES.SYLLABUS,  // 0.2 for structured generation
      max_tokens: maxTokens,  // 900 tokens max (increased for richer descriptions)
      stream: false  // Explicitly disable streaming
    });
    
    // Log token usage for cost monitoring
    if (response.usage) {
      console.log(`📊 Syllabus generation tokens: ${response.usage.total_tokens} (limit: ${maxTokens})`);
    }
    
    const content = response.choices[0].message.content.trim();
    
    // Remove markdown code blocks if present
    const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    // JSON SAFETY GUARD: Intentional parsing with fallback
    let parsed;
    try {
      parsed = JSON.parse(jsonContent);
    } catch (err) {
      console.error("❌ Invalid JSON from AI, attempting repair...");
      
      // REPAIR PASS: One retry attempt
      try {
        const repairPrompt = `Fix this JSON. Return ONLY valid JSON.

${jsonContent}`;
        
        const repairResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a JSON repair tool. Return only valid JSON."
            },
            {
              role: "user",
              content: repairPrompt
            }
          ],
          temperature: 0.1,  // Very low for repair
          max_tokens: 300,   // Lower limit for repair
          stream: false
        });
        
        const repairedContent = repairResponse.choices[0].message.content.trim();
        const repairedJson = repairedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        parsed = JSON.parse(repairedJson);
        console.log("✅ JSON repaired successfully");
      } catch (repairErr) {
        console.error("❌ JSON repair failed, using mock data");
        return generateMockSyllabus();
      }
    }
    
    // Extract days array from parsed response
    let days = parsed.days || parsed;  // Support both {days: [...]} and [...]
    
    // Ensure days is an array
    if (!Array.isArray(days)) {
      console.error("❌ Response is not an array, using mock data");
      return generateMockSyllabus();
    }
    
    // Validate and enrich with required fields
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    
    days = days.map((day, index) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + index);
      const dateStr = date.toISOString().split('T')[0];
      
      // Day 1 is active, all others are pending
      const status = index === 0 ? "active" : "pending";
      
      // Validate and ensure 3-4 subtasks
      let subtasks = Array.isArray(day.subtasks) ? day.subtasks.filter(st => typeof st === 'string' && st.trim()).map(st => st.trim()) : [];
      
      // Ensure we have 3-4 subtasks
      if (subtasks.length < 3) {
        // Pad with generic subtasks if needed
        const needed = 3 - subtasks.length;
        for (let i = 0; i < needed; i++) {
          subtasks.push(`Complete Day ${index + 1} learning objective ${i + 1}`);
        }
      } else if (subtasks.length > 4) {
        // Trim to 4 if more than 4
        subtasks = subtasks.slice(0, 4);
      }
      
      return {
        dayNumber: day.dayNumber || index + 1,
        date: dateStr,
        topic: day.topic || `${goal} - Day ${index + 1}`,
        subtasks: subtasks,
        aiExpertPrompt: day.aiExpertPrompt || `You are an expert in ${goal}. Focus on Day ${index + 1} topics.`,
        status: status,
        learningInput: null,
        completedAt: null
      };
    });
    
    return days;
  } catch (error) {
    console.error('OpenAI API error:', error.message);
    console.log('Falling back to mock data...');
    return generateMockSyllabus();
  }
}

/**
 * Hard domain safety gate: Checks if a learning goal is in an allowed domain
 * Rejects goals containing unsafe keywords (hacking, crime, fraud, spying, weapons, drugs, illegal activity, surveillance)
 * Uses deterministic keyword matching (no AI-based moderation)
 * 
 * @param {string} goalText - The learning goal text
 * @returns {boolean} - Returns true if domain is allowed, false if blocked
 */
function isAllowedLearningDomain(goalText) {
  if (!goalText || typeof goalText !== 'string') {
    return false; // Fail closed: invalid input is not allowed
  }

  // Normalize text: lowercase and trim
  const normalized = goalText.toLowerCase().trim();
  
  // Unsafe domain keywords - comprehensive list
  // False positives NOT acceptable, so we use strict keyword matching
  const unsafeKeywords = [
    // Hacking and unauthorized access
    'hack', 'hacking', 'crack', 'cracking', 'breach', 'unauthorized access',
    'bypass security', 'exploit', 'vulnerability', 'sql injection', 'xss',
    'ddos', 'malware', 'virus', 'trojan', 'ransomware', 'penetration testing',
    'ethical hacking', 'white hat', 'black hat', 'gray hat',
    
    // Crime and illegal activity
    'crime', 'criminal', 'illegal', 'unlawful', 'felony', 'misdemeanor',
    'theft', 'robbery', 'burglary', 'fraud', 'scam', 'embezzlement',
    'money laundering', 'counterfeit', 'forgery',
    
    // Spying and surveillance
    'spy', 'spying', 'surveillance', 'eavesdrop', 'wiretap', 'monitor without',
    'track someone', 'stalk', 'stalking', 'espionage', 'intelligence gathering',
    'covert', 'undercover',
    
    // Weapons and violence
    'weapon', 'weapons', 'gun', 'firearm', 'bomb', 'explosive', 'ammunition',
    'knife fighting', 'combat training', 'martial arts for violence',
    'kill', 'murder', 'assassinate', 'harm', 'violence', 'threaten', 'threat',
    'attack', 'assault',
    
    // Drugs and illegal substances
    'drug', 'drugs', 'cocaine', 'heroin', 'methamphetamine', 'marijuana',
    'cannabis cultivation', 'drug manufacturing', 'drug dealing',
    'illegal substance', 'controlled substance',
    
    // Surveillance and privacy violations
    'surveillance', 'spyware', 'keylogger', 'tracking without consent',
    'unauthorized monitoring', 'privacy violation',
    
    // Other illegal activities
    'identity theft', 'phishing', 'social engineering', 'blackmail', 'extort',
    'manipulate', 'deceive', 'cheat', 'unauthorized entry', 'break into',
    'illegal access', 'unauthorized login', 'password crack', 'credential theft'
  ];

  // Check for unsafe keywords - strict matching
  for (const keyword of unsafeKeywords) {
    if (normalized.includes(keyword)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('🚫 Blocked learning domain (unsafe keyword detected):', {
          keyword,
          goal: goalText.substring(0, 100)
        });
      }
      return false; // Domain is not allowed
    }
  }

  // Domain passed all safety checks
  return true;
}

/**
 * POST /api/generate-syllabus
 * Generates a learning syllabus based on goal, hours per day, and total days
 */
app.post('/api/generate-syllabus', async (req, res) => {
  try {
    const { goal, hoursPerDay, totalDays } = req.body;
    
    // Validation
    if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
      return res.status(400).json({ error: 'Goal is required and must be a non-empty string', fallback: false });
    }
    
    if (!hoursPerDay || typeof hoursPerDay !== 'number' || hoursPerDay <= 0) {
      return res.status(400).json({ error: 'hoursPerDay must be a positive number', fallback: false });
    }
    
    if (!totalDays || typeof totalDays !== 'number' || totalDays <= 0 || totalDays > 365) {
      return res.status(400).json({ error: 'totalDays must be a positive number (max 365)', fallback: false });
    }
    
    // HARD DOMAIN SAFETY GATE: Check if learning domain is allowed
    // This check happens BEFORE any LLM call
    if (!isAllowedLearningDomain(goal)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('🚫 Syllabus generation blocked (unsafe domain):', {
          goal: goal.substring(0, 100)
        });
      }
      return res.status(400).json({
        error: "unsafe_domain",
        message: "This learning topic is not supported."
      });
    }
    
    // Generate days
    const days = await generateSyllabus(goal.trim(), hoursPerDay, totalDays);
    
    // Create syllabus object matching PRD Section 7 data model
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    const startDateStr = startDate.toISOString().split('T')[0];
    
    // Generate unique ID using timestamp + random to ensure uniqueness
    // Format: syl_<timestamp>_<random>
    const uniqueId = `syl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    syllabus = {
      id: uniqueId,
      goal: goal.trim(),
      hoursPerDay,
      totalDays,
      startDate: startDateStr,
      days
    };
    
    // ALWAYS return valid JSON
    res.json(syllabus);
  } catch (error) {
    console.error('Error generating syllabus:', error);
    // BACKEND ERROR SAFETY: Always return valid JSON, never empty response
    res.status(500).json({ 
      error: 'Syllabus generation failed', 
      message: error.message,
      fallback: true 
    });
  }
});

/**
 * Safety and scope pre-filter for user questions
 * Checks for illegal, harmful, or off-scope content BEFORE sending to LLM
 * 
 * @param {string} userQuestion - The user's question
 * @param {string} currentDayTopic - The current day's topic
 * @param {string[]} currentDaySubtasks - Array of current day's subtasks
 * @returns {Object|null} - Returns refusal object if question should be blocked, null otherwise
 */
function preFilterQuestion(userQuestion, currentDayTopic, currentDaySubtasks = []) {
  if (!userQuestion || typeof userQuestion !== 'string') {
    return null;
  }

  const messageLower = userQuestion.toLowerCase().trim();
  
  // STEP 1: Check for illegal/harmful intent keywords
  // Zero false positives: strict keyword matching only
  const harmfulKeywords = [
    // Hacking and unauthorized access
    'hack', 'hacking', 'crack', 'cracking', 'breach', 'unauthorized access',
    'bypass security', 'exploit', 'vulnerability', 'sql injection', 'xss',
    'ddos', 'malware', 'virus', 'trojan', 'ransomware',
    
    // Spying and surveillance
    'spy', 'spying', 'surveillance', 'eavesdrop', 'wiretap', 'monitor without',
    'track someone', 'stalk', 'stalking',
    
    // Illegal access and data theft
    'steal data', 'data theft', 'identity theft', 'phishing', 'social engineering',
    'unauthorized entry', 'break into', 'illegal access', 'unauthorized login',
    'password crack', 'credential theft',
    
    // Violence
    'kill', 'murder', 'assassinate', 'harm', 'violence', 'weapon', 'bomb',
    'threaten', 'threat', 'attack', 'assault',
    
    // Explicit wrongdoing
    'illegal', 'unlawful', 'criminal', 'fraud', 'scam', 'cheat', 'deceive',
    'manipulate', 'blackmail', 'extort',
  ];

  // Check for harmful keywords - strict matching
  for (const keyword of harmfulKeywords) {
    if (messageLower.includes(keyword)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('🚫 Refused question (harmful keyword detected):', {
          keyword,
          message: userQuestion.substring(0, 100)
        });
      }
      return {
        refused: true,
        reason: 'out_of_scope',
        message: "I can only help with questions related to today's learning topic."
      };
    }
  }

  // STEP 2: Check semantic overlap with topic and subtasks
  // Extract keywords from topic and subtasks
  const topicKeywords = [];
  const subtaskKeywords = [];
  
  // Extract keywords from topic (words 3+ characters)
  if (currentDayTopic && typeof currentDayTopic === 'string') {
    const topicLower = currentDayTopic.toLowerCase();
    const topicWords = topicLower.split(/\s+/).filter(w => w.length >= 3);
    topicKeywords.push(...topicWords);
    
    // Also extract from common patterns (e.g., "React.js" -> "react")
    const techPatterns = topicLower.match(/\b(react|vue|angular|node|python|java|javascript|typescript|html|css|sql|api|rest|graphql)\b/gi);
    if (techPatterns) {
      topicKeywords.push(...techPatterns.map(p => p.toLowerCase()));
    }
  }
  
  // Extract keywords from subtasks
  if (Array.isArray(currentDaySubtasks) && currentDaySubtasks.length > 0) {
    currentDaySubtasks.forEach(subtask => {
      if (typeof subtask === 'string' && subtask.trim()) {
        const subtaskLower = subtask.toLowerCase();
        const subtaskWords = subtaskLower.split(/\s+/).filter(w => w.length >= 3);
        subtaskKeywords.push(...subtaskWords);
      }
    });
  }
  
  // Combine all relevant keywords (topic + subtasks)
  const allRelevantKeywords = [...new Set([...topicKeywords, ...subtaskKeywords])];
  
  // If no topic/subtask keywords available, allow question (fail open for safety)
  if (allRelevantKeywords.length === 0) {
    return null; // No filtering possible without context
  }
  
  // Extract significant words from user question (3+ characters)
  const messageWords = messageLower.split(/\s+/).filter(w => w.length >= 3);
  
  // Check for semantic overlap: question must contain at least one relevant keyword
  const hasTopicRelevance = allRelevantKeywords.some(keyword => {
    // Check if keyword appears in question or question word appears in keyword
    return messageWords.some(msgWord => 
      msgWord.includes(keyword) || keyword.includes(msgWord)
    );
  });
  
  // If no semantic overlap, check for clearly off-topic terms
  if (!hasTopicRelevance) {
    const offTopicTerms = [
      'cooking', 'recipe', 'weather', 'sports', 'celebrity', 'gossip',
      'dating', 'relationship advice', 'medical diagnosis', 'legal advice',
      'financial advice', 'investment', 'trading', 'cryptocurrency',
      'politics', 'religion', 'personal therapy', 'how to make money',
      'get rich', 'winning lottery', 'casino', 'gambling'
    ];
    
    const hasOffTopicTerm = offTopicTerms.some(term => messageLower.includes(term));
    
    if (hasOffTopicTerm) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('🚫 Refused question (off-topic, no semantic overlap):', {
          topic: currentDayTopic,
          subtasks: currentDaySubtasks,
          message: userQuestion.substring(0, 100)
        });
      }
      return {
        refused: true,
        reason: 'out_of_scope',
        message: "I can only help with questions related to today's learning topic."
      };
    }
    
    // If no off-topic terms but also no relevance, be conservative and allow
    // (Zero false positives preferred - only reject when clearly off-topic)
    return null;
  }

  // Question passed all checks - semantically related to topic/subtasks
  return null;
}

/**
 * Hard topic scope gate: Determines if a question is within the scope of today's topic
 * Uses keyword extraction and simple synonym mapping (no AI-based filtering)
 * 
 * @param {string} question - The user's question
 * @param {string} topic - The current day's topic
 * @param {string[]} subtasks - Array of current day's subtasks
 * @returns {boolean} - True if question is in scope, false otherwise
 */
/**
 * ============================================================================
 * DAY KNOWLEDGE BASE (DKB) - DAY-SCOPED EXPANDABLE MEMORY
 * ============================================================================
 * 
 * The DKB is the SINGLE SOURCE OF TRUTH for:
 * - What the mentor is allowed to know (scope validation)
 * - What the mentor can answer about (answering context)
 * 
 * ARCHITECTURE:
 * - Starts with today's syllabus (topic + subtasks)
 * - Expands ONLY with concepts introduced by the mentor
 * - Resets completely at the end of the day
 * - NO cross-day memory, NO global knowledge
 * 
 * KEY RULES:
 * - NO keyword matching (embedding-based only)
 * - NO predefined abbreviations
 * - NO fallback LLM calls
 * - Deterministic behavior only
 * 
 * ⚠️ DO NOT BYPASS DKB FOR SCOPE VALIDATION OR ANSWERING
 * ============================================================================
 */

/**
 * Day Knowledge Base (DKB) Store
 * Key: dayKey (normalized topic string)
 * Value: DKB object with structure:
 *   {
 *     topic: string,                    // Today's topic
 *     subtasks: string[],               // Today's subtasks
 *     concepts: string[],               // Concepts extracted from mentor answers
 *     lastUpdated: Date,                // Last update timestamp
 *     embedding: number[] | null,       // Cached embedding for the full DKB
 *     embeddingDirty: boolean           // True if embedding needs regeneration
 *   }
 * 
 * LIFECYCLE:
 * - Created when first question is asked for a day
 * - Expanded after each mentor answer (concept extraction)
 * - Reset when day changes (new topic)
 */
const dayKnowledgeBaseStore = new Map();

/**
 * Maximum number of concepts to store in DKB per day
 * Prevents unbounded growth
 */
const MAX_DKB_CONCEPTS = 50;

/**
 * Scope validation threshold for DKB embedding similarity
 * Questions with similarity >= threshold are IN SCOPE
 */
const DKB_SCOPE_THRESHOLD = 0.22;

/**
 * Get or create Day Knowledge Base for a specific day
 * 
 * @param {string} topic - Today's learning topic
 * @param {string[]} subtasks - Today's subtasks
 * @returns {Object} - The DKB object for this day
 */
function getOrCreateDKB(topic, subtasks = []) {
  if (!topic || typeof topic !== 'string') {
    return null;
  }
  
  const dayKey = topic.toLowerCase().trim();
  
  // Check if DKB exists for this day
  if (dayKnowledgeBaseStore.has(dayKey)) {
    const existingDKB = dayKnowledgeBaseStore.get(dayKey);
    // Verify it's for the same topic (not stale)
    if (existingDKB.topic.toLowerCase().trim() === dayKey) {
      return existingDKB;
    }
  }
  
  // Create new DKB for this day
  const newDKB = {
    topic: topic.trim(),
    subtasks: Array.isArray(subtasks) 
      ? subtasks.filter(st => typeof st === 'string' && st.trim()).map(st => st.trim())
      : [],
    concepts: [],  // Will be populated from mentor answers
    lastUpdated: new Date(),
    embedding: null,
    embeddingDirty: true  // Needs initial embedding generation
  };
  
  // Store the new DKB
  dayKnowledgeBaseStore.set(dayKey, newDKB);
  
  // Cleanup: remove old DKBs (keep only last 5 days)
  if (dayKnowledgeBaseStore.size > 5) {
    const oldestKey = dayKnowledgeBaseStore.keys().next().value;
    dayKnowledgeBaseStore.delete(oldestKey);
    console.log(`🗑️  DKB cleanup: removed stale day "${oldestKey}"`);
  }
  
  if (process.env.NODE_ENV === 'development') {
    console.log('📚 DKB created for day:', {
      topic: newDKB.topic.substring(0, 50),
      subtasksCount: newDKB.subtasks.length
    });
  }
  
  return newDKB;
}

/**
 * Build DKB text representation for embedding generation
 * Combines topic, subtasks, and all extracted concepts
 * 
 * @param {Object} dkb - The Day Knowledge Base object
 * @returns {string} - Combined text for embedding
 */
function buildDKBText(dkb) {
  if (!dkb || !dkb.topic) {
    return '';
  }
  
  const parts = [];
  
  // Add topic
  parts.push(`Topic: ${dkb.topic}`);
  
  // Add subtasks
  if (dkb.subtasks && dkb.subtasks.length > 0) {
    parts.push(`Subtasks: ${dkb.subtasks.join(', ')}`);
  }
  
  // Add extracted concepts
  if (dkb.concepts && dkb.concepts.length > 0) {
    parts.push(`Related concepts: ${dkb.concepts.join(', ')}`);
  }
  
  return parts.join('. ');
}

/**
 * Reset Day Knowledge Base for day boundary
 * Called when transitioning to a new day
 * 
 * @param {string} oldTopic - The previous day's topic (to clear)
 */
function resetDKBForDayBoundary(oldTopic) {
  if (!oldTopic) return;
  
  const dayKey = oldTopic.toLowerCase().trim();
  
  if (dayKnowledgeBaseStore.has(dayKey)) {
    dayKnowledgeBaseStore.delete(dayKey);
    console.log(`🔄 DKB reset for day boundary: "${dayKey}"`);
  }
}

/**
 * DEPRECATED: Legacy store - kept for backwards compatibility
 * Use dayKnowledgeBaseStore instead
 */
const mentorLastAnswerStore = new Map();

/**
 * Cache for DKB embeddings
 * Key: DKB text hash
 * Value: embedding vector (array of numbers)
 * 
 * Purpose: Avoid regenerating embeddings when DKB hasn't changed
 */
const dkbEmbeddingCache = new Map();

/**
 * ⚠️ DEPRECATED: Keyword extraction for mentor's last answer
 * 
 * This function is kept for compatibility but is NOT used in DKB-based scope validation.
 * The mentor system now uses DKB with embedding-based semantic validation.
 * 
 * @deprecated Use extractConceptsFromAnswer() and DKB instead
 */
function extractMentorAnswerKeywords(answerText) {
  if (!answerText || typeof answerText !== 'string') return [];
  
  const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'this', 'that', 'with', 'from', 'have', 'been', 'than', 'more', 'what', 'when', 'where', 'which', 'about', 'into', 'over', 'after', 'before', 'will', 'would', 'could', 'should', 'might', 'must', 'shall', 'they', 'them', 'their', 'there', 'these', 'those', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'done']);
  
  const words = answerText
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.replace(/[.,;:!?()\[\]{}'"]/g, ''))
    .filter(w => w.length >= 2);
  
  const keywords = words.filter(w => w.length >= 2 && !stopWords.has(w));
  
  return keywords;
}

/**
 * ============================================================================
 * CONCEPT EXTRACTION - Extract key concepts from mentor answers
 * ============================================================================
 * 
 * After EVERY mentor answer, this function extracts key concepts semantically.
 * These concepts are appended to the DKB to expand allowed knowledge.
 * 
 * RULES:
 * - Extract short phrases, NOT sentences
 * - Do NOT deduplicate aggressively
 * - Keep everything day-local
 * - NO keyword matching (uses AI extraction)
 * 
 * @param {string} mentorAnswer - The mentor's response text
 * @param {string} topic - Today's learning topic
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string[]>} - Array of extracted concept phrases
 */
async function extractConceptsFromAnswer(mentorAnswer, topic, apiKey) {
  if (!mentorAnswer || typeof mentorAnswer !== 'string' || mentorAnswer.trim().length === 0) {
    return [];
  }
  
  if (!apiKey) {
    // No API key: fall back to simple noun phrase extraction
    // This is deterministic and doesn't require AI
    return extractConceptsSimple(mentorAnswer);
  }
  
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });
    
    const maxTokens = AI_LIMITS.CONCEPT_EXTRACTION;
    validateTokenLimit('CONCEPT_EXTRACTION', maxTokens);
    
    // Strict prompt for concept extraction
    const prompt = `Extract key technical concepts, terms, and phrases from this explanation.

RULES:
- Return ONLY a JSON array of short phrases (2-5 words each)
- Extract concepts that were EXPLAINED or INTRODUCED
- Do NOT include common words or filler
- Maximum 8 concepts
- No explanations, no markdown

Topic context: ${topic}

Text to extract from:
"${mentorAnswer.substring(0, 800)}"

Return ONLY a JSON array like: ["concept one", "concept two"]`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You extract key concepts from educational text. Return only a JSON array of short concept phrases. No explanations."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: AI_TEMPERATURES.CONCEPT_EXTRACTION,
      max_tokens: maxTokens,
      stream: false
    });
    
    if (response.usage) {
      console.log(`📊 Concept extraction tokens: ${response.usage.total_tokens} (limit: ${maxTokens})`);
    }
    
    const content = response.choices[0].message.content.trim();
    const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    try {
      const parsed = JSON.parse(jsonContent);
      if (Array.isArray(parsed)) {
        const concepts = parsed
          .filter(c => typeof c === 'string' && c.trim().length >= 2 && c.trim().length <= 50)
          .map(c => c.trim().toLowerCase())
          .slice(0, 8);  // Max 8 concepts per answer
        
        if (process.env.NODE_ENV === 'development') {
          console.log('🧠 Concepts extracted:', concepts);
        }
        
        return concepts;
      }
    } catch (parseErr) {
      console.warn('⚠️  Failed to parse concept extraction JSON, using fallback');
    }
    
    // Fallback to simple extraction
    return extractConceptsSimple(mentorAnswer);
  } catch (error) {
    console.error('Error in concept extraction:', error.message);
    // Fallback to simple extraction
    return extractConceptsSimple(mentorAnswer);
  }
}

/**
 * Simple concept extraction fallback (no AI)
 * Extracts potential technical terms using heuristics
 * 
 * @param {string} text - Text to extract from
 * @returns {string[]} - Array of extracted concepts
 */
function extractConceptsSimple(text) {
  if (!text || typeof text !== 'string') return [];
  
  // Common stop words to filter out
  const stopWords = new Set([
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'was',
    'one', 'our', 'out', 'has', 'his', 'how', 'its', 'may', 'new', 'now',
    'see', 'way', 'who', 'did', 'let', 'say', 'too', 'use', 'this', 'that',
    'with', 'from', 'have', 'been', 'than', 'more', 'what', 'when', 'where',
    'which', 'about', 'into', 'over', 'after', 'before', 'will', 'would',
    'could', 'should', 'might', 'must', 'they', 'them', 'their', 'there',
    'these', 'those', 'being', 'does', 'done', 'very', 'just', 'also',
    'here', 'some', 'like', 'then', 'only', 'such', 'well', 'first',
    'example', 'following', 'based', 'using', 'helps', 'allows', 'means'
  ]);
  
  // Extract words that look like technical terms
  // - Capitalized words (not at sentence start)
  // - Words with numbers
  // - Acronyms (2-5 uppercase letters)
  // - Compound words with hyphens
  const patterns = [
    /\b[A-Z][a-z]+(?:[A-Z][a-z]+)+/g,  // CamelCase
    /\b[A-Z]{2,5}\b/g,                   // Acronyms
    /\b\w+[-_]\w+\b/g,                   // Hyphenated/underscored
    /\b(?:CPU|RAM|GPU|API|SQL|HTML|CSS|DOM|HTTP|REST|JSON|XML)\b/gi  // Common tech terms
  ];
  
  const concepts = new Set();
  
  // Extract pattern matches
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(m => {
        const normalized = m.toLowerCase().trim();
        if (normalized.length >= 2 && normalized.length <= 30 && !stopWords.has(normalized)) {
          concepts.add(normalized);
        }
      });
    }
  }
  
  // Also extract quoted terms
  const quotedMatches = text.match(/"([^"]{2,30})"/g);
  if (quotedMatches) {
    quotedMatches.forEach(m => {
      const term = m.replace(/"/g, '').toLowerCase().trim();
      if (term.length >= 2 && !stopWords.has(term)) {
        concepts.add(term);
      }
    });
  }
  
  return Array.from(concepts).slice(0, 8);
}

/**
 * Add extracted concepts to the Day Knowledge Base
 * 
 * @param {Object} dkb - The Day Knowledge Base object
 * @param {string[]} newConcepts - Concepts to add
 * @returns {boolean} - True if concepts were added
 */
function addConceptsToDKB(dkb, newConcepts) {
  if (!dkb || !Array.isArray(newConcepts) || newConcepts.length === 0) {
    return false;
  }
  
  const existingSet = new Set(dkb.concepts.map(c => c.toLowerCase()));
  let addedCount = 0;
  
  for (const concept of newConcepts) {
    const normalized = concept.toLowerCase().trim();
    
    // Skip if already exists or DKB is at capacity
    if (existingSet.has(normalized) || dkb.concepts.length >= MAX_DKB_CONCEPTS) {
      continue;
    }
    
    dkb.concepts.push(normalized);
    existingSet.add(normalized);
    addedCount++;
  }
  
  if (addedCount > 0) {
    dkb.lastUpdated = new Date();
    dkb.embeddingDirty = true;  // Mark embedding as needing regeneration
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`📚 DKB expanded: +${addedCount} concepts, total: ${dkb.concepts.length}`);
    }
  }
  
  return addedCount > 0;
}

/**
 * Compute cosine similarity between two embedding vectors
 * 
 * @param {number[]} vecA - First embedding vector
 * @param {number[]} vecB - Second embedding vector
 * @returns {number} - Cosine similarity score (0 to 1)
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * ⚠️ SINGLE POINT OF EMBEDDING COMPUTATION
 * Generate embedding for text using OpenAI's embedding API
 * 
 * This is the ONLY function that generates embeddings for the mentor system.
 * DO NOT create alternative embedding functions or bypass this.
 * 
 * @param {string} text - Text to generate embedding for
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<number[]>} - Embedding vector
 */
async function generateEmbedding(text, apiKey) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('Text is required for embedding generation');
  }
  
  if (!apiKey) {
    throw new Error('OpenAI API key is required for embedding generation');
  }
  
  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey });
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small', // Small, fast, cost-effective model
      input: text.trim()
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    throw error;
  }
}

/**
 * Build syllabus text for TODAY ONLY
 * Combines currentDay.topic and currentDay.subtasks into a single text
 * Format: "Topic: [topic]. Subtasks: [subtask1], [subtask2]..."
 * 
 * @param {string} topic - Today's learning topic
 * @param {string[]} subtasks - Today's subtasks array
 * @returns {string} - Combined syllabus text
 */
function buildSyllabusText(topic, subtasks = []) {
  if (!topic || typeof topic !== 'string') {
    return '';
  }
  
  const topicPart = `Topic: ${topic.trim()}`;
  
  if (Array.isArray(subtasks) && subtasks.length > 0) {
    const validSubtasks = subtasks
      .filter(st => typeof st === 'string' && st.trim())
      .map(st => st.trim());
    
    if (validSubtasks.length > 0) {
      const subtasksPart = `Subtasks: ${validSubtasks.join(', ')}`;
      return `${topicPart}. ${subtasksPart}`;
    }
  }
  
  return topicPart;
}

/**
 * Get or generate cached syllabus embedding
 * 
 * @deprecated Use getDKBEmbedding() instead for scope validation
 * @param {string} topic - Today's learning topic
 * @param {string[]} subtasks - Today's subtasks array
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<number[]>} - Syllabus embedding vector
 */
async function getSyllabusEmbedding(topic, subtasks = [], apiKey) {
  const syllabusText = buildSyllabusText(topic, subtasks);
  const cacheKey = syllabusText.toLowerCase().trim();
  
  if (dkbEmbeddingCache.has(cacheKey)) {
    return dkbEmbeddingCache.get(cacheKey);
  }
  
  const embedding = await generateEmbedding(syllabusText, apiKey);
  
  if (dkbEmbeddingCache.size > 50) {
    const firstKey = dkbEmbeddingCache.keys().next().value;
    dkbEmbeddingCache.delete(firstKey);
  }
  
  dkbEmbeddingCache.set(cacheKey, embedding);
  return embedding;
}

/**
 * Get or generate cached DKB embedding
 * Uses the full DKB text (topic + subtasks + extracted concepts)
 * 
 * @param {Object} dkb - The Day Knowledge Base object
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<number[]>} - DKB embedding vector
 */
async function getDKBEmbedding(dkb, apiKey) {
  if (!dkb) {
    throw new Error('DKB is required for embedding generation');
  }
  
  // If embedding exists and is not dirty, return cached
  if (dkb.embedding && !dkb.embeddingDirty) {
    return dkb.embedding;
  }
  
  // Build DKB text and generate embedding
  const dkbText = buildDKBText(dkb);
  
  if (!dkbText || dkbText.trim().length === 0) {
    throw new Error('DKB text is empty');
  }
  
  // Check cache by text hash
  const cacheKey = dkbText.toLowerCase().trim();
  if (dkbEmbeddingCache.has(cacheKey)) {
    const cachedEmbedding = dkbEmbeddingCache.get(cacheKey);
    dkb.embedding = cachedEmbedding;
    dkb.embeddingDirty = false;
    return cachedEmbedding;
  }
  
  // Generate new embedding
  const embedding = await generateEmbedding(dkbText, apiKey);
  
  // Cache it
  if (dkbEmbeddingCache.size > 30) {
    const firstKey = dkbEmbeddingCache.keys().next().value;
    dkbEmbeddingCache.delete(firstKey);
  }
  
  dkbEmbeddingCache.set(cacheKey, embedding);
  dkb.embedding = embedding;
  dkb.embeddingDirty = false;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('📊 DKB embedding generated:', {
      topic: dkb.topic.substring(0, 30),
      conceptsCount: dkb.concepts.length,
      textLength: dkbText.length
    });
  }
  
  return embedding;
}

/**
 * ⚠️ SINGLE POINT OF SCOPE DECISION
 * DKB-BASED SEMANTIC SCOPE VALIDATION
 * 
 * This is the ONLY function that determines if a question is in scope.
 * DO NOT create alternative scope validation functions or bypass this.
 * 
 * A question is IN SCOPE if:
 * - Cosine similarity between question and DKB embeddings >= DKB_SCOPE_THRESHOLD
 * 
 * A question is OUT OF SCOPE if:
 * - Cosine similarity < DKB_SCOPE_THRESHOLD
 * 
 * The DKB includes:
 * - Today's topic and subtasks (initial)
 * - Concepts extracted from mentor answers (dynamic expansion)
 * 
 * ⚠️ NO KEYWORD MATCHING - Embeddings only
 * ⚠️ NO PREDEFINED ABBREVIATIONS
 * ⚠️ NO GLOBAL MEMORY
 * ⚠️ DO NOT BYPASS THIS VALIDATION
 * 
 * @param {string} question - The user's question
 * @param {string} topic - Today's learning topic
 * @param {string[]} subtasks - Today's subtasks array
 * @param {string[]} lastAnswerKeywords - DEPRECATED: Not used in DKB-based validation
 * @param {string} apiKey - OpenAI API key for embedding generation
 * @returns {Promise<boolean>} - true if question is in scope, false otherwise
 */
async function isQuestionInScope(question, topic, subtasks = [], lastAnswerKeywords = [], apiKey = null) {
  if (!question || typeof question !== 'string' || !topic || typeof topic !== 'string') {
    return false;
  }
  
  // If no API key, fall back to basic validation (topic must be non-empty)
  if (!apiKey) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️  No API key for DKB scope validation, using basic check');
    }
    return topic.trim().length > 0;
  }
  
  try {
    // Get or create the Day Knowledge Base for this day
    const dkb = getOrCreateDKB(topic, subtasks);
    
    if (!dkb) {
      console.error('❌ Failed to get/create DKB for scope validation');
      return false;
    }
    
    // Generate embedding for question
    const questionEmbedding = await generateEmbedding(question, apiKey);
    
    // Get DKB embedding (includes topic, subtasks, AND extracted concepts)
    const dkbEmbedding = await getDKBEmbedding(dkb, apiKey);
    
    // Compute cosine similarity
    const similarity = cosineSimilarity(questionEmbedding, dkbEmbedding);
    
    // Use DKB threshold for scope decision
    const inScope = similarity >= DKB_SCOPE_THRESHOLD;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('📊 DKB scope check:', {
        similarity: similarity.toFixed(3),
        threshold: DKB_SCOPE_THRESHOLD,
        inScope,
        topic: topic.substring(0, 40),
        conceptsCount: dkb.concepts.length,
        question: question.substring(0, 40)
      });
    }
    
    return inScope;
  } catch (error) {
    console.error('Error in DKB scope validation:', error.message);
    // Fallback: if embedding fails, use basic validation
    return topic.trim().length > 0;
  }
}

/**
 * Extract topic name from aiExpertPrompt
 * Attempts to extract the main topic from various prompt formats
 * 
 * @param {string} aiExpertPrompt - The expert prompt
 * @returns {string} - The extracted topic name, or a fallback
 */
function extractTopic(aiExpertPrompt) {
  if (!aiExpertPrompt || typeof aiExpertPrompt !== 'string') {
    return 'today\'s learning topic';
  }

  const promptLower = aiExpertPrompt.toLowerCase();
  
  // Try to extract topic from common patterns
  // Pattern 1: "You are an expert in [TOPIC]"
  let match = promptLower.match(/you are an expert in ([^.,\n]+)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // Pattern 2: "topic: [TOPIC]" or "Topic: [TOPIC]"
  match = promptLower.match(/(?:topic|learning about|focus on|studying|covering)[:]\s*([^.,\n]+)/i);
  if (match && match[1]) {
    return match[1].trim();
  }
  
  // Pattern 3: Look for topic in first sentence
  const firstSentence = aiExpertPrompt.split(/[.!?]/)[0];
  if (firstSentence && firstSentence.length > 10 && firstSentence.length < 100) {
    // Remove common prefixes
    const cleaned = firstSentence
      .replace(/^you are (an? )?(expert|assistant|mentor) (in|for|on) /i, '')
      .replace(/^focus (on|ing) /i, '')
      .trim();
    if (cleaned.length > 3 && cleaned.length < 80) {
      return cleaned;
    }
  }
  
  // Fallback: return first meaningful phrase
  const words = aiExpertPrompt.split(/\s+/).slice(0, 5).join(' ');
  return words.length > 3 ? words : 'today\'s learning topic';
}

/**
 * Build RAG context from Day Knowledge Base (DKB)
 * 
 * Context MUST include ONLY content from the DKB:
 * - Today's topic
 * - Today's subtasks
 * - Concepts introduced by the mentor (extracted from answers)
 * 
 * DO NOT include:
 * - Previous days
 * - Future days
 * - Full syllabus
 * - User profile
 * - Chat history
 * - External knowledge
 * 
 * Format:
 * ALLOWED KNOWLEDGE:
 * "Today's Topic: {topic}
 * Subtasks:
 * - {subtask1}
 * - {subtask2}
 * Related Concepts:
 * - {concept1}
 * - {concept2}"
 * 
 * @param {string} currentDayTopic - The current day's topic (REQUIRED)
 * @param {string[]} currentDaySubtasks - Array of current day's subtasks
 * @returns {string|null} - The RAG context string, or null if empty
 */
function buildRAGContext(currentDayTopic, currentDaySubtasks = []) {
  // Add topic (REQUIRED - if missing, context is invalid)
  if (!currentDayTopic || typeof currentDayTopic !== 'string' || !currentDayTopic.trim()) {
    return null;
  }
  
  // Get the DKB for this day (includes extracted concepts)
  const dkb = getOrCreateDKB(currentDayTopic, currentDaySubtasks);
  
  if (!dkb) {
    // Fallback to basic context if DKB fails
    return buildBasicRAGContext(currentDayTopic, currentDaySubtasks);
  }
  
  // Build context from DKB
  const contentParts = [];
  
  // Add topic
  contentParts.push(`Today's Topic: ${dkb.topic}`);
  
  // Add subtasks (if any)
  if (dkb.subtasks && dkb.subtasks.length > 0) {
    contentParts.push('Subtasks:');
    dkb.subtasks.forEach(subtask => {
      contentParts.push(`- ${subtask}`);
    });
  }
  
  // Add extracted concepts (from mentor answers)
  if (dkb.concepts && dkb.concepts.length > 0) {
    contentParts.push('Related Concepts (from explanations):');
    dkb.concepts.forEach(concept => {
      contentParts.push(`- ${concept}`);
    });
  }
  
  const content = contentParts.join('\n');
  const context = 'ALLOWED KNOWLEDGE:\n"' + content + '"';
  
  if (!context || context.trim().length === 0 || content.trim().length === 0) {
    return null;
  }
  
  return context;
}

/**
 * Build basic RAG context without DKB (fallback)
 * Used when DKB is not available
 * 
 * @param {string} topic - Today's topic
 * @param {string[]} subtasks - Today's subtasks
 * @returns {string|null} - Basic context string
 */
function buildBasicRAGContext(topic, subtasks = []) {
  const contentParts = [];
  
  if (!topic || typeof topic !== 'string' || !topic.trim()) {
    return null;
  }
  
  contentParts.push(`Today's Topic: ${topic.trim()}`);
  
  if (Array.isArray(subtasks) && subtasks.length > 0) {
    const validSubtasks = subtasks
      .filter(st => typeof st === 'string' && st.trim())
      .map(st => st.trim());
    
    if (validSubtasks.length > 0) {
      contentParts.push('Subtasks:');
      validSubtasks.forEach(subtask => {
        contentParts.push(`- ${subtask}`);
      });
    }
  }
  
  const content = contentParts.join('\n');
  const context = 'ALLOWED KNOWLEDGE:\n"' + content + '"';
  
  if (!context || context.trim().length === 0 || content.trim().length === 0) {
    return null;
  }
  
  return context;
}

/**
 * Estimate token count (rough approximation: 1 token ≈ 0.75 words)
 * 
 * @param {string} text - Text to estimate
 * @returns {number} - Estimated token count
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  const words = text.split(/\s+/).length;
  return Math.ceil(words / 0.75);
}

/**
 * Check if question has semantic overlap with context
 * Simple keyword-based check (no AI, deterministic)
 * 
 * @param {string} question - User's question
 * @param {string} context - RAG context string
 * @returns {boolean} - True if there's semantic overlap
 */
function hasContextOverlap(question, context) {
  if (!question || !context) return false;
  
  const questionLower = question.toLowerCase();
  const contextLower = context.toLowerCase();
  
  // Extract significant words from question (3+ characters)
  const questionWords = questionLower.split(/\s+/).filter(w => w.length >= 3);
  
  // Extract significant words from context (3+ characters)
  const contextWords = contextLower.split(/\s+/).filter(w => w.length >= 3);
  
  // Check for overlap: at least one question word appears in context
  const hasOverlap = questionWords.some(qWord => 
    contextWords.some(cWord => 
      cWord.includes(qWord) || qWord.includes(cWord)
    )
  );
  
  return hasOverlap;
}

/**
 * Build system prompt using strict DKB-only approach
 * DKB context contains all allowed knowledge (topic, subtasks, extracted concepts)
 * 
 * @param {string|null} topic - The learning topic (optional, not used if ragContext provided)
 * @param {string} ragContext - The DKB context string (required)
 * @returns {string} - The formatted system prompt
 */
function buildSystemPrompt(topic, ragContext = null) {
  let prompt = `You are an AI tutor restricted to the ALLOWED KNOWLEDGE provided below.

STRICT RULES:
- You may ONLY answer questions using the ALLOWED KNOWLEDGE
- You may ONLY discuss concepts listed in the ALLOWED KNOWLEDGE
- If a question is about something NOT in the ALLOWED KNOWLEDGE, refuse
- Do NOT introduce new concepts beyond what is listed
- Do NOT use external knowledge

If the question is outside the allowed scope, respond ONLY with:
"This question is outside today's learning scope."

You are evaluated on REFUSING unrelated questions, not on being helpful.

Provide a clear, structured explanation with short paragraphs
and simple examples, avoiding unnecessary theory.`;

  // Add DKB context (required for strict DKB pipeline)
  if (ragContext) {
    prompt += `\n\n${ragContext}`;
  }
  
  return prompt;
}

/**
 * Controlled Question Rephraser
 * Rewrites vague or high-level learning questions to explicitly reference the topic/subtasks
 * WITHOUT introducing new concepts, answering the question, or expanding scope
 * 
 * @param {string} question - The user's original question
 * @param {string} topic - Today's learning topic
 * @param {string[]} subtasks - Today's subtasks array
 * @returns {string|null} - Rewritten question that explicitly references topic, or null if cannot align
 */
function rephraseQuestion(question, topic, subtasks = []) {
  if (!question || typeof question !== 'string' || !topic || typeof topic !== 'string') {
    return null;
  }
  
  const questionLower = question.toLowerCase().trim();
  const topicLower = topic.toLowerCase().trim();
  
  // Check if question already explicitly mentions the topic
  // If it does, no rephrasing needed
  if (questionLower.includes(topicLower)) {
    return question; // Already aligned, return as-is
  }
  
  // Extract first meaningful word from topic (for use in templates)
  const topicWords = topicLower.split(/\s+/).filter(w => w.length >= 3);
  const primaryTopicWord = topicWords[0] || topicLower.split(/\s+/)[0] || 'today\'s topic';
  
  // Template-based rephrasing patterns
  // Pattern: vague question → explicit question about topic
  
  // Pattern 1: "How does this work?" / "How does it work?" / "How does that work?"
  if (/^how\s+does\s+(this|it|that|the\s+computer|the\s+system|the\s+process)\s+work/i.test(question)) {
    if (subtasks && Array.isArray(subtasks) && subtasks.length > 0) {
      // Use first subtask if available
      const firstSubtask = subtasks[0].toLowerCase().trim();
      return `Explain how ${firstSubtask} works in the context of ${topicLower}.`;
    }
    return `Explain how ${topicLower} works.`;
  }
  
  // Pattern 2: "What is this?" / "What is it?" / "What is that?"
  if (/^what\s+is\s+(this|it|that)$/i.test(question)) {
    return `What is ${topicLower}?`;
  }
  
  // Pattern 3: "How do I do this?" / "How do I do it?" / "How do I use this?"
  if (/^how\s+do\s+i\s+(do|use|apply|implement|work\s+with)\s+(this|it|that)/i.test(question)) {
    if (subtasks && Array.isArray(subtasks) && subtasks.length > 0) {
      const firstSubtask = subtasks[0].toLowerCase().trim();
      return `How do I ${firstSubtask}?`;
    }
    return `How do I work with ${topicLower}?`;
  }
  
  // Pattern 4: "Why is this important?" / "Why does this matter?"
  if (/^why\s+(is|does)\s+(this|it|that)\s+(important|matter|relevant)/i.test(question)) {
    return `Why is ${topicLower} important?`;
  }
  
  // Pattern 5: "Can you explain this?" / "Can you explain it?" / "Can you tell me about this?"
  if (/^can\s+you\s+(explain|tell\s+me\s+about|describe)\s+(this|it|that)/i.test(question)) {
    return `Explain ${topicLower}.`;
  }
  
  // Pattern 6: "What about this?" / "Tell me more about this"
  if (/^(what\s+about|tell\s+me\s+more\s+about)\s+(this|it|that)/i.test(question)) {
    return `Tell me more about ${topicLower}.`;
  }
  
  // Pattern 7: "How does [generic term] work?" where generic term doesn't match topic
  // e.g., "How does the computer work?" when topic is "CPU Architecture"
  const genericTerms = ['computer', 'system', 'process', 'mechanism', 'component', 'device', 'machine'];
  const hasGenericTerm = genericTerms.some(term => {
    const regex = new RegExp(`how\\s+does\\s+(the\\s+)?${term}\\s+work`, 'i');
    return regex.test(question);
  });
  
  if (hasGenericTerm) {
    // Rewrite to reference topic explicitly
    if (subtasks && Array.isArray(subtasks) && subtasks.length > 0) {
      const firstSubtask = subtasks[0].toLowerCase().trim();
      return `Explain how ${firstSubtask} works in ${topicLower}.`;
    }
    return `Explain how the components in ${topicLower} work together.`;
  }
  
  // Pattern 8: "What are the basics?" / "What are the fundamentals?"
  if (/^what\s+are\s+(the\s+)?(basics|fundamentals|key\s+concepts|main\s+points)/i.test(question)) {
    return `What are the basics of ${topicLower}?`;
  }
  
  // Pattern 9: "Show me an example" / "Give me an example"
  if (/^(show|give|provide)\s+me\s+(an\s+)?example/i.test(question)) {
    return `Give me an example of ${topicLower}.`;
  }
  
  // Pattern 10: Questions starting with "this" or "it" without context
  // e.g., "This is confusing" → "Explain [topic] more clearly"
  if (/^(this|it)\s+(is|seems|appears|looks)/i.test(question)) {
    return `Explain ${topicLower} more clearly.`;
  }
  
  // If no pattern matches, return null (cannot align to topic)
  return null;
}

/**
 * POST /api/topic-chat
 * 
 * ⚠️ FROZEN AI MENTOR SYSTEM - DO NOT MODIFY WITHOUT SAFETY REVIEW ⚠️
 * 
 * SINGLE POINT OF CONTROL FOR:
 * - Embedding computation (via generateEmbedding/getSyllabusEmbedding)
 * - Scope validation (via isQuestionInScope)
 * - LLM calls for mentor chat
 * 
 * SAFETY RULES:
 * - DO NOT BYPASS SCOPE VALIDATION
 * - LLM MUST NOT BE CALLED IF OUT OF SCOPE
 * - No fallback LLM calls (only mock responses)
 * - No client-side AI calls (all go through this endpoint)
 * - No keyword-based scope logic (embedding-based only)
 * 
 * Handles topic-specific AI chat using strict DAY-SCOPED RAG pipeline
 * Uses ONLY: currentDayTopic, currentDaySubtasks
 * NO prompt-only system, NO aiExpertPrompt dependency
 */
app.post('/api/topic-chat', async (req, res) => {
  try {
    const { userMessage, currentDayTopic, currentDaySubtasks, currentDayNotes } = req.body;
    
    // Validation
    if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
      return res.status(400).json({ error: 'userMessage is required and must be a non-empty string' });
    }
    
    // Validate that we have at least a topic (required for RAG context)
    if (!currentDayTopic || typeof currentDayTopic !== 'string' || currentDayTopic.trim().length === 0) {
      return res.status(400).json({ 
        error: 'currentDayTopic is required and must be a non-empty string',
        refused: true,
        reason: "no_context",
        message: "This question is outside today's learning scope."
      });
    }

    // CONTROLLED QUESTION REPHRASER: Rewrite vague questions to explicitly reference topic
    // This runs BEFORE scope validation to handle natural learner questions
    let finalQuestion = userMessage;
    const rephrasedQuestion = rephraseQuestion(
      userMessage,
      currentDayTopic,
      Array.isArray(currentDaySubtasks) ? currentDaySubtasks : []
    );
    
    if (rephrasedQuestion) {
      // Use rephrased question for scope validation and LLM
      finalQuestion = rephrasedQuestion;
      if (process.env.NODE_ENV === 'development') {
        console.log('🔄 Question rephrased:', {
          original: userMessage.substring(0, 100),
          rephrased: rephrasedQuestion.substring(0, 100)
        });
      }
    } else {
      // Rephraser couldn't align question to topic
      // Continue with original question - scope validation will handle it
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️  Question could not be rephrased, using original:', userMessage.substring(0, 100));
      }
    }

    // Get mentor's last answer for this day (if exists)
    // Key: normalized currentDayTopic
    const dayKey = currentDayTopic.toLowerCase().trim();
    const lastMentorAnswer = mentorLastAnswerStore.get(dayKey) || null;
    const lastAnswerKeywords = lastMentorAnswer ? extractMentorAnswerKeywords(lastMentorAnswer) : [];

    // SAFETY PRE-FILTER: Check for harmful/illegal/off-scope content BEFORE ANY LLM/RAG call
    // This runs BEFORE any LLM or RAG processing
    // Use finalQuestion (rephrased if available, original otherwise)
    const refusal = preFilterQuestion(
      finalQuestion, 
      currentDayTopic || null, 
      Array.isArray(currentDaySubtasks) ? currentDaySubtasks : []
    );
    
    if (refusal) {
      // DO NOT call LLM, DO NOT call RAG - return refusal immediately
      // Log in dev mode only
      if (process.env.NODE_ENV === 'development') {
        console.warn('🚫 Question refused by pre-filter:', {
          reason: refusal.reason,
          message: finalQuestion.substring(0, 100)
        });
      }
      return res.json(refusal);
    }
    
    // ⚠️ EMBEDDING-BASED SEMANTIC SCOPE GATE: Block off-topic questions completely
    // ⚠️ DO NOT BYPASS SCOPE VALIDATION
    // ⚠️ LLM MUST NOT BE CALLED IF OUT OF SCOPE
    // This runs BEFORE building RAG context or calling LLM
    // Uses semantic similarity (cosine similarity >= 0.25) instead of keyword matching
    // Use finalQuestion (rephrased if available)
    // 
    // SINGLE POINT OF SCOPE DECISION - All scope validation happens here
    const embeddingApiKey = process.env.OPENAI_API_KEY;
    const isInScope = await isQuestionInScope(
      finalQuestion,
      currentDayTopic || '',
      Array.isArray(currentDaySubtasks) ? currentDaySubtasks : [],
      lastAnswerKeywords, // Kept for compatibility, not used in embedding-based check
      embeddingApiKey // Pass API key for embedding generation
    );
    
    // ⚠️ CRITICAL: If out of scope, return refusal immediately - DO NOT call LLM
    if (!isInScope) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('🚫 Question refused (out of topic scope):', {
          topic: currentDayTopic,
          message: finalQuestion.substring(0, 100),
          original: userMessage.substring(0, 100)
        });
      }
      // Return exact refusal format as specified
      return res.json({
        refused: true,
        reason: "out_of_scope",
        message: "This question is outside today's learning scope."
      });
    }
    
    // BUILD RAG CONTEXT: FROZEN to TODAY'S syllabus ONLY
    // MUST include ONLY: currentDay.topic, currentDay.subtasks
    // DO NOT include: previous days, future days, full syllabus, user profile, chat history, notes
    const ragContext = buildRAGContext(
      currentDayTopic || null,
      Array.isArray(currentDaySubtasks) ? currentDaySubtasks : []
    );
    
    // STRICT CONTEXT GATE: Check context length and minimum threshold
    // Minimum threshold: at least 10 words (≈ 13 tokens) to be considered valid context
    const MIN_CONTEXT_WORDS = 10;
    const MIN_CONTEXT_TOKENS = 13;
    
    // STRICT CONTEXT GATE: If context is empty, refuse immediately
    // DO NOT call LLM if context is empty
    // No fallback context, no retries, no global memory
    // Mentor is blind to everything except today's syllabus
    if (!ragContext || ragContext.trim().length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('🚫 Question refused (empty RAG context - mentor is blind to everything except today):', {
          topic: currentDayTopic,
          message: finalQuestion.substring(0, 100)
        });
      }
      return res.json({
        refused: true,
        reason: "no_context",
        message: "This question is outside today's learning scope."
      });
    }
    
    // Check context length (word count)
    const contextWords = ragContext.trim().split(/\s+/).filter(w => w.length > 0);
    const contextWordCount = contextWords.length;
    
    // Check context token count
    const contextTokens = estimateTokens(ragContext);
    
    // If context is below minimum threshold, refuse immediately
    if (contextWordCount < MIN_CONTEXT_WORDS || contextTokens < MIN_CONTEXT_TOKENS) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('🚫 Question refused (insufficient RAG context):', {
          wordCount: contextWordCount,
          tokenCount: contextTokens,
          minimumWords: MIN_CONTEXT_WORDS,
          minimumTokens: MIN_CONTEXT_TOKENS,
          message: userMessage.substring(0, 100)
        });
      }
      return res.json({
        refused: true,
        reason: "no_context",
        message: "This question is outside today's learning scope."
      });
    }
    
    // ⚠️ FINAL SAFETY GATE: Check if question has semantic overlap with context
    // ⚠️ DO NOT BYPASS THIS CHECK
    // ⚠️ LLM MUST NOT BE CALLED IF NO OVERLAP
    // If no overlap, refuse (question is not related to current day)
    // DO NOT call LLM if no overlap
    if (!hasContextOverlap(userMessage, ragContext)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('🚫 Question refused (no context overlap):', {
          message: userMessage.substring(0, 100),
          contextPreview: ragContext.substring(0, 100)
        });
      }
      return res.json({
        refused: true,
        reason: 'out_of_scope',
        message: "I can only help with questions related to today's learning topic."
      });
    }
    
    // CONTEXT-BOUND QUESTION REWRITING
    // After all scope + RAG checks pass, rewrite user question to enforce context-bound answering
    // NEVER send raw user input alone - always wrap with context-bound instruction
    // Use finalQuestion (rephrased if available, original otherwise)
    // Format: "Using ONLY the context above, answer the following question: {userQuestion}"
    const rewrittenQuestion = `Using ONLY the context above, answer the following question: ${finalQuestion}`;
    
    const apiKey = process.env.OPENAI_API_KEY;
    
    // Build system prompt with RAG context ONLY (no aiExpertPrompt, no topic extraction)
    // The RAG context contains all necessary information
    const systemPrompt = buildSystemPrompt(null, ragContext);
    
    // Verify context token limit (300-500 tokens max)
    if (contextTokens > 500) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️  RAG context exceeds 500 tokens:', {
          tokens: contextTokens
        });
      }
      // Context is already truncated in buildRAGContext, but log if still too large
    }
    
    // Mock response generator (used when API key is missing)
    // Uses finalQuestion (not raw userMessage) to maintain consistency with context-bound answering
    function generateMockResponse() {
      const mockResponses = [
        `Based on today's topic, here's what I can tell you: ${finalQuestion} is an important concept. Let me explain it in the context of what you're learning today.`,
        `Great question! In the context of today's topic, ${finalQuestion} relates to the core concepts we're covering. Here's a detailed explanation...`,
        `That's a relevant question for today's learning. ${finalQuestion} is a key aspect of the topic we're focusing on. Let me break it down for you.`
      ];
      return mockResponses[Math.floor(Math.random() * mockResponses.length)];
    }
    
    // ⚠️ NO FALLBACK LLM CALLS - If no API key, return mock response only
    // ⚠️ DO NOT attempt to call LLM through alternative means
    if (!apiKey) {
      console.log('⚠️  OPENAI_API_KEY not found. Using mock chat response.');
      const mockResponse = generateMockResponse();
      
      // DKB: Add mock concepts from the mock response
      if (currentDayTopic && typeof currentDayTopic === 'string') {
        try {
          const dkb = getOrCreateDKB(
            currentDayTopic,
            Array.isArray(currentDaySubtasks) ? currentDaySubtasks : []
          );
          if (dkb) {
            // Simple concept extraction for mock (no AI)
            const mockConcepts = extractConceptsSimple(mockResponse);
            addConceptsToDKB(dkb, mockConcepts);
          }
        } catch (err) {
          // Non-blocking
        }
        
        // Legacy store
        const dayKey = currentDayTopic.toLowerCase().trim();
        mentorLastAnswerStore.set(dayKey, mockResponse);
        
        if (mentorLastAnswerStore.size > 10) {
          const firstKey = mentorLastAnswerStore.keys().next().value;
          mentorLastAnswerStore.delete(firstKey);
        }
      }
      
      return res.json({ response: mockResponse });
    }
    
    // ⚠️ SINGLE POINT OF LLM CALL FOR MENTOR CHAT
    // ⚠️ This code path is ONLY reachable if:
    //    1. Pre-filter passed (no harmful content)
    //    2. Scope validation passed (embedding similarity >= 0.25)
    //    3. RAG context is valid (not empty, sufficient length)
    //    4. Context overlap check passed
    // ⚠️ DO NOT ADD FALLBACK LLM CALLS - Use mock responses only
    // Real OpenAI API call
    // Uses rewritten question (NEVER raw user input)
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey });
      
      // Enforce token limit
      const maxTokens = AI_LIMITS.CHAT;
      validateTokenLimit('CHAT', maxTokens);
      
      // ⚠️ LLM CALL - Only reached if all safety gates passed
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: rewrittenQuestion  // Use rewritten question, NOT raw userMessage
          }
        ],
        temperature: AI_TEMPERATURES.CHAT,  // 0.3 for topic chat
        max_tokens: maxTokens,  // 1000 tokens max
        stream: false  // Explicitly disable streaming
      });
      
      // Log token usage for cost monitoring
      if (response.usage) {
        console.log(`📊 Topic chat tokens: ${response.usage.total_tokens} (limit: ${maxTokens})`);
      }
      
      const aiResponse = response.choices[0].message.content.trim();
      
      // ============================================================================
      // DKB EXPANSION: Extract concepts from mentor answer and add to DKB
      // This allows natural follow-up questions about concepts the mentor introduced
      // ============================================================================
      if (currentDayTopic && typeof currentDayTopic === 'string') {
        try {
          // Get the DKB for this day
          const dkb = getOrCreateDKB(
            currentDayTopic,
            Array.isArray(currentDaySubtasks) ? currentDaySubtasks : []
          );
          
          if (dkb) {
            // Extract concepts from the mentor's answer
            const extractedConcepts = await extractConceptsFromAnswer(
              aiResponse,
              currentDayTopic,
              apiKey
            );
            
            // Add extracted concepts to DKB
            if (extractedConcepts && extractedConcepts.length > 0) {
              addConceptsToDKB(dkb, extractedConcepts);
              
              if (process.env.NODE_ENV === 'development') {
                console.log('📚 DKB after expansion:', {
                  topic: dkb.topic.substring(0, 30),
                  totalConcepts: dkb.concepts.length,
                  newConcepts: extractedConcepts.length
                });
              }
            }
          }
        } catch (extractErr) {
          // Concept extraction failure should not block the response
          console.error('⚠️  Concept extraction failed (non-blocking):', extractErr.message);
        }
        
        // Legacy: Also store in mentorLastAnswerStore for backwards compatibility
        const dayKey = currentDayTopic.toLowerCase().trim();
        mentorLastAnswerStore.set(dayKey, aiResponse);
        
        if (mentorLastAnswerStore.size > 10) {
          const firstKey = mentorLastAnswerStore.keys().next().value;
          mentorLastAnswerStore.delete(firstKey);
        }
      }
      
      res.json({ response: aiResponse });
    } catch (error) {
      console.error('OpenAI API error:', error.message);
      console.log('Falling back to mock response...');
      // ⚠️ NO FALLBACK LLM CALLS - Use mock response only
      // ⚠️ DO NOT attempt to call LLM again or use alternative endpoints
      const mockResponse = generateMockResponse();
      
      // Store mock response as last answer for follow-up support
      if (currentDayTopic && typeof currentDayTopic === 'string') {
        const dayKey = currentDayTopic.toLowerCase().trim();
        mentorLastAnswerStore.set(dayKey, mockResponse);
        
        // Safety: Limit store size
        if (mentorLastAnswerStore.size > 10) {
          const firstKey = mentorLastAnswerStore.keys().next().value;
          mentorLastAnswerStore.delete(firstKey);
        }
      }
      
      res.json({ response: mockResponse });
    }
  } catch (error) {
    console.error('Error in topic-chat:', error);
    // ⚠️ NO FALLBACK LLM CALLS - Use mock response only
    // ⚠️ DO NOT attempt to call LLM in error handler
    // Instead of returning 500, return a mock response so frontend doesn't show error
    // This ensures the user always gets a response, even if there's a server error
    const mockResponse = `I understand you're asking about ${currentDayTopic || 'today\'s topic'}. Based on today's learning content, here's a helpful response. For more detailed information, please ensure the AI service is properly configured.`;
    
    // Store mock response as last answer for follow-up support
    if (currentDayTopic && typeof currentDayTopic === 'string') {
      const dayKey = currentDayTopic.toLowerCase().trim();
      mentorLastAnswerStore.set(dayKey, mockResponse);
      
      // Safety: Limit store size
      if (mentorLastAnswerStore.size > 10) {
        const firstKey = mentorLastAnswerStore.keys().next().value;
        mentorLastAnswerStore.delete(firstKey);
      }
    }
    
    res.json({ response: mockResponse });
  }
});

/**
 * POST /api/evaluate-learning
 * Evaluates learning input and determines if syllabus should be adjusted
 * Returns: { action: "continue" | "adjust" }
 */
app.post('/api/evaluate-learning', async (req, res) => {
  try {
    const { topic, subtasks, learningInput } = req.body;
    
    // Validation
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({ error: 'topic is required and must be a non-empty string' });
    }
    
    if (!learningInput || typeof learningInput !== 'string' || learningInput.trim().length < 50) {
      return res.status(400).json({ error: 'learningInput is required and must be at least 50 characters' });
    }
    
    const apiKey = process.env.OPENAI_API_KEY;
    
    // Mock response generator (used when API key is missing)
    function generateMockEvaluation() {
      return {
        understanding_level: "basic",
        confidence: "medium",
        gaps_detected: [],
        recommended_action: "continue"
      };
    }
    
    // If no API key, return mock evaluation
    if (!apiKey) {
      console.log('⚠️  OPENAI_API_KEY not found. Using mock evaluation.');
      return res.json(generateMockEvaluation());
    }
    
    // Real OpenAI API call
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey });
      
      // Enforce token limit
      const maxTokens = AI_LIMITS.EVALUATION;
      validateTokenLimit('EVALUATION', maxTokens);
      
      // Build context with today's syllabus
      const subtasksText = Array.isArray(subtasks) && subtasks.length > 0
        ? `Today's subtasks:\n${subtasks.map((st, idx) => `${idx + 1}. ${st}`).join('\n')}`
        : '';
      
      const context = `Today's topic: ${topic}
${subtasksText ? subtasksText + '\n' : ''}Learner's response to "What did you learn today?": ${learningInput}`;
      
      // Optimized instruction - shortened for faster processing
      const instruction = `Evaluate learner's understanding based ONLY on today's topic/subtasks and their reflection.

RULES:
- Evaluate ONLY against today's topic and subtasks
- Do NOT introduce new concepts or provide advice
- Return ONLY valid JSON, no explanations

OUTPUT (JSON only):
{
  "understanding_level": "low" | "basic" | "good" | "strong",
  "confidence": "low" | "medium" | "high",
  "gaps_detected": ["specific gap 1", "specific gap 2"] or [],
  "recommended_action": "repeat" | "continue" | "simplify" | "advance"
}

GUIDANCE:
- understanding_level: Assess grasp of today's content
- confidence: How clear is the evidence
- gaps_detected: Specific conceptual gaps (e.g., "difference between X and Y"), empty if none
- recommended_action: "continue" if on track, "repeat"/"simplify" if struggling, "advance" if strong

Default if insufficient: understanding_level="basic", confidence="medium", recommended_action="continue"`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are an internal learning evaluation engine. Your task is to evaluate the learner's understanding based ONLY on today's syllabus and the learner's written reflection. Return ONLY valid JSON with no explanations, no feedback text, no other content outside the JSON."
          },
          {
            role: "user",
            content: `${context}\n\n${instruction}`
          }
        ],
        temperature: AI_TEMPERATURES.EVALUATION,  // 0.2 for conservative evaluation
        max_tokens: maxTokens,  // 280 tokens max (optimized for faster response)
        stream: false,
        timeout: 30000  // 30 second timeout
      });
      
      // Log token usage
      if (response.usage) {
        console.log(`📊 Evaluation tokens: ${response.usage.total_tokens} (limit: ${maxTokens})`);
      }
      
      const content = response.choices[0].message.content.trim();
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      let parsed;
      try {
        parsed = JSON.parse(jsonContent);
      } catch (err) {
        console.error("❌ Invalid JSON from evaluation, using defaults");
        parsed = generateMockEvaluation();
      }
      
      // Validate and set defaults for required fields
      const validUnderstandingLevels = ['low', 'basic', 'good', 'strong'];
      const validConfidenceLevels = ['low', 'medium', 'high'];
      const validActions = ['repeat', 'continue', 'simplify', 'advance'];
      
      const result = {
        understanding_level: validUnderstandingLevels.includes(parsed.understanding_level) 
          ? parsed.understanding_level 
          : 'basic',
        confidence: validConfidenceLevels.includes(parsed.confidence)
          ? parsed.confidence
          : 'medium',
        gaps_detected: Array.isArray(parsed.gaps_detected)
          ? parsed.gaps_detected.filter(g => typeof g === 'string' && g.trim().length > 0)
          : [],
        recommended_action: validActions.includes(parsed.recommended_action)
          ? parsed.recommended_action
          : 'continue'
      };
      
      res.json(result);
    } catch (error) {
      console.error('OpenAI API error:', error.message);
      console.log('Falling back to mock evaluation...');
      res.json(generateMockEvaluation());
    }
  } catch (error) {
    console.error('Error in evaluate-learning:', error);
    res.status(500).json({ error: 'Failed to evaluate learning', message: error.message });
  }
});

/**
 * POST /api/regenerate-future-days
 * Regenerates days starting from a specific day number
 * Used when AI evaluation suggests adjustment
 */
app.post('/api/regenerate-future-days', async (req, res) => {
  try {
    const { goal, hoursPerDay, startDayNumber, totalDays, currentDate } = req.body;
    
    if (!goal || !hoursPerDay || !startDayNumber || !totalDays) {
      return res.status(400).json({ error: 'goal, hoursPerDay, startDayNumber, and totalDays are required' });
    }
    
    // HARD DOMAIN SAFETY GATE: Check if learning domain is allowed
    // This check happens BEFORE any LLM call
    if (!isAllowedLearningDomain(goal)) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('🚫 Syllabus regeneration blocked (unsafe domain):', {
          goal: typeof goal === 'string' ? goal.substring(0, 100) : goal
        });
      }
      return res.status(400).json({
        error: "unsafe_domain",
        message: "This learning topic is not supported."
      });
    }
    
    // Generate new days
    const newDays = await generateSyllabus(goal, hoursPerDay, totalDays);
    
    // Adjust day numbers and dates to match continuation
    const startDate = currentDate ? new Date(currentDate) : new Date();
    startDate.setHours(0, 0, 0, 0);
    
    const adjustedDays = newDays.map((day, index) => {
      const date = new Date(startDate);
      date.setDate(date.getDate() + index);
      const dateStr = date.toISOString().split('T')[0];
      
      return {
        ...day,
        dayNumber: startDayNumber + index,
        date: dateStr,
        status: index === 0 ? "active" : "pending"
      };
    });
    
    res.json({ days: adjustedDays });
  } catch (error) {
    console.error('Error regenerating future days:', error);
    res.status(500).json({ error: 'Failed to regenerate days', message: error.message });
  }
});

/**
 * POST /api/update-syllabus
 * Updates the syllabus state (for completed/skipped/leave days)
 * 
 * IMPORTANT: This endpoint triggers DKB day boundary reset when:
 * - A day is marked as completed
 * - The active day changes
 */
app.post('/api/update-syllabus', async (req, res) => {
  try {
    const { updatedSyllabus } = req.body;
    
    if (!updatedSyllabus || !updatedSyllabus.days) {
      return res.status(400).json({ error: 'updatedSyllabus with days array is required' });
    }
    
    // ============================================================================
    // DKB DAY BOUNDARY RESET
    // When day transitions occur, clear the DKB for the completed day
    // ============================================================================
    if (syllabus && syllabus.days) {
      // Find the previously active day
      const previousActiveDay = syllabus.days.find(d => d.status === 'active');
      const newActiveDay = updatedSyllabus.days.find(d => d.status === 'active');
      
      // Check if day changed
      if (previousActiveDay && newActiveDay && 
          previousActiveDay.dayNumber !== newActiveDay.dayNumber) {
        // Day boundary: reset DKB for the completed day
        if (previousActiveDay.topic) {
          resetDKBForDayBoundary(previousActiveDay.topic);
          console.log(`🔄 Day boundary detected: Day ${previousActiveDay.dayNumber} → Day ${newActiveDay.dayNumber}`);
          console.log(`📚 DKB reset for: "${previousActiveDay.topic}"`);
        }
      }
      
      // Also clear DKB for any days that were just marked completed
      for (const newDay of updatedSyllabus.days) {
        const oldDay = syllabus.days.find(d => d.dayNumber === newDay.dayNumber);
        if (oldDay && oldDay.status !== 'completed' && newDay.status === 'completed') {
          // This day was just completed - reset its DKB
          if (newDay.topic) {
            resetDKBForDayBoundary(newDay.topic);
            console.log(`✅ Day ${newDay.dayNumber} completed - DKB reset`);
          }
        }
      }
    }
    
    // Update in-memory syllabus
    syllabus = updatedSyllabus;
    
    res.json({ success: true, syllabus });
  } catch (error) {
    console.error('Error updating syllabus:', error);
    res.status(500).json({ error: 'Failed to update syllabus', message: error.message });
  }
});

/**
 * POST /api/reset-day-knowledge
 * Explicitly reset the Day Knowledge Base for a specific day
 * Called when user wants to start fresh or when debugging
 */
app.post('/api/reset-day-knowledge', async (req, res) => {
  try {
    const { topic } = req.body;
    
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'topic is required' });
    }
    
    resetDKBForDayBoundary(topic);
    
    res.json({ 
      success: true, 
      message: `DKB reset for topic: ${topic}` 
    });
  } catch (error) {
    console.error('Error resetting DKB:', error);
    res.status(500).json({ error: 'Failed to reset DKB', message: error.message });
  }
});

/**
 * GET /api/day-knowledge
 * Debug endpoint to view current DKB state (development only)
 */
app.get('/api/day-knowledge', (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({ error: 'Debug endpoint only available in development' });
  }
  
  const { topic } = req.query;
  
  if (topic) {
    const dayKey = topic.toLowerCase().trim();
    const dkb = dayKnowledgeBaseStore.get(dayKey);
    
    if (!dkb) {
      return res.status(404).json({ error: 'No DKB found for this topic' });
    }
    
    return res.json({
      topic: dkb.topic,
      subtasks: dkb.subtasks,
      concepts: dkb.concepts,
      conceptCount: dkb.concepts.length,
      lastUpdated: dkb.lastUpdated,
      embeddingCached: !!dkb.embedding && !dkb.embeddingDirty
    });
  }
  
  // Return all DKBs
  const allDKBs = [];
  for (const [key, dkb] of dayKnowledgeBaseStore.entries()) {
    allDKBs.push({
      key,
      topic: dkb.topic,
      subtasksCount: dkb.subtasks.length,
      conceptCount: dkb.concepts.length,
      lastUpdated: dkb.lastUpdated
    });
  }
  
  res.json({ dkbs: allDKBs, count: allDKBs.length });
});

/**
 * POST /api/generate-linkedin-draft
 * Generates a LinkedIn post draft from completed day's topic and learning input
 * Day 5: LinkedIn draft generator
 */
app.post('/api/generate-linkedin-draft', async (req, res) => {
  try {
    const { topic, learningInput } = req.body;
    
    // Validation
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({ error: 'topic is required and must be a non-empty string' });
    }
    
    if (!learningInput || typeof learningInput !== 'string' || learningInput.trim().length < 50) {
      return res.status(400).json({ error: 'learningInput is required and must be at least 50 characters' });
    }
    
    const apiKey = process.env.OPENAI_API_KEY;
    
    // Mock response generator (used when API key is missing or for demo safety)
    function generateMockDraft() {
      return `Just completed Day ${topic.includes('Day') ? topic.match(/Day (\d+)/)?.[1] || '' : ''} of my learning journey! 🚀

Today I focused on ${topic}. Here's what I learned:

${learningInput.substring(0, 150)}...

Excited to continue this learning path! 💪

#Learning #Growth #ContinuousImprovement`;
    }
    
    // If no API key, return mock draft
    if (!apiKey) {
      console.log('⚠️  OPENAI_API_KEY not found. Using mock LinkedIn draft.');
      return res.json({ draft: generateMockDraft() });
    }
    
    // Real OpenAI API call
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey });
      
      // Enforce token limit
      const maxTokens = AI_LIMITS.LINKEDIN;
      validateTokenLimit('LINKEDIN', maxTokens);
      
      const prompt = `Create a short, professional LinkedIn post (5-6 lines max) about this learning experience.

Topic: ${topic}
What I learned: ${learningInput}

Requirements:
- Professional but engaging tone
- 5-6 lines maximum
- Include relevant hashtags (2-3 max)
- Focus on the learning outcome
- No emoji overuse (1-2 max)`;

      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a professional LinkedIn content writer. Create concise, engaging posts."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: AI_TEMPERATURES.LINKEDIN,  // 0.4 for creative posts
        max_tokens: maxTokens,  // 200 tokens max
        stream: false
      });
      
      // Log token usage
      if (response.usage) {
        console.log(`📊 LinkedIn draft tokens: ${response.usage.total_tokens} (limit: ${maxTokens})`);
      }
      
      const draft = response.choices[0].message.content.trim();
      res.json({ draft });
    } catch (error) {
      console.error('OpenAI API error:', error.message);
      console.log('Falling back to mock draft...');
      res.json({ draft: generateMockDraft() });
    }
  } catch (error) {
    console.error('Error in generate-linkedin-draft:', error);
    // Demo safety: always return something
    res.json({ 
      draft: `Learning update: Completed ${req.body?.topic || 'today\'s topic'}. Key takeaway: ${req.body?.learningInput?.substring(0, 100) || 'Continued progress on my learning journey.'} #Learning #Growth`
    });
  }
});

/**
 * POST /api/generate-mentor-first-message
 * 
 * ⚠️ Frontend–backend contract: do not rename without updating both.
 * 
 * Generates a mentor-initiated first message for instructional orientation.
 * This is NOT a chatbot greeting - it's an instructional orientation message.
 * 
 * GENERATION RULES:
 * - Uses ONLY today's Day Knowledge Base (topic + subtasks)
 * - Does NOT use mentor answers (none exist yet)
 * - Does NOT use previous days or general knowledge
 * - Short and instructional (not chatty)
 * - No emojis, no casual greetings
 * - No future topics, no motivational fluff
 * 
 * REQUEST BODY:
 * {
 *   topic: string (required),
 *   subtasks: string[] (optional)
 * }
 * 
 * RESPONSE:
 * {
 *   message: string (the first message text, or empty string on failure)
 * }
 */
app.post('/api/generate-mentor-first-message', async (req, res) => {
  try {
    // ⚠️ Frontend–backend contract: field names must match exactly
    const { topic, subtasks } = req.body;
    
    // Validation: topic is required
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({ error: 'topic is required and must be a non-empty string' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    
    // SAFE MOCK RESPONSE: If AI logic is missing, return deterministic template
    if (!apiKey) {
      console.log('⚠️  OPENAI_API_KEY not found. Using template-based first message.');
      const subtasksList = Array.isArray(subtasks) && subtasks.length > 0
        ? subtasks.map(st => `- ${st}`).join('\n')
        : '';
      
      const mockMessage = `Welcome. Today we'll focus on ${topic}.
${subtasksList ? `By the end of this session, you should understand:\n${subtasksList}\n` : ''}You can start by asking one of the questions below.`;
      
      return res.json({ message: mockMessage });
    }
    
    // Real OpenAI API call
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey });
      
      // Enforce token limit
      const maxTokens = AI_LIMITS.FIRST_MESSAGE;
      validateTokenLimit('FIRST_MESSAGE', maxTokens);
      
      // Build context (ONLY today's topic and subtasks)
      const subtasksText = Array.isArray(subtasks) && subtasks.length > 0
        ? `Subtasks:\n${subtasks.map(st => `- ${st}`).join('\n')}`
        : '';
      
      const context = `Today's topic: ${topic}
${subtasksText ? subtasksText + '\n' : ''}`;
      
      // Strict instruction for first message generation
      const instruction = `Generate a short, instructional orientation message for a learner starting today's topic.

REQUIREMENTS:
- Clearly state what today's topic is
- Clearly state what the learner will focus on
- Be short and instructional (not chatty)
- No emojis
- No casual greetings ("hey", "hi", etc.)
- No future topics
- No motivational fluff
- Maximum 4-5 sentences

Example structure (adapt to actual topic/subtasks):
"Welcome. Today we'll focus on [topic].
By the end of this session, you should understand:
- [subtask 1]
- [subtask 2]
You can start by asking one of the questions below."

Return ONLY the message text. No explanations, no markdown, no JSON wrapper.`;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a learning mentor that provides instructional orientation. Return only the message text. No explanations, no markdown, no JSON, no emojis."
          },
          {
            role: "user",
            content: `${context}\n\n${instruction}`
          }
        ],
        temperature: AI_TEMPERATURES.FIRST_MESSAGE,  // 0.2 for instructional tone
        max_tokens: maxTokens,  // 250 tokens max
        stream: false
      });
      
      // Log token usage
      if (response.usage) {
        console.log(`📊 First message tokens: ${response.usage.total_tokens} (limit: ${maxTokens})`);
      }
      
      const message = response.choices[0].message.content.trim();
      
      // Clean up any markdown or formatting that might have been added
      const cleanMessage = message
        .replace(/```/g, '')
        .replace(/^["']|["']$/g, '')  // Remove surrounding quotes
        .trim();
      
      if (!cleanMessage || cleanMessage.length === 0) {
        // Fallback to template
        const subtasksList = Array.isArray(subtasks) && subtasks.length > 0
          ? subtasks.map(st => `- ${st}`).join('\n')
          : '';
        
        const fallbackMessage = `Welcome. Today we'll focus on ${topic}.
${subtasksList ? `By the end of this session, you should understand:\n${subtasksList}\n` : ''}You can start by asking one of the questions below.`;
        
        return res.json({ message: fallbackMessage });
      }
      
      res.json({ message: cleanMessage });
    } catch (error) {
      console.error('OpenAI API error in generate-mentor-first-message:', error.message);
      // Fallback to template
      const subtasksList = Array.isArray(subtasks) && subtasks.length > 0
        ? subtasks.map(st => `- ${st}`).join('\n')
        : '';
      
      const fallbackMessage = `Welcome. Today we'll focus on ${topic}.
${subtasksList ? `By the end of this session, you should understand:\n${subtasksList}\n` : ''}You can start by asking one of the questions below.`;
      
      res.json({ message: fallbackMessage });
    }
  } catch (error) {
    console.error('Error in generate-mentor-first-message:', error);
    // Fallback to template
    const subtasksList = Array.isArray(req.body?.subtasks) && req.body?.subtasks.length > 0
      ? req.body.subtasks.map(st => `- ${st}`).join('\n')
      : '';
    
    const fallbackMessage = `Welcome. Today we'll focus on ${req.body?.topic || 'today\'s topic'}.
${subtasksList ? `By the end of this session, you should understand:\n${subtasksList}\n` : ''}You can start by asking one of the questions below.`;
    
    res.json({ message: fallbackMessage });
  }
});

/**
 * POST /api/generate-starter-questions
 * 
 * ⚠️ Frontend–backend contract: do not rename without updating both.
 * 
 * Generates exactly 3 AI-suggested starter questions for FIRST INTERACTION.
 * Used when user opens a day's learning page and no mentor interaction has occurred.
 * 
 * GENERATION RULES:
 * - Uses ONLY today's Day Knowledge Base (topic + subtasks)
 * - Does NOT use mentor answers (none exist yet)
 * - Does NOT use previous days or general knowledge
 * 
 * REQUEST BODY:
 * {
 *   topic: string (required),
 *   subtasks: string[] (optional)
 * }
 * 
 * RESPONSE:
 * {
 *   questions: string[] (exactly 3 questions, or empty array on failure)
 * }
 */
app.post('/api/generate-starter-questions', async (req, res) => {
  try {
    // ⚠️ Frontend–backend contract: field names must match exactly
    const { topic, subtasks } = req.body;
    
    // Validation: topic is required
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({ error: 'topic is required and must be a non-empty string' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    
    // SAFE MOCK RESPONSE: If AI logic is missing, return mock starter questions
    if (!apiKey) {
      console.log('⚠️  OPENAI_API_KEY not found. Using mock starter questions.');
      const mockQuestions = [
        `What is ${topic}?`,
        `How do I get started with ${topic}?`,
        `What are the basics of ${topic}?`
      ];
      return res.json({ questions: mockQuestions });
    }
    
    // Real OpenAI API call
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey });
      
      // Enforce token limit
      const maxTokens = AI_LIMITS.SUGGESTIONS;
      validateTokenLimit('SUGGESTIONS', maxTokens);
      
      // Build context (ONLY today's topic and subtasks - no mentor answer)
      const subtasksText = Array.isArray(subtasks) && subtasks.length > 0
        ? `Subtasks: ${subtasks.join(', ')}`
        : '';
      
      const context = `Today's topic: ${topic}
${subtasksText ? subtasksText : ''}`;
      
      // Use EXACT instruction as specified (verbatim)
      const instruction = `Using ONLY today's learning topic and subtasks,
generate exactly 3 simple starter questions
a learner might ask to begin understanding this topic.

STRICT RULES:
- Questions MUST be ONLY about today's topic and subtasks
- Do NOT introduce new concepts
- Do NOT ask about future topics
- Do NOT ask about previous days
- Do NOT ask about general knowledge outside today's scope
- Questions must be directly related to the topic and subtasks provided

Return ONLY a JSON array of strings.`;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a learning assistant that generates starter questions. Questions must ONLY be about today's topic and subtasks. Do NOT generate questions about other topics, future content, or general knowledge. Return only a JSON array of exactly 3 question strings. No explanations, no markdown, no other text."
          },
          {
            role: "user",
            content: `${context}\n\n${instruction}`
          }
        ],
        temperature: AI_TEMPERATURES.SUGGESTIONS,  // 0.3 for question generation
        max_tokens: maxTokens,  // 300 tokens max
        stream: false
      });
      
      // Log token usage
      if (response.usage) {
        console.log(`📊 Starter questions tokens: ${response.usage.total_tokens} (limit: ${maxTokens})`);
      }
      
      const content = response.choices[0].message.content.trim();
      
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Parse JSON array
      let questions = [];
      try {
        const parsed = JSON.parse(jsonContent);
        // Ensure it's an array
        if (Array.isArray(parsed)) {
          // Take exactly 3 questions, filter out empty strings
          questions = parsed
            .filter(q => typeof q === 'string' && q.trim().length > 0)
            .slice(0, 3)
            .map(q => q.trim());
        }
      } catch (parseError) {
        console.warn('⚠️  Failed to parse starter questions JSON');
        // Fallback: return empty array (silent failure)
        return res.json({ questions: [] });
      }
      
      // Ensure exactly 3 questions
      if (questions.length === 0) {
        return res.json({ questions: [] });
      }
      
      // Return exactly 3 questions (or fewer if generation failed)
      const finalQuestions = questions.slice(0, 3);
      res.json({ questions: finalQuestions });
    } catch (error) {
      console.error('OpenAI API error in generate-starter-questions:', error.message);
      // Silent failure: return empty array
      res.json({ questions: [] });
    }
  } catch (error) {
    console.error('Error in generate-starter-questions:', error);
    // Silent failure: return empty array
    res.json({ questions: [] });
  }
});

/**
 * POST /api/generate-suggested-questions
 * 
 * ⚠️ Frontend–backend contract: do not rename without updating both.
 * 
 * Generates exactly 3 AI-suggested follow-up questions based on:
 * - Today's topic
 * - Today's subtasks
 * - Mentor's last answer
 * 
 * STRICT SCOPE: Only uses today's context, no external knowledge
 * TOKEN LIMIT: 300 tokens max
 * 
 * REQUEST BODY:
 * {
 *   topic: string (required),
 *   subtasks: string[] (optional),
 *   lastAnswer: string (required)
 * }
 * 
 * RESPONSE:
 * {
 *   questions: string[] (exactly 3 questions, or empty array on failure)
 * }
 */
app.post('/api/generate-suggested-questions', async (req, res) => {
  try {
    // ⚠️ Frontend–backend contract: field names must match exactly
    const { topic, subtasks, lastAnswer } = req.body;
    
    // Validation: topic is required
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return res.status(400).json({ error: 'topic is required and must be a non-empty string' });
    }
    
    // Validation: lastAnswer is required
    if (!lastAnswer || typeof lastAnswer !== 'string' || lastAnswer.trim().length === 0) {
      // If no answer, return empty array (silent failure)
      return res.json({ questions: [] });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    
    // SAFE MOCK RESPONSE: If AI logic is missing, return mock questions
    // DO NOT crash the server - return exactly 3 mock questions
    if (!apiKey) {
      console.log('⚠️  OPENAI_API_KEY not found. Using mock suggested questions.');
      // Generate safe mock questions based on topic and last answer
      const mockQuestions = [
        `Can you explain more about ${topic}?`,
        `What are the key concepts related to ${topic}?`,
        `How does this relate to what we're learning today?`
      ];
      return res.json({ questions: mockQuestions });
    }
    
    // Real OpenAI API call
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey });
      
      // Enforce token limit
      const maxTokens = AI_LIMITS.SUGGESTIONS;
      validateTokenLimit('SUGGESTIONS', maxTokens);
      
      // Build context (ONLY today's scope)
      // ⚠️ Frontend–backend contract: subtasks is optional array
      const subtasksText = Array.isArray(subtasks) && subtasks.length > 0
        ? `Subtasks: ${subtasks.join(', ')}`
        : '';
      
      const context = `Today's topic: ${topic}
${subtasksText ? subtasksText + '\n' : ''}Mentor's last answer: ${lastAnswer}`;
      
      // Use exact instruction as specified
      const instruction = `Using ONLY the context provided above (today's topic, subtasks, and mentor's last answer), generate exactly 3 short, clear follow-up questions that a learner could naturally ask next.

STRICT RULES:
- Questions MUST be ONLY about today's topic and subtasks
- Questions MUST be based on the mentor's last answer (which is about today's topic)
- Do NOT introduce new concepts
- Do NOT ask about future topics
- Do NOT ask about previous days
- Do NOT ask about general knowledge outside today's scope
- Questions must be directly related to what was discussed in the mentor's answer

Do NOT include explanations. Return ONLY the questions as a JSON array of strings.`;
      
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a learning assistant that generates focused follow-up questions. Questions must ONLY be about today's topic and subtasks, based on the mentor's answer. Do NOT generate questions about other topics, future content, previous days, or general knowledge. Return only a JSON array of exactly 3 question strings. No explanations, no markdown, no other text."
          },
          {
            role: "user",
            content: `${context}\n\n${instruction}`
          }
        ],
        temperature: AI_TEMPERATURES.SUGGESTIONS,  // 0.3 for question generation
        max_tokens: maxTokens,  // 300 tokens max
        stream: false
      });
      
      // Log token usage
      if (response.usage) {
        console.log(`📊 Suggested questions tokens: ${response.usage.total_tokens} (limit: ${maxTokens})`);
      }
      
      const content = response.choices[0].message.content.trim();
      
      // Remove markdown code blocks if present
      const jsonContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Parse JSON array
      let questions = [];
      try {
        const parsed = JSON.parse(jsonContent);
        // Ensure it's an array
        if (Array.isArray(parsed)) {
          // Take exactly 3 questions, filter out empty strings
          questions = parsed
            .filter(q => typeof q === 'string' && q.trim().length > 0)
            .slice(0, 3)
            .map(q => q.trim());
        }
      } catch (parseError) {
        // If JSON parsing fails, try to extract questions from text
        console.warn('⚠️  Failed to parse suggested questions JSON, attempting text extraction');
        // Fallback: return empty array (silent failure)
        return res.json({ questions: [] });
      }
      
      // Ensure exactly 3 questions (pad with empty if needed, but prefer to return fewer than invalid)
      if (questions.length === 0) {
        return res.json({ questions: [] });
      }
      
      // Return exactly 3 questions (or fewer if generation failed)
      // The route MUST return an array of EXACTLY 3 strings (or fewer if generation fails)
      const finalQuestions = questions.slice(0, 3);
      res.json({ questions: finalQuestions });
    } catch (error) {
      console.error('OpenAI API error in generate-suggested-questions:', error.message);
      // Silent failure: return empty array
      res.json({ questions: [] });
    }
  } catch (error) {
    console.error('Error in generate-suggested-questions:', error);
    // Silent failure: return empty array
    res.json({ questions: [] });
  }
});

/**
 * GET /api/syllabus
 * Returns the current syllabus
 */
app.get('/api/syllabus', (req, res) => {
  if (!syllabus) {
    return res.status(404).json({ error: 'No syllabus found' });
  }
  res.json(syllabus);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Export app for Vercel serverless (always export)
export default app;

// Start server for local development only
if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📝 API endpoint: http://localhost:${PORT}/api/generate-syllabus`);
    console.log(`💬 Chat endpoint: http://localhost:${PORT}/api/topic-chat`);
    console.log(`📊 Evaluation endpoint: http://localhost:${PORT}/api/evaluate-learning`);
  });
}


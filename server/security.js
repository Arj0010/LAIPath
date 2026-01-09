/**
 * Security Middleware and Utilities
 * 
 * Provides:
 * - Input sanitization
 * - Rate limiting configuration
 * - CORS configuration
 * - Security headers
 * - Error message sanitization
 */

import rateLimit from 'express-rate-limit';

/**
 * Sanitize user input to prevent injection attacks
 * @param {string} input - User input string
 * @returns {string} - Sanitized string
 */
export function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Limit length (prevent DoS via extremely long inputs)
  const MAX_LENGTH = 10000;
  if (sanitized.length > MAX_LENGTH) {
    sanitized = sanitized.substring(0, MAX_LENGTH);
  }
  
  return sanitized;
}

/**
 * Sanitize error messages to prevent information leakage
 * @param {Error} error - Error object
 * @param {boolean} isDevelopment - Whether in development mode
 * @returns {string} - Safe error message
 */
export function sanitizeError(error, isDevelopment = false) {
  if (!error) {
    return 'An error occurred';
  }
  
  // In production, don't expose internal error details
  if (!isDevelopment) {
    // Only expose generic error messages
    if (error.message && error.message.includes('API')) {
      return 'External service error. Please try again later.';
    }
    if (error.message && error.message.includes('timeout')) {
      return 'Request timeout. Please try again.';
    }
    if (error.message && error.message.includes('network')) {
      return 'Network error. Please check your connection.';
    }
    return 'An error occurred. Please try again.';
  }
  
  // In development, show full error
  return error.message || 'An error occurred';
}

/**
 * Validate and sanitize request body
 * @param {object} body - Request body
 * @param {string[]} requiredFields - Required field names
 * @returns {{valid: boolean, sanitized: object, error?: string}}
 */
export function validateAndSanitizeBody(body, requiredFields = []) {
  if (!body || typeof body !== 'object') {
    return { valid: false, sanitized: {}, error: 'Invalid request body' };
  }
  
  const sanitized = {};
  
  // Check required fields
  for (const field of requiredFields) {
    if (!(field in body)) {
      return { valid: false, sanitized: {}, error: `Missing required field: ${field}` };
    }
  }
  
  // Sanitize all string fields
  for (const [key, value] of Object.entries(body)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (Array.isArray(value)) {
      // Sanitize array of strings
      sanitized[key] = value.map(item => 
        typeof item === 'string' ? sanitizeInput(item) : item
      );
    } else {
      sanitized[key] = value;
    }
  }
  
  return { valid: true, sanitized };
}

/**
 * Rate limiter for API endpoints
 * Limits: 100 requests per 15 minutes per IP
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.'
    });
  }
});

/**
 * Stricter rate limiter for AI endpoints (more expensive)
 * Limits: 20 requests per 15 minutes per IP
 */
export const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: 'Too many AI requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'AI rate limit exceeded. Please try again later.'
    });
  }
});

/**
 * CORS configuration
 * Restricts origins to known safe domains
 */
export function getCorsOptions() {
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174',
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.FRONTEND_URL || null
  ].filter(Boolean);
  
  return {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, etc.) in development
      if (!origin && process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      
      // Check if origin is allowed
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400 // 24 hours
  };
}

/**
 * Security headers middleware
 */
export function securityHeaders(req, res, next) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy (basic)
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';"
  );
  
  // Remove server header (don't expose Express version)
  res.removeHeader('X-Powered-By');
  
  next();
}

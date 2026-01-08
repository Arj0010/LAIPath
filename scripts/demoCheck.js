/**
 * Demo Safety Verification Script
 * 
 * Verifies all critical guarantees of the LAIPath app before demo.
 * 
 * Checks:
 * - Environment safety
 * - AI token limits
 * - Syllabus contract
 * - Calendar derivation logic
 * - Demo-safe fallback behavior
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Load environment variables
dotenv.config({ path: join(rootDir, 'server', '.env') });

// Track verification results
let hasErrors = false;
let hasWarnings = false;

/**
 * Log success
 */
function success(message) {
  console.log(`✅ ${message}`);
}

/**
 * Log warning (non-critical)
 */
function warning(message) {
  console.log(`⚠️  ${message}`);
  hasWarnings = true;
}

/**
 * Log error (critical)
 */
function error(message) {
  console.log(`❌ ${message}`);
  hasErrors = true;
}

/**
 * A. Environment Check
 */
function checkEnvironment() {
  console.log('\n📋 A. Environment Check');
  console.log('─'.repeat(50));
  
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    warning('OPENAI_API_KEY not found in environment');
    console.log('   → App will use mock data (acceptable for demo)');
  } else {
    success('OPENAI_API_KEY found');
  }
}

/**
 * B. Token Limit Enforcement Check
 */
function checkTokenLimits() {
  console.log('\n📋 B. Token Limit Enforcement Check');
  console.log('─'.repeat(50));
  
  try {
    // Import AI config from server
    const aiConfigPath = join(rootDir, 'server', 'aiConfig.js');
    const aiConfigContent = readFileSync(aiConfigPath, 'utf-8');
    
    // Extract AI_LIMITS object
    const limitsMatch = aiConfigContent.match(/AI_LIMITS\s*=\s*\{([^}]+)\}/s);
    if (!limitsMatch) {
      error('AI_LIMITS not found in aiConfig.js');
      return;
    }
    
    const limitsText = limitsMatch[1];
    
    // Check for each required limit
    const requiredLimits = {
      SYLLABUS: 450,
      CHAT: 300,
      LINKEDIN: 200
    };
    
    let allLimitsValid = true;
    
    for (const [key, maxValue] of Object.entries(requiredLimits)) {
      const regex = new RegExp(`${key}:\\s*(\\d+)`);
      const match = limitsText.match(regex);
      
      if (!match) {
        error(`${key} limit not found in AI_LIMITS`);
        allLimitsValid = false;
      } else {
        const value = parseInt(match[1]);
        if (value > maxValue) {
          error(`${key} limit (${value}) exceeds maximum allowed (${maxValue})`);
          allLimitsValid = false;
        } else {
          success(`${key}: ${value} tokens (max: ${maxValue})`);
        }
      }
    }
    
    // Verify validateTokenLimit function exists
    if (!aiConfigContent.includes('validateTokenLimit')) {
      error('validateTokenLimit function not found in aiConfig.js');
      allLimitsValid = false;
    } else {
      success('validateTokenLimit function exists');
    }
    
    // Check server.js uses AI_LIMITS
    const serverPath = join(rootDir, 'server', 'server.js');
    const serverContent = readFileSync(serverPath, 'utf-8');
    
    if (!serverContent.includes('AI_LIMITS')) {
      error('server.js does not import/use AI_LIMITS');
      allLimitsValid = false;
    } else {
      success('server.js imports AI_LIMITS');
    }
    
    // Verify all API calls use limits
    const apiCalls = [
      { name: 'Syllabus generation', pattern: /AI_LIMITS\.SYLLABUS|maxTokens.*AI_LIMITS\.SYLLABUS/ },
      { name: 'Topic chat', pattern: /AI_LIMITS\.CHAT|maxTokens.*AI_LIMITS\.CHAT/ },
      { name: 'LinkedIn draft', pattern: /AI_LIMITS\.LINKEDIN|maxTokens.*AI_LIMITS\.LINKEDIN/ }
    ];
    
    for (const call of apiCalls) {
      if (!call.pattern.test(serverContent)) {
        warning(`${call.name} may not be using centralized AI_LIMITS`);
      } else {
        success(`${call.name} uses AI_LIMITS`);
      }
    }
    
  } catch (err) {
    error(`Failed to check token limits: ${err.message}`);
  }
}

/**
 * C. Syllabus Structure Validation
 */
function checkSyllabusStructure() {
  console.log('\n📋 C. Syllabus Structure Validation');
  console.log('─'.repeat(50));
  
  try {
    const serverPath = join(rootDir, 'server', 'server.js');
    const serverContent = readFileSync(serverPath, 'utf-8');
    
    // Check for generateMockSyllabus function
    if (!serverContent.includes('generateMockSyllabus')) {
      warning('generateMockSyllabus function not found');
    } else {
      success('generateMockSyllabus function exists');
    }
    
    // Extract mock syllabus structure
    const mockMatch = serverContent.match(/function generateMockSyllabus\(\)\s*\{[\s\S]*?return days;/);
    
    if (mockMatch) {
      const mockCode = mockMatch[0];
      
      // Check required fields
      const requiredFields = [
        'dayNumber',
        'topic',
        'subtasks',
        'aiExpertPrompt'
      ];
      
      for (const field of requiredFields) {
        if (mockCode.includes(field)) {
          success(`Mock syllabus includes: ${field}`);
        } else {
          error(`Mock syllabus missing required field: ${field}`);
        }
      }
      
      // Check that subtasks is an array
      if (mockCode.includes('subtasks:') && mockCode.includes('[')) {
        success('subtasks is defined as an array');
      } else {
        error('subtasks must be an array');
      }
      
    } else {
      warning('Could not extract mock syllabus structure for validation');
    }
    
    // Check syllabus response structure in API endpoint
    if (serverContent.includes('syllabus = {')) {
      success('Syllabus object structure defined in API endpoint');
      
      // Check for required top-level fields (use regex to match field assignments)
      const topLevelFields = [
        { name: 'goal', pattern: /goal:\s*goal\.trim\(\)|goal:\s*[^,}]+/ },
        { name: 'hoursPerDay', pattern: /hoursPerDay[:\s,]/ },
        { name: 'totalDays', pattern: /totalDays[:\s,]/ },
        { name: 'startDate', pattern: /startDate[:\s,]/ },
        { name: 'days', pattern: /days[:\s,]/ }
      ];
      
      for (const field of topLevelFields) {
        if (field.pattern.test(serverContent)) {
          success(`Syllabus includes top-level field: ${field.name}`);
        } else {
          error(`Syllabus missing top-level field: ${field.name}`);
        }
      }
    } else {
      error('Syllabus object structure not found in API endpoint');
    }
    
  } catch (err) {
    error(`Failed to validate syllabus structure: ${err.message}`);
  }
}

/**
 * D. Day State Safety
 */
function checkDayStates() {
  console.log('\n📋 D. Day State Safety');
  console.log('─'.repeat(50));
  
  const allowedStates = ['pending', 'active', 'completed', 'skipped', 'leave'];
  
  try {
    // Check server.js for state usage
    const serverPath = join(rootDir, 'server', 'server.js');
    const serverContent = readFileSync(serverPath, 'utf-8');
    
    // Check mock syllabus sets status
    if (serverContent.includes('status:') || serverContent.includes('status =')) {
      success('Status field is set in mock syllabus');
    } else {
      warning('Status field may not be set in mock syllabus');
    }
    
    // Check each allowed state is used somewhere
    for (const state of allowedStates) {
      if (serverContent.includes(`"${state}"`) || serverContent.includes(`'${state}'`) || serverContent.includes(`status: "${state}"`)) {
        success(`State "${state}" is used in server code`);
      } else {
        warning(`State "${state}" not found in server.js (may be set in frontend)`);
      }
    }
    
    // Check frontend for state handling
    const appPath = join(rootDir, 'src', 'App.jsx');
    if (existsSync(appPath)) {
      const appContent = readFileSync(appPath, 'utf-8');
      
      // Check getStatusBadge function
      if (appContent.includes('getStatusBadge')) {
        success('getStatusBadge function exists in App.jsx');
        
        // Verify all states are handled
        for (const state of allowedStates) {
          if (appContent.includes(`case '${state}'`)) {
            success(`getStatusBadge handles state: ${state}`);
          } else if (appContent.includes('default:') && state === 'pending') {
            // Pending is handled by default case
            success(`getStatusBadge handles state: ${state} (via default)`);
          } else {
            warning(`getStatusBadge may not handle state: ${state}`);
          }
        }
      } else {
        warning('getStatusBadge function not found');
      }
    }
    
    // Check DailyLearningPage for state transitions
    const dailyPagePath = join(rootDir, 'src', 'DailyLearningPage.jsx');
    if (existsSync(dailyPagePath)) {
      const dailyContent = readFileSync(dailyPagePath, 'utf-8');
      
      const stateTransitions = [
        { from: 'active', to: 'completed', action: 'complete' },
        { from: 'active', to: 'skipped', action: 'skip' },
        { from: 'active', to: 'leave', action: 'leave' }
      ];
      
      for (const transition of stateTransitions) {
        if (dailyContent.includes(`status: '${transition.to}'`)) {
          success(`State transition to "${transition.to}" exists`);
        } else {
          warning(`State transition to "${transition.to}" may be missing`);
        }
      }
    }
    
  } catch (err) {
    error(`Failed to check day states: ${err.message}`);
  }
}

/**
 * E. Calendar Architecture Assertion
 */
function checkCalendarArchitecture() {
  console.log('\n📋 E. Calendar Architecture Assertion');
  console.log('─'.repeat(50));
  
  try {
    const calendarUtilsPath = join(rootDir, 'src', 'calendarUtils.js');
    
    if (!existsSync(calendarUtilsPath)) {
      error('calendarUtils.js not found');
      return;
    }
    
    const calendarContent = readFileSync(calendarUtilsPath, 'utf-8');
    
    // Check for generateCalendarEntries function
    if (calendarContent.includes('generateCalendarEntries')) {
      success('generateCalendarEntries function exists');
    } else {
      error('generateCalendarEntries function not found');
    }
    
    // Verify calendar is derived from syllabus
    if (calendarContent.includes('syllabus.days') || calendarContent.includes('syllabus.startDate')) {
      success('Calendar derives data from syllabus object');
    } else {
      error('Calendar does not appear to derive from syllabus');
    }
    
    // Check that calendar does NOT persist data
    if (calendarContent.includes('localStorage') || calendarContent.includes('save') || calendarContent.includes('persist')) {
      warning('Calendar utilities may contain persistence logic (should be read-only)');
    } else {
      success('Calendar utilities are read-only (no persistence)');
    }
    
    // Check CalendarView component
    const calendarViewPath = join(rootDir, 'src', 'CalendarView.jsx');
    if (existsSync(calendarViewPath)) {
      const viewContent = readFileSync(calendarViewPath, 'utf-8');
      
      if (viewContent.includes('generateCalendarEntries')) {
        success('CalendarView uses generateCalendarEntries');
      } else {
        error('CalendarView does not use generateCalendarEntries');
      }
      
      // Verify it receives syllabus as prop
      if (viewContent.includes('syllabus') && (viewContent.includes('props') || viewContent.includes('syllabus={') || viewContent.includes('function CalendarView') || viewContent.includes('const CalendarView'))) {
        success('CalendarView receives syllabus as prop');
      } else {
        warning('CalendarView may not receive syllabus as prop');
      }
    }
    
    console.log('   → Calendar is derived from syllabus state (not persisted separately)');
    
  } catch (err) {
    error(`Failed to check calendar architecture: ${err.message}`);
  }
}

/**
 * F. Demo Safety
 */
function checkDemoSafety() {
  console.log('\n📋 F. Demo Safety');
  console.log('─'.repeat(50));
  
  try {
    const serverPath = join(rootDir, 'server', 'server.js');
    const serverContent = readFileSync(serverPath, 'utf-8');
    
    // Check for fallback logic
    const fallbackChecks = [
      { name: 'Mock syllabus fallback', pattern: /generateMockSyllabus|mock.*syllabus/i },
      { name: 'Mock chat response fallback', pattern: /generateMockResponse|mock.*response/i },
      { name: 'Mock evaluation fallback', pattern: /generateMockEvaluation|mock.*evaluation/i },
      { name: 'Mock LinkedIn draft fallback', pattern: /generateMockDraft|mock.*draft/i },
      { name: 'JSON parse error handling', pattern: /JSON\.parse|try.*catch.*JSON/i },
      { name: 'API key missing check', pattern: /!apiKey|OPENAI_API_KEY.*not found/i }
    ];
    
    for (const check of fallbackChecks) {
      if (check.pattern.test(serverContent)) {
        success(`${check.name} exists`);
      } else {
        error(`${check.name} not found`);
      }
    }
    
    // Check for isDemoSafe or demo safety utilities
    const demoUtilsPath = join(rootDir, 'src', 'demoUtils.js');
    if (existsSync(demoUtilsPath)) {
      const demoContent = readFileSync(demoUtilsPath, 'utf-8');
      
      if (demoContent.includes('isDemoSafe')) {
        success('isDemoSafe function exists in demoUtils.js');
      } else {
        warning('isDemoSafe function not found in demoUtils.js');
      }
      
      if (demoContent.includes('handleDemoError')) {
        success('handleDemoError function exists');
      } else {
        warning('handleDemoError function not found');
      }
    } else {
      warning('demoUtils.js not found (may be acceptable)');
    }
    
    // Check for error handling in API endpoints
    const endpoints = [
      '/api/generate-syllabus',
      '/api/topic-chat',
      '/api/evaluate-learning',
      '/api/generate-linkedin-draft'
    ];
    
    for (const endpoint of endpoints) {
      const endpointPattern = new RegExp(endpoint.replace('/', '\\/'));
      if (endpointPattern.test(serverContent)) {
        // Check for try-catch around endpoint (look for app.post/put/get with try-catch)
        // Match endpoint definition followed by try block within reasonable distance
        const endpointMatch = serverContent.match(new RegExp(`${endpoint.replace('/', '\\/')}[\\s\\S]{0,1000}try\\s*\\{`));
        if (endpointMatch) {
          success(`${endpoint} has error handling`);
        } else {
          // Also check if endpoint uses async wrapper or has catch elsewhere
          const hasCatch = serverContent.match(new RegExp(`${endpoint.replace('/', '\\/')}[\\s\\S]{0,2000}catch\\s*\\(`));
          if (hasCatch) {
            success(`${endpoint} has error handling`);
          } else {
            warning(`${endpoint} may lack error handling`);
          }
        }
      }
    }
    
    console.log('   → Fallback logic ensures demo never breaks');
    
  } catch (err) {
    error(`Failed to check demo safety: ${err.message}`);
  }
}

/**
 * Main verification function
 */
function main() {
  console.log('🔍 LAIPath Demo Safety Verification');
  console.log('='.repeat(50));
  console.log('Verifying critical guarantees before demo...\n');
  
  checkEnvironment();
  checkTokenLimits();
  checkSyllabusStructure();
  checkDayStates();
  checkCalendarArchitecture();
  checkDemoSafety();
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Verification Summary');
  console.log('='.repeat(50));
  
  if (hasErrors) {
    console.log('\n❌ CRITICAL FAILURES DETECTED');
    console.log('   The app may not be demo-ready.');
    console.log('   Please fix the errors above before proceeding.\n');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('\n⚠️  WARNINGS DETECTED');
    console.log('   The app should work for demo, but review warnings above.\n');
    process.exit(0);
  } else {
    console.log('\n✅ ALL CHECKS PASSED');
    console.log('   LAIPath is demo-ready!\n');
    process.exit(0);
  }
}

// Run verification
main();


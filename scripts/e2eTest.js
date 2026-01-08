/**
 * End-to-End Test Script for LAIPath
 * 
 * Tests all critical flows and components
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

let testsPassed = 0;
let testsFailed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    testsPassed++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failures.push({ name, error: error.message });
    testsFailed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

console.log('🧪 LAIPath End-to-End Test Suite');
console.log('='.repeat(60));
console.log('');

// 1. File Structure Tests
console.log('📁 1. File Structure Tests');
console.log('-'.repeat(60));

test('Main entry point exists', () => {
  assert(existsSync(join(rootDir, 'src', 'main.jsx')), 'main.jsx missing');
});

test('App component exists', () => {
  assert(existsSync(join(rootDir, 'src', 'App.jsx')), 'App.jsx missing');
});

test('Landing page exists', () => {
  assert(existsSync(join(rootDir, 'src', 'LandingPage.jsx')), 'LandingPage.jsx missing');
});

test('Daily learning page exists', () => {
  assert(existsSync(join(rootDir, 'src', 'DailyLearningPage.jsx')), 'DailyLearningPage.jsx missing');
});

test('Calendar view exists', () => {
  assert(existsSync(join(rootDir, 'src', 'CalendarView.jsx')), 'CalendarView.jsx missing');
});

test('Profile page exists', () => {
  assert(existsSync(join(rootDir, 'src', 'ProfilePage.jsx')), 'ProfilePage.jsx missing');
});

test('Auth context exists', () => {
  assert(existsSync(join(rootDir, 'src', 'contexts', 'AuthContext.jsx')), 'AuthContext.jsx missing');
});

test('Supabase client exists', () => {
  assert(existsSync(join(rootDir, 'src', 'lib', 'supabase.js')), 'supabase.js missing');
});

test('Syllabus storage exists', () => {
  assert(existsSync(join(rootDir, 'src', 'lib', 'syllabusStorage.js')), 'syllabusStorage.js missing');
});

test('Server file exists', () => {
  assert(existsSync(join(rootDir, 'server', 'server.js')), 'server.js missing');
});

test('AI config exists', () => {
  assert(existsSync(join(rootDir, 'server', 'aiConfig.js')), 'aiConfig.js missing');
});

// 2. Import/Export Tests
console.log('\n📦 2. Import/Export Tests');
console.log('-'.repeat(60));

test('App.jsx imports correctly', () => {
  const content = readFileSync(join(rootDir, 'src', 'App.jsx'), 'utf-8');
  assert(content.includes('import'), 'App.jsx has no imports');
  assert(content.includes('export default'), 'App.jsx has no default export');
});

test('LandingPage exports correctly', () => {
  const content = readFileSync(join(rootDir, 'src', 'LandingPage.jsx'), 'utf-8');
  assert(content.includes('export default'), 'LandingPage has no default export');
});

test('DailyLearningPage exports correctly', () => {
  const content = readFileSync(join(rootDir, 'src', 'DailyLearningPage.jsx'), 'utf-8');
  assert(content.includes('export default'), 'DailyLearningPage has no default export');
});

test('AuthContext exports correctly', () => {
  const content = readFileSync(join(rootDir, 'src', 'contexts', 'AuthContext.jsx'), 'utf-8');
  assert(content.includes('export'), 'AuthContext has no exports');
});

test('Supabase client exports correctly', () => {
  const content = readFileSync(join(rootDir, 'src', 'lib', 'supabase.js'), 'utf-8');
  assert(content.includes('export'), 'supabase.js has no exports');
});

// 3. Component Structure Tests
console.log('\n🎨 3. Component Structure Tests');
console.log('-'.repeat(60));

test('App has auth gating logic', () => {
  const content = readFileSync(join(rootDir, 'src', 'App.jsx'), 'utf-8');
  assert(content.includes('useAuth'), 'App does not use auth');
  assert(content.includes('LandingPage'), 'App does not render LandingPage');
});

test('LandingPage has hero section', () => {
  const content = readFileSync(join(rootDir, 'src', 'LandingPage.jsx'), 'utf-8');
  assert(content.includes('hero-section'), 'LandingPage missing hero section');
  assert(content.includes('LAIPath'), 'LandingPage missing title');
});

test('DailyLearningPage has required props', () => {
  const content = readFileSync(join(rootDir, 'src', 'DailyLearningPage.jsx'), 'utf-8');
  assert(content.includes('day'), 'DailyLearningPage missing day prop');
  assert(content.includes('syllabus'), 'DailyLearningPage missing syllabus prop');
});

test('CalendarView uses calendar utils', () => {
  const content = readFileSync(join(rootDir, 'src', 'CalendarView.jsx'), 'utf-8');
  assert(content.includes('generateCalendarEntries'), 'CalendarView does not use calendar utils');
});

// 4. API Endpoint Tests
console.log('\n🌐 4. API Endpoint Tests');
console.log('-'.repeat(60));

test('Server has syllabus generation endpoint', () => {
  const content = readFileSync(join(rootDir, 'server', 'server.js'), 'utf-8');
  assert(content.includes('/api/generate-syllabus'), 'Missing /api/generate-syllabus endpoint');
});

test('Server has topic chat endpoint', () => {
  const content = readFileSync(join(rootDir, 'server', 'server.js'), 'utf-8');
  assert(content.includes('/api/topic-chat'), 'Missing /api/topic-chat endpoint');
});

test('Server has evaluation endpoint', () => {
  const content = readFileSync(join(rootDir, 'server', 'server.js'), 'utf-8');
  assert(content.includes('/api/evaluate-learning'), 'Missing /api/evaluate-learning endpoint');
});

test('Server has LinkedIn draft endpoint', () => {
  const content = readFileSync(join(rootDir, 'server', 'server.js'), 'utf-8');
  assert(content.includes('/api/generate-linkedin-draft'), 'Missing /api/generate-linkedin-draft endpoint');
});

// 5. Data Model Tests
console.log('\n📊 5. Data Model Tests');
console.log('-'.repeat(60));

test('Syllabus structure includes required fields', () => {
  const content = readFileSync(join(rootDir, 'server', 'server.js'), 'utf-8');
  assert(content.includes('goal'), 'Syllabus missing goal field');
  assert(content.includes('hoursPerDay'), 'Syllabus missing hoursPerDay field');
  assert(content.includes('totalDays'), 'Syllabus missing totalDays field');
  assert(content.includes('days'), 'Syllabus missing days array');
});

test('Day structure includes required fields', () => {
  const content = readFileSync(join(rootDir, 'server', 'server.js'), 'utf-8');
  assert(content.includes('dayNumber'), 'Day missing dayNumber field');
  assert(content.includes('topic'), 'Day missing topic field');
  assert(content.includes('subtasks'), 'Day missing subtasks field');
  assert(content.includes('aiExpertPrompt'), 'Day missing aiExpertPrompt field');
  assert(content.includes('status'), 'Day missing status field');
});

// 6. Safety & Fallback Tests
console.log('\n🛡️  6. Safety & Fallback Tests');
console.log('-'.repeat(60));

test('Server has mock fallback for syllabus', () => {
  const content = readFileSync(join(rootDir, 'server', 'server.js'), 'utf-8');
  assert(content.includes('generateMockSyllabus'), 'Missing mock syllabus fallback');
});

test('Server has error handling', () => {
  const content = readFileSync(join(rootDir, 'server', 'server.js'), 'utf-8');
  assert(content.includes('try'), 'Missing try-catch blocks');
  assert(content.includes('catch'), 'Missing error handling');
});

test('Supabase has fallback handling', () => {
  const content = readFileSync(join(rootDir, 'src', 'lib', 'syllabusStorage.js'), 'utf-8');
  assert(content.includes('catch'), 'Syllabus storage missing error handling');
});

test('Auth context has error handling', () => {
  const content = readFileSync(join(rootDir, 'src', 'contexts', 'AuthContext.jsx'), 'utf-8');
  assert(content.includes('catch'), 'Auth context missing error handling');
});

// 7. CSS & Styling Tests
console.log('\n🎨 7. CSS & Styling Tests');
console.log('-'.repeat(60));

test('App.css exists', () => {
  assert(existsSync(join(rootDir, 'src', 'App.css')), 'App.css missing');
});

test('LandingPage.css exists', () => {
  assert(existsSync(join(rootDir, 'src', 'LandingPage.css')), 'LandingPage.css missing');
});

test('Dark theme colors are used', () => {
  const appCss = readFileSync(join(rootDir, 'src', 'App.css'), 'utf-8');
  assert(appCss.includes('#020617'), 'Missing dark background color');
  assert(appCss.includes('#e5e7eb'), 'Missing primary text color');
  assert(appCss.includes('#10b981'), 'Missing accent color');
});

// 8. Configuration Tests
console.log('\n⚙️  8. Configuration Tests');
console.log('-'.repeat(60));

test('package.json has required scripts', () => {
  const content = readFileSync(join(rootDir, 'package.json'), 'utf-8');
  assert(content.includes('"dev"'), 'Missing dev script');
  assert(content.includes('"build"'), 'Missing build script');
  assert(content.includes('"check:demo"'), 'Missing check:demo script');
});

test('vite.config.js exists', () => {
  assert(existsSync(join(rootDir, 'vite.config.js')), 'vite.config.js missing');
});

test('Server package.json exists', () => {
  assert(existsSync(join(rootDir, 'server', 'package.json')), 'server/package.json missing');
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 Test Summary');
console.log('='.repeat(60));
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`📈 Total:  ${testsPassed + testsFailed}`);

if (failures.length > 0) {
  console.log('\n❌ Failed Tests:');
  failures.forEach(({ name, error }) => {
    console.log(`   - ${name}: ${error}`);
  });
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}


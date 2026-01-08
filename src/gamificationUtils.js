/**
 * Gamification Utilities
 * 
 * Derived gamification logic based on syllabus progress.
 * All values are computed from existing syllabus_days state.
 * NO data storage - all values calculated on-the-fly.
 * 
 * Functions accept raw syllabus_days array and return computed values only.
 * NO side effects.
 */

/**
 * Calculate XP from days array
 * 
 * Rules:
 * - +10 XP for each completed day
 * - +5 XP bonus for each streak day (completed days in a streak)
 * - Skip and leave give 0 XP
 * 
 * @param {Array} days - Array of day objects with status field
 * @returns {number} Total XP
 */
export function calculateXP(days) {
  if (!days || !Array.isArray(days) || days.length === 0) {
    return 0;
  }
  
  // First, calculate streak to identify streak days
  const streak = calculateStreak(days);
  
  let xp = 0;
  let streakCompletedCount = 0; // Count of completed days in the streak
  
  // Process all days in order
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    
    if (day.status === 'completed') {
      // Base XP for completed day
      xp += 10;
      
      // Bonus XP if this completed day is part of the streak
      // Streak counts consecutive completed days (skipping over leave days)
      if (streakCompletedCount < streak) {
        xp += 5; // Streak bonus
        streakCompletedCount++;
      }
    } else if (day.status === 'skipped') {
      // Skipped day breaks streak - no more streak bonuses after this
      // But we've already given bonuses to all streak days before this
      break;
    }
    // Leave days don't break streak and don't give XP (continue to next day)
    // Other statuses (pending, active) also don't give XP
  }
  
  return xp;
}

/**
 * Calculate streak (consecutive completed days ending today)
 * 
 * Rules:
 * - Count consecutive completed days from the start
 * - Reset streak on skipped days
 * - Leave does NOT break streak (treated as if it doesn't exist)
 * 
 * @param {Array} days - Array of day objects with status field
 * @returns {number} Current streak count
 */
export function calculateStreak(days) {
  if (!days || !Array.isArray(days) || days.length === 0) {
    return 0;
  }
  
  let streak = 0;
  
  // Count consecutive completed days from the start
  // Streak ends when we hit a skipped day
  // Leave does NOT break streak (we skip over it and continue)
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    
    if (day.status === 'completed') {
      streak++;
    } else if (day.status === 'skipped') {
      // Streak breaks on skipped day
      break;
    } else if (day.status === 'leave') {
      // Leave does NOT break streak - skip over it and continue
      // (Leave days don't add to streak count, but don't break it)
      continue;
    } else {
      // Any other status (pending, active) breaks the streak
      break;
    }
  }
  
  return streak;
}

/**
 * Calculate level from XP
 * 
 * Formula: Level = floor(XP / 100) + 1
 * 
 * @param {number} xp - Total XP
 * @returns {number} Current level
 */
export function calculateLevel(xp) {
  if (typeof xp !== 'number' || xp < 0) {
    return 1;
  }
  
  return Math.floor(xp / 100) + 1;
}

/**
 * Calculate milestone name based on level
 * 
 * Milestones:
 * - Level 1: "Beginner"
 * - Level 3: "Consistent"
 * - Level 5: "Focused"
 * - Level 8: "Advanced"
 * - Level 12: "Elite"
 * 
 * @param {number} level - Current level
 * @returns {string} Milestone name
 */
export function calculateMilestones(level) {
  if (typeof level !== 'number' || level < 1) {
    return 'Beginner';
  }
  
  if (level >= 12) {
    return 'Elite';
  } else if (level >= 8) {
    return 'Advanced';
  } else if (level >= 5) {
    return 'Focused';
  } else if (level >= 3) {
    return 'Consistent';
  } else {
    return 'Beginner';
  }
}

/**
 * Calculate XP needed for next level
 * Helper function for progress calculation
 * 
 * @param {number} currentLevel - Current level
 * @returns {number} XP needed for next level
 */
export function getXPForNextLevel(currentLevel) {
  if (typeof currentLevel !== 'number' || currentLevel < 1) {
    return 100;
  }
  
  return currentLevel * 100;
}

/**
 * Calculate XP progress to next level
 * Returns percentage (0-100)
 * 
 * @param {number} xp - Current XP
 * @param {number} currentLevel - Current level
 * @returns {number} Progress percentage (0-100)
 */
export function getXPProgress(xp, currentLevel) {
  if (typeof xp !== 'number' || xp < 0) {
    return 0;
  }
  
  if (typeof currentLevel !== 'number' || currentLevel < 1) {
    return 0;
  }
  
  const xpForCurrentLevel = (currentLevel - 1) * 100;
  const xpForNextLevel = currentLevel * 100;
  const xpInCurrentLevel = xp - xpForCurrentLevel;
  const xpNeededForNext = xpForNextLevel - xpForCurrentLevel;
  
  return Math.min(100, Math.max(0, (xpInCurrentLevel / xpNeededForNext) * 100));
}

/**
 * Calculate longest streak from days array
 * Finds the maximum consecutive completed days across the entire array
 * 
 * Rules:
 * - Count consecutive completed days
 * - Leave does NOT break streak (skipped over)
 * - Skip and other statuses reset the streak
 * 
 * @param {Array} days - Array of day objects with status field
 * @returns {number} Longest streak count
 */
export function calculateLongestStreak(days) {
  if (!days || !Array.isArray(days) || days.length === 0) {
    return 0;
  }
  
  let longestStreak = 0;
  let currentStreak = 0;
  
  // Find the longest consecutive sequence of completed days
  // Leave does NOT break streak (we skip over it)
  // Skip and other statuses reset the current streak
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    
    if (day.status === 'completed') {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else if (day.status === 'leave') {
      // Leave does NOT break streak - skip over it and continue
      continue;
    } else {
      // Skipped, pending, active, or any other status resets current streak
      currentStreak = 0;
    }
  }
  
  return longestStreak;
}

/**
 * Calendar Utilities
 * 
 * Day 4: Calendar data derivation from syllabus
 * 
 * The calendar is READ-ONLY and derived entirely from syllabus data.
 * It acts as a living mirror of the syllabus state.
 */

// Hardcoded user (no auth)
const USER = {
  id: "demo_user",
  name: "Demo User",
  preferredStudyTime: "20:00"  // 8 PM
};

/**
 * Generate calendar entries from syllabus
 * 
 * Rules:
 * - Calendar is derived, never manually stored
 * - Date calculated from syllabus.startDate + dayNumber + shifts
 * - Time from user.preferredStudyTime
 * - Notes generated from topic + subtasks
 * 
 * @param {Object} syllabus - The syllabus object with days array
 * @returns {Array} Array of calendar entries
 */
export function generateCalendarEntries(syllabus) {
  if (!syllabus || !syllabus.days || syllabus.days.length === 0) {
    return [];
  }

  const entries = [];
  const startDate = new Date(syllabus.startDate);
  startDate.setHours(0, 0, 0, 0);

  syllabus.days.forEach((day) => {
    // Date is already calculated in syllabus (accounts for skip/leave shifts)
    const entryDate = new Date(day.date);
    
    // Generate notes from topic and subtasks
    const notes = generateNotes(day.topic, day.subtasks);
    
    entries.push({
      date: day.date,  // Already includes skip/leave shifts
      time: USER.preferredStudyTime,
      dayNumber: day.dayNumber,
      topic: day.topic,
      notes: notes,
      status: day.status  // Include status for highlighting
    });
  });

  return entries;
}

/**
 * Generate notes from topic and subtasks
 * Creates a short summary for calendar display
 */
function generateNotes(topic, subtasks) {
  if (!subtasks || subtasks.length === 0) {
    return `Focus on ${topic}`;
  }
  
  // Join subtasks with commas, limit length
  const subtasksText = subtasks.join(', ');
  const maxLength = 100;
  
  if (subtasksText.length <= maxLength) {
    return subtasksText;
  }
  
  return subtasksText.substring(0, maxLength - 3) + '...';
}

/**
 * Generate iCal format text from calendar entries
 * 
 * This is a SIMULATED export for demonstration only.
 * Not a real Google Calendar sync.
 * 
 * Includes status tags (completed, skipped, leave) in the description.
 * 
 * @param {Array} entries - Calendar entries with status
 * @returns {string} iCal-formatted text
 */
export function generateICalText(entries) {
  if (!entries || entries.length === 0) {
    return 'No calendar entries to export.';
  }

  let ical = 'BEGIN:VCALENDAR\n';
  ical += 'VERSION:2.0\n';
  ical += 'PRODID:-//Adaptive Learning System//EN\n';
  ical += 'CALSCALE:GREGORIAN\n';
  ical += 'METHOD:PUBLISH\n\n';

  entries.forEach((entry) => {
    // Convert date and time to iCal format (YYYYMMDDTHHMMSS)
    const dateTime = formatDateTimeForICal(entry.date, entry.time);
    
    // Build status tag
    let statusTag = '';
    if (entry.status === 'completed') {
      statusTag = '[COMPLETED] ';
    } else if (entry.status === 'skipped') {
      statusTag = '[SKIPPED] ';
    } else if (entry.status === 'leave') {
      statusTag = '[LEAVE] ';
    } else if (entry.status === 'active') {
      statusTag = '[ACTIVE] ';
    }
    
    // Build description with status and notes
    const description = `${statusTag}${entry.notes}`;
    
    ical += 'BEGIN:VEVENT\n';
    ical += `UID:day-${entry.dayNumber}-${entry.date}@learning-system\n`;
    ical += `DTSTART:${dateTime}\n`;
    ical += `DTEND:${dateTime}\n`;  // Same as start (1-hour event implied)
    ical += `SUMMARY:Day ${entry.dayNumber} – ${entry.topic}\n`;
    ical += `DESCRIPTION:${description}\n`;
    
    // Add status as a category for better filtering
    if (entry.status) {
      ical += `CATEGORIES:${entry.status.toUpperCase()}\n`;
    }
    
    ical += 'STATUS:CONFIRMED\n';
    ical += 'SEQUENCE:0\n';
    ical += 'END:VEVENT\n\n';
  });

  ical += 'END:VCALENDAR\n';
  return ical;
}

/**
 * Format date and time for iCal format
 * Converts "2026-01-10" and "20:00" to "20260110T200000"
 */
function formatDateTimeForICal(dateStr, timeStr) {
  // dateStr format: "2026-01-10"
  // timeStr format: "20:00"
  const date = dateStr.replace(/-/g, '');  // "20260110"
  const time = timeStr.replace(/:/g, '') + '00';  // "200000"
  return `${date}T${time}`;
}

/**
 * Get today's date in YYYY-MM-DD format
 * For this app, "today" is always Day 1's date (the original start date)
 * This keeps the reference point consistent regardless of skip/leave shifts
 */
export function getTodayDate(syllabus) {
  // If syllabus provided, use Day 1's date as "today"
  // This ensures "today" always refers to the original start date
  if (syllabus && syllabus.startDate) {
    return syllabus.startDate;
  }
  
  // Fallback to actual today if no syllabus
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().split('T')[0];
}


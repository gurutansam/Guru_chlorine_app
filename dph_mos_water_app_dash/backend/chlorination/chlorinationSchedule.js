// scripts/chlorinationSchedule.js
import db from '../utils/db.js';

const REQUIRED_READINGS = 11;
const cycles = [1, 2];

console.log('\n🧪 Chlorination Prediction Started');

const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const tomorrowStr = tomorrow.toISOString().split('T')[0];

// Step 1: Fetch districts and active officers
const districts = db.prepare(`SELECT * FROM district_table`).all();
const officers = db.prepare(`SELECT * FROM district_officer_table WHERE status = 'active'`).all();

if (!officers.length) {
  console.log('⚠️ No active officers found.');
  process.exit();
}

const pending = [];

for (const d of districts) {
  for (const cycle of cycles) {
    const count = db.prepare(`
      SELECT COUNT(*) as count FROM datacollection
      WHERE district_name = ? AND areaType = ?
    `).get(d.district_name, `Cycle ${cycle}`);

    if (count.count < REQUIRED_READINGS) {
      pending.push({
        district_code: d.district_code,
        district_name: d.district_name,
        cycle
      });
    }
  }
}

// Distribute tasks to officers
let i = 0;
for (const task of pending) {
  const officer = officers[i % officers.length];

  db.prepare(`
    INSERT INTO scheduled_tasks
    (user_id, username, district_code, district_name, cycle, date_assigned)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    officer.user_id,
    officer.username,
    task.district_code,
    task.district_name,
    task.cycle,
    tomorrowStr
  );

  console.log(`✅ Assigned: ${officer.username} → ${task.district_name} (Cycle ${task.cycle}) on ${tomorrowStr}`);
  i++;
}

console.log('✅ Chlorination Prediction Completed\n');

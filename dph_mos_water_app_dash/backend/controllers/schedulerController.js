// const db = require('./db');
import db from '../utils/db.js';
import fs from 'fs';
import path from 'path';
const { sendNotification } = require('./notifications');

function getReadingsCount(district_id, cycle) {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT COUNT(*) as count FROM readings WHERE district_id = ? AND cycle = ?`,
      [district_id, cycle],
      (err, row) => {
        if (err) reject(err);
        else resolve(row.count);
      }
    );
  });
}

function getUsersByHub(hub_id) {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM users WHERE hub_id = ?`, [hub_id], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function scheduleTasks() {
  const hubs = [1, 2, 3, 4];
  const districtsPerHub = 11;
  const cycles = [1, 2];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateStr = tomorrow.toISOString().split('T')[0];

  for (const hub_id of hubs) {
    const users = await getUsersByHub(hub_id);
    if (!users.length) continue;

    const pendingTasks = [];

    for (let district = 1; district <= districtsPerHub; district++) {
      for (const cycle of cycles) {
        const count = await getReadingsCount(district, cycle);
        if (count < 11) {
          pendingTasks.push({ district_id: district, cycle });
        }
      }
    }

    // Assign districts evenly
    for (let i = 0; i < pendingTasks.length; i++) {
      const user = users[i % users.length];
      const task = pendingTasks[i];

      // Save assignment
      db.run(
        `INSERT INTO scheduled_tasks (user_id, district_id, hub_id, cycle, date_assigned)
         VALUES (?, ?, ?, ?, ?)`,
        [user.id, task.district_id, hub_id, task.cycle, dateStr]
      );
    }

    // Notify each user
    for (const user of users) {
      db.all(
        `SELECT * FROM scheduled_tasks WHERE user_id = ? AND date_assigned = ?`,
        [user.id, dateStr],
        (err, tasks) => {
          if (!err && tasks.length) {
            sendNotification(user, tasks);
          }
        }
      );
    }
  }

  console.log('✅ Task scheduling completed.');
}

module.exports = { scheduleTasks };

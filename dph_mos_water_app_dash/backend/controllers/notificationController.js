function sendNotification(user, tasks) {
  const msg = `Hello ${user.name}, you are assigned to:
${tasks.map(t => `District ${t.district_id}, Cycle ${t.cycle}`).join('\n')}`;
  console.log(`📲 Sending SMS to ${user.phone}:\n${msg}`);
}

module.exports = { sendNotification };

// scripts/seed-main.js
import dbPromise from '../utils/db.js'; // db.js exports a Promise
import bcrypt from 'bcryptjs';

export async function seedAdmins() {
  // Wait for the connection
  const db = await dbPromise;
console.log('Script started');
  const admins = [
    {
      user_id: 'MOSADMIN001',
      email: 'mosadmin@example.com',
      username: 'mosadmin@example.com',
      password: 'Mosquito@123',
      role: 'mos_admin',
      module: 'mosquito'
    },
    {
      user_id: 'CHLADMIN001',
      email: 'dphepi@nic.in',
      username: 'dphepi@nic.in',
      password: 'Chlorine@123',
      role: 'chl_admin',
      module: 'chlorination'
    },
  ];

  for (const admin of admins) {
    try {
      const hashedPassword = await bcrypt.hash(admin.password, 10);

      const [result] = await db.execute(`
        INSERT INTO admin_users (
          user_id, email, username, password, role, module, district_name, block_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          email = VALUES(email),
          username = VALUES(username),
          password = VALUES(password),
          role = VALUES(role),
          module = VALUES(module),
          district_name = VALUES(district_name),
          block_name = VALUES(block_name)
      `, [
        admin.user_id,
        admin.email,
        admin.username,
        hashedPassword,
        admin.role,
        admin.module,
        admin.district_name || null,
        admin.block_name || null,
      ]);

      if (result.affectedRows === 1) {
        console.log(`Inserted new user: ${admin.username}`);
      } else {
        console.log(`Updated existing user: ${admin.username}`);
      }

    } catch (err) {
      console.error(`Error inserting/updating ${admin.username}:`, err);
    }
  }

  console.log('Admin users seeding complete.');
}

seedAdmins().catch(err => console.error('Error in seeding admins:', err));

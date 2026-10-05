// scripts/seed-zet-users.js
import dbPromise from '../utils/db.js'; // db.js exports a Promise
import bcrypt from 'bcryptjs';

export async function seedZetUsers() {
  // Wait for the connection
  const db = await dbPromise;
  console.log('ZET seeding script started');

  const zets = [
    {
      user_id: 'ZET001',
      email: 'zet_cbe@yahoo.com',
      username: 'zet_cbe@yahoo.com',
      password: 'Zet@123',
      role: 'special_user',
      module: 'mosquito',
      district_name: 'Coimbatore',
      block_name: null
    },
    {
      user_id: 'ZET002',
      email: 'vbdcpzetcud@yahoo.co.in',
      username: 'vbdcpzetcud@yahoo.co.in',
      password: 'Zet@123',
      role: 'special_user',
      module: 'mosquito',
      district_name: 'Cuddalore',
      block_name: null
    },
    {
      user_id: 'ZET003',
      email: 'sezetdgl@yahoo.com',
      username: 'sezetdgl@yahoo.com',
      password: 'Zet@123',
      role: 'special_user',
      module: 'mosquito',
      district_name: 'Dindigul',
      block_name: null
    },
    {
      user_id: 'ZET004',
      email: 'sezetslm@yahoo.com',
      username: 'sezetslm@yahoo.com',
      password: 'Zet@123',
      role: 'special_user',
      module: 'mosquito',
      district_name: 'Salem',
      block_name: null
    },
    {
      user_id: 'ZET005',
      email: 'zettnj@yahoo.co.in',
      username: 'zettnj@yahoo.co.in',
      password: 'Zet@123',
      role: 'special_user',
      module: 'mosquito',
      district_name: 'Thanjavur',
      block_name: null
    },
    {
      user_id: 'ZET006',
      email: 'zettrichy@gmail.com',
      username: 'zettrichy@gmail.com',
      password: 'Zet@123',
      role: 'special_user',
      module: 'mosquito',
      district_name: 'Trichy',
      block_name: null
    },
    {
      user_id: 'ZET007',
      email: 'zettnv@gmail.com',
      username: 'zettnv@gmail.com',
      password: 'Zet@123',
      role: 'special_user',
      module: 'mosquito',
      district_name: 'Tirunelveli',
      block_name: null
    },
    {
      user_id: 'ZET008',
      email: 'sezetvellore@gmail.com',
      username: 'sezetvellore@gmail.com',
      password: 'Zet@123',
      role: 'special_user',
      module: 'mosquito',
      district_name: 'Vellore',
      block_name: null
    },
    {
      user_id: 'ZET009',
      email: 'zetvnr@yahoo.com',
      username: 'zetvnr@yahoo.com',
      password: 'Zet@123',
      role: 'special_user',
      module: 'mosquito',
      district_name: 'Virudhunagar',
      block_name: null
    },
  ];

  for (const zet of zets) {
    try {
      const hashedPassword = await bcrypt.hash(zet.password, 10);

      const [result] = await db.execute(`
        INSERT INTO admin_users (
          user_id,
          email,
          username,
          password,
          role,
          module,
          district_name,
          block_name
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
        zet.user_id,
        zet.email,
        zet.username,
        hashedPassword,
        zet.role,
        zet.module,
        zet.district_name,
        zet.block_name,
      ]);

      if (result.affectedRows === 1) {
        console.log(`Inserted new ZET user: ${zet.username}`);
      } else {
        console.log(`Updated existing ZET user: ${zet.username}`);
      }

    } catch (err) {
      console.error(`Error inserting/updating ${zet.username}:`, err);
    }
  }

  console.log('ZET users seeding complete.');
}

seedZetUsers().catch(err =>
  console.error('Error in seeding ZET users:', err)
);

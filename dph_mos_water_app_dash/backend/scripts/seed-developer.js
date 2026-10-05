// scripts/seed-developer.js
import dbPromise from "../utils/db.js"; // db.js exports a Promise
import bcrypt from "bcryptjs";

export async function seedDeveloper() {
  // Wait for DB connection
  const db = await dbPromise;
  console.log("Developer seed script started");

  const developers = [
    {
      user_id: "DEV001",
      email: "aravindhshankar@tansam.org",
      username: "Aravindh Shankar",
      password: "Tansam@123",
      role: "DEVELOPER",
    },
  ];

  for (const dev of developers) {
    try {
      const hashedPassword = await bcrypt.hash(dev.password, 10);

      const [result] = await db.execute(
        `
        INSERT INTO developer_users (
          user_id, email, username, password, role
        ) VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          email = VALUES(email),
          username = VALUES(username),
          password = VALUES(password),
          role = VALUES(role)
      `,
        [
          dev.user_id,
          dev.email,
          dev.username,
          hashedPassword,
          dev.role,
        ]
      );

      if (result.affectedRows === 1) {
        console.log(`Inserted new developer: ${dev.username}`);
      } else {
        console.log(`Updated existing developer: ${dev.username}`);
      }
    } catch (err) {
      console.error(`Error inserting/updating ${dev.username}:`, err);
    }
  }

  console.log("Developer seeding complete.");
}

// Run directly
seedDeveloper().catch((err) =>
  console.error("Error in seeding developer:", err)
);

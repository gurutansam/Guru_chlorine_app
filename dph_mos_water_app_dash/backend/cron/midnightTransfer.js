import cron from "node-cron";
import db from "../utils/db.js";
import sendMail from "../utils/sendMail.js";
import { getPreTransferEmailTemplate, getPostTransferEmailTemplate } from "./mail/transferTemplate.js";

const getTableCounts = async () => {
  const [[{ count: newCount }]] = await db.query("SELECT COUNT(*) as count FROM chlorine_hud_data_collection_new");
  const [[{ count: mainCount }]] = await db.query("SELECT COUNT(*) as count FROM chlorine_hud_data_collection");
  return { newCount, mainCount };
};

export const runPreTransferNotification = async () => {
  console.log("⏳ Running 11:00 PM pre-transfer notification...");
  try {
    const { newCount, mainCount } = await getTableCounts();
    const dateStr = new Date().toLocaleDateString();
    
    await sendMail({
      to: 'aravindhshankar@tansam.org',
      cc: 'hannahr@tansam.org',
      subject: `Pre-Transfer Report - ${dateStr}`,
      html: getPreTransferEmailTemplate(newCount, mainCount, dateStr)
    });
    console.log("✅ Pre-transfer notification sent.");
  } catch (error) {
    console.error("❌ Pre-transfer notification error:", error);
  }
};

export const runTransferJob = async () => {
  console.log("⏳ Running 11:45 PM DB transfer job...");
  try {
    // 1. Get BEFORE counts
    const beforeCounts = await getTableCounts();

    // 2. Do Transfer
    const query = `
      INSERT INTO chlorine_hud_data_collection (
        ppm, actualPPM, samplingPoint, image_path, latitude, longitude, 
        timestamp, address, block_id, block_name, hud_id, hud_name, user_id, username
      )
      SELECT 
        ppm, actualPPM, samplingPoint, image_path, latitude, longitude, 
        timestamp, address, block_id, block_name, hud_id, hud_name, user_id, username
      FROM chlorine_hud_data_collection_new
    `;
    const [result] = await db.query(query);
    const transferCount = result.affectedRows;
    console.log(`✅ Transferred ${transferCount} rows to chlorine_hud_data_collection.`);
    
    // 3. Empty the 'new' table
    await db.query("DELETE FROM chlorine_hud_data_collection_new");
    console.log("✅ Emptied chlorine_hud_data_collection_new table.");

    // 4. Get AFTER counts
    const afterCounts = await getTableCounts();

    // 5. Send confirmation email with before/after comparison
    const dateStr = new Date().toLocaleDateString();
    await sendMail({
      to: 'aravindhshankar@tansam.org',
      cc: 'hannahr@tansam.org',
      subject: `Post-Transfer Complete - ${dateStr}`,
      html: getPostTransferEmailTemplate(
        beforeCounts.newCount, beforeCounts.mainCount, 
        transferCount, 
        afterCounts.newCount, afterCounts.mainCount, 
        dateStr
      )
    });
  } catch (error) {
    console.error("❌ DB transfer job error:", error);
  }
};

export const initMidnightTransferJob = () => {
  // 11:00 PM Job - Pre-transfer counts
  cron.schedule("0 23 * * *", () => {
    console.log("⏰ Triggering 11:00 PM pre-transfer notification...");
    runPreTransferNotification();
  });

  // 11:45 PM Job - Transfer and post-transfer counts
  cron.schedule("45 23 * * *", () => {
    console.log("⏰ Triggering 11:45 PM DB transfer job...");
    runTransferJob();
  });
};

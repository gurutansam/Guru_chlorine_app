export const getPreTransferEmailTemplate = (newCount, mainCount, dateStr) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
        <h2 style="color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px;">
          Pre-Transfer Data Report
        </h2>
        
        <p style="font-size: 16px;">Hello Admin,</p>
        <p style="font-size: 16px;">Here is the database status as of 11:00 PM on <strong>${dateStr}</strong>, before the auto-transfer begins.</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 16px;">
          <tr style="background-color: #3498db; color: white; text-align: left;">
            <th style="padding: 12px; border: 1px solid #ddd;">Table</th>
            <th style="padding: 12px; border: 1px solid #ddd;">Current Count</th>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd;">Main Table (Overall Data)</td>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold;">${mainCount}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd;">New Table (Today's Data)</td>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; color: #e67e22;">${newCount}</td>
          </tr>
        </table>
        
        <p style="font-size: 12px; color: #95a5a6; margin-top: 40px; border-top: 1px solid #e9ecef; padding-top: 10px;">
          This is an automated system notification. Please do not reply directly to this email.
        </p>
      </div>
    </div>
  `;
};

export const getPostTransferEmailTemplate = (beforeNew, beforeMain, transferCount, afterNew, afterMain, dateStr) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; max-width: 600px; margin: auto;">
      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #e9ecef;">
        <h2 style="color: #2c3e50; border-bottom: 2px solid #2ecc71; padding-bottom: 10px;">
          Post-Transfer Data Report
        </h2>
        
        <p style="font-size: 16px;">Hello Admin,</p>
        <p style="font-size: 16px;">The daily database transfer has completed successfully for <strong>${dateStr}</strong>.</p>
        
        <div style="background-color: #ffffff; border-left: 4px solid #2ecc71; padding: 15px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
          <p style="margin: 0; font-size: 18px; color: #2c3e50;">
            <strong>Rows Transferred:</strong> <span style="color: #2ecc71;">${transferCount}</span>
          </p>
        </div>

        <h3 style="color: #2c3e50; margin-top: 30px;">Before vs After Comparison</h3>
        <table style="width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 16px;">
          <tr style="background-color: #34495e; color: white; text-align: left;">
            <th style="padding: 12px; border: 1px solid #ddd;">Table</th>
            <th style="padding: 12px; border: 1px solid #ddd;">Before Transfer</th>
            <th style="padding: 12px; border: 1px solid #ddd;">After Transfer</th>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd;">Main Table (Overall)</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${beforeMain}</td>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; color: #2ecc71;">${afterMain}</td>
          </tr>
          <tr>
            <td style="padding: 12px; border: 1px solid #ddd;">New Table (Today's)</td>
            <td style="padding: 12px; border: 1px solid #ddd;">${beforeNew}</td>
            <td style="padding: 12px; border: 1px solid #ddd; font-weight: bold; color: #e74c3c;">${afterNew}</td>
          </tr>
        </table>
        
        <p style="font-size: 12px; color: #95a5a6; margin-top: 40px; border-top: 1px solid #e9ecef; padding-top: 10px;">
          This is an automated system notification. Please do not reply directly to this email.
        </p>
      </div>
    </div>
  `;
};

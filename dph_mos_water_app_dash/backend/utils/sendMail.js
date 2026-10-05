import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: process.env.MAIL_PORT || 587,
  secure: process.env.MAIL_PORT == 465, // true for 465, false for other ports
  auth: {
    user: process.env.MAIL_USERNAME,
    pass: process.env.MAIL_PASSWORD?.replace(/['"]/g, ''), // remove quotes from env if any
  },
});

const sendMail = async ({ to, cc, subject, text, html }) => {
const mailOptions = {
  from: process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME,
  to,
  cc,
  subject,
  text,
  html,
  replyTo: process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME,
  headers: {
    'X-Laziness-level': 1000,
    'X-Content-Type-Options': 'nosniff'
  }
};


  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}`);
  } catch (error) {
    console.error(`❌ Email send failed to ${to}:`, error);
  }
};

export default sendMail;

// test-email.js
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'arvindhshankar98@gmail.com',
    pass: 'ecgo dibn kfut tywm',
  },
});

transporter.sendMail({
  from: 'arvindhshankar98@gmail.com',
  to: 'xarih78597@axcradio.com',
  subject: 'Test Mail',
  text: 'Hello! This is a test email.',
}, (err, info) => {
  if (err) return console.error('❌ Error:', err);
  console.log('✅ Sent:', info.response);
});

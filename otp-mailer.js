/**
 * otp-mailer.js — KisaanConnect Professional Email Service
 *
 * PRIMARY:  Resend API (HTTPS/443 — most reliable)
 * FALLBACK: Gmail SMTP (SSL/465 — high deliverability)
 */

'use strict';

const nodemailer = require('nodemailer');

let transporter = null;
let smtpReady   = false;

// ── PROFESSIONAL HTML EMAIL WRAPPER ──────────────────────────────────────────
function buildEmailTemplate(title, content, actionText, actionUrl) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
    body { margin: 0; padding: 0; background-color: #f8fafc; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { width: 100%; table-layout: fixed; background-color: #f8fafc; padding: 40px 0; }
    .main-card { max-width: 540px; margin: 0 auto; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.03); border: 1px solid #e2e8f0; }
    .header { background: linear-gradient(135deg, #059669, #10b981); padding: 48px 32px; text-align: center; }
    .logo-icon { font-size: 54px; margin-bottom: 12px; display: block; }
    .brand-name { color: #ffffff; font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin: 0; }
    .brand-tagline { color: rgba(255,255,255,0.9); font-size: 13px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; margin-top: 8px; }
    .content-area { padding: 48px 40px; color: #1e293b; line-height: 1.6; }
    .content-area h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin: 0 0 16px; }
    .content-area p { font-size: 16px; margin: 0 0 24px; }
    .otp-display { background: #f0fdf4; border: 2px dashed #059669; border-radius: 16px; padding: 32px; text-align: center; margin: 32px 0; }
    .otp-code { font-family: 'Monaco', 'Courier New', monospace; font-size: 48px; font-weight: 800; color: #065f46; letter-spacing: 12px; margin: 0; }
    .cta-button { display: inline-block; background: #059669; color: #ffffff !important; padding: 16px 36px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px; margin: 8px 0; box-shadow: 0 10px 20px rgba(5,150,105,0.2); }
    .footer { background: #f1f5f9; padding: 32px 40px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer p { font-size: 12px; color: #64748b; margin: 0 0 8px; line-height: 1.5; }
    .footer a { color: #059669; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="main-card">
      <div class="header">
        <span class="logo-icon">🌾</span>
        <h2 class="brand-name">KisaanConnect</h2>
        <div class="brand-tagline">Direct Farm-to-Home</div>
      </div>
      <div class="content-area">
        ${content}
        ${actionText && actionUrl ? `<div style="text-align: center; margin-top: 32px;"><a href="${actionUrl}" class="cta-button">${actionText}</a></div>` : ''}
      </div>
      <div class="footer">
        <p>Connecting Indian Farmers with Customers Directly 🇮🇳</p>
        <p>© 2026 KisaanConnect Platform. All rights reserved.</p>
        <p>Support: <a href="mailto:support@kisaanconnect.com">support@kisaanconnect.com</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function buildOTPHtml(otp, userName) {
  const content = `
    <h1>Verify Your Identity</h1>
    <p>Hello <strong>${userName}</strong>,</p>
    <p>We received a request to access your KisaanConnect account. Please use the verification code below to proceed. This code will expire in 10 minutes.</p>
    <div class="otp-display">
      <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 2px; color: #059669; font-weight: 700; margin-bottom: 8px;">Your Verification Code</div>
      <h2 class="otp-code">${otp}</h2>
    </div>
    <p style="font-size: 14px; color: #64748b;">If you didn't request this code, you can safely ignore this email. Someone may have typed your email address by mistake.</p>
  `;
  return buildEmailTemplate('KisaanConnect Verification', content);
}

function buildWelcomeHtml(userName, role) {
  const isFarmer = role.toLowerCase() === 'farmer';
  const roleTitle = isFarmer ? 'Farmer Partner' : 'Valued Customer';
  const content = `
    <h1>Welcome to the Green Revolution! 🌱</h1>
    <p>Namaste <strong>${userName}</strong>,</p>
    <p>We're honored to have you join KisaanConnect as a <strong>${roleTitle}</strong>. You are now part of a community that values fresh produce, fair pricing, and direct connections.</p>
    <div style="background: #f8fafc; border-radius: 16px; padding: 24px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
      <h3 style="margin-top: 0; color: #059669;">What's next?</h3>
      <ul style="padding-left: 20px; margin-bottom: 0;">
        ${isFarmer
          ? `<li>List your fresh harvest and reach thousands of local customers.</li>
             <li>Get fair market prices directly without any middlemen.</li>
             <li>Use KisaanAI for instant advice on crop health and disease.</li>`
          : `<li>Discover fresh, organic produce delivered straight from the farm.</li>
             <li>Support local farming families with every single purchase.</li>
             <li>Subscribe to your daily essentials for consistent fresh delivery.</li>`
        }
      </ul>
    </div>
    <p>We're here to help you grow. If you have any questions, simply reply to this email.</p>
  `;
  return buildEmailTemplate('Welcome to KisaanConnect', content, 'Launch Marketplace', 'https://kisaanconnect.com');
}

// ── SMTP INITIALIZATION ──────────────────────────────────────────────────────
function makeSmtpTransport(port, secure) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port,
    secure,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    },
    tls: { rejectUnauthorized: false }
  });
}

function initMailer() {
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASS;

  if (!user || !pass) {
    console.warn('⚠️  MAIL_USER / MAIL_PASS not set — Gmail SMTP disabled.');
    return;
  }

  // Use Port 465 (SSL) as primary for Gmail — higher success rate
  const t465 = makeSmtpTransport(465, true);
  t465.verify((err) => {
    if (!err) {
      transporter = t465;
      smtpReady = true;
      console.log('✅ Gmail SMTP Secure ready (port 465):', user);
    } else {
      console.warn(`⚠️  SMTP 465 failed: ${err.message}. Trying 587...`);
      const t587 = makeSmtpTransport(587, false);
      t587.verify((err2) => {
        if (!err2) {
          transporter = t587;
          smtpReady = true;
          console.log('✅ Gmail SMTP ready (port 587):', user);
        } else {
          console.error('❌ Gmail SMTP failed on both ports.');
        }
      });
    }
  });
}

// ── SEND FUNCTIONS ──────────────────────────────────────────────────────────
async function sendEmail(toEmail, subject, html, text) {
  const from = `"KisaanConnect" <${process.env.MAIL_USER}>`;

  // 1. Try Resend
  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || from, to: [toEmail], subject, html, text })
      });
      if (res.ok) return { success: true, provider: 'resend' };
    } catch (e) { console.error(`Resend error: ${e.message}`); }
  }

  // 2. Try Gmail
  if (smtpReady && transporter) {
    try {
      const info = await transporter.sendMail({ from, to: toEmail, subject, html, text });
      return { success: true, provider: 'gmail', id: info.messageId };
    } catch (e) { console.error(`Gmail SMTP error: ${e.message}`); }
  }

  return { success: false };
}

async function sendOTPEmail(toEmail, otp, userName = 'User') {
  const subject = `${otp} is your KisaanConnect verification code`;
  const html = buildOTPHtml(otp, userName);
  const text = `Hello ${userName}, your KisaanConnect verification code is: ${otp}`;
  return sendEmail(toEmail, subject, html, text);
}

async function sendWelcomeEmail(toEmail, userName, role = 'user') {
  const subject = 'Welcome to KisaanConnect! 🌾';
  const html = buildWelcomeHtml(userName, role);
  const text = `Hello ${userName}, Welcome to KisaanConnect!`;
  return sendEmail(toEmail, subject, html, text);
}

module.exports = { initMailer, sendOTPEmail, sendWelcomeEmail };

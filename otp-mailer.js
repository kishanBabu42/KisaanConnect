/**
 * otp-mailer.js — KisaanConnect OTP Email Service
 *
 * PRIMARY:  Resend API  (https://resend.com — free 3000 emails/month)
 *           Uses HTTPS port 443 — NEVER blocked by ISP/firewall/mobile network
 *           Setup: 1. Sign up at https://resend.com (no credit card needed)
 *                  2. Dashboard → API Keys → Create API Key (re_xxxx...)
 *                  3. Paste into .env as:  RESEND_API_KEY=re_xxxx...
 *                  4. Sender: onboarding@resend.dev works for testing immediately
 *
 * FALLBACK: Gmail SMTP (force IPv4, try 587 then 465)
 *           Requires MAIL_USER + MAIL_PASS (Gmail App Password)
 *           Fails on mobile-hotspot / ISP networks that block SMTP ports
 *
 * FINAL:    Console log (dev mode — OTP printed to server terminal)
 */

'use strict';

const nodemailer = require('nodemailer');

let transporter = null;
let smtpReady   = false;

// ── HTML EMAIL TEMPLATE ──────────────────────────────────────────────────────
function buildOTPHtml(otp, userName) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KisaanConnect OTP</title>
</head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;padding:30px 0;">
    <tr><td align="center">
      <table width="440" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;box-shadow:0 8px 32px rgba(5,150,105,0.12);overflow:hidden;max-width:96%;border:1px solid #d1fae5;">
        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(135deg,#059669,#10b981);padding:32px 30px;text-align:center;">
            <div style="font-size:40px;margin-bottom:8px;">🌾</div>
            <div style="font-size:26px;font-weight:800;color:white;letter-spacing:-0.5px;">KisaanConnect</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.85);letter-spacing:2px;margin-top:4px;text-transform:uppercase;">Farm Fresh Marketplace</div>
          </td>
        </tr>
        <!-- BODY -->
        <tr>
          <td style="padding:36px 32px;">
            <p style="font-size:16px;color:#374151;margin:0 0 8px;">Hello, <strong>${userName}</strong> 👋</p>
            <p style="font-size:15px;color:#6b7280;margin:0 0 28px;line-height:1.6;">
              We received a request to reset your <strong>KisaanConnect</strong> password.
              Use the OTP below to proceed. This code is valid for <strong>1 minute</strong>.
            </p>
            <!-- OTP BOX -->
            <div style="background:linear-gradient(135deg,#ecfdf5,#d1fae5);border:2px solid #059669;border-radius:16px;padding:28px;text-align:center;margin:0 0 28px;">
              <div style="font-size:13px;font-weight:700;color:#059669;letter-spacing:3px;text-transform:uppercase;margin-bottom:12px;">Your One-Time Password</div>
              <div style="font-size:48px;font-weight:900;letter-spacing:12px;color:#065f46;font-family:monospace;">${otp}</div>
              <div style="margin-top:14px;display:inline-block;background:#059669;color:white;font-size:12px;font-weight:700;padding:6px 16px;border-radius:20px;">
                ⏱ Expires in 60 seconds
              </div>
            </div>
            <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;color:#92400e;">
                ⚠️ <strong>Security Notice:</strong> If you did not request this OTP, please ignore this email.
                Never share your OTP with anyone. KisaanConnect will never ask for your OTP.
              </p>
            </div>
            <p style="font-size:13px;color:#9ca3af;margin:0;text-align:center;">
              Trouble? Contact us at <a href="mailto:support@kisaanconnect.com" style="color:#059669;">support@kisaanconnect.com</a>
            </p>
          </td>
        </tr>
        <!-- FOOTER -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              © 2026 KisaanConnect • Farm Fresh Marketplace<br>
              Connecting Indian Farmers with Customers Directly 🌱
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── RESEND API (HTTPS/443 — works on ALL networks including mobile hotspots) ──
async function sendViaResend(toEmail, otp, userName) {
  const key = (process.env.RESEND_API_KEY || '').trim();
  if (!key || key === 'your_resend_api_key_here') return null; // not configured

  const fromAddress = (process.env.RESEND_FROM_EMAIL || '').trim()
    || 'KisaanConnect <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: fromAddress,
      to: [toEmail],
      subject: `${otp} — Your KisaanConnect Password Reset OTP`,
      html: buildOTPHtml(otp, userName),
      text: `Hello ${userName},\n\nYour KisaanConnect password reset OTP is: ${otp}\n\nThis OTP expires in 60 seconds.\n\nIf you did not request this, please ignore this email.\n\n— KisaanConnect Team`
    })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Resend API error ${res.status}: ${JSON.stringify(data)}`);
  }

  console.log(`📧 OTP email sent via Resend to ${toEmail} [id: ${data.id}]`);
  return { success: true, provider: 'resend', messageId: data.id };
}

// ── GMAIL SMTP (FALLBACK — forced IPv4 to avoid ISP IPv6 blocks) ──────────────
function makeSmtpTransport(port, secure) {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port,
    secure,
    family: 4,                // ← Force IPv4: avoids "ENETUNREACH" on IPv6-blocked networks
    connectionTimeout: 10000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
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

  // Try port 587 first, then 465
  const t587 = makeSmtpTransport(587, false);
  t587.verify((err) => {
    if (!err) {
      transporter = t587;
      smtpReady   = true;
      console.log('✅ Gmail SMTP ready (port 587 / IPv4):', user);
      return;
    }
    console.warn(`⚠️  SMTP 587 failed: ${err.message} — trying 465...`);
    const t465 = makeSmtpTransport(465, true);
    t465.verify((err2) => {
      if (!err2) {
        transporter = t465;
        smtpReady   = true;
        console.log('✅ Gmail SMTP ready (port 465 / IPv4):', user);
      } else {
        console.error('❌ Gmail SMTP blocked on both ports 587 & 465.');
        console.error('   This is an ISP/mobile-network restriction — SMTP ports are firewalled.');
        console.error('   ✅ FIX: Add RESEND_API_KEY to .env (free at https://resend.com)');
        console.error('   Sign up → API Keys → Create Key → paste value into .env');
      }
    });
  });
}

async function sendViaGmail(toEmail, otp, userName) {
  if (!smtpReady || !transporter) throw new Error('Gmail SMTP not available');
  const info = await transporter.sendMail({
    from: `"KisaanConnect 🌾" <${process.env.MAIL_USER}>`,
    to: toEmail,
    subject: `${otp} — Your KisaanConnect Password Reset OTP`,
    html: buildOTPHtml(otp, userName),
    text: `Hello ${userName},\n\nYour KisaanConnect OTP: ${otp}\n\nExpires in 60 seconds.`
  });
  console.log(`📧 OTP email sent via Gmail to ${toEmail} [msgId: ${info.messageId}]`);
  return { success: true, provider: 'gmail', messageId: info.messageId };
}

// ── MAIN SEND FUNCTION ────────────────────────────────────────────────────────
async function sendOTPEmail(toEmail, otp, userName = 'User') {
  // ① Try Resend first (HTTPS/443 — works on ALL networks)
  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  if (resendKey) {
    try {
      const result = await sendViaResend(toEmail, otp, userName);
      if (result) return result;
    } catch (e) {
      console.error(`❌ Resend failed: ${e.message}`);
      // fall through to Gmail
    }
  }

  // ② Try Gmail SMTP (IPv4-forced)
  if (smtpReady) {
    try {
      return await sendViaGmail(toEmail, otp, userName);
    } catch (e) {
      console.error(`❌ Gmail SMTP send failed: ${e.message}`);
    }
  }

  // ③ Console fallback — OTP still works, just not emailed
  const border = '═'.repeat(44);
  console.log(`\n🔑 ${border}`);
  console.log(`   📧 EMAIL NOT DELIVERED — SMTP BLOCKED BY ISP/NETWORK`);
  console.log(`   OTP for ${toEmail} : ${otp}`);
  console.log(`   Valid for 60 seconds from now`);
  console.log(`   `);
  console.log(`   ✅ PERMANENT FIX (2 minutes, free):`);
  console.log(`   1. Go to https://resend.com → Sign Up`);
  console.log(`   2. Dashboard → API Keys → Create API Key`);
  console.log(`   3. Copy the key (starts with re_...)`);
  console.log(`   4. Open .env → set: RESEND_API_KEY=re_your_key_here`);
  console.log(`   5. Restart server → OTPs will email instantly`);
  console.log(`🔑 ${border}\n`);

  return {
    success: true,
    provider: 'console',
    warning: 'Email not delivered. OTP printed to server console. Add RESEND_API_KEY to .env to fix.'
  };
}

module.exports = { initMailer, sendOTPEmail };

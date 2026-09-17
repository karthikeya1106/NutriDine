# otp_service.py — NutriDine Email OTP Service

import smtplib
import random
import string
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# ── Gmail Config ──────────────────────────────────────────────────────────────
GMAIL_ADDRESS  = "dynamicriderz418@gmail.com"
GMAIL_APP_PASS = "ropy griz almq nxfa"

# ── In-memory OTP store ───────────────────────────────────────────────────────
# Format: { email: { "otp": "123456", "expires_at": timestamp } }
otp_store: dict = {}

OTP_EXPIRY_SECONDS = 600   # 10 minutes

def generate_otp() -> str:
    """Generate a 6-digit numeric OTP."""
    return "".join(random.choices(string.digits, k=6))

def store_otp(email: str, otp: str):
    """Store OTP with expiry timestamp."""
    otp_store[email.lower()] = {
        "otp": otp,
        "expires_at": time.time() + OTP_EXPIRY_SECONDS
    }

def verify_otp(email: str, otp: str) -> dict:
    """
    Verify OTP for given email.
    Returns: { "valid": bool, "message": str }
    """
    email = email.lower()
    record = otp_store.get(email)

    if not record:
        return {"valid": False, "message": "No OTP found for this email. Please request a new one."}

    if time.time() > record["expires_at"]:
        del otp_store[email]
        return {"valid": False, "message": "OTP has expired. Please request a new one."}

    if record["otp"] != otp.strip():
        return {"valid": False, "message": "Incorrect OTP. Please try again."}

    # OTP is valid — remove it so it can't be reused
    del otp_store[email]
    return {"valid": True, "message": "OTP verified successfully"}

def send_otp_email(email: str, otp: str, name: str = "") -> bool:
    """
    Send OTP email via Gmail SMTP.
    Returns True if sent successfully, False otherwise.
    """
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Your NutriDine Verification Code: {otp}"
        msg["From"]    = f"NutriDine <{GMAIL_ADDRESS}>"
        msg["To"]      = email

        greeting = f"Hi {name}," if name else "Hi,"

        # Plain text version
        text = f"""{greeting}

Your NutriDine verification code is: {otp}

This code expires in 10 minutes.

If you did not request this, please ignore this email.

— NutriDine Team
        """

        # HTML version — NutriDine branding, HTML entities for emoji/special chars
        html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
          style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a1a2e,#0f3460);padding:32px;text-align:center;">
              <div style="font-size:36px;margin-bottom:8px;">&#127809;</div>
              <h1 style="color:#ffffff;margin:0;font-size:24px;letter-spacing:1px;">NutriDine</h1>
              <p style="color:#e94560;margin:4px 0 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;">
                Personalised Nutrition System
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="color:#374151;font-size:16px;margin:0 0 8px;">{greeting}</p>
              <p style="color:#6b7280;font-size:14px;margin:0 0 32px;line-height:1.6;">
                Your verification code for NutriDine is:
              </p>

              <!-- OTP Box -->
              <div style="text-align:center;margin:0 0 32px;">
                <div style="display:inline-block;background:linear-gradient(135deg,#1a1a2e,#0f3460);
                  border-radius:12px;padding:20px 48px;">
                  <span style="font-size:42px;font-weight:bold;color:#ffffff;letter-spacing:12px;
                    font-family:monospace;">{otp}</span>
                </div>
              </div>

              <!-- Expiry notice -->
              <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;
                padding:12px 16px;margin-bottom:24px;text-align:center;">
                <p style="color:#92400e;font-size:13px;margin:0;">
                  &#9201; This code expires in <strong>10 minutes</strong>
                </p>
              </div>

              <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.6;">
                If you didn't create a NutriDine account, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center;">
              <p style="color:#9ca3af;font-size:12px;margin:0;">
                &copy; 2026 NutriDine &mdash; AI-Powered Personalised Nutrition
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

        msg.attach(MIMEText(text, "plain", "utf-8"))
        msg.attach(MIMEText(html, "html", "utf-8"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(GMAIL_ADDRESS, GMAIL_APP_PASS)
            server.sendmail(GMAIL_ADDRESS, email, msg.as_string())

        print(f"[NutriDine OTP] Sent OTP to {email}")
        return True

    except Exception as e:
        print(f"[NutriDine OTP] Failed to send email: {e}")
        return False
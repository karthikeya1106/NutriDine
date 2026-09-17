from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import sqlite3, json, hashlib, secrets, os, random as _random
from datetime import datetime, timezone, timedelta
from typing import Optional
from pydantic import BaseModel
import hmac
from dotenv import load_dotenv

load_dotenv()

# -- Password hashing (PBKDF2-SHA256, built-in — no bcrypt/passlib needed) ----
# Format: "pbkdf2:sha256:<iterations>$<salt>$<hash>"
_PBKDF2_ITERATIONS = 260_000

def _pbkdf2_hash(password: str, salt: str) -> str:
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _PBKDF2_ITERATIONS)
    return dk.hex()


# -- Module-level ML engine reference -----------------------------------------
ml_engine = None

# -- Lifespan (replaces deprecated @app.on_event) ------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Single startup / shutdown handler -- replaces deprecated on_event."""
    global RECIPES, NUTRITION, ml_engine

    # -- Startup ------------------------------------------------------------
    init_db()
    RECIPES   = load_recipes()
    NUTRITION = load_nutrition()
    n_ingr    = len(NUTRITION.get("ingredients", {}))
    print(f"[NutriDine] Started. {len(RECIPES)} recipes | {n_ingr} ingredients loaded.")

    try:
        from ml_engine import ml_engine as _engine
        ml_engine = _engine
        print("[NutriDine] ML engine loaded successfully")
    except Exception as exc:
        print(f"[NutriDine] ML engine warning: {exc}")
        ml_engine = None

    yield  # application runs here

    # -- Shutdown (add cleanup here if needed) ------------------------------

# -- App Setup ----------------------------------------------------------------
app = FastAPI(
    title="NutriDine Backend",
    description="AI-powered personalised nutrition system API",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS — reads from env var so it works in production too
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

# -- Database Setup ------------------------------------------------------------
DB_PATH = "nutriai.db"
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row   # so rows behave like dicts
    conn.execute("PRAGMA journal_mode=WAL")
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    # Users table
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            email       TEXT UNIQUE NOT NULL,
            password    TEXT NOT NULL,
            age         INTEGER,
            height      REAL,
            weight      REAL,
            gender      TEXT,
            goal        TEXT,
            target_weight REAL,
            conditions  TEXT DEFAULT '[]',
            preference  TEXT DEFAULT 'Non-Vegetarian',
            likes       TEXT DEFAULT '[]',
            dislikes    TEXT DEFAULT '[]',
            avatar      TEXT DEFAULT '',
            created_at  TEXT DEFAULT (datetime('now'))
        )
    """)

    # Sessions table (token-based auth, with expiry)
    c.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            token       TEXT PRIMARY KEY,
            user_id     INTEGER NOT NULL,
            created_at  TEXT DEFAULT (datetime('now')),
            expires_at  REAL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)
    # Non-destructive migration: add expires_at if missing
    try:
        c.execute("ALTER TABLE sessions ADD COLUMN expires_at REAL")
    except Exception:
        pass  # column already exists

    # Saved meal plans
    c.execute("""
        CREATE TABLE IF NOT EXISTS meal_plans (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            plan_data   TEXT NOT NULL,
            created_at  TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # Saved favourite recipes
    c.execute("""
        CREATE TABLE IF NOT EXISTS favourites (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            recipe_id   TEXT NOT NULL,
            saved_at    TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, recipe_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    # Non-destructive migration: add cuisine_preference if missing
    try:
        c.execute("ALTER TABLE users ADD COLUMN cuisine_preference TEXT DEFAULT 'International'")
    except Exception:
        pass  # column already exists

    # Password reset tokens table
    c.execute("""
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            token       TEXT PRIMARY KEY,
            email       TEXT NOT NULL,
            otp         TEXT NOT NULL,
            expires_at  REAL NOT NULL,
            used        INTEGER DEFAULT 0
        )
    """)

    # Food log (daily meal tracking)
    c.execute("""
        CREATE TABLE IF NOT EXISTS food_logs (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            recipe_id   TEXT,
            name        TEXT NOT NULL,
            calories    REAL NOT NULL DEFAULT 0,
            protein     REAL DEFAULT 0,
            carbs       REAL DEFAULT 0,
            fat         REAL DEFAULT 0,
            meal_type   TEXT DEFAULT 'Meal',
            logged_at   TEXT DEFAULT (date('now')),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    """)

    conn.commit()
    conn.close()

# -- Load Datasets -------------------------------------------------------------
def load_recipes():
    path = os.path.join(DATA_DIR, "recipes.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def load_nutrition():
    path = os.path.join(DATA_DIR, "nutrition.json")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# Cache datasets in memory at startup (populated by lifespan handler above)
RECIPES: list = []
NUTRITION: dict = {}

# -- Auth Helpers --------------------------------------------------------------
SESSION_TTL_DAYS = int(os.getenv("SESSION_TTL_DAYS", "30"))

def hash_password(password: str) -> str:
    """Hash a password with PBKDF2-SHA256 (built-in, no external deps)."""
    salt = secrets.token_hex(16)
    h = _pbkdf2_hash(password, salt)
    return f"pbkdf2:sha256:{_PBKDF2_ITERATIONS}${salt}${h}"

def verify_password(plain: str, stored: str) -> bool:
    """Verify password — supports PBKDF2 (new), legacy SHA-256, and bcrypt."""
    if stored.startswith("pbkdf2:"):
        # New format: pbkdf2:sha256:<iters>$<salt>$<hash>
        try:
            _, _, rest = stored.split(":", 2)
            iters_str, salt, expected = rest.split("$", 2)
            dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), int(iters_str))
            return hmac.compare_digest(dk.hex(), expected)
        except Exception:
            return False
    if len(stored) == 64 and not stored.startswith("$2"):
        # Legacy: plain SHA-256 (no salt)
        return hmac.compare_digest(hashlib.sha256(plain.encode()).hexdigest(), stored)
    # Legacy: bcrypt — try passlib if available
    try:
        from passlib.context import CryptContext
        ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
        return ctx.verify(plain, stored)
    except Exception:
        return False

def migrate_password_if_needed(user_id: int, plain: str, stored: str):
    """Re-hash legacy SHA-256 passwords to PBKDF2 on next login."""
    if not stored.startswith("pbkdf2:"):
        new_hash = hash_password(plain)
        conn = get_db()
        conn.execute("UPDATE users SET password = ? WHERE id = ?", (new_hash, user_id))
        conn.commit()
        conn.close()

def create_token() -> str:
    return secrets.token_urlsafe(32)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    import time
    token = credentials.credentials
    conn = get_db()
    row = conn.execute(
        "SELECT u.*, s.expires_at FROM users u JOIN sessions s ON u.id = s.user_id WHERE s.token = ?",
        (token,)
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    # Check expiry
    if row["expires_at"] and time.time() > row["expires_at"]:
        # Clean up expired session
        conn = get_db()
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
        conn.close()
        raise HTTPException(status_code=401, detail="Session expired. Please sign in again.")
    return dict(row)

# -- Pydantic Schemas ----------------------------------------------------------
class SignupRequest(BaseModel):
    name: str
    email: str
    password: str
    age: int
    height: float
    weight: float
    gender: str
    goal: str
    target_weight: float
    conditions: list[str] = []
    preference: str = "Non-Vegetarian"
    cuisine_preference: str = "International"
    likes: list[str] = []
    dislikes: list[str] = []

class LoginRequest(BaseModel):
    email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str

class SendOTPRequest(BaseModel):
    email: str

class VerifyResetOTPRequest(BaseModel):
    email: str
    otp: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    gender: Optional[str] = None
    goal: Optional[str] = None
    target_weight: Optional[float] = None
    conditions: Optional[list[str]] = None
    preference: Optional[str] = None
    cuisine_preference: Optional[str] = None
    likes: Optional[list[str]] = None
    dislikes: Optional[list[str]] = None

# -- Auth Endpoints ------------------------------------------------------------
@app.post("/api/auth/signup")
def signup(req: SignupRequest):
    conn = get_db()
    # Check duplicate email
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (req.email,)).fetchone()
    if existing:
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed = hash_password(req.password)
    try:
        c = conn.execute(
            """INSERT INTO users
               (name, email, password, age, height, weight, gender, goal,
                target_weight, conditions, preference, cuisine_preference, likes, dislikes)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                req.name, req.email, hashed,
                req.age, req.height, req.weight, req.gender, req.goal,
                req.target_weight,
                json.dumps(req.conditions),
                req.preference,
                req.cuisine_preference,
                json.dumps(req.likes),
                json.dumps(req.dislikes),
            )
        )
        user_id = c.lastrowid
        token = create_token()
        import time
        expires_at = time.time() + SESSION_TTL_DAYS * 86400
        conn.execute(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)",
            (token, user_id, expires_at)
        )
        conn.commit()
    finally:
        conn.close()

    return {
        "success": True,
        "token": token,
        "user": {
            "id": user_id, "name": req.name, "email": req.email,
            "age": req.age, "height": req.height, "weight": req.weight,
            "gender": req.gender, "goal": req.goal,
            "targetWeight": req.target_weight,
            "conditions": req.conditions, "preference": req.preference,
            "cuisinePreference": req.cuisine_preference,
            "likes": req.likes, "dislikes": req.dislikes
        }
    }

@app.post("/api/auth/login")
def login(req: LoginRequest):
    import time
    conn = get_db()
    try:
        # Fetch user by email only (password check done via bcrypt/sha256)
        user = conn.execute(
            "SELECT * FROM users WHERE email = ?",
            (req.email.strip().lower(),)
        ).fetchone()

        if not user or not verify_password(req.password, user["password"]):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        user = dict(user)
        # Transparently migrate SHA-256 to bcrypt
        migrate_password_if_needed(user["id"], req.password, user["password"])

        token = create_token()
        expires_at = time.time() + SESSION_TTL_DAYS * 86400
        conn.execute(
            "INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)",
            (token, user["id"], expires_at)
        )
        conn.commit()
    finally:
        conn.close()

    return {
        "success": True,
        "token": token,
        "user": {
            "id": user["id"], "name": user["name"], "email": user["email"],
            "age": user["age"], "height": user["height"], "weight": user["weight"],
            "gender": user["gender"], "goal": user["goal"],
            "targetWeight": user["target_weight"],
            "conditions": json.loads(user["conditions"]),
            "preference": user["preference"],
            "cuisinePreference": user.get("cuisine_preference", "International"),
            "likes": json.loads(user["likes"]),
            "dislikes": json.loads(user["dislikes"])
        }
    }


@app.post("/api/auth/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    conn = get_db()
    conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()
    return {"success": True, "message": "Logged out"}

# -- Google OAuth Endpoint ------------------------------------------------------
class GoogleAuthRequest(BaseModel):
    access_token: str
    email: str
    name: str

@app.post("/api/auth/google")
def google_auth(req: GoogleAuthRequest):
    """
    Verify a Google OAuth access token, then log in an EXISTING user only.
    - Existing user  → return their session token
    - New user       → 404 error; must sign up with email/password first
    """
    import urllib.request, time

    # Verify token with Google's userinfo endpoint
    try:
        google_req = urllib.request.Request(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {req.access_token}"}
        )
        with urllib.request.urlopen(google_req, timeout=8) as resp:
            info = json.loads(resp.read().decode())
    except Exception:
        raise HTTPException(status_code=401, detail="Google token verification failed")

    verified_email = info.get("email", "").strip().lower()
    if not verified_email:
        raise HTTPException(status_code=400, detail="Could not retrieve email from Google")

    # Email in request must match verified token email
    if verified_email != req.email.strip().lower():
        raise HTTPException(status_code=401, detail="Email mismatch with Google token")

    conn = get_db()
    try:
        user = conn.execute(
            "SELECT * FROM users WHERE email = ?", (verified_email,)
        ).fetchone()

        if user:
            # Existing user — create new session
            user = dict(user)
            token = create_token()
            expires_at = time.time() + SESSION_TTL_DAYS * 86400
            conn.execute(
                "INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)",
                (token, user["id"], expires_at)
            )
            conn.commit()
            return {
                "success": True, "token": token,
                "user": {
                    "id": user["id"], "name": user["name"], "email": user["email"],
                    "age": user["age"], "height": user["height"], "weight": user["weight"],
                    "gender": user["gender"], "goal": user["goal"],
                    "targetWeight": user["target_weight"],
                    "conditions": json.loads(user["conditions"]),
                    "preference": user["preference"],
                    "cuisinePreference": user.get("cuisine_preference", "International"),
                    "likes": json.loads(user["likes"]),
                    "dislikes": json.loads(user["dislikes"])
                }
            }
        else:
            # No account found — reject; user must sign up with email first
            raise HTTPException(
                status_code=404,
                detail="No NutriDine account found for this Google email. Please sign up with your email and password first, then you can use Google Sign-In."
            )
    finally:
        conn.close()

# -- Signup Email OTP -----------------------------------------------------------
class OTPSendRequest(BaseModel):
    email: str
    name: str = ""

class OTPVerifyRequest(BaseModel):
    email: str
    otp: str

@app.post("/api/auth/send-otp")
def send_otp_endpoint(req: OTPSendRequest):
    """Send a 6-digit OTP to the user's email for signup verification."""
    from otp_service import generate_otp, store_otp, send_otp_email
    otp = generate_otp()
    store_otp(req.email.strip().lower(), otp)
    sent = send_otp_email(req.email.strip(), otp, req.name.strip())
    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send verification email. Check the email address and try again.")
    return {"success": True, "message": "Verification code sent to your email."}

@app.post("/api/auth/verify-otp")
def verify_otp_endpoint(req: OTPVerifyRequest):
    """Verify the signup OTP."""
    from otp_service import verify_otp
    result = verify_otp(req.email.strip().lower(), req.otp.strip())
    if not result["valid"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return {"success": True, "message": "Email verified successfully."}


@app.post("/api/auth/forgot-password")
def forgot_password(req: ForgotPasswordRequest):
    """Step 1: Check email exists, send a 6-digit reset OTP."""
    import time
    from otp_service import generate_otp, send_otp_email

    conn = get_db()
    user = conn.execute("SELECT id, name FROM users WHERE email = ?", (req.email.lower().strip(),)).fetchone()
    conn.close()

    # Always return 200 to prevent email enumeration
    if not user:
        return {"success": True, "message": "If that email exists, a reset code has been sent."}

    otp   = generate_otp()
    token = secrets.token_urlsafe(32)
    expires_at = time.time() + 600   # 10 minutes

    # Store in DB (invalidates any previous unexpired tokens for this email)
    conn = get_db()
    conn.execute("DELETE FROM password_reset_tokens WHERE email = ?", (req.email.lower().strip(),))
    conn.execute(
        "INSERT INTO password_reset_tokens (token, email, otp, expires_at) VALUES (?,?,?,?)",
        (token, req.email.lower().strip(), otp, expires_at)
    )
    conn.commit()
    conn.close()

    # Send email
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
    import smtplib
    from otp_service import GMAIL_ADDRESS, GMAIL_APP_PASS

    name = user["name"]
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Reset your NutriDine password - Code: {otp}"
        msg["From"]    = f"NutriDine <{GMAIL_ADDRESS}>"
        msg["To"]      = req.email

        html = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
        style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e,#0f3460);padding:32px;text-align:center;">
            <div style="font-size:36px;margin-bottom:8px;">&#128274;</div>
            <h1 style="color:#fff;margin:0;font-size:24px;letter-spacing:1px;">NutriDine</h1>
            <p style="color:#e94560;margin:4px 0 0;font-size:11px;letter-spacing:3px;text-transform:uppercase;">Password Reset</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="color:#374151;font-size:16px;margin:0 0 8px;">Hi {name},</p>
            <p style="color:#6b7280;font-size:14px;margin:0 0 32px;line-height:1.6;">
              We received a request to reset your NutriDine password. Enter the code below:
            </p>
            <div style="text-align:center;margin:0 0 32px;">
              <div style="display:inline-block;background:linear-gradient(135deg,#e94560,#f5a623);border-radius:12px;padding:20px 48px;">
                <span style="font-size:42px;font-weight:bold;color:#fff;letter-spacing:12px;font-family:monospace;">{otp}</span>
              </div>
            </div>
            <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin-bottom:24px;text-align:center;">
              <p style="color:#92400e;font-size:13px;margin:0;">&#9888; This code expires in <strong>10 minutes</strong></p>
            </div>
            <p style="color:#9ca3af;font-size:12px;margin:0;line-height:1.6;">
              If you didn't request a password reset, you can safely ignore this email -- your password will remain unchanged.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">&copy; 2026 NutriDine &mdash; AI-Powered Personalised Nutrition</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""
        msg.attach(MIMEText(html, "html", "utf-8"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as srv:
            srv.login(GMAIL_ADDRESS, GMAIL_APP_PASS)
            srv.sendmail(GMAIL_ADDRESS, req.email, msg.as_string())
        print(f"[NutriDine] Password reset OTP sent to {req.email}")
    except Exception as e:
        print(f"[NutriDine] Failed to send reset email: {e}")
        raise HTTPException(status_code=500, detail="Failed to send reset email. Try again.")

    return {"success": True, "message": "Reset code sent to your email."}


@app.post("/api/auth/verify-reset-otp")
def verify_reset_otp(req: VerifyResetOTPRequest):
    """Step 2: Validate OTP, return a short-lived reset token for step 3."""
    import time
    conn = get_db()
    record = conn.execute(
        "SELECT * FROM password_reset_tokens WHERE email = ? AND used = 0",
        (req.email.lower().strip(),)
    ).fetchone()
    conn.close()

    if not record:
        raise HTTPException(status_code=400, detail="No active reset request for this email.")
    if time.time() > record["expires_at"]:
        raise HTTPException(status_code=400, detail="Reset code has expired. Please request a new one.")
    if record["otp"] != req.otp.strip():
        raise HTTPException(status_code=400, detail="Incorrect code. Please try again.")

    return {"success": True, "token": record["token"], "message": "Code verified."}


@app.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest):
    """Step 3: Validate token + set new password."""
    import time
    conn = get_db()
    record = conn.execute(
        "SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0",
        (req.token,)
    ).fetchone()

    if not record:
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid or expired reset link.")
    if time.time() > record["expires_at"]:
        conn.close()
        raise HTTPException(status_code=400, detail="Reset link has expired. Please request a new one.")

    # Update password
    new_hash = hash_password(req.new_password)
    conn.execute("UPDATE users SET password = ? WHERE email = ?", (new_hash, record["email"]))
    conn.execute("UPDATE password_reset_tokens SET used = 1 WHERE token = ?", (req.token,))
    # Invalidate all sessions for security
    user = conn.execute("SELECT id FROM users WHERE email = ?", (record["email"],)).fetchone()
    if user:
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (user["id"],))
    conn.commit()
    conn.close()

    return {"success": True, "message": "Password reset successfully. Please sign in."}

# -- User Profile Endpoints ----------------------------------------------------
@app.get("/api/user/profile")
def get_profile(user=Depends(get_current_user)):
    return {
        "id": user["id"], "name": user["name"], "email": user["email"],
        "age": user["age"], "height": user["height"], "weight": user["weight"],
        "gender": user["gender"], "goal": user["goal"],
        "targetWeight": user["target_weight"],
        "conditions": json.loads(user["conditions"]),
        "preference": user["preference"],
        "cuisinePreference": user.get("cuisine_preference", "International"),
        "likes": json.loads(user["likes"]),
        "dislikes": json.loads(user["dislikes"]),
        "avatar": user["avatar"] or ""
    }

@app.put("/api/user/profile")
def update_profile(req: UpdateProfileRequest, user=Depends(get_current_user)):
    conn = get_db()
    fields = []
    values = []

    if req.name is not None:        fields.append("name=?");          values.append(req.name)
    if req.age is not None:         fields.append("age=?");           values.append(req.age)
    if req.height is not None:      fields.append("height=?");        values.append(req.height)
    if req.weight is not None:      fields.append("weight=?");        values.append(req.weight)
    if req.gender is not None:      fields.append("gender=?");        values.append(req.gender)
    if req.goal is not None:        fields.append("goal=?");          values.append(req.goal)
    if req.target_weight is not None: fields.append("target_weight=?"); values.append(req.target_weight)
    if req.conditions is not None:  fields.append("conditions=?");         values.append(json.dumps(req.conditions))
    if req.preference is not None:  fields.append("preference=?");         values.append(req.preference)
    if req.cuisine_preference is not None: fields.append("cuisine_preference=?"); values.append(req.cuisine_preference)
    if req.likes is not None:       fields.append("likes=?");              values.append(json.dumps(req.likes))
    if req.dislikes is not None:    fields.append("dislikes=?");           values.append(json.dumps(req.dislikes))

    if not fields:
        conn.close()
        return {"success": True, "message": "Nothing to update"}

    values.append(user["id"])
    conn.execute(f"UPDATE users SET {', '.join(fields)} WHERE id=?", values)
    conn.commit()
    conn.close()
    return {"success": True, "message": "Profile updated"}

# -- Recipe Endpoints ----------------------------------------------------------
def filter_recipes_for_user(
    user: dict,
    meal_type: str = None,
    max_time: int = 999,
    all_cuisines: bool = False,
    cuisine_filter: str = None,
    dietary_tags: list = None,
):
    """Filter recipes based on user conditions, preference, dislikes, and cuisine preference."""
    conditions        = json.loads(user["conditions"]) if isinstance(user["conditions"], str) else user["conditions"]
    preference        = user["preference"]
    dislikes          = json.loads(user["dislikes"])   if isinstance(user["dislikes"], str)  else user["dislikes"]
    cuisine_pref      = user.get("cuisine_preference", "International")

    # Fuzzy keyword map for UI cuisine buttons → DB cuisine strings
    CUISINE_KEYWORDS = {
        "indian":        ["indian", "south asian"],
        "chinese":       ["chinese"],
        "mediterranean": ["mediterranean", "greek", "italian", "turkish", "lebanese"],
        "american":      ["american"],
        "italian":       ["italian"],
        "mexican":       ["mexican"],
        "japanese":      ["japanese"],
        "thai":          ["thai"],
        "middle eastern":["middle eastern", "arabic", "lebanese", "persian"],
    }

    results = []
    for recipe in RECIPES:
        # Meal type filter
        if meal_type and meal_type != "All" and recipe["meal_type"] != meal_type:
            continue

        # Time filter
        if recipe["prep_time"] + recipe["cook_time"] > max_time:
            continue

        # UI cuisine button filter (takes priority over all_cuisines / user preference)
        if cuisine_filter and cuisine_filter.lower() != "all":
            recipe_cuisine = recipe.get("cuisine", "International").lower()
            terms = CUISINE_KEYWORDS.get(cuisine_filter.lower(), [cuisine_filter.lower()])
            if not any(t in recipe_cuisine for t in terms):
                continue
        elif not all_cuisines:
            # Fall back to user’s saved cuisine preference
            recipe_cuisine = recipe.get("cuisine", "International").lower()
            if cuisine_pref == "Indian":
                # Match all Indian/regional variants present in DB
                if not any(c in recipe_cuisine for c in [
                    "indian", "south asian", "north indian", "south indian",
                    "gujarati", "mughlai", "central indian", "coastal indian", "pan-indian"
                ]):
                    continue
            elif cuisine_pref == "South Asian":
                if not any(c in recipe_cuisine for c in ["indian", "south asian", "bangladeshi", "pakistani", "sri lankan"]):
                    continue
            elif cuisine_pref == "Mediterranean":
                if not any(c in recipe_cuisine for c in [
                    "mediterranean", "greek", "italian", "turkish", "lebanese",
                    "spanish", "middle eastern", "french"
                ]):
                    continue
            elif cuisine_pref == "Asian":
                # East/South-East Asian only -- Indian is a separate preference
                if not any(c in recipe_cuisine for c in ["chinese", "japanese", "korean", "thai", "vietnamese", "asian", "pan-asian"]):
                    continue
            elif cuisine_pref == "Western":
                if not any(c in recipe_cuisine for c in [
                    "american", "european", "british", "french", "western",
                    "continental", "spanish", "italian"
                ]):
                    continue
            # "International" or "Mixed" -> no filter, include everything

        # Dietary tag filter (AND logic: ALL selected tags must be present)
        # UI labels may differ from DB values — normalize via alias map
        if dietary_tags:
            DIETARY_ALIAS = {
                "gluten-free":   ["gluten free", "gluten-free"],
                "low-carb":      ["low carb", "low-carb"],
                "high-protein":  ["high protein", "high-protein"],
                "dairy-free":    ["lactose free", "dairy free", "dairy-free"],
                "vegetarian":    ["vegetarian"],
                "vegan":         ["vegan"],
            }
            recipe_tags_lower = [t.lower() for t in recipe.get("dietary_tags", [])]
            def tag_matches(ui_tag: str) -> bool:
                aliases = DIETARY_ALIAS.get(ui_tag.lower(), [ui_tag.lower()])
                return any(alias in recipe_tags_lower for alias in aliases)
            if not all(tag_matches(tag) for tag in dietary_tags):
                continue

        # Preference filter (user’s saved dietary preference)
        if preference == "Vegetarian" and "Non-Vegetarian" in recipe["dietary_tags"]:
            continue
        if preference == "Vegan" and ("Non-Vegetarian" in recipe["dietary_tags"] or "Vegetarian" in recipe["dietary_tags"] and "Vegan" not in recipe["dietary_tags"]):
            continue

        # Dislike filter
        ingredient_names = [i["name"].lower() for i in recipe["ingredients"]]
        if any(d.lower() in " ".join(ingredient_names) for d in dislikes if d):
            continue

        # Build condition safety summary
        safe_for_all = True
        condition_notes = []
        for cond in conditions:
            if cond in recipe["condition_safety"]:
                safety = recipe["condition_safety"][cond]
                if not safety["safe"]:
                    safe_for_all = False
                condition_notes.append({
                    "condition": cond,
                    "safe": safety["safe"],
                    "reason": safety["reason"]
                })

        results.append({
            **recipe,
            "is_compliant": safe_for_all,
            "condition_notes": condition_notes
        })

    return results

@app.get("/api/recipes")
def get_recipes(
    meal_type: str = "All",
    max_time: int = 999,
    page: int = 1,
    limit: int = 100,
    all_cuisines: bool = False,
    cuisine_filter: str = None,
    dietary_tags: str = None,   # comma-separated list e.g. "Vegan,Gluten-Free"
    user=Depends(get_current_user)
):
    # Parse dietary_tags from comma-separated string
    parsed_dietary = [t.strip() for t in dietary_tags.split(",") if t.strip()] if dietary_tags else None
    results = filter_recipes_for_user(
        user, meal_type, max_time,
        all_cuisines=all_cuisines,
        cuisine_filter=cuisine_filter,
        dietary_tags=parsed_dietary,
    )
    compliant = [r for r in results if r["is_compliant"]]
    non_compliant = [r for r in results if not r["is_compliant"]]
    ordered = compliant + non_compliant

    # Pagination
    limit  = min(limit, 100)   # cap at 100 per page
    page   = max(1, page)
    start  = (page - 1) * limit
    end    = start + limit
    paged  = ordered[start:end]

    return {
        "total":           len(ordered),
        "compliant_count": len(compliant),
        "page":            page,
        "limit":           limit,
        "total_pages":     (len(ordered) + limit - 1) // limit,
        "recipes":         paged
    }

@app.get("/api/recipes/{recipe_id}")
def get_recipe(recipe_id: str, user=Depends(get_current_user)):
    recipe = next((r for r in RECIPES if r["id"] == recipe_id), None)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    conditions = json.loads(user["conditions"]) if isinstance(user["conditions"], str) else user["conditions"]
    condition_notes = []
    for cond in conditions:
        if cond in recipe["condition_safety"]:
            safety = recipe["condition_safety"][cond]
            condition_notes.append({
                "condition": cond,
                "safe": safety["safe"],
                "reason": safety["reason"]
            })

    return {**recipe, "condition_notes": condition_notes}

@app.get("/api/recipes/search/{query}")
def search_recipes(
    query: str,
    page: int = 1,
    limit: int = 20,
    user=Depends(get_current_user)
):
    q = query.lower().strip()
    # Split query into individual tokens (words) for order-independent matching
    tokens = [t for t in q.split() if t]

    def matches(r):
        name        = r["name"].lower()
        cuisine     = r["cuisine"].lower()
        tags        = [tag.lower() for tag in r.get("dietary_tags", [])]
        ingredients = [i["name"].lower() for i in r.get("ingredients", [])]
        ingr_str    = " ".join(ingredients)

        # 1. Exact substring match (original behaviour)
        if q in name or q in cuisine:
            return True
        # 2. Token-based name match — all words in query appear in name (any order)
        #    e.g. "Akoori Parsi Scrambled Eggs" finds "Akoori Scrambled Eggs Parsi"
        if tokens and all(t in name for t in tokens):
            return True
        # 3. Any tag or ingredient contains the full query string
        if any(q in tag for tag in tags):
            return True
        if q in ingr_str:
            return True
        # 4. Single-token queries: also check ingredients individually
        if len(tokens) == 1 and any(tokens[0] in i for i in ingredients):
            return True
        return False

    results = [r for r in RECIPES if matches(r)]

    # Sort: exact name matches first, then token matches, then others
    def sort_key(r):
        name = r["name"].lower()
        if name == q:               return 0   # exact name
        if name.startswith(q):      return 1   # prefix
        if q in name:               return 2   # substring
        return 3                               # token / other

    results.sort(key=sort_key)

    limit  = min(limit, 100)
    page   = max(1, page)
    start  = (page - 1) * limit
    paged  = results[start : start + limit]
    return {
        "total":       len(results),
        "page":        page,
        "limit":       limit,
        "total_pages": (len(results) + limit - 1) // limit,
        "recipes":     paged
    }

# -- Nutrition Endpoints -------------------------------------------------------
@app.get("/api/nutrition")
def get_all_nutrition(page: int = 1, limit: int = 50):
    """
    Returns paginated ingredient list.
    With the USDA dataset this can be 8000+ entries -- always paginate.
    """
    all_items = NUTRITION.get("ingredients", {})
    keys      = sorted(all_items.keys())
    limit     = min(limit, 200)
    page      = max(1, page)
    start     = (page - 1) * limit
    paged_keys = keys[start : start + limit]

    return {
        "total":               len(keys),
        "page":                page,
        "limit":               limit,
        "total_pages":         (len(keys) + limit - 1) // limit,
        "ingredients":         {k: all_items[k] for k in paged_keys},
        "condition_guidelines": NUTRITION.get("condition_guidelines", {})
    }

@app.get("/api/nutrition/search")
def search_nutrition(q: str = "", limit: int = 20):
    """
    Search ingredients by name substring.
    Example: GET /api/nutrition/search?q=chicken&limit=15
    """
    if not q:
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")
    q_lower  = q.lower()
    all_ingr = NUTRITION.get("ingredients", {})
    matches  = {
        k: v for k, v in all_ingr.items()
        if q_lower in k
    }
    limit   = min(limit, 100)
    limited = dict(list(matches.items())[:limit])
    return {
        "query":   q,
        "total":   len(matches),
        "results": limited
    }

@app.get("/api/nutrition/ingredient/{ingredient_name}")
def get_ingredient_nutrition(ingredient_name: str):
    key  = ingredient_name.lower().strip()
    data = NUTRITION.get("ingredients", {}).get(key)
    if data:
        return {ingredient_name: data}
    # Fuzzy: partial match
    matches = {k: v for k, v in NUTRITION.get("ingredients", {}).items() if key in k}
    if not matches:
        raise HTTPException(status_code=404, detail=f"Ingredient '{ingredient_name}' not found")
    return {"matches": matches, "note": f"Exact match not found for '{ingredient_name}'. Showing partial matches."}

@app.get("/api/nutrition/cuisine-ingredients")
def get_cuisine_ingredients(user=Depends(get_current_user)):
    """
    Returns a curated ingredient list based on the user's cuisine_preference.
    Buckets each ingredient by food category for display.
    """
    cuisine_pref = user.get("cuisine_preference", "International")

    # -- Curated ingredient buckets by cuisine ---------------------------------
    CUISINE_INGREDIENTS: dict[str, dict[str, list[str]]] = {
        "Indian": {
            "Grains & Flour": ["brown rice", "basmati rice", "whole wheat flour", "ragi flour",
                                "jowar flour", "besan", "semolina", "poha", "quinoa"],
            "Lentils & Legumes": ["toor dal", "moong dal", "chana dal", "rajma", "chana",
                                   "green moong dal", "masoor dal", "urad dal", "black eyed peas"],
            "Vegetables": ["spinach", "tomato", "onion", "potato", "cauliflower", "brinjal",
                            "bhindi", "bitter gourd", "drumstick", "fenugreek leaves"],
            "Spices": ["turmeric", "cumin seeds", "coriander seeds", "mustard seeds",
                       "garam masala", "red chili powder", "cardamom", "cloves", "cinnamon"],
            "Dairy & Alternatives": ["paneer", "yogurt", "ghee", "milk", "coconut yogurt",
                                      "almond milk unsweetened", "soy milk"],
            "Oils & Fats": ["mustard oil", "coconut oil", "olive oil", "sesame oil"],
            "Protein": ["chicken breast", "eggs", "firm tofu", "soya chunks", "fish fillet"],
            "Fruits": ["banana", "mango", "apple", "guava", "papaya", "pomegranate"],
            "Nuts & Seeds": ["almonds", "cashews", "peanuts", "chia seeds", "flaxseeds", "walnuts"],
            "Sweeteners": ["jaggery", "honey", "stevia"],
        },
        "Mediterranean": {
            "Grains": ["whole wheat pasta", "couscous", "farro", "pita bread", "bulgur"],
            "Legumes": ["chickpeas", "lentils", "white beans", "black beans"],
            "Vegetables": ["tomato", "cucumber", "zucchini", "eggplant", "artichoke", "spinach",
                            "roasted red pepper", "olives", "sundried tomato"],
            "Herbs & Spices": ["oregano", "basil", "rosemary", "thyme", "sumac", "za'atar",
                                "parsley", "mint", "garlic"],
            "Dairy": ["feta cheese", "yogurt", "halloumi", "ricotta", "mozzarella"],
            "Oils": ["olive oil", "tahini"],
            "Protein": ["salmon", "sardines", "chicken breast", "lamb", "eggs", "tuna"],
            "Fruits": ["lemon", "orange", "fig", "grape", "pomegranate", "dates"],
            "Nuts & Seeds": ["pine nuts", "walnuts", "almonds", "sesame seeds", "pumpkin seeds"],
        },
        "Asian": {
            "Grains & Noodles": ["jasmine rice", "sushi rice", "rice noodles", "udon",
                                   "soba noodles", "glass noodles"],
            "Vegetables": ["bok choy", "napa cabbage", "shiitake mushroom", "bamboo shoot",
                            "bean sprouts", "daikon", "edamame", "lotus root"],
            "Sauces & Condiments": ["soy sauce", "fish sauce", "oyster sauce", "miso",
                                     "hoisin sauce", "sesame oil", "rice vinegar"],
            "Spices & Aromatics": ["ginger", "lemongrass", "galangal", "star anise",
                                    "szechuan pepper", "thai basil", "kaffir lime leaves"],
            "Protein": ["tofu", "tempeh", "chicken breast", "shrimp", "salmon", "pork belly", "eggs"],
            "Dairy Alternatives": ["coconut milk", "soy milk"],
            "Fruits": ["mango", "lychee", "durian", "dragon fruit", "yuzu", "longan"],
            "Nuts & Seeds": ["sesame seeds", "peanuts", "cashews", "chestnuts"],
        },
        "Western": {
            "Grains & Bread": ["whole grain bread", "oats", "whole wheat pasta", "quinoa",
                                "brown rice", "barley", "rye bread"],
            "Vegetables": ["broccoli", "carrot", "potato", "sweet potato", "corn",
                            "green beans", "asparagus", "peas", "mushroom", "celery"],
            "Herbs & Spices": ["paprika", "oregano", "thyme", "rosemary", "sage",
                                "black pepper", "garlic powder", "onion powder"],
            "Dairy": ["milk", "cheddar cheese", "greek yogurt", "butter", "cream"],
            "Oils": ["olive oil", "vegetable oil", "avocado oil", "coconut oil"],
            "Protein": ["chicken breast", "beef", "salmon", "tuna", "eggs", "turkey", "tofu"],
            "Fruits": ["apple", "banana", "strawberry", "blueberry", "avocado", "orange"],
            "Nuts & Seeds": ["almonds", "walnuts", "peanut butter", "sunflower seeds", "chia seeds"],
            "Sweeteners": ["honey", "maple syrup", "brown sugar", "stevia"],
        },
        "International": {
            "Grains": ["brown rice", "oats", "quinoa", "whole wheat bread", "pasta"],
            "Vegetables": ["spinach", "broccoli", "tomato", "carrot", "onion", "potato",
                            "sweet potato", "zucchini", "mushroom", "capsicum"],
            "Protein": ["chicken breast", "eggs", "firm tofu", "salmon", "tuna", "lentils"],
            "Fruits": ["banana", "apple", "orange", "berries", "mango", "avocado"],
            "Dairy & Alt": ["milk", "yogurt", "almond milk unsweetened", "coconut milk"],
            "Oils": ["olive oil", "coconut oil", "avocado oil"],
            "Nuts & Seeds": ["almonds", "walnuts", "chia seeds", "flaxseeds", "pumpkin seeds"],
            "Spices": ["turmeric", "cumin", "paprika", "garlic", "ginger", "cinnamon"],
            "Sweeteners": ["honey", "stevia", "maple syrup"],
        },
    }

    # Fall back to International if cuisine not in map
    buckets = CUISINE_INGREDIENTS.get(cuisine_pref, CUISINE_INGREDIENTS["International"])

    # Enrich each ingredient with nutrition data (exact then fuzzy fallback)
    all_ingr = NUTRITION.get("ingredients", {})
    all_keys = list(all_ingr.keys())

    def find_nutrition(item: str):
        key = item.lower().strip()
        # 1. Exact match
        if key in all_ingr:
            return all_ingr[key]
        # 2. Starts-with match (e.g. "almonds" -> "almonds, dry roasted...")
        for k in all_keys:
            if k.startswith(key):
                return all_ingr[k]
        # 3. Word-overlap: all words of ingredient appear in the key
        words = key.split()
        if len(words) >= 2:
            for k in all_keys:
                if all(w in k for w in words):
                    return all_ingr[k]
        # 4. Single-word substring
        if len(words) == 1:
            for k in all_keys:
                if key in k.split(",")[0].split():
                    return all_ingr[k]
        return None

    result_buckets = {}
    for category, items in buckets.items():
        enriched = []
        for item in items:
            nutrition = find_nutrition(item)
            enriched.append({
                "name": item,
                "nutrition": nutrition,
                "found_in_db": nutrition is not None,
            })
        result_buckets[category] = enriched

    return {
        "cuisine_preference": cuisine_pref,
        "buckets": result_buckets,
        "total_ingredients": sum(len(v) for v in result_buckets.values()),
    }


@app.get("/api/nutrition/condition/{condition_name}")
def get_condition_guidelines(condition_name: str):
    guidelines = NUTRITION["condition_guidelines"].get(condition_name)
    if not guidelines:
        raise HTTPException(status_code=404, detail=f"No guidelines found for '{condition_name}'")
    return guidelines

# ── Conditions Encyclopedia (41+ conditions) ───────────────────────────────
_CONDITIONS_DB: list = []

def _load_conditions_db():
    global _CONDITIONS_DB
    try:
        _dir = os.path.dirname(os.path.abspath(__file__))
        p = os.path.join(_dir, "data", "conditions.json")
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                _CONDITIONS_DB = json.load(f)
            print(f"[OK] Conditions DB loaded: {len(_CONDITIONS_DB)} conditions")
        else:
            print("[WARN] data/conditions.json not found -- conditions encyclopedia will be empty")
            _CONDITIONS_DB = []
    except Exception as e:
        print(f"[ERROR] Failed to load conditions.json: {e}")
        _CONDITIONS_DB = []

# Load at module level with safe fallback
_load_conditions_db()

@app.get("/api/conditions")
def list_conditions(category: str = None, search: str = None, ml_only: bool = False):
    """
    List all conditions in the encyclopedia.
    Optional filters: ?category=Metabolic, ?search=diabetes, ?ml_only=true
    """
    results = _CONDITIONS_DB
    if ml_only:
        results = [c for c in results if c.get("ml_supported")]
    if category:
        results = [c for c in results if c.get("category", "").lower() == category.lower()]
    if search:
        q = search.lower()
        results = [c for c in results if q in c.get("name", "").lower() or q in c.get("overview", "").lower()]
    return {
        "total": len(results),
        "categories": sorted(set(c["category"] for c in _CONDITIONS_DB)),
        "conditions": [{
            "slug": c["slug"],
            "name": c["name"],
            "category": c["category"],
            "prevalence": c.get("prevalence", ""),
            "overview": c.get("overview", "")[:200] + "...",
            "ml_supported": c.get("ml_supported", False),
            "authority": c.get("authority", "")
        } for c in results]
    }

@app.get("/api/conditions/categories")
def list_condition_categories():
    """Return all available condition categories with counts."""
    cats: dict = {}
    for c in _CONDITIONS_DB:
        cat = c.get("category", "Other")
        cats[cat] = cats.get(cat, 0) + 1
    return {"categories": [{"name": k, "count": v} for k, v in sorted(cats.items())]}

@app.get("/api/conditions/{slug}")
def get_condition_detail(slug: str):
    """Get full detail for a specific condition by slug."""
    for c in _CONDITIONS_DB:
        if c["slug"] == slug:
            return c
    raise HTTPException(status_code=404, detail=f"Condition '{slug}' not found in encyclopedia")

@app.post("/api/nutrition/calculate")
def calculate_nutrition(ingredient_amounts: dict):
    """
    Calculate nutrition for a list of ingredients with amounts.
    Body: {"oats": 100, "banana": 50, "almond milk unsweetened": 200}
    """
    total = {"calories": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 0, "sodium": 0}
    breakdown = {}

    for ingredient, grams in ingredient_amounts.items():
        key = ingredient.lower()
        data = NUTRITION["ingredients"].get(key)
        if data:
            factor = grams / 100
            breakdown[ingredient] = {
                "grams":    grams,
                "calories": round(data["calories_kcal"] * factor, 1),
                "protein":  round(data["protein_g"]    * factor, 1),
                "carbs":    round(data["carbs_g"]      * factor, 1),
                "fat":      round(data["fat_g"]        * factor, 1),
                "fiber":    round(data["fiber_g"]      * factor, 1),
            }
            total["calories"] += breakdown[ingredient]["calories"]
            total["protein"]  += breakdown[ingredient]["protein"]
            total["carbs"]    += breakdown[ingredient]["carbs"]
            total["fat"]      += breakdown[ingredient]["fat"]
            total["fiber"]    += breakdown[ingredient]["fiber"]

    return {
        "total":     {k: round(v, 1) for k, v in total.items()},
        "breakdown": breakdown
    }

# -- Meal Plan Endpoints -------------------------------------------------------
@app.get("/api/mealplan/generate")
def generate_meal_plan(weeks: int = None, user=Depends(get_current_user)):
    """
    Auto-calculates how many weeks to generate based on the users compliant
    recipe pool. weeks = floor(max_compliant_across_meal_types / 7).
    Capped at 16 weeks. Every week uses totally unique recipes -- zero repeats.
    Optional: pass ?weeks=N to override the auto-calculated count (1-16).
    """
    MAX_WEEKS = 16
    MIN_WEEKS = 1
    requested_weeks = weeks  # None = auto-calculate, int = user override

    def _calc_daily_calorie_target():
        weight = user.get("weight", 70) or 70
        height = user.get("height", 1.70) or 1.70
        age    = user.get("age", 30) or 30
        gender = (user.get("gender") or "male").lower()
        goal   = user.get("goal") or "Maintenance"
        if gender == "male":
            bmr = 10 * weight + 6.25 * (height * 100) - 5 * age + 5
        else:
            bmr = 10 * weight + 6.25 * (height * 100) - 5 * age - 161
        if goal == "Weight Loss":   return int(bmr * 1.3 - 300)
        elif goal == "Muscle Gain": return int(bmr * 1.5 + 300)
        else:                       return int(bmr * 1.4)

    daily_cal = _calc_daily_calorie_target()

    meal_cal_targets = {
        "Breakfast": daily_cal * 0.25,
        "Lunch":     daily_cal * 0.35,
        "Dinner":    daily_cal * 0.30,
        "Snack":     daily_cal * 0.10,
    }

    b_filtered = filter_recipes_for_user(user, "Breakfast")
    l_filtered = filter_recipes_for_user(user, "Lunch")
    d_filtered = filter_recipes_for_user(user, "Dinner")
    s_filtered = filter_recipes_for_user(user, "Snack")

    b_compliant = [r for r in b_filtered if r.get("is_compliant", True)]
    l_compliant = [r for r in l_filtered if r.get("is_compliant", True)]
    d_compliant = [r for r in d_filtered if r.get("is_compliant", True)]
    s_compliant = [r for r in s_filtered if r.get("is_compliant", True)]

    pool_sizes = {
        "Breakfast": len(b_compliant),
        "Lunch":     len(l_compliant),
        "Dinner":    len(d_compliant),
        "Snack":     len(s_compliant),
    }

    max_pool   = max(pool_sizes.values()) if any(pool_sizes.values()) else 7
    auto_weeks = max(MIN_WEEKS, min(MAX_WEEKS, max_pool // 7))
    if auto_weeks < MIN_WEEKS:
        auto_weeks = MIN_WEEKS

    # If user explicitly requested a custom number of weeks, honour it
    if requested_weeks is not None:
        auto_weeks = max(MIN_WEEKS, min(MAX_WEEKS, requested_weeks))

    total_days = auto_weeks * 7

    def _build_pool(compliant, filtered, needed, cal_target):
        def cal_of(r):
            return (r.get("nutrition_per_serving") or {}).get("calories", 0) or 0
        BAND   = max(50, cal_target * 0.15)
        within = [r for r in compliant if abs(cal_of(r) - cal_target) <= BAND]
        over   = sorted([r for r in compliant if cal_of(r) - cal_target > BAND],
                        key=lambda r: cal_of(r) - cal_target)
        under  = sorted([r for r in compliant if cal_target - cal_of(r) > BAND],
                        key=lambda r: cal_target - cal_of(r))
        _random.shuffle(within)
        full_pool = within + over + under
        if not full_pool:
            return []
        if len(full_pool) < needed:
            nc = sorted([r for r in filtered if not r.get("is_compliant", True)],
                        key=lambda r: abs(cal_of(r) - cal_target))
            full_pool = full_pool + nc
        result = list(full_pool)
        while len(result) < needed:
            chunk = full_pool.copy()
            _random.shuffle(chunk)
            result.extend(chunk)
        return result[:needed]

    all_breakfasts = _build_pool(b_compliant, b_filtered, total_days, meal_cal_targets["Breakfast"])
    all_lunches    = _build_pool(l_compliant, l_filtered, total_days, meal_cal_targets["Lunch"])
    all_dinners    = _build_pool(d_compliant, d_filtered, total_days, meal_cal_targets["Dinner"])
    all_snacks     = _build_pool(s_compliant, s_filtered, total_days, meal_cal_targets["Snack"])

    day_names = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5", "Day 6", "Day 7"]
    all_days  = []

    for idx in range(total_days):
        b = all_breakfasts[idx] if idx < len(all_breakfasts) else None
        l = all_lunches[idx]    if idx < len(all_lunches)    else None
        d = all_dinners[idx]    if idx < len(all_dinners)    else None
        s = all_snacks[idx]     if idx < len(all_snacks)     else None
        total_cal = sum(m["nutrition_per_serving"]["calories"] for m in [b, l, d, s] if m)
        all_days.append({
            "day":            day_names[idx % 7],
            "week":           (idx // 7) + 1,
            "day_index":      idx,
            "breakfast":      b,
            "lunch":          l,
            "dinner":         d,
            "snack":          s,
            "total_calories": round(total_cal, 1)
        })

    plan_weeks = []
    for w in range(1, auto_weeks + 1):
        week_days = [d for d in all_days if d["week"] == w]
        week_cal  = sum(d["total_calories"] for d in week_days)
        plan_weeks.append({
            "week":               w,
            "label":              f"Week {w}",
            "days":               week_days,
            "avg_daily_calories": round(week_cal / len(week_days), 1) if week_days else 0,
        })

    avg_calories  = round(sum(d["total_calories"] for d in all_days) / len(all_days), 1) if all_days else 0
    total_protein = sum(
        sum((m["nutrition_per_serving"].get("protein", 0) or 0)
            for m in [d["breakfast"], d["lunch"], d["dinner"], d["snack"]] if m)
        for d in all_days
    )
    avg_protein    = round(total_protein / len(all_days), 1) if all_days else 0
    compliant_days = sum(
        1 for d in all_days
        if all(
            m.get("is_compliant", True)
            for m in [d["breakfast"], d["lunch"], d["dinner"], d["snack"]] if m
        )
    )

    return {
        "success":     True,
        "plan_type":   "dataset",
        "total_weeks": auto_weeks,
        "total_days":  total_days,
        "weeks":       plan_weeks,
        "days":        all_days,
        "pool_stats": {
            "safe_breakfasts":      pool_sizes["Breakfast"],
            "safe_lunches":         pool_sizes["Lunch"],
            "safe_dinners":         pool_sizes["Dinner"],
            "safe_snacks":          pool_sizes["Snack"],
            "largest_pool":         max_pool,
            "generated_weeks":      auto_weeks,
            "daily_calorie_target": daily_cal,
        },
        "summary": {
            "avg_daily_calories": avg_calories,
            "avg_daily_protein":  avg_protein,
            "total_meals":        total_days * 4,
            "compliant_days":     compliant_days,
            "total_days":         total_days,
        }
    }

@app.get("/api/mealplan/history")
def get_meal_plan_history(user=Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        "SELECT id, created_at FROM meal_plans WHERE user_id=? ORDER BY created_at DESC LIMIT 10",
        (user["id"],)
    ).fetchall()
    conn.close()
    return {"plans": [dict(r) for r in rows]}

@app.get("/api/mealplan/{plan_id}")
def get_saved_meal_plan(plan_id: int, user=Depends(get_current_user)):
    conn = get_db()
    row = conn.execute(
        "SELECT id, plan_data, created_at FROM meal_plans WHERE id=? AND user_id=?",
        (plan_id, user["id"])
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Plan not found")
    return {
        "id": row["id"],
        "created_at": row["created_at"],
        "plan_data": json.loads(row["plan_data"])
    }

# -- Favourites Endpoints ------------------------------------------------------
@app.post("/api/favourites/{recipe_id}")
def add_favourite(recipe_id: str, user=Depends(get_current_user)):
    conn = get_db()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO favourites (user_id, recipe_id) VALUES (?,?)",
            (user["id"], recipe_id)
        )
        conn.commit()
    finally:
        conn.close()
    return {"success": True, "message": f"{recipe_id} added to favourites"}

@app.delete("/api/favourites/{recipe_id}")
def remove_favourite(recipe_id: str, user=Depends(get_current_user)):
    conn = get_db()
    conn.execute(
        "DELETE FROM favourites WHERE user_id=? AND recipe_id=?",
        (user["id"], recipe_id)
    )
    conn.commit()
    conn.close()
    return {"success": True, "message": f"{recipe_id} removed from favourites"}

@app.get("/api/favourites")
def get_favourites(user=Depends(get_current_user)):
    conn = get_db()
    rows = conn.execute(
        "SELECT recipe_id FROM favourites WHERE user_id=?",
        (user["id"],)
    ).fetchall()
    conn.close()

    fav_ids = [r["recipe_id"] for r in rows]
    fav_recipes = [r for r in RECIPES if r["id"] in fav_ids]
    return {"favourites": fav_recipes}

# -- Dashboard Stats -----------------------------------------------------------
@app.get("/api/dashboard/stats")
def get_dashboard_stats(user=Depends(get_current_user)):
    weight = user["weight"]
    height = user["height"] / 100  # cm to m
    bmi = round(weight / (height * height), 1) if height > 0 else 0

    if bmi < 18.5:   bmi_category = "Underweight"
    elif bmi < 25:   bmi_category = "Normal"
    elif bmi < 30:   bmi_category = "Overweight"
    else:            bmi_category = "Obese"

    conditions = json.loads(user["conditions"]) if isinstance(user["conditions"], str) else user["conditions"]

    # Estimate daily calorie target
    age, gender = user["age"], user["gender"]
    if gender == "male":
        bmr = 10 * weight + 6.25 * (height * 100) - 5 * age + 5
    else:
        bmr = 10 * weight + 6.25 * (height * 100) - 5 * age - 161

    goal = user["goal"]
    if goal == "Weight Loss":    target_cal = int(bmr * 1.3 - 300)
    elif goal == "Muscle Gain":  target_cal = int(bmr * 1.5 + 300)
    else:                        target_cal = int(bmr * 1.4)

    return {
        "bmi": bmi,
        "bmi_category": bmi_category,
        "current_weight": weight,
        "target_weight": user["target_weight"],
        "goal": goal,
        "daily_calorie_target": target_cal,
        "conditions_count": len(conditions),
        "conditions": conditions,
        "compliant_recipes_count": len([
            r for r in filter_recipes_for_user(user) if r["is_compliant"]
        ])
    }

# -- Health Check --------------------------------------------------------------
@app.get("/")
def root():
    meta = NUTRITION.get("meta", {})
    return {
        "app":                "NutriDine Backend",
        "status":             "running",
        "version":            "2.0.0",
        "recipes_loaded":     len(RECIPES),
        "ingredients_in_db":  len(NUTRITION.get("ingredients", {})),
        "nutrition_source":   meta.get("source", "NutriDine Nutrition DB"),
        "recipe_sources":     list({r.get('source', 'Hand-crafted') for r in RECIPES[:100]}),
    }


# -- Substitution Engine (dual-mode: health + preference) ---------------------

# Voluntary / preference-based substitutes -- ingredient category buckets
VOLUNTARY_SUBSTITUTES: dict = {
    # -- Grains & Starches ----------------------------------------------------
    "rice": {
        "category": "Grain",
        "substitutes": [
            {"name": "Quinoa",          "notes": "Higher protein, similar texture. Cook 1:2 with water."},
            {"name": "Brown Rice",      "notes": "Nuttier flavour, more fibre. Swap 1:1, cook a bit longer."},
            {"name": "Cauliflower Rice","notes": "Very low-carb. Pulse cauliflower in a food processor and stir-fry."},
            {"name": "Millet",          "notes": "Gluten-free, fluffy grain. Cook same as rice."},
        ]
    },
    "white rice": {
        "category": "Grain",
        "substitutes": [
            {"name": "Brown Rice",       "notes": "Lower GI, more fibre. Swap 1:1 -- takes ~5 min longer."},
            {"name": "Quinoa",           "notes": "High protein grain. Cook 1:2 with water for 15 min."},
            {"name": "Cauliflower Rice", "notes": "Virtual zero-carb option. Grate and stir-fry 5 min."},
            {"name": "Barley",           "notes": "Chewy texture, great for pilafs and soups."},
        ]
    },
    "basmati rice": {
        "category": "Grain",
        "substitutes": [
            {"name": "Brown Basmati Rice", "notes": "Same aroma, more fibre and lower GI. Swap 1:1."},
            {"name": "Quinoa",             "notes": "Protein-packed. Swap 1:1 -- add a bay leaf for aroma."},
            {"name": "Freekeh",            "notes": "Smoky flavour, high fibre Middle-eastern grain."},
        ]
    },
    "pasta": {
        "category": "Grain",
        "substitutes": [
            {"name": "Whole Wheat Pasta",  "notes": "Higher fibre and lower GI. Exact 1:1 swap."},
            {"name": "Zucchini Noodles",   "notes": "Spiralise zucchini for a very low-carb, light option."},
            {"name": "Chickpea Pasta",     "notes": "High protein, gluten-free. Cooks slightly faster."},
            {"name": "Rice Noodles",       "notes": "Gluten-free. Soak in hot water instead of boiling."},
        ]
    },
    "bread": {
        "category": "Grain",
        "substitutes": [
            {"name": "Whole Grain Bread",  "notes": "More fibre and nutrients. Direct 1:1 swap."},
            {"name": "Lettuce Wraps",      "notes": "Zero-carb wrap for burgers or sandwiches."},
            {"name": "Rice Cakes",         "notes": "Light, gluten-free base. Good for toppings."},
            {"name": "Oat Bread",          "notes": "Lower GI, hearty flavour."},
        ]
    },
    "oats": {
        "category": "Grain",
        "substitutes": [
            {"name": "Quinoa Flakes",    "notes": "Higher protein, similar cooking time."},
            {"name": "Millet Porridge",  "notes": "Gluten-free. Cook with milk/water same as oats."},
            {"name": "Buckwheat Groats", "notes": "Nutty and gluten-free. Soak overnight, cook 20 min."},
        ]
    },
    "flour": {
        "category": "Flour",
        "substitutes": [
            {"name": "Whole Wheat Flour", "notes": "More fibre, slightly denser. Use same quantity."},
            {"name": "Almond Flour",      "notes": "Gluten-free, low-carb. Use 1:1 but add an extra egg."},
            {"name": "Oat Flour",         "notes": "Mild taste. Blend oats into powder. Swap 1:1."},
            {"name": "Ragi Flour",        "notes": "High calcium, gluten-free. Great for rotis."},
            {"name": "Chickpea Flour",    "notes": "High protein, nutty taste. Good for savoury dishes."},
        ]
    },
    "maida": {
        "category": "Flour",
        "substitutes": [
            {"name": "Whole Wheat Flour", "notes": "More nutritious. Use 7/8 cup for every 1 cup maida."},
            {"name": "Almond Flour",      "notes": "Gluten-free and low-carb. Add 1 extra egg per cup."},
            {"name": "Rice Flour",        "notes": "Light texture, gluten-free. Good for batters."},
        ]
    },
    "semolina": {
        "category": "Flour",
        "substitutes": [
            {"name": "Quinoa",        "notes": "Cook similarly. Higher protein and gluten-free."},
            {"name": "Oats (rolled)", "notes": "For porridge-style use. Swap 1:1."},
            {"name": "Jowar Flour",   "notes": "Gluten-free, mildly nutty. Good for upma-style dishes."},
        ]
    },

    # -- Proteins -------------------------------------------------------------
    "chicken breast": {
        "category": "Protein",
        "substitutes": [
            {"name": "Turkey Breast",   "notes": "Almost identical flavour and texture. Swap 1:1."},
            {"name": "Firm Tofu",       "notes": "Press and marinate. Great vegetarian swap."},
            {"name": "Soya Chunks",     "notes": "High plant protein. Soak before use. Use 3/4 quantity."},
            {"name": "Paneer",          "notes": "For vegetarians. Cube and cook similarly."},
            {"name": "Chickpeas",       "notes": "Hearty legume protein. Use in curries and salads."},
        ]
    },
    "eggs": {
        "category": "Protein",
        "substitutes": [
            {"name": "Flax Egg (1 tbsp flaxseed + 3 tbsp water)", "notes": "Vegan binder for baking."},
            {"name": "Chia Egg (1 tbsp chia + 3 tbsp water)",     "notes": "Vegan binder, neutral taste."},
            {"name": "Aquafaba (3 tbsp)",                          "notes": "Chickpea water. Great for meringues and batters."},
            {"name": "Silken Tofu (1/4 cup)",                        "notes": "Creamy egg replacement in quiches and scrambles."},
            {"name": "Banana (1/2 mashed)",                          "notes": "For sweet baking. Adds moisture and binds."},
        ]
    },
    "paneer": {
        "category": "Protein",
        "substitutes": [
            {"name": "Firm Tofu",    "notes": "Best 1:1 swap. Press, cube and marinate like paneer."},
            {"name": "Halloumi",     "notes": "Squeaky, hold shape well when cooked. Similar richness."},
            {"name": "Soya Chunks",  "notes": "Soak before use. High protein, good in curries."},
            {"name": "Tempeh",       "notes": "Firm, nutty textured protein. Cube and add to curries."},
        ]
    },
    "salmon": {
        "category": "Protein",
        "substitutes": [
            {"name": "Trout",          "notes": "Similar oily fish texture and taste. Swap 1:1."},
            {"name": "Mackerel",       "notes": "Bold flavour, similar omega-3 content."},
            {"name": "Canned Tuna",    "notes": "Budget-friendly lean option for salads and sandwiches."},
            {"name": "Firm Tofu",      "notes": "Vegetarian option. Marinate in soy sauce + sesame oil."},
        ]
    },
    "beef": {
        "category": "Protein",
        "substitutes": [
            {"name": "Lamb",          "notes": "Similar richness. Swap 1:1 in any recipe."},
            {"name": "Turkey Mince",  "notes": "Lean option, much lower fat. Swap 1:1."},
            {"name": "Soya Chunks",   "notes": "High plant protein. Soak and use in curries."},
            {"name": "Lentils",       "notes": "For mince-style dishes (bolognese, keema). Swap 1:1 cooked."},
        ]
    },
    "tofu": {
        "category": "Protein",
        "substitutes": [
            {"name": "Tempeh",          "notes": "Firmer and nuttier. Great in stir-fries."},
            {"name": "Paneer",          "notes": "Holds shape well. Indian cooking swap."},
            {"name": "Soya Chunks",     "notes": "Soak and squeeze before use. High protein."},
            {"name": "Chickpeas",       "notes": "Good in curries and salads."},
        ]
    },

    # -- Dairy & Alternatives -------------------------------------------------
    "milk": {
        "category": "Dairy",
        "substitutes": [
            {"name": "Almond Milk (unsweetened)", "notes": "Low calorie, mild. Good for tea, smoothies, porridge."},
            {"name": "Oat Milk",                  "notes": "Creamy and neutral. Best for coffee and baking."},
            {"name": "Soy Milk",                  "notes": "Highest protein of all plant milks. Good all-rounder."},
            {"name": "Coconut Milk",              "notes": "Rich and creamy. Use in curries and desserts."},
        ]
    },
    "yogurt": {
        "category": "Dairy",
        "substitutes": [
            {"name": "Coconut Yogurt",  "notes": "Best dairy-free swap. Same creamy texture."},
            {"name": "Soy Yogurt",      "notes": "High protein, tangy. Good in marinades and raita."},
            {"name": "Silken Tofu",     "notes": "Blend for a smooth, protein-rich base in dips."},
            {"name": "Cashew Cream",    "notes": "Soak cashews, blend with lemon and water."},
        ]
    },
    "butter": {
        "category": "Fat",
        "substitutes": [
            {"name": "Olive Oil",      "notes": "Heart-healthy fat. Use 3/4 the amount of butter called for."},
            {"name": "Coconut Oil",    "notes": "Solid at room temp. Swap 1:1 for baking."},
            {"name": "Avocado",        "notes": "For spreading on toast. Creamy and nutritious."},
            {"name": "Nut Butter",     "notes": "For baking -- use almond or peanut butter. Rich and nutty."},
        ]
    },
    "cream": {
        "category": "Dairy",
        "substitutes": [
            {"name": "Coconut Cream",         "notes": "Rich dairy-free swap. Best for curries and desserts."},
            {"name": "Cashew Cream",           "notes": "Blend soaked cashews + water for a neutral cream."},
            {"name": "Silken Tofu (blended)", "notes": "High protein, creamy. Good in soups and sauces."},
            {"name": "Greek Yogurt",           "notes": "For stirring into hot dishes -- reduces fat."},
        ]
    },
    "cheese": {
        "category": "Dairy",
        "substitutes": [
            {"name": "Nutritional Yeast", "notes": "Cheesy, nutty flavour. Sprinkle on pasta and salads."},
            {"name": "Cashew Cheese",     "notes": "Blend soaked cashews with lemon, garlic, and nutritional yeast."},
            {"name": "Goat Cheese",       "notes": "Easier to digest than cow cheese. Swap 1:1."},
            {"name": "Tofu (seasoned)",   "notes": "Crumble firm tofu with lemon and salt as a feta substitute."},
        ]
    },
    "ghee": {
        "category": "Fat",
        "substitutes": [
            {"name": "Coconut Oil",  "notes": "High smoke point. Good for Indian cooking. Swap 1:1."},
            {"name": "Olive Oil",    "notes": "Lighter option. Use for lower-heat cooking. Use 3/4 amount."},
            {"name": "Avocado Oil",  "notes": "Very high smoke point, neutral flavour. Exact swap."},
        ]
    },

    # -- Sweeteners -----------------------------------------------------------
    "sugar": {
        "category": "Sweetener",
        "substitutes": [
            {"name": "Jaggery",      "notes": "Lower GI, mineral-rich. Use same quantity."},
            {"name": "Maple Syrup",  "notes": "Use 3/4 cup per 1 cup sugar. Reduce liquids slightly."},
            {"name": "Honey",        "notes": "Use 3/4 amount. Stronger flavour; reduce liquids."},
            {"name": "Stevia",       "notes": "Zero calorie. Use 1/4 tsp per 1 cup sugar."},
            {"name": "Dates (paste)","notes": "Blend dates + water. 1:1 swap. Adds fibre and minerals."},
        ]
    },
    "honey": {
        "category": "Sweetener",
        "substitutes": [
            {"name": "Maple Syrup", "notes": "Vegan swap. Same liquid consistency. Swap 1:1."},
            {"name": "Date Syrup",  "notes": "Rich, caramel-like. Full of minerals."},
            {"name": "Agave Nectar","notes": "Lower GI than honey. Swap 1:1."},
            {"name": "Stevia",      "notes": "Zero calorie. Use 1/8 tsp per tablespoon of honey."},
        ]
    },
    "jaggery": {
        "category": "Sweetener",
        "substitutes": [
            {"name": "Brown Sugar",  "notes": "Similar colour and depth. Swap 1:1."},
            {"name": "Coconut Sugar","notes": "Lower GI, caramel flavour. Swap 1:1."},
            {"name": "Dates (paste)","notes": "Natural unrefined sweetness. Blend dates with warm water."},
        ]
    },

    # -- Oils & Fats ----------------------------------------------------------
    "olive oil": {
        "category": "Oil",
        "substitutes": [
            {"name": "Avocado Oil",  "notes": "Higher smoke point to use for frying. Swap 1:1."},
            {"name": "Coconut Oil",  "notes": "Solid at room temp. Adds slight coconut note."},
            {"name": "Sesame Oil",   "notes": "Strong Asian flavour. Use in smaller quantity."},
        ]
    },
    "vegetable oil": {
        "category": "Oil",
        "substitutes": [
            {"name": "Olive Oil",     "notes": "Healthier monounsaturated fats. Swap 1:1 for saut?ing."},
            {"name": "Coconut Oil",   "notes": "Good for high heat. Swap 1:1."},
            {"name": "Avocado Oil",   "notes": "Neutral flavour with very high smoke point."},
        ]
    },

    # -- Vegetables -----------------------------------------------------------
    "potato": {
        "category": "Vegetable",
        "substitutes": [
            {"name": "Sweet Potato",   "notes": "Sweeter taste, more nutrients. Roast or mash same way."},
            {"name": "Cauliflower",    "notes": "Mash, roast, or rice. Very low carb. Swap 1:1 by weight."},
            {"name": "Turnip",         "notes": "Less starchy, mild taste. Roasts well."},
            {"name": "Parsnip",        "notes": "Sweet and earthy. Roasts beautifully."},
        ]
    },
    "spinach": {
        "category": "Vegetable",
        "substitutes": [
            {"name": "Kale",          "notes": "Slightly tougher -- massage or cook longer. Very nutritious."},
            {"name": "Swiss Chard",   "notes": "Mild, cooks the same way as spinach."},
            {"name": "Rocket (Arugula)", "notes": "Peppery raw lead option for salads."},
            {"name": "Methi (Fenugreek leaves)", "notes": "Slightly bitter. Great in Indian dishes."},
        ]
    },
    "tomato": {
        "category": "Vegetable",
        "substitutes": [
            {"name": "Roasted Red Pepper", "notes": "Sweet, similar texture in sauces."},
            {"name": "Tamarind Paste",     "notes": "For tanginess in Indian cooking. Use 1 tsp per tomato."},
            {"name": "Canned Crushed Tomato", "notes": "Direct swap for cooking. Use 1/4 cup per fresh tomato."},
        ]
    },
    "onion": {
        "category": "Vegetable",
        "substitutes": [
            {"name": "Shallots",        "notes": "Milder and sweeter. Use same quantity."},
            {"name": "Leeks",           "notes": "Mild onion flavour. Use the white part. Swap 1:1."},
            {"name": "Spring Onions",   "notes": "Lighter flavour. Good raw or lightly cooked."},
            {"name": "Asafoetida (Hing)", "notes": "Tiny pinch replaces onion/garlic flavour in cooked dishes."},
        ]
    },

    # -- Nuts, Seeds & Nut Butters --------------------------------------------
    "peanut butter": {
        "category": "Nut Butter",
        "substitutes": [
            {"name": "Almond Butter", "notes": "Milder, slightly sweeter. Swap 1:1."},
            {"name": "Sunflower Seed Butter", "notes": "Nut-free option. Swap 1:1."},
            {"name": "Tahini",        "notes": "Sesame paste. Less sweet -- good in savoury dishes."},
        ]
    },
    "almonds": {
        "category": "Nut",
        "substitutes": [
            {"name": "Walnuts",    "notes": "Slightly more bitter. Swap 1:1 in baking and salads."},
            {"name": "Cashews",    "notes": "Creamier, milder. Swap 1:1 for snacking."},
            {"name": "Sunflower Seeds", "notes": "Nut-free. Swap 1:1 for crunch."},
            {"name": "Pumpkin Seeds",   "notes": "Crunchy and nutritious. Great in granola and salads."},
        ]
    },

    # -- Legumes --------------------------------------------------------------
    "chickpeas": {
        "category": "Legume",
        "substitutes": [
            {"name": "White Beans",    "notes": "Creamy texture in soups and stews. Swap 1:1."},
            {"name": "Lentils",        "notes": "Cook faster. Swap 1:1 by weight."},
            {"name": "Black Beans",    "notes": "Heartier flavour. Great in Mexican dishes."},
            {"name": "Tofu (firm)",    "notes": "For salads and curries -- cube and toss."},
        ]
    },
    "lentils": {
        "category": "Legume",
        "substitutes": [
            {"name": "Split Peas",  "notes": "Similar texture. Swap 1:1 in soups and dal."},
            {"name": "Chickpeas",   "notes": "Heartier. Cook longer. Swap 1:1."},
            {"name": "Tofu",        "notes": "For protein in curries. Cube and add."},
            {"name": "Quinoa",      "notes": "For salads where you want a lighter protein base."},
        ]
    },

    # -- Spices & Aromatics ---------------------------------------------------
    "garam masala": {
        "category": "Spice",
        "substitutes": [
            {"name": "Curry Powder",     "notes": "Milder blend. Use same amount -- adjust chili separately."},
            {"name": "Allspice + Cumin", "notes": "1/2 tsp allspice + 1/2 tsp cumin approximates garam masala."},
            {"name": "Ras el Hanout",    "notes": "North African blend with similar warming notes."},
        ]
    },
    "cumin": {
        "category": "Spice",
        "substitutes": [
            {"name": "Coriander seeds", "notes": "Milder but similar earthy note. Swap 1:1."},
            {"name": "Caraway seeds",   "notes": "Very close to cumin. Swap 1:1."},
            {"name": "Fennel seeds",    "notes": "Slightly sweeter. Use 3/4 of the quantity."},
        ]
    },
    "coriander": {
        "category": "Herb",
        "substitutes": [
            {"name": "Parsley",  "notes": "Milder than coriander. Swap 1:1 in cooked dishes."},
            {"name": "Mint",     "notes": "For freshness in raita and chutneys."},
            {"name": "Basil",    "notes": "For Mediterranean-style dishes."},
        ]
    },
    "turmeric": {
        "category": "Spice",
        "substitutes": [
            {"name": "Saffron (tiny pinch)", "notes": "Provides colour and flavour. Use sparingly."},
            {"name": "Curry Powder",          "notes": "Contains turmeric + more spices. Use same quantity."},
            {"name": "Ginger",                "notes": "Different flavour but similar anti-inflammatory benefits."},
        ]
    },
}


def _get_preference_substitution(original_name: str, ingredient: str, preference: str) -> dict:
    """Return category-based voluntary substitutes for any ingredient."""
    # Direct match
    matched_key = None
    for key in VOLUNTARY_SUBSTITUTES:
        if key == ingredient or key in ingredient or ingredient in key:
            matched_key = key
            break

    # Fuzzy: check if any word of the ingredient matches a key
    if not matched_key:
        words = ingredient.split()
        for word in words:
            if len(word) > 3:
                for key in VOLUNTARY_SUBSTITUTES:
                    if word in key or key in word:
                        matched_key = key
                        break
            if matched_key:
                break

    if matched_key:
        data    = VOLUNTARY_SUBSTITUTES[matched_key]
        subs    = list(data["substitutes"])
        # Filter for vegans
        if preference == "Vegan":
            subs = [s for s in subs if not any(
                x in s["name"].lower()
                for x in ["paneer", "milk", "yogurt", "cream", "butter", "cheese", "egg", "meat", "chicken", "beef", "lamb", "salmon", "fish", "turkey"]
            )]
        if preference == "Vegetarian":
            subs = [s for s in subs if not any(
                x in s["name"].lower()
                for x in ["chicken", "beef", "lamb", "salmon", "tuna", "fish", "turkey", "bacon", "ham", "pork"]
            )]
        return {
            "ingredient":        original_name,
            "mode":              "preference",
            "category":          data.get("category", "General"),
            "reason":            f"You requested a swap for {original_name.capitalize()}. Here are alternatives in the same food category.",
            "substitutes":       subs,
            "condition_specific": False
        }

    # Fallback generic
    return {
        "ingredient":        original_name,
        "mode":              "preference",
        "category":          "General",
        "reason":            f"No specific preference substitutes found for {original_name.capitalize()}. Here are some general swaps based on its food type.",
        "substitutes": [
            {"name": "Check Food & Ingredients page", "notes": "Browse the ingredient list for alternatives in the same category."},
        ],
        "condition_specific": False
    }


@app.get("/api/substitution/{ingredient_name}")
def get_substitution(
    ingredient_name: str,
    mode: str = "health",
    user=Depends(get_current_user)
):
    """
    Rule-based ingredient substitution engine.
    Supports two modes:
      - health     (default): condition-aware substitutes based on user's health conditions
      - preference           : voluntary swap based on food category (any reason)
    """
    conditions = json.loads(user["conditions"]) if isinstance(user["conditions"], str) else user["conditions"]
    preference = user["preference"]
    ingredient = ingredient_name.lower().strip()

    # -- Route by mode ---------------------------------------------------------
    if mode == "preference":
        return _get_preference_substitution(ingredient_name, ingredient, preference)

    # -- Health mode (original logic below) ------------------------------------

    # Load substitution rules
    substitution_map = {
        # Dairy substitutes
        "paneer": {
            "reason": "Paneer contains lactose which may be unsuitable for lactose intolerance. Also high in saturated fat.",
            "substitutes": [
                {"name": "Firm Tofu", "amount": "Same amount", "unit": "", "notes": "Best 1:1 substitute. Press and cube like paneer. Dairy-free and lower in fat."},
                {"name": "Soya Chunks", "amount": "Half the amount", "unit": "", "notes": "Soak in warm water before use. High protein, dairy-free."},
            ]
        },
        "yogurt": {
            "reason": "Regular yogurt contains lactose. Avoid if lactose intolerant.",
            "substitutes": [
                {"name": "Coconut Yogurt", "amount": "Same amount", "unit": "", "notes": "Best dairy-free substitute. Same creamy texture."},
                {"name": "Soy Yogurt", "amount": "Same amount", "unit": "", "notes": "High protein dairy-free alternative."},
            ]
        },
        "milk": {
            "reason": "Dairy milk contains lactose. Avoid if lactose intolerant.",
            "substitutes": [
                {"name": "Almond Milk (unsweetened)", "amount": "Same amount", "unit": "", "notes": "Best low-calorie dairy-free milk. Very low GI."},
                {"name": "Coconut Milk", "amount": "Same amount", "unit": "", "notes": "Richer option. Use for curries and desserts."},
                {"name": "Oat Milk", "amount": "Same amount", "unit": "", "notes": "Neutral taste. Good for tea and smoothies."},
            ]
        },
        "cream": {
            "reason": "Dairy cream is high in saturated fat and contains lactose.",
            "substitutes": [
                {"name": "Coconut Cream", "amount": "Same amount", "unit": "", "notes": "Perfect dairy-free substitute for rich curries."},
                {"name": "Cashew Cream", "amount": "Same amount", "unit": "", "notes": "Blend soaked cashews with water for a neutral cream."},
            ]
        },
        "butter": {
            "reason": "Butter is high in saturated fat and contains dairy.",
            "substitutes": [
                {"name": "Coconut Oil", "amount": "3/4 amount", "unit": "", "notes": "Good for high-heat cooking. Dairy-free."},
                {"name": "Olive Oil", "amount": "3/4 amount", "unit": "", "notes": "Best for heart health. Use for saut?ing."},
            ]
        },
        # High GI / Diabetic substitutes
        "white rice": {
            "reason": "White rice has a very high glycemic index (GI ~73) causing rapid blood sugar spikes.",
            "substitutes": [
                {"name": "Brown Rice", "amount": "Same amount", "unit": "", "notes": "Lower GI (~50). Takes longer to cook but much better for blood sugar."},
                {"name": "Cauliflower Rice", "amount": "Same amount", "unit": "", "notes": "Extremely low carb. Grate cauliflower and stir-fry. Best for diabetics."},
                {"name": "Quinoa", "amount": "Same amount", "unit": "", "notes": "Low GI, high protein. Cook like rice."},
            ]
        },
        "potato": {
            "reason": "Potato has a high glycemic index (GI ~78) -- not ideal for diabetics.",
            "substitutes": [
                {"name": "Sweet Potato", "amount": "Same amount", "unit": "", "notes": "Much lower GI (~44). More nutritious with more fiber."},
                {"name": "Cauliflower", "amount": "Same amount", "unit": "", "notes": "Very low carb substitute for mashed potato dishes."},
            ]
        },
        "sugar": {
            "reason": "Refined sugar causes immediate blood sugar spikes -- dangerous for diabetics.",
            "substitutes": [
                {"name": "Stevia", "amount": "1/4 amount", "unit": "", "notes": "Zero calorie natural sweetener. Zero GI. No blood sugar impact."},
                {"name": "Jaggery", "amount": "3/4 amount", "unit": "", "notes": "Lower GI than sugar. Use in moderation."},
            ]
        },
        "honey": {
            "reason": "Honey has a medium-high GI (~58) and raises blood sugar significantly.",
            "substitutes": [
                {"name": "Stevia", "amount": "Few drops", "unit": "", "notes": "Zero calorie, zero GI. Diabetic safe sweetener."},
                {"name": "Date Syrup", "amount": "Same amount", "unit": "", "notes": "Lower GI than honey with more minerals."},
            ]
        },
        # Gluten substitutes
        "whole wheat flour": {
            "reason": "Wheat flour contains gluten -- unsafe for Celiac disease.",
            "substitutes": [
                {"name": "Ragi (Finger Millet) Flour", "amount": "Same amount", "unit": "", "notes": "Gluten-free. High calcium. Makes excellent rotis."},
                {"name": "Jowar (Sorghum) Flour", "amount": "Same amount", "unit": "", "notes": "Gluten-free. Mild taste. Good for flatbreads."},
                {"name": "Besan (Chickpea Flour)", "amount": "Same amount", "unit": "", "notes": "Gluten-free. High protein. Great for cheelas and curries."},
            ]
        },
        "maida": {
            "reason": "Maida (refined flour) contains gluten and is high GI -- avoid for Celiac and Diabetes.",
            "substitutes": [
                {"name": "Rice Flour", "amount": "Same amount", "unit": "", "notes": "Gluten-free. Light texture for batters."},
                {"name": "Almond Flour", "amount": "Same amount", "unit": "", "notes": "Gluten-free, low carb. Good for baking."},
            ]
        },
        "semolina rava": {
            "reason": "Semolina/Rava is made from wheat and contains gluten.",
            "substitutes": [
                {"name": "Quinoa", "amount": "Same amount", "unit": "", "notes": "Gluten-free grain with similar texture when cooked."},
                {"name": "Oats (certified GF)", "amount": "Same amount", "unit": "", "notes": "Use certified gluten-free oats as substitute."},
            ]
        },
        # Protein substitutes
        "chicken breast": {
            "reason": "Non-vegetarian protein. Suitable substitute needed for vegetarians.",
            "substitutes": [
                {"name": "Firm Tofu", "amount": "Same amount", "unit": "", "notes": "Best vegetarian substitute. High protein, low fat."},
                {"name": "Soya Chunks", "amount": "3/4 amount", "unit": "", "notes": "Soak before use. Very high plant protein."},
                {"name": "Paneer", "amount": "Same amount", "unit": "", "notes": "For non-lactose intolerant vegetarians."},
            ]
        },
        # Oil substitutes
        "oil": {
            "reason": "Regular refined oils are high in unhealthy fats.",
            "substitutes": [
                {"name": "Olive Oil", "amount": "Same amount", "unit": "", "notes": "Best for heart health. Rich in monounsaturated fats."},
                {"name": "Coconut Oil", "amount": "Same amount", "unit": "", "notes": "Good for high heat cooking. Use in moderation."},
            ]
        },
    }

    # Find the best match
    matched_key = None
    for key in substitution_map:
        if key in ingredient or ingredient in key:
            matched_key = key
            break

    if not matched_key:
        # Generic substitution based on nutrition data
        nutrition = NUTRITION["ingredients"].get(ingredient, {})
        if not nutrition:
            return {
                "ingredient": ingredient_name,
                "reason": "This ingredient is generally safe. No specific substitution needed.",
                "substitutes": [
                    {"name": "Keep original", "amount": "Same amount", "unit": "", "notes": "This ingredient is suitable for your conditions."}
                ],
                "condition_specific": False
            }

        # Build generic reason based on conditions
        reasons = []
        for cond in conditions:
            avoid = NUTRITION["condition_guidelines"].get(cond, {}).get("avoid_completely", [])
            if any(a.lower() in ingredient for a in avoid):
                reasons.append(f"Avoid for {cond}")

        return {
            "ingredient": ingredient_name,
            "reason": ", ".join(reasons) if reasons else "Consider healthier alternatives",
            "substitutes": [
                {"name": "Consult nutrition guide", "amount": "", "unit": "", "notes": "Check the Nutrition Lookup tab in Food & Ingredients for safe alternatives."}
            ],
            "condition_specific": bool(reasons)
        }

    data = substitution_map[matched_key]

    # Filter substitutes based on preference
    substitutes = data["substitutes"]
    if preference == "Vegan":
        substitutes = [s for s in substitutes if "paneer" not in s["name"].lower() and "yogurt" not in s["name"].lower()]

    return {
        "ingredient": ingredient_name,
        "reason": data["reason"],
        "substitutes": substitutes,
        "condition_specific": True,
        "conditions": conditions
    }
# ===============================================================================
# ML ENDPOINTS -- paste these at the bottom of main.py
# ===============================================================================

# ML engine is initialised in the lifespan handler above (module-level `ml_engine`).

@app.get("/api/ml/recommend")
def ml_recommend(top_n: int = 10, user=Depends(get_current_user)):
    """
    ML-powered recipe recommendations using:
    - TF-IDF content-based filtering
    - NLTK preference matching
    - Weighted scoring engine
    """
    if not ml_engine:
        raise HTTPException(status_code=503, detail="ML engine not available")

    user_profile = {
        "conditions": json.loads(user["conditions"]) if isinstance(user["conditions"], str) else user["conditions"],
        "preference": user["preference"],
        "likes":      json.loads(user["likes"])      if isinstance(user["likes"], str)      else user["likes"],
        "dislikes":   json.loads(user["dislikes"])   if isinstance(user["dislikes"], str)   else user["dislikes"],
        "goal":       user["goal"],
        "age":        user["age"],
        "weight":     user["weight"],
        "height":     user["height"],
    }

    results = ml_engine.get_ranked_recommendations(user_profile, top_n=top_n)

    return {
        "success":    True,
        "model":      "TF-IDF + NLTK + Weighted Scoring",
        "total":      len(results),
        "recipes":    results
    }


@app.get("/api/ml/analyze/{recipe_id}")
def ml_analyze_recipe(recipe_id: str, user=Depends(get_current_user)):
    """
    Detailed ML analysis of a single recipe for the current user.
    Uses Decision Tree classifier + NLP matcher.
    """
    if not ml_engine:
        raise HTTPException(status_code=503, detail="ML engine not available")

    recipe = next((r for r in RECIPES if r["id"] == recipe_id), None)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    user_profile = {
        "conditions": json.loads(user["conditions"]) if isinstance(user["conditions"], str) else user["conditions"],
        "preference": user["preference"],
        "likes":      json.loads(user["likes"])      if isinstance(user["likes"], str)      else user["likes"],
        "dislikes":   json.loads(user["dislikes"])   if isinstance(user["dislikes"], str)   else user["dislikes"],
        "goal":       user["goal"],
    }

    analysis = ml_engine.score_recipe(recipe, user_profile)

    return {
        "success":  True,
        "recipe":   recipe["name"],
        "analysis": analysis
    }


@app.get("/api/ml/ingredient-safety/{ingredient_name}")
def ml_ingredient_safety(ingredient_name: str, user=Depends(get_current_user)):
    """
    Decision Tree prediction of ingredient safety for user's conditions.
    """
    if not ml_engine:
        raise HTTPException(status_code=503, detail="ML engine not available")

    conditions = json.loads(user["conditions"]) if isinstance(user["conditions"], str) else user["conditions"]
    nutrition  = NUTRITION["ingredients"].get(ingredient_name.lower(), {})

    if not nutrition:
        return {
            "ingredient": ingredient_name,
            "predictions": [],
            "message": "Ingredient not found in nutrition database"
        }

    predictions = []
    for condition in conditions:
        pred = ml_engine.classifier.predict(nutrition, condition)
        predictions.append({
            "condition":  condition,
            **pred
        })

    return {
        "ingredient":  ingredient_name,
        "predictions": predictions,
        "model":       "Decision Tree Classifier"
    }


@app.get("/api/ml/nlp-match")
def ml_nlp_match(recipe_id: str, user=Depends(get_current_user)):
    """
    NLP-based matching of recipe ingredients against user preferences.
    Uses NLTK tokenization + Porter Stemmer.
    """
    if not ml_engine:
        raise HTTPException(status_code=503, detail="ML engine not available")

    recipe = next((r for r in RECIPES if r["id"] == recipe_id), None)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")

    likes    = json.loads(user["likes"])    if isinstance(user["likes"], str)    else user["likes"]
    dislikes = json.loads(user["dislikes"]) if isinstance(user["dislikes"], str) else user["dislikes"]

    result = ml_engine.nlp_matcher.match_score(recipe, likes, dislikes)

    return {
        "recipe":  recipe["name"],
        "result":  result,
        "model":   "NLTK Tokenizer + Porter Stemmer"
    }


@app.post("/api/auth/send-login-otp")
def send_login_otp(req: SendOTPRequest):
    """
    Send OTP for login verification.
    Checks user exists before sending.
    """
    from otp_service import generate_otp, store_otp, send_otp_email

    conn = get_db()
    user = conn.execute("SELECT id, name FROM users WHERE email = ?", (req.email.lower(),)).fetchone()
    conn.close()

    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email. Please sign up first.")

    name = user["name"]
    otp  = generate_otp()
    store_otp(req.email, otp)
    sent = send_otp_email(req.email, otp, name)

    if not sent:
        raise HTTPException(status_code=500, detail="Failed to send OTP. Please check your email address.")

    return {
        "success":    True,
        "message":    f"Verification code sent to {req.email}",
        "expires_in": "10 minutes"
    }


# ── Food Log Endpoints ─────────────────────────────────────────────────────────

class FoodLogEntry(BaseModel):
    recipe_id: Optional[str] = None
    name: str
    calories: float = 0
    protein: float = 0
    carbs: float = 0
    fat: float = 0
    meal_type: str = "Meal"   # Breakfast | Lunch | Snack | Dinner | Meal
    logged_at: Optional[str] = None  # ISO date YYYY-MM-DD, defaults to today

@app.post("/api/food-log")
def add_food_log(entry: FoodLogEntry, user=Depends(get_current_user)):
    import time as _time
    date = entry.logged_at or datetime.now().strftime("%Y-%m-%d")
    conn = get_db()
    c = conn.execute(
        """INSERT INTO food_logs (user_id, recipe_id, name, calories, protein, carbs, fat, meal_type, logged_at)
           VALUES (?,?,?,?,?,?,?,?,?)""",
        (user["id"], entry.recipe_id, entry.name, entry.calories,
         entry.protein, entry.carbs, entry.fat, entry.meal_type, date)
    )
    new_id = c.lastrowid
    conn.commit()
    conn.close()
    return {"success": True, "id": new_id, "logged_at": date}

@app.get("/api/food-log")
def get_food_log(date: Optional[str] = None, user=Depends(get_current_user)):
    """Return all food log entries for a given date (defaults to today)."""
    target = date or datetime.now().strftime("%Y-%m-%d")
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM food_logs WHERE user_id = ? AND logged_at = ? ORDER BY id ASC",
        (user["id"], target)
    ).fetchall()
    conn.close()
    entries = [dict(r) for r in rows]
    totals = {
        "calories": sum(e["calories"] for e in entries),
        "protein":  sum(e["protein"]  for e in entries),
        "carbs":    sum(e["carbs"]    for e in entries),
        "fat":      sum(e["fat"]      for e in entries),
    }
    return {"date": target, "entries": entries, "totals": totals}

@app.get("/api/food-log/history")
def get_food_log_history(days: int = 7, user=Depends(get_current_user)):
    """Return per-day calorie summary for the past N days."""
    conn = get_db()
    rows = conn.execute(
        """SELECT logged_at, SUM(calories) as calories, SUM(protein) as protein,
                  SUM(carbs) as carbs, SUM(fat) as fat, COUNT(*) as meals
           FROM food_logs WHERE user_id = ?
           GROUP BY logged_at ORDER BY logged_at DESC LIMIT ?""",
        (user["id"], days)
    ).fetchall()
    conn.close()
    return {"history": [dict(r) for r in rows]}

@app.delete("/api/food-log/{entry_id}")
def delete_food_log(entry_id: int, user=Depends(get_current_user)):
    conn = get_db()
    result = conn.execute(
        "DELETE FROM food_logs WHERE id = ? AND user_id = ?",
        (entry_id, user["id"])
    )
    conn.commit()
    conn.close()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Log entry not found")
    return {"success": True}

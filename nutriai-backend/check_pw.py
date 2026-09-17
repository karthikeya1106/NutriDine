from passlib.context import CryptContext
import sqlite3, hashlib

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
conn = sqlite3.connect("nutriai.db")
conn.row_factory = sqlite3.Row
user = conn.execute("SELECT password FROM users WHERE email=?", ("dynamicriderz418@gmail.com",)).fetchone()
conn.close()

stored = user["password"]
is_bcrypt = stored.startswith("$2")
print(f"Hash type: {'bcrypt' if is_bcrypt else 'sha256_legacy'}")
print(f"Hash preview: {stored[:50]}")

test_passwords = ["Admin@123", "admin@123", "Test@123", "Karthik@1", "karthik", "password123", "NutriDine@1", "Karthikeya@1"]
for pw in test_passwords:
    if not is_bcrypt:
        match = hashlib.sha256(pw.encode()).hexdigest() == stored
    else:
        try:
            match = pwd_context.verify(pw, stored)
        except Exception:
            match = False
    if match:
        print(f"PASSWORD MATCH: {pw}")
        break
else:
    print("None of the test passwords matched - user must use their own password")

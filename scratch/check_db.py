import sqlite3
import os

db_path = 'backend/discipline.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT username FROM users")
    users = cursor.fetchall()
    print("Users in DB:", [u[0] for u in users])
    conn.close()
else:
    print("DB not found at", db_path)

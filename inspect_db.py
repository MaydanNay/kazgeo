import sqlite3
import os

db_path = "kazgeo.db"
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    print("--- Users Table ---")
    cursor.execute("SELECT id, name, email, is_approved FROM users")
    users = cursor.fetchall()
    for u in users:
        print(f"ID: {u[0]}, Name: {u[1]}, Email: {u[2]}, Approved: {u[3]}")
    
    print("\n--- NDA Requests Table ---")
    cursor.execute("SELECT id, user_id, status, file_path FROM nda_requests")
    reqs = cursor.fetchall()
    for r in reqs:
        print(f"ID: {r[0]}, UserID: {r[1]}, Status: {r[2]}, File: {r[3]}")
    
    conn.close()
else:
    print(f"{db_path} not found.")

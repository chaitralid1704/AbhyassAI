import firebase_admin
from firebase_admin import credentials, firestore

try:
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
except ValueError:
    pass # App already initialized

db = firestore.client()
links = db.collection("parent_student_links").stream()
print("parent_student_links:")
for l in links:
    print(l.to_dict())

users = db.collection("users").stream()
print("\nUsers:")
for u in users:
    d = u.to_dict()
    if d.get("role") == "student":
        print(f"UID: {u.id}, Name: {d.get('name')}, Referral: {d.get('referralCode')}")

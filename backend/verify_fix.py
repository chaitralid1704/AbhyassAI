import asyncio
import firebase_admin
from firebase_admin import credentials, firestore
import main  # Import the main.py to use its functions and settings

async def verify_notification():
    # 1. Setup Firebase (it might already be initialized in main)
    if not firebase_admin._apps:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    
    student_id = "9DMYRXQkBwhGrMggUl8Y4oMqf2G3"
    topic = "Mathematics"
    
    print(f"Simulating notification check for student {student_id} on topic '{topic}'...")
    
    # We don't need to add a real quiz attempt, we can just call the function.
    # But if there are no attempts, it will return early.
    # Let's check if there are any attempts first.
    db = firestore.client()
    docs = db.collection("users").document(student_id).collection("quiz_attempts").where("topic", "==", topic).limit(1).get()
    
    if not docs:
        print(f"No quiz attempts found for {topic}. Adding a dummy one for testing...")
        db.collection("users").document(student_id).collection("quiz_attempts").add({
            "topic": topic,
            "accuracy": 25,
            "timestamp": firestore.SERVER_TIMESTAMP
        })
    
    # Now call the function
    await main.notify_parents_if_weak(student_id, topic)
    print("Notification check completed. Check the console for 'Notifying parent...' messages.")

if __name__ == "__main__":
    asyncio.run(verify_notification())

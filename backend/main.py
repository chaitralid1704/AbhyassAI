from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import firebase_admin
from firebase_admin import credentials, firestore
import json
import sqlite3
import re
import os

import PyPDF2
import tempfile
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import base64
import io
from gtts import gTTS
import google.generativeai as genai
from pydantic_settings import BaseSettings, SettingsConfigDict
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import urllib.request
import urllib.error

app = FastAPI()

def init_sqlite_db():
    conn = sqlite3.connect("learning_notes.db")
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS notes (
                 id TEXT PRIMARY KEY,
                 uid TEXT,
                 subject TEXT,
                 level TEXT,
                 content TEXT,
                 timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
              )''')
    c.execute('''CREATE TABLE IF NOT EXISTS roadmaps (
                 uid TEXT PRIMARY KEY,
                 goal TEXT,
                 data TEXT,
                 updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )''')
    c.execute('''CREATE TABLE IF NOT EXISTS daily_missions (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 uid TEXT,
                 task TEXT,
                 completed INTEGER DEFAULT 0,
                 score INTEGER DEFAULT 0,
                 date TEXT,
                 UNIQUE(uid, task, date)
              )''')
    c.execute('''CREATE TABLE IF NOT EXISTS tutor_context (
                 uid TEXT PRIMARY KEY,
                 material_text TEXT,
                 updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
              )''')
    conn.commit()
    conn.close()

init_sqlite_db()

# Allow CORS so the Next.js frontend can make requests to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:3002", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration for Gemini AI
class Settings(BaseSettings):
    gemini_api_key: str = ""
    email_user: str = ""
    email_pass: str = ""
    heygen_api_key: str = "sk_V2_hgu_kSMjRD4wWbn_H2UnYqaCOjnZQgabBaFfwINik9VmWlpc"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

def parse_json_res(text):
    """Robustly extracts JSON from AI responses that might use markdown or extra text."""
    try:
        # 1. Search for triple backtick blocks (```json ... ``` or ``` ... ```)
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
        if json_match:
            return json.loads(json_match.group(1).strip())
        
        # 2. Fallback: Search for the first [ or { and last ] or }
        json_match = re.search(r'(\[|\{)[\s\S]*(\]|\})', text)
        if json_match:
            return json.loads(json_match.group(0).strip())
        
        # 3. Last fallback: try parsing the whole thing
        return json.loads(text.strip())
    except Exception as e:
        print(f"JSON Parse Error: {e} | Raw Text: {text[:100]}...")
        return None

if settings.gemini_api_key:
    genai.configure(api_key=settings.gemini_api_key)
    print("GEMINI_API_KEY loaded successfully")
else:
    print("WARNING: GEMINI_API_KEY not found in environment or .env!")

# Initialize Firebase Admin SDK
cred_path = "serviceAccountKey.json"
if os.path.exists(cred_path):
    # Only initialize if not already initialized
    if not firebase_admin._apps:
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
    db = firestore.client()
else:
    print("WARNING: serviceAccountKey.json not found! Firestore calls will fail.")
    db = None

# ---- Pydantic Models ----

class UserModels(BaseModel):
    uid: str
    email: Optional[str] = None
    phone: Optional[str] = None
    name: Optional[str] = "User"
    role: Optional[str] = "student"
    username: Optional[str] = None
    age: Optional[int] = None

class LinkStudentRequest(BaseModel):
    parentId: str
    referralCode: str

class DefaultCollectionRequest(BaseModel):
    uid: str

class Flashcard(BaseModel):
    id: Optional[str] = None
    question: str
    answer: str
    easiness_factor: Optional[float] = 2.5
    interval: Optional[float] = 0.0  # Represents days.
    next_review_date: Optional[str] = None

class QuizAttemptRequest(BaseModel):
    uid: str
    topic: str
    score: int
    total: int

class ReviewFlashcardRequest(BaseModel):
    uid: str
    collection_id: str
    set_id: str
    card_id: str
    quality: int # 0=Again, 1=Hard, 2=Good, 3=Easy

class RoadmapRequest(BaseModel):
    uid: str
    goal: str

class QuickNotesRequest(BaseModel):
    subject: str
    level: str

class DailyMissionRequest(BaseModel):
    uid: str
    topic: Optional[str] = None
    roadmap: Optional[List[dict]] = None

class DiagramRequest(BaseModel):
    text: str
    diagramType: Optional[str] = "flowchart"

class TutorContextRequest(BaseModel):
    uid: str
    material_text: str

class SaveFlashcardsRequest(BaseModel):
    uid: str
    collection_id: str
    collection_name: str
    flashcards: List[Flashcard]

class QuizRequest(BaseModel):
    text: str
    count: Optional[int] = 5

class RoadmapQuizRequest(BaseModel):
    uid: str
    week_index: int
    focus: str
    milestones: List[str]

class UserActivityRequest(BaseModel):
    uid: str
    xp_gained: int
    collection_id: Optional[str] = None

class MissionSyncRequest(BaseModel):
    uid: str
    tasks: List[str]

class MissionCompleteRequest(BaseModel):
    uid: str
    task_id: Optional[Any] = None
    task_text: Optional[str] = None
    score: int


# ---- API Routes ----

@app.post("/api/users")
async def save_user(user: UserModels):
    if db is None:
        raise HTTPException(status_code=500, detail="Firestore not initialized")
    try:
        user_ref = db.collection("users").document(user.uid)
        user_data = {
            "uid": user.uid,
            "email": user.email,
            "phone": user.phone,
            "name": user.name,
            "role": user.role,
            "username": user.username,
            "age": user.age,
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
        
        # Keep existing referralCode if present, otherwise generate new one for students
        existing_doc = user_ref.get()
        if existing_doc.exists:
            existing_data = existing_doc.to_dict()
            if "referralCode" in existing_data:
                user_data["referralCode"] = existing_data["referralCode"]
            elif user.role == "student":
                user_data["referralCode"] = user.uid[:6].upper()
        else:
            if user.role == "student":
                user_data["referralCode"] = user.uid[:6].upper()

        user_ref.set(user_data, merge=True)
        return {"status": "success", "message": "User saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/check-username")
async def check_username(username: str):
    if db is None:
        raise HTTPException(status_code=500, detail="Firestore not initialized")
    try:
        query = db.collection("users").where("username", "==", username).limit(1).stream()
        for doc in query:
            return {"exists": True}
        return {"exists": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/get-email-by-username")
async def get_email_by_username(username: str):
    if db is None:
        raise HTTPException(status_code=500, detail="Firestore not initialized")
    try:
        query = db.collection("users").where("username", "==", username).limit(1).stream()
        for doc in query:
            email = doc.to_dict().get("email")
            if email:
                return {"email": email}
        raise HTTPException(status_code=404, detail="Username not found or missing email mapping")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/collections/default")
async def create_default_collection(request: DefaultCollectionRequest):
    if db is None:
        raise HTTPException(status_code=500, detail="Firestore not initialized")
    try:
        col_ref = db.collection("users").document(request.uid).collection("collections").document("Auto")
        col_ref.set({
            "name": "My First Collection",
            "createdAt": firestore.SERVER_TIMESTAMP,
        }, merge=True)
        return {"status": "success", "message": "Default collection created"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/collections")
async def get_collections(uid: str):
    if db is None:
        raise HTTPException(status_code=500, detail="Firestore not initialized")
    try:
        collections_ref = db.collection("users").document(uid).collection("collections")
        docs = collections_ref.stream()
        collections = []
        for doc in docs:
            data = doc.to_dict()
            data["id"] = doc.id
            if "createdAt" in data and hasattr(data["createdAt"], "timestamp"):
                data.pop("createdAt", None)
            collections.append(data)
        return {"collections": collections}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/flashcards")
async def save_flashcards(request: SaveFlashcardsRequest):
    if db is None:
        raise HTTPException(status_code=500, detail="Firestore not initialized")
    try:
        flashcard_set_ref = db.collection("users").document(request.uid)\
            .collection("collections").document(request.collection_id)\
            .collection("flashcardSets")
        valid_cards = []
        for card in request.flashcards:
            valid_cards.append({
                "id": card.id or str(uuid.uuid4()),
                "question": card.question,
                "answer": card.answer,
                "easiness_factor": card.easiness_factor or 2.5,
                "interval": card.interval or 0.0,
                "next_review_date": card.next_review_date or datetime.utcnow().isoformat()
            })
        flashcard_set_ref.add({
            "name": request.collection_name,
            "flashcards": valid_cards,
            "createdAt": firestore.SERVER_TIMESTAMP,
        })
        return {"status": "success", "message": "Flashcards saved successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/collections/{collection_id}/flashcards")
async def get_collection_flashcards(collection_id: str, uid: str):
    if db is None:
        raise HTTPException(status_code=500, detail="Firestore not initialized")
    try:
        sets_ref = db.collection("users").document(uid).collection("collections").document(collection_id).collection("flashcardSets")
        docs = sets_ref.order_by("createdAt", direction=firestore.Query.DESCENDING).stream()
        all_flashcards = []
        for doc in docs:
            data = doc.to_dict()
            if "flashcards" in data:
                for c in data["flashcards"]:
                    c["set_id"] = doc.id
                all_flashcards.extend(data["flashcards"])
        return {"flashcards": all_flashcards}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class GenerateFlashcardsRequest(BaseModel):
    text: str
    count: Optional[int] = 10

@app.post("/api/flashcards/generate")
async def generate_flashcards(request: GenerateFlashcardsRequest):
    if not settings.gemini_api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key not configured")
    try:
        model_names = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-flash-latest']
        prompt = f"""Generate {request.count} flashcards from the text below.
For each flashcard, use this exact format:
Q: <question here>
A: <answer here>

Separate each flashcard with a blank line.
Text: {request.text}"""
        last_error = None
        for m_name in model_names:
            try:
                model = genai.GenerativeModel(m_name)
                response = model.generate_content(prompt)
                if response and response.text:
                    return {"text": response.text.strip()}
            except Exception as e:
                last_error = str(e)
                continue
        raise HTTPException(status_code=500, detail=f"AI failed to generate flashcards. Last error: {last_error}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/collections")
async def create_collection(request: dict):
    if db is None:
        raise HTTPException(status_code=500, detail="Firestore not initialized")
    try:
        uid = request.get("uid")
        name = request.get("name", "New Collection")
        if not uid:
            raise HTTPException(status_code=400, detail="uid is required")
        col_ref = db.collection("users").document(uid).collection("collections").document()
        col_ref.set({
            "name": name,
            "createdAt": firestore.SERVER_TIMESTAMP,
        })
        return {"status": "success", "id": col_ref.id, "name": name}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/file")
async def extract_text_from_file(file: UploadFile = File(...)):
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name
        text_content = ""
        with open(tmp_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                text = page.extract_text()
                if text: text_content += text + "\n"
        os.unlink(tmp_path)
        return {"text": text_content.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to extract text from file")

@app.post("/api/quiz/generate")
async def generate_quiz(request: QuizRequest):
    if not settings.gemini_api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key not configured")
    try:
        model_names = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-flash-latest']
        prompt = f"""
        Generate {request.count} multiple choice questions based on the text below.
        Return ONLY a JSON array of objects with these keys: 
        "question": string, "options": array of 4 strings, "answer": string, "explanation": string
        Text: {request.text}
        """
        for m_name in model_names:
            try:
                model = genai.GenerativeModel(m_name)
                response = model.generate_content(prompt)
                if response:
                    content = response.text.strip()
                    if content.startswith("```json"): content = content[7:-3].strip()
                    elif content.startswith("```"): content = content[3:-3].strip()
                    return {"questions": json.loads(content)}
            except: continue
        raise HTTPException(status_code=500, detail="AI failed to generate quiz")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/user/{uid}/stats")
async def get_user_stats(uid: str):
    if db is None:
        raise HTTPException(status_code=500, detail="Firestore not initialized")
    user_ref = db.collection("users").document(uid)
    doc = user_ref.get()
    if not doc.exists:
        return {"xp": 0, "level": 1, "streak": 0, "lastActive": None, "role": "student"}
    data = doc.to_dict()
    return {
        "xp": data.get("xp", 0),
        "level": data.get("level", 1),
        "streak": data.get("streak", 0),
        "lastActive": data.get("lastActive"),
        "role": data.get("role", "student"),
        "referralCode": data.get("referralCode")
    }

@app.post("/api/user/{uid}/activity")
async def update_user_activity(uid: str, request: UserActivityRequest):
    if db is None:
        raise HTTPException(status_code=500, detail="Firestore not initialized")
    user_ref = db.collection("users").document(uid)
    doc = user_ref.get()
    today = datetime.utcnow().date()
    if not doc.exists:
        user_data = {"xp": request.xp_gained, "level": 1 + (request.xp_gained // 100), "streak": 1, "lastActive": today.isoformat()}
    else:
        data = doc.to_dict()
        if data.get("role") == "parent":
            return {"status": "success", "message": "Gamification frozen for parents", "stats": data}
        old_xp = data.get("xp", 0)
        new_xp = old_xp + request.xp_gained
        last_active_str = data.get("lastActive")
        streak = data.get("streak", 0)
        if last_active_str:
            last_active = datetime.fromisoformat(last_active_str).date()
            delta = (today - last_active).days
            if delta == 1: streak += 1
            elif delta > 1: streak = 1
        else: streak = 1
        user_data = {"xp": new_xp, "level": 1 + (new_xp // 100), "streak": streak, "lastActive": today.isoformat()}
    user_ref.set(user_data, merge=True)
    return {"status": "success", "stats": user_data}

@app.post("/api/generate-diagram")
async def generate_diagram(request: DiagramRequest):
    if not settings.gemini_api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key not configured")
    try:
        model_names = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-flash-latest']
        prompt = f"""Analyze the text and convert it into a Mermaid.js {request.diagramType}. 
Return ONLY the mermaid code. 
IMPORTANT: To prevent syntax errors, ALWAYS wrap any text with spaces or special characters (like parentheses, colons, slashes) inside double quotes when defining node labels (e.g., A["Label (Extra Info)"] instead of A[Label (Extra Info)]).
Text: {request.text}"""
        for m_name in model_names:
            try:
                model = genai.GenerativeModel(m_name)
                response = model.generate_content(prompt)
                if response:
                    code = response.text.strip()
                    if code.startswith("```"): code = "\n".join(code.split("\n")[1:-1])
                    return {"code": code.strip()}
            except: continue
        raise HTTPException(status_code=500, detail="AI failed to generate diagram")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class InfographRequest(BaseModel):
    text: str

@app.post("/api/generate-infograph")
async def generate_infograph(request: InfographRequest):
    if not settings.gemini_api_key:
        raise HTTPException(status_code=500, detail="Gemini API Key not configured")
    try:
        model_names = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-flash-latest']
        prompt = f"""Analyze the provided text and convert it into a well-structured JSON object representing an infographic.
Identify the main topic, key concepts, and standard chronological or hierarchical facts that can be represented as an infographic.
Return ONLY valid JSON with no markdown wrapping. The JSON structure should ideally be:
{{
  "title": "Main Topic",
  "nodes": [
    {{"id": "1", "label": "Concept 1", "description": "Brief explanation"}},
    {{"id": "2", "label": "Concept 2", "description": "Brief explanation"}}
  ],
  "links": [
    {{"source": "1", "target": "2", "relation": "leads to"}}
  ]
}}
Text: {request.text}"""
        for m_name in model_names:
            try:
                model = genai.GenerativeModel(m_name)
                response = model.generate_content(prompt)
                if response:
                    content = response.text.strip()
                    if content.startswith("```json"): content = content[7:-3].strip()
                    elif content.startswith("```"): content = content[3:-3].strip()
                    return json.loads(content)
            except: continue
        raise HTTPException(status_code=500, detail="AI failed to generate infograph JSON")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/link-student")
async def link_student(request: LinkStudentRequest):
    if db is None:
        raise HTTPException(status_code=500, detail="Firestore not initialized")
    try:
        # Find student by referralCode
        users_ref = db.collection("users")
        query = users_ref.where("referralCode", "==", request.referralCode).where("role", "==", "student").limit(1).stream()
        student_doc = None
        for doc in query:
            student_doc = doc
            break
            
        if not student_doc:
            raise HTTPException(status_code=404, detail="Student with this referral code not found")
            
        student_id = student_doc.id
        
        # Create link
        link_ref = db.collection("parent_student_links").document(f"{request.parentId}_{student_id}")
        link_ref.set({
            "parentId": request.parentId,
            "studentId": student_id,
            "linkedAt": firestore.SERVER_TIMESTAMP
        })
        
        return {"status": "success", "message": "Student linked successfully", "studentId": student_id, "studentName": student_doc.to_dict().get("name")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/parent/{parent_id}/students")
async def get_linked_students(parent_id: str):
    if db is None:
        raise HTTPException(status_code=500, detail="Firestore not initialized")
    try:
        links_ref = db.collection("parent_student_links")
        query = links_ref.where("parentId", "==", parent_id).stream()
        
        students = []
        for doc in query:
            link_data = doc.to_dict()
            student_id = link_data.get("studentId")
            if student_id:
                # Fetch basic student details
                student_doc = db.collection("users").document(student_id).get()
                if student_doc.exists:
                    student_data = student_doc.to_dict()
                    students.append({
                        "id": student_id,
                        "name": student_data.get("name", "Student"),
                        "email": student_data.get("email", ""),
                        "xp": student_data.get("xp", 0),
                        "level": student_data.get("level", 1),
                        "streak": student_data.get("streak", 0)
                    })
                    
        return {"students": students}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ---- QUIZ RESULTS & PARENT HUB ----
@app.post("/api/quiz/result")
async def save_quiz_result(request: QuizAttemptRequest):
    if db is None: raise HTTPException(500, "Firestore missing")
    db.collection("users").document(request.uid).collection("quiz_attempts").add({
        "topic": request.topic,
        "score": request.score,
        "total": request.total,
        "accuracy": (request.score / request.total) * 100 if request.total > 0 else 0,
        "timestamp": firestore.SERVER_TIMESTAMP
    })
    
    # Trigger background check for red zones and notify parents
    try:
        await notify_parents_if_weak(request.uid, request.topic)
    except Exception as e:
        print(f"Notification error: {e}")
        
    return {"status": "success"}

def send_email(to_email, subject, body):
    if not settings.email_user or not settings.email_pass:
        print("Skipping email: Credentials not set")
        return False
    try:
        msg = MIMEMultipart()
        msg['From'] = settings.email_user
        msg['To'] = to_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))
        
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(settings.email_user, settings.email_pass)
        server.send_message(msg)
        server.quit()
        return True
    except Exception as e:
        print(f"Email failed: {e}")
        return False

async def notify_parents_if_weak(student_id: str, topic: str):
    if db is None: return
    
    # 1. Check if student is actually in a red zone for this topic
    docs = db.collection("users").document(student_id).collection("quiz_attempts")\
             .where("topic", "==", topic)\
             .order_by("timestamp", direction=firestore.Query.DESCENDING).limit(3).get()
    
    if len(docs) < 3: return
    
    accs = [d.to_dict().get("accuracy", 0) for d in docs]
    avg = sum(accs) / len(accs)
    
    if avg < 45: # Threshold for notification
        # 2. Find linked parents
        links = db.collection("parent_student_links").where("studentId", "==", student_id).stream()
        student_doc = db.collection("users").document(student_id).get()
        student_name = student_doc.to_dict().get("name", "Your ward")
        
        for link in links:
            parent_id = link.to_dict().get("parentId")
            parent_doc = db.collection("users").document(parent_id).get()
            if parent_doc.exists:
                parent_email = parent_doc.to_dict().get("email")
                if parent_email:
                    print(f"📧 Notifying parent {parent_email} about {topic}...")
                    subject = f"🚨 Academic Alert: {student_name}'s Progress in {topic}"
                    body = f"""
                    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                        <h2 style="color: #d32f2f;">Academic Progress Alert</h2>
                        <p>Hello,</p>
                        <p>Our AI system has detected that <b>{student_name}</b> is consistently struggling with the topic: <b>{topic}</b>.</p>
                        <p><b>Performance Detail:</b> Average score of {avg:.1f}% over the last 3 attempts.</p>
                        <hr/>
                        <p>We recommend checking the <a href="http://localhost:3000/dashboard">Parent Dashboard</a> for specific AI-generated study suggestions to help them bridge this gap.</p>
                        <p style="font-size: 12px; color: #777;">Sent automatically by Abhyas AI Sanctuary.</p>
                    </div>
                    """
                    send_email(parent_email, subject, body)

@app.get("/api/parent/{parent_id}/student/{student_id}/red-zones")
async def get_red_zones(parent_id: str, student_id: str):
    if db is None: raise HTTPException(500, "Firestore missing")
    docs = db.collection("users").document(student_id).collection("quiz_attempts")\
             .order_by("timestamp", direction=firestore.Query.DESCENDING).limit(15).stream()
    
    topic_stats = {}
    for doc in docs:
        d = doc.to_dict()
        topic = d.get("topic")
        acc = d.get("accuracy", 100)
        if topic not in topic_stats:
            topic_stats[topic] = []
        topic_stats[topic].append(acc)

    red_zones = []
    for topic, accs in topic_stats.items():
        if len(accs) >= 3:
            recent_3 = accs[:3]
            avg = sum(recent_3) / 3
            if avg < 40:
                suggestion = f"Consider a quick 10-minute review session about {topic}."
                if settings.gemini_api_key:
                    try:
                        model = genai.GenerativeModel("gemini-2.5-flash")
                        prompt = f"A student is struggling with '{topic}' (average score {avg:.1f}%). Provide a short, actionable 'Parent Action' suggestion in 1-2 sentences to help them."
                        res = model.generate_content(prompt)
                        if res and res.text: suggestion = res.text.strip()
                    except: pass
                red_zones.append({ "topic": topic, "averageScore": avg, "suggestion": suggestion })
    return {"redZones": red_zones}

# ---- SPACED REPETITION (SM-2) ----
@app.post("/api/flashcards/review")
async def review_flashcard(request: ReviewFlashcardRequest):
    if db is None: raise HTTPException(500, "Firestore missing")
    set_ref = db.collection("users").document(request.uid)\
                .collection("collections").document(request.collection_id)\
                .collection("flashcardSets").document(request.set_id)
    doc = set_ref.get()
    if not doc.exists:
        raise HTTPException(404, "Set not found")
        
    data = doc.to_dict()
    cards = data.get("flashcards", [])
    
    updated = False
    for card in cards:
        if card.get("id") == request.card_id:
            ef = card.get("easiness_factor", 2.5)
            interval = card.get("interval", 0.0)
            
            # Simple SM-2 based on 0=Again, 1=Hard, 2=Good, 3=Easy
            if request.quality == 0:
                interval = 0
            elif request.quality == 1:
                interval = max(1.0, interval * 1.2)
            elif request.quality == 2:
                interval = max(1.0, (interval * 2.5))
            elif request.quality == 3:
                interval = 5.0 if interval == 0 else max(5.0, interval * ef * 1.3)
                
            card["easiness_factor"] = round(ef, 2)
            card["interval"] = round(interval, 2)
            
            if interval == 0:
                 card["next_review_date"] = datetime.utcnow().isoformat()
            else:
                 new_date = datetime.utcnow() + timedelta(days=interval)
                 card["next_review_date"] = new_date.isoformat()
            
            updated = True
            break
            
    if updated:
        set_ref.update({"flashcards": cards})
        return {"status": "success", "message": "Card updated"}
    raise HTTPException(404, "Card not found in set")

# ---- MY LEARNING DASHBOARD ----
@app.post("/api/learning/roadmap")
async def generate_roadmap(request: RoadmapRequest):
    if not settings.gemini_api_key: raise HTTPException(500, "Gemini API missing")
    prompt = f"""
    Generate a step-by-step weekly roadmap for: '{request.goal}'.    Return ONLY a JSON array where each object has:
    - 'week': integer
    - 'focus': string
    - 'milestones': array of strings
    - 'resources': array of objects with 'type' (video or article), 'title', and 'query' (search keywords for YouTube/Library)
    """
    for m_name in ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest']:
        try:
            model = genai.GenerativeModel(m_name)
            res = model.generate_content(prompt)
            if res:
                parsed = parse_json_res(res.text)
                if parsed:
                    conn = sqlite3.connect("learning_notes.db")
                    cur = conn.cursor()
                    cur.execute("INSERT OR REPLACE INTO roadmaps (uid, goal, data) VALUES (?, ?, ?)", 
                               (request.uid, request.goal, json.dumps(parsed)))
                    conn.commit()
                    conn.close()
                    return {"roadmap": parsed}
        except: continue
    raise HTTPException(500, "AI failed to generate roadmap")

@app.post("/api/tutor/context")
async def save_tutor_context(request: TutorContextRequest):
    try:
        conn = sqlite3.connect("learning_notes.db")
        c = conn.cursor()
        c.execute("INSERT OR REPLACE INTO tutor_context (uid, material_text, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)", (request.uid, request.material_text))
        conn.commit()
        conn.close()
        return {"status": "success", "message": "Context saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/tutor/context/{uid}")
async def get_tutor_context(uid: str):
    try:
        conn = sqlite3.connect("learning_notes.db")
        c = conn.cursor()
        c.execute("SELECT material_text FROM tutor_context WHERE uid=?", (uid,))
        row = c.fetchone()
        conn.close()
        if row:
            return {"material_text": row[0]}
        return {"material_text": ""}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TutorChatRequest(BaseModel):
    uid: str
    message: str

class TutorTTSRequest(BaseModel):
    text: str

@app.post("/api/tutor/tts")
async def tutor_tts(request: TutorTTSRequest):
    """Convert arbitrary text to speech and return as base64 MP3 data URI."""
    try:
        tts = gTTS(text=request.text, lang='en')
        fp = io.BytesIO()
        tts.write_to_fp(fp)
        fp.seek(0)
        audio_b64 = base64.b64encode(fp.read()).decode('utf-8')
        return {"audio_data": f"data:audio/mp3;base64,{audio_b64}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS failed: {e}")

@app.post("/api/heygen-token")
async def generate_heygen_token():
    if not settings.heygen_api_key:
        raise HTTPException(status_code=500, detail="HeyGen API Key not configured")
    try:
        req = urllib.request.Request(
            "https://api.heygen.com/v1/streaming.create_token",
            method="POST",
            headers={"x-api-key": settings.heygen_api_key}
        )
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            return {"token": data["data"]["token"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tutor/chat")
async def tutor_chat(request: TutorChatRequest):
    if not settings.gemini_api_key:
        raise HTTPException(status_code=500, detail="Gemini API missing")
    
    context_text = ""
    try:
        conn = sqlite3.connect("learning_notes.db")
        c = conn.cursor()
        c.execute("SELECT material_text FROM tutor_context WHERE uid=? ORDER BY updated_at DESC LIMIT 1", (request.uid,))
        row = c.fetchone()
        conn.close()
        if row and row[0]:
            context_text = row[0]
            if len(context_text) > 10000:
                context_text = context_text[:10000] + "\n...[truncated]..."
    except: pass
    
    prompt = """You are a friendly, encouraging, and highly intelligent AI academic tutor. 
Keep your responses conversational, spoken-style, and concise (1-3 sentences max).
Do not use emojis or complex markdown formatting as your text will be spoken out loud by an avatar."""

    if context_text:
        prompt += f"\n\nThe student has provided this study material. Answer their question strictly based on it:\n{context_text}\n"
    
    prompt += f"\nStudent says: {request.message}"

    last_error = None
    model_names = ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest']
    for m_name in model_names:
        try:
            model = genai.GenerativeModel(m_name)
            response = model.generate_content(prompt)
            if response and response.text:
                reply_text = response.text.strip()
                audio_data = ""
                try:
                    tts = gTTS(text=reply_text, lang='en')
                    fp = io.BytesIO()
                    tts.write_to_fp(fp)
                    fp.seek(0)
                    audio_b64 = base64.b64encode(fp.read()).decode('utf-8')
                    audio_data = f"data:audio/mp3;base64,{audio_b64}"
                except Exception as e:
                    print(f"TTS Error: {e}")
                return {"reply": reply_text, "audio_data": audio_data}
        except Exception as e:
            last_error = str(e)
            continue
            
    raise HTTPException(status_code=500, detail=f"Failed to get AI response. Last error: {last_error}")

@app.get("/api/learning/active-roadmap/{uid}")
async def get_active_roadmap(uid: str):
    conn = sqlite3.connect("learning_notes.db")
    cur = conn.cursor()
    cur.execute("SELECT goal, data FROM roadmaps WHERE uid=?", (uid,))
    row = cur.fetchone()
    conn.close()
    if row:
        return {"goal": row[0], "roadmap": json.loads(row[1])}
    return {"goal": "", "roadmap": []}

@app.post("/api/learning/roadmap/quiz")
async def generate_roadmap_quiz(request: RoadmapQuizRequest):
    if not settings.gemini_api_key: raise HTTPException(500, "Gemini API missing")
    prompt = f"""
    Create a 5-question multiple choice diagnostic quiz to test understanding of the following topic:
    Topic: {request.focus}
    Milestones: {', '.join(request.milestones)}
    
    Return ONLY a JSON array of objects with:
    "question": string, "options": array of 4 strings, "answer": string, "explanation": string
    """
    for m_name in ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest']:
        try:
            model = genai.GenerativeModel(m_name)
            res = model.generate_content(prompt)
            if res:
                parsed = parse_json_res(res.text)
                if parsed:
                    return {"questions": parsed}
        except: continue
    raise HTTPException(500, "Failed to generate quiz after multiple attempts")



@app.post("/api/learning/quick-notes")
async def quick_notes(request: QuickNotesRequest):
    if not settings.gemini_api_key: raise HTTPException(500, "Gemini API missing")
    prompt = f"Provide simplified structural notes on '{request.subject}' aimed at a '{request.level}' skill level. Use markdown with clear headers and bullet points."
    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        res = model.generate_content(prompt)
        return {"notes": res.text.strip() if res else "Failed to generate notes"}
    except Exception as e:
        raise HTTPException(500, str(e))

# ---- MISSION TRACKING & PERFORMANCE ----
@app.get("/api/learning/missions/{uid}")
async def get_daily_missions(uid: str):
    date_str = datetime.utcnow().strftime("%Y-%m-%d")
    conn = sqlite3.connect("learning_notes.db")
    cur = conn.cursor()
    cur.execute("SELECT id, task, completed, score FROM daily_missions WHERE uid=? AND date=?", (uid, date_str))
    rows = cur.fetchall()
    conn.close()
    missions = [{"id": r[0], "task": r[1], "completed": bool(r[2]), "score": r[3]} for r in rows]
    return {"missions": missions}

@app.post("/api/learning/missions/sync")
async def sync_daily_missions(request: MissionSyncRequest):
    date_str = datetime.utcnow().strftime("%Y-%m-%d")
    conn = sqlite3.connect("learning_notes.db")
    cur = conn.cursor()
    for task in request.tasks:
        try:
            cur.execute("INSERT OR IGNORE INTO daily_missions (uid, task, date) VALUES (?, ?, ?)", 
                       (request.uid, task, date_str))
        except: pass
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.post("/api/learning/missions/complete")
async def complete_mission(request: MissionCompleteRequest):
    date_str = datetime.utcnow().strftime("%Y-%m-%d")
    conn = sqlite3.connect("learning_notes.db")
    cur = conn.cursor()
    
    # If we have a task name, we can UPSERT (Insert or Update if exists)
    if request.task_text:
        cur.execute("""
            INSERT INTO daily_missions (uid, task, date, completed, score) 
            VALUES (?, ?, ?, 1, ?)
            ON CONFLICT(uid, task, date) 
            DO UPDATE SET completed=1, score=excluded.score
        """, (request.uid, request.task_text, date_str, request.score))
    # Fallback to ID-based update if we have a numeric ID
    elif isinstance(request.task_id, int) or (isinstance(request.task_id, str) and request.task_id.isdigit()):
        cur.execute("UPDATE daily_missions SET completed=1, score=? WHERE id=? AND uid=?", 
                   (request.score, int(request.task_id), request.uid))
    
    conn.commit()
    conn.close()
    return {"status": "success"}

@app.get("/api/learning/performance/{uid}")
async def get_performance(uid: str):
    conn = sqlite3.connect("learning_notes.db")
    cur = conn.cursor()
    cur.execute("SELECT AVG(score) FROM daily_missions WHERE uid=? AND completed=1", (uid,))
    avg_score = cur.fetchone()[0] or 0
    cur.execute("SELECT COUNT(*) FROM daily_missions WHERE uid=? AND completed=1", (uid,))
    completed_count = cur.fetchone()[0] or 0
    conn.close()
    return {"averageScore": round(avg_score, 1), "completedCount": completed_count}


@app.post("/api/learning/daily-mission")
async def daily_mission(request: DailyMissionRequest):
    if not settings.gemini_api_key: raise HTTPException(500, "Gemini API missing")
    if request.topic and request.roadmap:
        prompt = f"The student is trying to master '{request.topic}'. Here is their roadmap: {json.dumps(request.roadmap)}. Suggest exactly 3 concrete daily interactive study tasks targeted at the earliest steps of this roadmap. Format as JSON array of exactly 3 concise strings."
    else:
        prompt = "Suggest 3 daily interactive study tasks for a student. Include at least 1 task about spaced repetition review, 1 quiz, and 1 reading goal. Format as JSON array of exactly 3 concise strings."
    
    for m_name in ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest']:
        try:
            model = genai.GenerativeModel(m_name)
            res = model.generate_content(prompt)
            if res:
                parsed = parse_json_res(res.text)
                if parsed:
                    return {"tasks": parsed}
        except: continue
    
    return {"tasks": ["Review 5 Spaced Repetition cards", "Complete 1 Quiz", "Read Notes on a New Topic"]}


class NoteSaveRequest(BaseModel):
    uid: str
    subject: str
    level: str
    content: str

@app.post("/api/learning/notes")
async def save_note(request: NoteSaveRequest):
    note_id = str(uuid.uuid4())
    conn = sqlite3.connect("learning_notes.db")
    c = conn.cursor()
    try:
        c.execute("INSERT INTO notes (id, uid, subject, level, content) VALUES (?, ?, ?, ?, ?)",
                  (note_id, request.uid, request.subject, request.level, request.content))
        conn.commit()
        return {"id": note_id, "message": "Note saved successfully"}
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()

@app.get("/api/learning/notes/{uid}")
async def get_notes(uid: str):
    conn = sqlite3.connect("learning_notes.db")
    c = conn.cursor()
    try:
        c.execute("SELECT id, subject, level, content, timestamp FROM notes WHERE uid=? ORDER BY timestamp DESC", (uid,))
        rows = c.fetchall()
        notes = [{"id": r[0], "subject": r[1], "level": r[2], "content": r[3], "timestamp": r[4]} for r in rows]
        return {"notes": notes}
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()

@app.delete("/api/learning/notes/{note_id}")
async def delete_note(note_id: str):
    conn = sqlite3.connect("learning_notes.db")
    c = conn.cursor()
    try:
        c.execute("DELETE FROM notes WHERE id=?", (note_id,))
        conn.commit()
        return {"message": "Note deleted successfully"}
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()


# ============================================================
# STUDENT HIGHLIGHTS & PERFORMANCE TRACKING
# ============================================================

@app.get("/api/student/{uid}/highlights")
async def get_student_highlights(uid: str):
    """Aggregated performance snapshot for the student dashboard."""
    conn = sqlite3.connect("learning_notes.db")
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*), AVG(score) FROM daily_missions WHERE uid=? AND completed=1", (uid,))
    row = cur.fetchone()
    completed_missions = row[0] or 0
    avg_mission_score  = round(row[1] or 0, 1)
    cur.execute("SELECT COUNT(*) FROM daily_missions WHERE uid=?", (uid,))
    total_missions = cur.fetchone()[0] or 0
    cur.execute("SELECT task, score, date FROM daily_missions WHERE uid=? AND completed=1 ORDER BY date DESC LIMIT 5", (uid,))
    recent_missions = [{"task": r[0], "score": r[1], "date": r[2]} for r in cur.fetchall()]
    conn.close()

    quiz_stats = {"totalAttempts": 0, "avgAccuracy": 0, "topicBreakdown": []}
    xp = 0; level = 1; streak = 0
    if db:
        try:
            docs = db.collection("users").document(uid).collection("quiz_attempts").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(20).stream()
            topic_map: dict = {}
            total_acc = 0; count = 0
            for doc in docs:
                d = doc.to_dict()
                acc = d.get("accuracy", 0); topic = d.get("topic", "General")
                total_acc += acc; count += 1
                if topic not in topic_map: topic_map[topic] = {"attempts": 0, "totalAcc": 0}
                topic_map[topic]["attempts"] += 1
                topic_map[topic]["totalAcc"] += acc
            quiz_stats["totalAttempts"] = count
            quiz_stats["avgAccuracy"] = round(total_acc / count, 1) if count else 0
            quiz_stats["topicBreakdown"] = [{"topic": t, "attempts": v["attempts"], "avgAccuracy": round(v["totalAcc"]/v["attempts"], 1)} for t, v in topic_map.items()][:5]
            user_doc = db.collection("users").document(uid).get()
            if user_doc.exists:
                ud = user_doc.to_dict(); xp = ud.get("xp", 0); level = ud.get("level", 1); streak = ud.get("streak", 0)
        except Exception as e: print(f"Highlights error: {e}")

    composite = round((avg_mission_score * 0.5) + (quiz_stats["avgAccuracy"] * 0.5), 1)
    return {"missions": {"completed": completed_missions, "total": total_missions, "averageScore": avg_mission_score, "recent": recent_missions}, "quizzes": quiz_stats, "user": {"xp": xp, "level": level, "streak": streak}, "overallScore": composite}


@app.get("/api/student/{uid}/test-results")
async def get_test_results(uid: str):
    """Full quiz + mission history with accuracy."""
    results = []
    if db:
        try:
            docs = db.collection("users").document(uid).collection("quiz_attempts").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(30).stream()
            for doc in docs:
                d = doc.to_dict()
                ts = d.get("timestamp")
                results.append({"id": doc.id, "topic": d.get("topic", "General"), "score": d.get("score", 0), "total": d.get("total", 0), "accuracy": round(d.get("accuracy", 0), 1), "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else str(ts) if ts else None, "source": "quiz"})
        except Exception as e: print(f"Test results error: {e}")

    conn = sqlite3.connect("learning_notes.db")
    cur = conn.cursor()
    cur.execute("SELECT task, score, date FROM daily_missions WHERE uid=? AND completed=1 ORDER BY date DESC LIMIT 20", (uid,))
    mission_results = [{"id": f"mission-{i}", "topic": r[0], "score": r[1], "total": 100, "accuracy": float(r[1]), "timestamp": r[2], "source": "mission"} for i, r in enumerate(cur.fetchall())]
    conn.close()
    return {"results": results, "missionResults": mission_results}


@app.get("/api/student/{uid}/achievements")
async def get_achievements(uid: str):
    """Compute achievements based on student activity."""
    conn = sqlite3.connect("learning_notes.db")
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM daily_missions WHERE uid=? AND completed=1", (uid,))
    completed_missions = cur.fetchone()[0] or 0
    cur.execute("SELECT AVG(score) FROM daily_missions WHERE uid=? AND completed=1", (uid,))
    avg_score = cur.fetchone()[0] or 0
    cur.execute("SELECT COUNT(*) FROM roadmaps WHERE uid=?", (uid,))
    roadmap_count = cur.fetchone()[0] or 0
    conn.close()

    xp = 0; streak = 0; quiz_count = 0; high_score_quiz = False
    if db:
        try:
            user_doc = db.collection("users").document(uid).get()
            if user_doc.exists:
                ud = user_doc.to_dict(); xp = ud.get("xp", 0); streak = ud.get("streak", 0)
            qdocs = db.collection("users").document(uid).collection("quiz_attempts").stream()
            for d in qdocs:
                quiz_count += 1
                if d.to_dict().get("accuracy", 0) >= 90: high_score_quiz = True
        except: pass

    all_achievements = [
        {"id": "first_mission", "title": "First Step", "description": "Completed your first daily mission", "icon": "flag", "color": "emerald", "unlocked": completed_missions >= 1},
        {"id": "mission_5", "title": "Mission Adept", "description": "Completed 5 daily missions", "icon": "military_tech", "color": "blue", "unlocked": completed_missions >= 5},
        {"id": "mission_25", "title": "Mission Master", "description": "Completed 25 daily missions", "icon": "workspace_premium", "color": "purple", "unlocked": completed_missions >= 25},
        {"id": "quiz_first", "title": "Quiz Taker", "description": "Submitted your first quiz", "icon": "quiz", "color": "amber", "unlocked": quiz_count >= 1},
        {"id": "quiz_10", "title": "Quiz Veteran", "description": "Completed 10 quizzes", "icon": "school", "color": "indigo", "unlocked": quiz_count >= 10},
        {"id": "streak_3", "title": "On Fire", "description": "Maintained a 3-day study streak", "icon": "local_fire_department", "color": "orange", "unlocked": streak >= 3},
        {"id": "streak_7", "title": "Week Warrior", "description": "Maintained a 7-day study streak", "icon": "bolt", "color": "yellow", "unlocked": streak >= 7},
        {"id": "xp_100", "title": "XP Earner", "description": "Earned 100 XP points", "icon": "star", "color": "teal", "unlocked": xp >= 100},
        {"id": "xp_500", "title": "Scholar", "description": "Earned 500 XP points", "icon": "auto_awesome", "color": "violet", "unlocked": xp >= 500},
        {"id": "perfect_score", "title": "Perfectionist", "description": "Scored 90%+ on a quiz", "icon": "verified", "color": "green", "unlocked": high_score_quiz},
        {"id": "roadmap_creator", "title": "Pathfinder", "description": "Created your first learning roadmap", "icon": "map", "color": "cyan", "unlocked": roadmap_count >= 1},
        {"id": "high_avg", "title": "High Achiever", "description": "Maintained an average mission score above 80%", "icon": "trending_up", "color": "rose", "unlocked": avg_score >= 80 and completed_missions >= 3},
    ]

    unlocked = [a for a in all_achievements if a["unlocked"]]
    locked   = [a for a in all_achievements if not a["unlocked"]]
    return {"achievements": all_achievements, "unlocked": unlocked, "locked": locked, "totalUnlocked": len(unlocked), "totalAchievements": len(all_achievements)}


# ============================================================
# FLASHCARD SUMMARY GENERATOR
# ============================================================

class FlashcardSummarizeRequest(BaseModel):
    flashcards: List[dict]  # [{question, answer}, ...]

@app.post("/api/flashcards/summarize")
async def summarize_flashcards(request: FlashcardSummarizeRequest):
    """Generate a structured summary from a set of flashcards."""
    print(f"📄 Summarize request received for {len(request.flashcards)} cards")
    
    if not settings.gemini_api_key:
        print("❌ Gemini API key missing")
        raise HTTPException(500, "Gemini API missing")
    if not request.flashcards:
        print("❌ No flashcards in request")
        raise HTTPException(400, "No flashcards provided")

    # Build a compact Q&A list for the prompt
    qa_text = "\n".join(
        f"Q: {card.get('question','')}\nA: {card.get('answer','')}"
        for card in request.flashcards[:30]
    )

    prompt = f"""You are an expert educator. Analyze the following flashcard set and produce a structured JSON summary.

Flashcard set:
{qa_text}

Return ONLY valid JSON (no markdown fences) with this exact structure:
{{
  "topic": "Short title for this flashcard set (max 8 words)",
  "overview": "2-3 sentence paragraph summarising what this flashcard set covers",
  "difficulty": "Beginner | Intermediate | Advanced",
  "keyConceptsSummary": [
    {{"concept": "Concept name", "summary": "One sentence explanation"}}
  ],
  "studyTips": ["Tip 1 for studying this material", "Tip 2", "Tip 3"],
  "totalCards": {len(request.flashcards)},
  "estimatedStudyTime": "X minutes"
}}
Produce 4-6 key concepts. Keep all text concise."""

    # Use a safer list of models
    models = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro']
    
    for m_name in models:
        try:
            print(f"🤖 Attempting summary with {m_name}...")
            model = genai.GenerativeModel(m_name)
            res = model.generate_content(prompt)
            
            if res and res.text:
                parsed = parse_json_res(res.text)
                if parsed:
                    print(f"✅ Summary generated successfully with {m_name}")
                    return {"summary": parsed}
                else:
                    print(f"⚠️ Failed to parse JSON response from {m_name}")
            else:
                print(f"⚠️ Empty response from {m_name}")
        except Exception as e:
            print(f"❌ Summarize attempt failed ({m_name}): {str(e)}")
            continue
            
    raise HTTPException(500, "Failed to generate summary from AI")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
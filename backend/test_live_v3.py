import urllib.request
import json
import os
from dotenv import load_dotenv

# Load from backend/.env
load_dotenv("c:/AbhyasAI/backend/.env")

def test_liveavatar_token_v3():
    api_key = os.getenv("HEYGEN_API_KEY")
    if not api_key:
        print("FAILURE: HEYGEN_API_KEY not found")
        return

    avatar_id = "65f9e3c9-d48b-4118-b73a-4ae2e3cbb8f0"
    print(f"Testing LiveAvatar token generation with avatar_id: {avatar_id} and session_mode: FULL")
    
    try:
        payload = {
            "avatar_id": avatar_id,
            "session_mode": "FULL"
        }
        req = urllib.request.Request(
            "https://api.liveavatar.com/v1/sessions/token",
            method="POST",
            headers={
                "X-API-KEY": api_key,
                "Content-Type": "application/json",
                "User-Agent": "AbhyasAI-Bot/1.0"
            },
            data=json.dumps(payload).encode()
        )
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            print(f"SUCCESS: {data}")
    except Exception as e:
        if hasattr(e, 'read'):
            print(f"FAILURE: {e.code} - {e.read().decode()}")
        else:
            print(f"FAILURE: {str(e)}")

if __name__ == "__main__":
    test_liveavatar_v3()

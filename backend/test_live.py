import urllib.request
import json
import os
from dotenv import load_dotenv

# Load from backend/.env
load_dotenv("c:/AbhyasAI/backend/.env")

def test_liveavatar_token():
    api_key = os.getenv("HEYGEN_API_KEY")
    if not api_key:
        print("FAILURE: HEYGEN_API_KEY not found")
        return

    print(f"Testing LiveAvatar token generation with User-Agent...")
    
    try:
        req = urllib.request.Request(
            "https://api.liveavatar.com/v1/sessions/token",
            method="POST",
            headers={
                "X-API-KEY": api_key,
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            },
            data=b"{}"
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
    test_liveavatar_token()

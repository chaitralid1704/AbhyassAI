import urllib.request
import json
import os
from dotenv import load_dotenv

# Load from backend/.env
load_dotenv("c:/AbhyasAI/backend/.env")

def test_heygen_v1_token():
    api_key = os.getenv("HEYGEN_API_KEY")
    if not api_key:
        print("FAILURE: HEYGEN_API_KEY not found")
        return

    print(f"Testing HeyGen-integrated v1/sessions/token endpoint...")
    
    try:
        req = urllib.request.Request(
            "https://api.heygen.com/v1/sessions/token",
            method="POST",
            headers={
                "X-API-KEY": api_key,
                "Content-Type": "application/json",
                "User-Agent": "AbhyasAI-Bot/1.0"
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
    test_heygen_v1_token()

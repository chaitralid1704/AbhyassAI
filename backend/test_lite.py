import urllib.request
import json
import os
from dotenv import load_dotenv

# Load from backend/.env
load_dotenv("c:/AbhyasAI/backend/.env")

def test_liveavatar_token_lite():
    api_key = os.getenv("HEYGEN_API_KEY")
    if not api_key:
        print("FAILURE: HEYGEN_API_KEY not found")
        return

    avatar_id = "65f9e3c9-d48b-4118-b73a-4ae2e3cbb8f0"
    print(f"Testing LiveAvatar token generation with mode: LITE")
    
    try:
        payload = {
            "avatar_id": avatar_id,
            "mode": "LITE"
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
        try:
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode())
                print(f"SUCCESS: {data}")
        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            print(f"HTTP ERROR {e.code}: {error_body}")
    except Exception as e:
        print(f"FAILURE: {str(e)}")

if __name__ == "__main__":
    test_liveavatar_token_lite()

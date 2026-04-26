import urllib.request
import json
import os
from dotenv import load_dotenv

# Load from backend/.env
load_dotenv("c:/AbhyasAI/backend/.env")

def test_heygen_token():
    api_key = os.getenv("HEYGEN_API_KEY")
    if not api_key:
        print("FAILURE: HEYGEN_API_KEY not found in backend/.env")
        return

    print(f"Testing HeyGen token generation with key: {api_key[:10]}...")
    
    try:
        req = urllib.request.Request(
            "https://api.heygen.com/v1/streaming.create_token",
            method="POST",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            data=b"{}"
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
    test_heygen_token()

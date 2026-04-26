import urllib.request
import json
import os
from dotenv import load_dotenv

# Load from backend/.env
load_dotenv("c:/AbhyasAI/backend/.env")

def test_heygen_v2_variations():
    api_key = os.getenv("HEYGEN_API_KEY")
    if not api_key:
        print("FAILURE: HEYGEN_API_KEY not found")
        return

    variations = [
        "https://api.heygen.com/v2/streaming/create_token",
        "https://api.heygen.com/v2/streaming.create_token",
        "https://api.heygen.com/v1/streaming/create_token",
        "https://api.heygen.com/v1/streaming.create_token"
    ]
    
    for url in variations:
        print(f"\nTesting: {url}")
        try:
            req = urllib.request.Request(
                url,
                method="POST",
                headers={
                    "X-Api-Key": api_key,
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                data=b"{}"
            )
            with urllib.request.urlopen(req) as response:
                data = json.loads(response.read().decode())
                print(f"SUCCESS: {data}")
                return # Stop if one works
        except Exception as e:
            if hasattr(e, 'read'):
                print(f"FAILURE: {e.code} - {e.read().decode()[:100]}")
            else:
                print(f"FAILURE: {str(e)}")

if __name__ == "__main__":
    test_heygen_v2_variations()

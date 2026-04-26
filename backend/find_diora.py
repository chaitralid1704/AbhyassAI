import urllib.request
import json
import os
from dotenv import load_dotenv

# Load from backend/.env
load_dotenv("c:/AbhyasAI/backend/.env")

def find_diora_uuid():
    api_key = os.getenv("HEYGEN_API_KEY")
    if not api_key:
        print("FAILURE: HEYGEN_API_KEY not found")
        return

    print(f"Fetching public avatars from LiveAvatar API...")
    
    try:
        req = urllib.request.Request(
            "https://api.liveavatar.com/v1/avatars",
            method="GET",
            headers={
                "X-API-KEY": api_key,
                "Content-Type": "application/json"
            }
        )
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            avatars = data.get("data", {}).get("avatars", [])
            for av in avatars:
                name = av.get("name", "")
                uid = av.get("id", "")
                print(f"Avatar: {name} | ID: {uid}")
                if "Diora" in name:
                    print(f"!!! FOUND DIORA: {uid}")
    except Exception as e:
        print(f"FAILURE: {str(e)}")

if __name__ == "__main__":
    find_diora_uuid()

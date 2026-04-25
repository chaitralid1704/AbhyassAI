import os
import google.generativeai as genai
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    gemini_api_key: str = ""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()

if not settings.gemini_api_key:
    print("❌ No API key found in .env")
    exit(1)

genai.configure(api_key=settings.gemini_api_key)

print("🔍 Fetching available models for your API key...")
try:
    with open("available_models.txt", "w") as f:
        for m in genai.list_models():
            line = f"Model: {m.name}, Methods: {m.supported_generation_methods}\n"
            print(line.strip())
            f.write(line)
    print("\n✅ Saved model list to available_models.txt")
except Exception as e:
    print(f"❌ Error: {e}")

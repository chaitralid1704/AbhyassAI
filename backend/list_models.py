import os
import google.generativeai as genai
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    gemini_api_key: str = ""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

def list_models():
    settings = Settings()
    if not settings.gemini_api_key:
        print("❌ No API key found")
        return

    genai.configure(api_key=settings.gemini_api_key)
    try:
        print("🔍 Listing available models...")
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(m.name)
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    list_models()

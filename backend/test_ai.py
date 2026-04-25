import os
import google.generativeai as genai
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    gemini_api_key: str = ""
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

def test():
    settings = Settings()
    if not settings.gemini_api_key:
        print("❌ No API key found in .env")
        return

    print(f"🔑 Key found: {settings.gemini_api_key[:5]}...")
    genai.configure(api_key=settings.gemini_api_key)
    
    model = genai.GenerativeModel('gemini-pro')
    text = """
    Networking is the practice of connecting devices to share data, resources, and services efficiently across local or global networks.
    Core Components of a Network:
    End Devices: computers, laptops, smartphones, servers.
    Networking Devices: Routers, Switches, Hubs, Firewalls.
    Transmission Media: Ethernet, Optical fiber, Wi-Fi, Bluetooth.
    Protocols: TCP/IP, DNS, HTTP.
    """
    
    try:
        print("🤖 Sending to Gemini...")
        response = model.generate_content(f"Convert this text into a Mermaid.js graph TD. Return ONLY the code:\n{text}")
        print("✅ AI RESPONSE:")
        print(response.text)
    except Exception as e:
        print(f"❌ FAILED: {unicode(e) if hasattr(e, '__unicode__') else str(e)}")

if __name__ == "__main__":
    test()

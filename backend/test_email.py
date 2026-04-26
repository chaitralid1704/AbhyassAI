import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from dotenv import load_dotenv

load_dotenv()

def test_send_email():
    email_user = os.getenv("EMAIL_USER")
    email_pass = os.getenv("EMAIL_PASS")
    
    if not email_user or not email_pass:
        print("ERROR: EMAIL_USER or EMAIL_PASS not found in .env")
        return

    print(f"Testing with: {email_user}")
    
    to_email = email_user
    subject = "Abhyas AI - Test Email"
    body = "This is a test email to verify SMTP credentials."

    msg = MIMEMultipart()
    msg['From'] = email_user
    msg['To'] = to_email
    msg['Subject'] = subject
    msg.attach(MIMEText(body, 'plain'))

    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(email_user, email_pass)
        server.send_message(msg)
        server.quit()
        print("SUCCESS: Email sent successfully!")
    except Exception as e:
        print(f"FAILURE: Email failed: {str(e)}")

if __name__ == "__main__":
    test_send_email()

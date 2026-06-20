from cryptography.fernet import Fernet
from app.core.config import settings

# Initialize the Fernet cipher suite
# We must encode the string to bytes because Fernet expects a byte-string key.
cipher_suite = Fernet(settings.ENCRYPTION_SECRET_KEY.encode())

def encrypt(text: str) -> str:
    """Encrypts a plaintext string and returns the URL-safe base64-encoded encrypted string."""
    return cipher_suite.encrypt(text.encode()).decode()

def decrypt(encrypted_text: str) -> str:
    """Decrypts a URL-safe base64-encoded encrypted string and returns the plaintext."""
    return cipher_suite.decrypt(encrypted_text.encode()).decode()

import os
from dotenv import load_dotenv

load_dotenv()

class settings:
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

settings = settings()



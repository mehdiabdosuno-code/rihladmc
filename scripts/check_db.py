import sys, os, uuid
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://rihla:rihla_secret_change_me@localhost:5432/rihla_db")
engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

def check():
    with Session() as db:
        user = db.execute(text("SELECT email FROM users WHERE email = 'a.chakir@stours.ma'")).fetchone()
        print(f"Admin User exists: {user is not None}")
        if user:
            print(f"Email: {user[0]}")
        
        roles = db.execute(text("SELECT name FROM roles")).fetchall()
        print(f"Roles: {[r[0] for r in roles]}")

if __name__ == "__main__":
    check()

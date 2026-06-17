from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.models import User


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def get_user_by_email(db: Session, email: str) -> User | None:
    clean_email = str(email or "").strip().lower()
    if not clean_email:
        return None
    return db.query(User).filter(User.email == clean_email).first()


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(db, email)

    if not user:
        return None

    if not verify_password(password, user.password_hash):
        return None

    if not user.is_active:
        return None

    return user
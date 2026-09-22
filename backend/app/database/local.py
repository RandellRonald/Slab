from datetime import UTC, datetime
from uuid import uuid4

from passlib.context import CryptContext
from sqlalchemy import Boolean, DateTime, String, create_engine, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

from app.core.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True)
    role: Mapped[str] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))


settings = get_settings()
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_local_database() -> None:
    Base.metadata.create_all(engine)


def get_user_by_email(session: Session, email: str) -> User | None:
    return session.scalar(select(User).where(User.email == email.lower()))


def get_user_by_id(session: Session, user_id: str) -> User | None:
    return session.get(User, user_id)


def user_payload(user: User) -> dict:
    return {"user_id": user.id, "profile_id": user.id, "email": user.email, "role": user.role, "full_name": user.full_name, "is_active": user.is_active, "joined_at": user.created_at.isoformat() if user.created_at else None}


def seed_auth_users() -> None:
    init_local_database()
    accounts = [
        ("customer@slab.local", "Customer@123", "Arjun Menon", "customer"),
        ("provider@slab.local", "Provider@123", "SLAB Equipment Services", "provider"),
        ("admin@slab.local", "Admin@123", "SLAB Administrator", "admin"),
    ]
    with SessionLocal.begin() as session:
        for email, password, name, role in accounts:
            user = get_user_by_email(session, email)
            if user is None:
                session.add(User(id=str(uuid4()), email=email, password_hash=pwd_context.hash(password), full_name=name, role=role))
            else:
                user.full_name = name
                user.role = role
                if not pwd_context.verify(password, user.password_hash):
                    user.password_hash = pwd_context.hash(password)

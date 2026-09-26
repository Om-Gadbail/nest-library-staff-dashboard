import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_nest.db")
os.environ.setdefault("SECRET_KEY", "test-secret-key-min-32-chars-long-xxxx")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models.models as m
from app.core.db import Base, get_db
from app.core.security import hash_password
from app.main import create_app


@pytest.fixture(scope="session")
def engine():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False},
                        poolclass=StaticPool)
    Base.metadata.create_all(bind=eng)
    return eng


@pytest.fixture()
def db(engine):
    Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
    session = Session()
    # isolate per test with savepoint-style cleanup
    yield session
    session.rollback()
    # wipe data between tests for determinism
    for table in reversed(Base.metadata.sorted_tables):
        session.execute(table.delete())
    session.commit()
    session.close()


@pytest.fixture()
def client(db):
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def make_tenant(db, biz_id="nest-library-001", name="Nest Library"):
    biz = m.Business(id=biz_id, name=name, timezone="Asia/Kolkata")
    db.add(biz)
    db.add(m.BusinessSettings(business_id=biz_id, name=name))
    db.add(m.WhatsAppSettings(business_id=biz_id))
    db.commit()
    return biz


def make_user(db, email, role="staff", biz_id="nest-library-001", password="Pass@123"):
    u = m.User(full_name=email.split("@")[0], email=email,
               password_hash=hash_password(password))
    db.add(u)
    db.flush()
    db.add(m.Membership2Business(user_id=u.id, business_id=biz_id, role=role))
    db.commit()
    return u


def login(client, email, password="Pass@123"):
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r

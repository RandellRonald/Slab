from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_response_contract() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"success": True, "data": {"status": "ok", "service": "slab-api"}}


def test_auth_me_requires_authentication() -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.json()["success"] is False
    assert response.json()["error"]["code"] == "AUTH_REQUIRED"


def test_validation_errors_use_api_envelope() -> None:
    response = client.post("/api/v1/auth/login", json={"email": "not-email", "password": "short"})

    assert response.status_code == 422
    assert response.json()["success"] is False
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"

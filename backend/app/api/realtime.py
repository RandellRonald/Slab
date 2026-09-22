from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.realtime_service import RealtimeAuthService, RealtimePersistenceService, manager

router = APIRouter()


def _token(websocket: WebSocket) -> str | None:
    query_token = websocket.query_params.get("token")
    header = websocket.headers.get("authorization", "")
    return query_token or (header[7:] if header.lower().startswith("bearer ") else None)


async def _authenticate(websocket: WebSocket):
    try:
        return RealtimeAuthService().user_from_token(_token(websocket))
    except Exception:
        await websocket.close(code=1008)
        return None


@router.websocket("/ws/tracking/{booking_id}")
async def tracking(websocket: WebSocket, booking_id: UUID):
    user = await _authenticate(websocket)
    if not user:
        return
    try:
        RealtimeAuthService().authorize_booking(user, booking_id)
        room = f"tracking:{booking_id}"
        await manager.connect(room, websocket)
        await websocket.send_json({"type": "connected", "booking_id": str(booking_id), "refetch": True})
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                continue
            if message.get("type") == "location":
                update = RealtimePersistenceService().tracking_update(user, booking_id, message)
                await manager.broadcast(room, update)
    except WebSocketDisconnect:
        pass
    except Exception:
        await websocket.close(code=1011)
    finally:
        manager.disconnect(f"tracking:{booking_id}", websocket)


@router.websocket("/ws/chat/{booking_id}")
async def chat(websocket: WebSocket, booking_id: UUID):
    user = await _authenticate(websocket)
    if not user:
        return
    try:
        RealtimeAuthService().authorize_booking(user, booking_id)
        room = f"chat:{booking_id}"
        await manager.connect(room, websocket)
        await websocket.send_json({"type": "connected", "booking_id": str(booking_id), "refetch": True})
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif message.get("type") == "message" and message.get("message"):
                saved = RealtimePersistenceService().chat_message(user, booking_id, message)
                await manager.broadcast(room, saved)
    except WebSocketDisconnect:
        pass
    except Exception:
        await websocket.close(code=1011)
    finally:
        manager.disconnect(f"chat:{booking_id}", websocket)


@router.websocket("/ws/notifications/{user_id}")
async def notifications(websocket: WebSocket, user_id: UUID):
    user = await _authenticate(websocket)
    if not user:
        return
    try:
        RealtimeAuthService().authorize_notifications(user, user_id)
        room = f"notifications:{user_id}"
        await manager.connect(room, websocket)
        await websocket.send_json({"type": "connected", "user_id": str(user_id), "refetch": True})
        while True:
            if (await websocket.receive_json()).get("type") == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(f"notifications:{user_id}", websocket)


@router.websocket("/ws/provider-status/{provider_id}")
async def provider_status(websocket: WebSocket, provider_id: UUID):
    user = await _authenticate(websocket)
    if not user:
        return
    try:
        RealtimeAuthService().authorize_provider_status(user, provider_id)
        room = f"provider-status:{provider_id}"
        await manager.connect(room, websocket)
        await websocket.send_json({"type": "connected", "provider_id": str(provider_id), "refetch": True})
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif message.get("type") == "status":
                await manager.broadcast(room, {"type": "provider_status", "provider_id": str(provider_id), "online": bool(message.get("online"))})
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(f"provider-status:{provider_id}", websocket)

# TODO: Implement WebSocket routes for real-time updates
# This will handle live updates for board changes, task updates, etc.

from fastapi import APIRouter,WebSocket, WebSocketDisconnect

from ..websockets.manager import manager
from ..schemas.Websockets import WebSocketBroadcastMessage

ws_router = APIRouter(
    prefix="/ws", 
    tags=["websockets"]
)

@ws_router.websocket("/")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            print(f"received: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)

    
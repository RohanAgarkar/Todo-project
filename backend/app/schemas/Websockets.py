from pydantic import BaseModel

class WebSocketBroadcastMessage(BaseModel):
    event: str
    data: dict
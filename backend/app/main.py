from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import random
import json
import asyncio
from typing import List, Dict
import os
from datetime import datetime

app = FastAPI()

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене заменить на конкретный домен
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Класс для управления WebSocket подключениями
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

# Класс игры Double
class DoubleGame:
    def __init__(self):
        self.current_number = 0
        self.is_running = False
        self.countdown = 30
        self.bets: Dict[str, Dict] = {}
        
    def place_bet(self, user_id: str, amount: float, bet_type: str):
        if not self.is_running:
            self.bets[user_id] = {"amount": amount, "type": bet_type}
            return True
        return False
    
    def generate_number(self):
        self.current_number = random.randint(0, 14)
        return self.current_number
    
    def calculate_winnings(self):
        results = {}
        for user_id, bet in self.bets.items():
            multiplier = 0
            if bet["type"] == "red" and self.current_number in [1, 2, 3, 4, 5, 6, 7]:
                multiplier = 2
            elif bet["type"] == "black" and self.current_number in [8, 9, 10, 11, 12, 13, 14]:
                multiplier = 2
            elif bet["type"] == "green" and self.current_number == 0:
                multiplier = 14
            
            results[user_id] = bet["amount"] * multiplier
        
        return results

game = DoubleGame()

@app.websocket("/ws/game")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await manager.broadcast(f"Message: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/")
async def root():
    return {"message": "Casino Double Game API"}

# Запуск игрового цикла
async def game_loop():
    while True:
        game.is_running = True
        # Отсчет до начала игры
        for i in range(game.countdown, 0, -1):
            await manager.broadcast(json.dumps({
                "type": "countdown",
                "time": i
            }))
            await asyncio.sleep(1)
        
        # Генерация числа и расчет выигрышей
        number = game.generate_number()
        results = game.calculate_winnings()
        
        await manager.broadcast(json.dumps({
            "type": "result",
            "number": number,
            "results": results
        }))
        
        game.is_running = False
        game.bets = {}
        await asyncio.sleep(5)  # Пауза между раундами

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(game_loop()) 
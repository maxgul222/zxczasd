from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import random
import json
import asyncio
from typing import Dict, List
import os
from datetime import datetime
from pathlib import Path

app = FastAPI()

# Монтируем статические файлы
app.mount("/static", StaticFiles(directory="static"), name="static")

# Класс для управления WebSocket подключениями
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.user_balances: Dict[str, float] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        self.active_connections.append(websocket)
        if user_id not in self.user_balances:
            self.user_balances[user_id] = 1000.0  # Начальный баланс

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

    def get_balance(self, user_id: str) -> float:
        return self.user_balances.get(user_id, 0.0)

    def update_balance(self, user_id: str, amount: float):
        self.user_balances[user_id] = amount

manager = ConnectionManager()

# Класс игры Double
class DoubleGame:
    def __init__(self):
        self.current_number = 0
        self.is_running = False
        self.countdown = 30
        self.bets: Dict[str, Dict] = {}
        
    def place_bet(self, user_id: str, amount: float, bet_type: str) -> bool:
        if not self.is_running and manager.get_balance(user_id) >= amount:
            self.bets[user_id] = {"amount": amount, "type": bet_type}
            manager.update_balance(user_id, manager.get_balance(user_id) - amount)
            return True
        return False
    
    def generate_number(self) -> int:
        self.current_number = random.randint(0, 14)
        return self.current_number
    
    def calculate_winnings(self) -> Dict[str, float]:
        results = {}
        for user_id, bet in self.bets.items():
            multiplier = 0
            if bet["type"] == "red" and self.current_number in [1, 2, 3, 4, 5, 6, 7]:
                multiplier = 2
            elif bet["type"] == "black" and self.current_number in [8, 9, 10, 11, 12, 13, 14]:
                multiplier = 2
            elif bet["type"] == "green" and self.current_number == 0:
                multiplier = 14
            
            winnings = bet["amount"] * multiplier
            results[user_id] = winnings
            if winnings > 0:
                manager.update_balance(user_id, manager.get_balance(user_id) + winnings)
        
        return results

game = DoubleGame()

@app.get("/", response_class=HTMLResponse)
async def get_html():
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Casino Double</title>
        <link rel="stylesheet" href="/static/style.css">
    </head>
    <body>
        <div class="container">
            <h1>Casino Double</h1>
            <div id="balance">Баланс: 1000</div>
            <div id="timer">30</div>
            <div id="roulette">0</div>
            <input type="number" id="betAmount" placeholder="Сумма ставки" min="0">
            <div class="betting-controls">
                <button class="bet-btn red" onclick="placeBet('red')">Red (2x)</button>
                <button class="bet-btn green" onclick="placeBet('green')">Green (14x)</button>
                <button class="bet-btn black" onclick="placeBet('black')">Black (2x)</button>
            </div>
            <div id="history"></div>
        </div>
        <script src="/static/script.js"></script>
    </body>
    </html>
    """

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
                if message["type"] == "bet":
                    success = game.place_bet(
                        user_id,
                        float(message["amount"]),
                        message["bet_type"]
                    )
                    if success:
                        await websocket.send_text(json.dumps({
                            "type": "balance",
                            "balance": manager.get_balance(user_id)
                        }))
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)

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
    # Создаем директорию для статических файлов
    static_dir = Path("static")
    static_dir.mkdir(exist_ok=True)
    
    # Создаем CSS файл
    with open(static_dir / "style.css", "w") as f:
        f.write("""
body {
    margin: 0;
    font-family: Arial, sans-serif;
    background: #121212;
    color: white;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
}

h1 {
    text-align: center;
    color: #ffd700;
}

#balance {
    font-size: 24px;
    color: #ffd700;
    text-align: right;
    margin-bottom: 20px;
}

#timer {
    font-size: 48px;
    text-align: center;
    margin: 20px 0;
    color: #ffd700;
}

#roulette {
    height: 100px;
    background: #2a2a2a;
    border-radius: 10px;
    margin: 20px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
}

#betAmount {
    width: 100%;
    padding: 10px;
    font-size: 16px;
    margin-bottom: 20px;
    background: #2a2a2a;
    border: 2px solid #333;
    border-radius: 5px;
    color: white;
}

.betting-controls {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin-bottom: 20px;
}

.bet-btn {
    padding: 15px;
    font-size: 18px;
    border: none;
    border-radius: 5px;
    color: white;
    cursor: pointer;
    transition: transform 0.2s;
}

.bet-btn:hover {
    transform: translateY(-2px);
}

.bet-btn.red { background-color: #ff4444; }
.bet-btn.green { background-color: #4CAF50; }
.bet-btn.black { background-color: #333; }

#history {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    padding: 10px;
    background: #2a2a2a;
    border-radius: 5px;
}

.history-item {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 14px;
}
        """)
    
    # Создаем JavaScript файл
    with open(static_dir / "script.js", "w") as f:
        f.write("""
let ws;
let gameState = {
    balance: 1000,
    history: []
};

function connect() {
    const userId = '1'; // В реальном приложении здесь должна быть авторизация
    ws = new WebSocket(`ws://${window.location.host}/ws/${userId}`);
    
    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'countdown') {
            document.getElementById('timer').textContent = data.time;
            document.querySelectorAll('.bet-btn').forEach(btn => {
                btn.disabled = true;
                btn.style.opacity = '0.5';
            });
        } 
        else if (data.type === 'result') {
            const number = data.number;
            document.getElementById('roulette').textContent = number;
            
            let color = 'black';
            if (number === 0) color = 'green';
            else if (number <= 7) color = 'red';
            
            // Добавляем в историю
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.style.backgroundColor = color === 'red' ? '#ff4444' : color === 'green' ? '#4CAF50' : '#333';
            historyItem.textContent = number;
            
            const history = document.getElementById('history');
            history.insertBefore(historyItem, history.firstChild);
            
            // Ограничиваем историю 10 элементами
            if (history.children.length > 10) {
                history.removeChild(history.lastChild);
            }
            
            document.querySelectorAll('.bet-btn').forEach(btn => {
                btn.disabled = false;
                btn.style.opacity = '1';
            });
            
            // Обновляем баланс если есть выигрыш
            if (data.results && data.results[1]) {
                gameState.balance += data.results[1];
                document.getElementById('balance').textContent = `Баланс: ${gameState.balance}`;
            }
        }
        else if (data.type === 'balance') {
            gameState.balance = data.balance;
            document.getElementById('balance').textContent = `Баланс: ${gameState.balance}`;
        }
    };
    
    ws.onclose = () => {
        setTimeout(connect, 1000);
    };
}

function placeBet(type) {
    const amount = parseFloat(document.getElementById('betAmount').value);
    if (!amount || amount <= 0 || amount > gameState.balance) {
        alert('Неверная сумма ставки!');
        return;
    }
    
    ws.send(JSON.stringify({
        type: 'bet',
        amount: amount,
        bet_type: type
    }));
    
    document.getElementById('betAmount').value = '';
}

connect();
        """)
    
    asyncio.create_task(game_loop()) 
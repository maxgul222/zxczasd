import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { toast } from 'react-toastify';

const GameContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  background: #1a1a1a;
  color: white;
  border-radius: 10px;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
`;

const Timer = styled.div`
  font-size: 48px;
  text-align: center;
  margin: 20px 0;
  color: #ffd700;
`;

const RouletteWheel = styled.div`
  height: 100px;
  background: #2a2a2a;
  border-radius: 10px;
  margin: 20px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  position: relative;
  overflow: hidden;
`;

const BettingControls = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 20px 0;
`;

const BetButton = styled.button`
  padding: 15px;
  font-size: 18px;
  border: none;
  border-radius: 5px;
  background-color: ${props => props.color};
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
  opacity: ${props => props.disabled ? 0.5 : 1};

  &:hover {
    transform: ${props => props.disabled ? 'none' : 'translateY(-2px)'};
    box-shadow: ${props => props.disabled ? 'none' : '0 5px 15px rgba(0, 0, 0, 0.3)'};
  }
`;

const BetInput = styled.input`
  padding: 10px;
  font-size: 16px;
  border: 2px solid #333;
  border-radius: 5px;
  background: #2a2a2a;
  color: white;
  width: 100%;
  margin-bottom: 10px;
`;

const HistoryContainer = styled.div`
  margin-top: 20px;
  padding: 10px;
  background: #2a2a2a;
  border-radius: 5px;
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`;

const HistoryItem = styled.div`
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background-color: ${props => {
    switch (props.result) {
      case 'red': return '#ff4444';
      case 'black': return '#333';
      case 'green': return '#4CAF50';
      default: return '#333';
    }
  }};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
`;

const Balance = styled.div`
  font-size: 24px;
  color: #ffd700;
  text-align: right;
  margin-bottom: 20px;
`;

function DoubleGame() {
  const [gameState, setGameState] = useState({
    countdown: 30,
    currentNumber: 0,
    history: [],
    isRunning: false
  });
  
  const [betAmount, setBetAmount] = useState('');
  const [balance, setBalance] = useState(1000); // Начальный баланс
  const [ws, setWs] = useState(null);

  const connectWebSocket = useCallback(() => {
    const socket = new WebSocket('ws://localhost:8000/ws/game');

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'countdown') {
        setGameState(prev => ({
          ...prev,
          countdown: data.time,
          isRunning: true
        }));
      } else if (data.type === 'result') {
        const number = data.number;
        let color = 'black';
        if (number === 0) color = 'green';
        else if (number <= 7) color = 'red';

        setGameState(prev => ({
          ...prev,
          currentNumber: number,
          isRunning: false,
          history: [{number, color}, ...prev.history].slice(0, 10)
        }));

        // Обработка выигрыша
        if (data.results && data.results[1]) { // Предполагаем, что ID пользователя = 1
          const winAmount = data.results[1];
          setBalance(prev => prev + winAmount);
          if (winAmount > 0) {
            toast.success(`Выигрыш: ${winAmount}!`);
          }
        }
      }
    };

    socket.onclose = () => {
      toast.error('Соединение потеряно. Переподключение...');
      setTimeout(connectWebSocket, 1000);
    };

    socket.onerror = () => {
      toast.error('Ошибка соединения');
    };

    setWs(socket);
  }, []);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (ws) ws.close();
    };
  }, [connectWebSocket]);

  const placeBet = (type) => {
    if (!ws || !betAmount || gameState.isRunning) return;
    
    const amount = parseFloat(betAmount);
    if (amount > balance) {
      toast.error('Недостаточно средств!');
      return;
    }

    ws.send(JSON.stringify({
      type: 'bet',
      amount: amount,
      betType: type,
      userId: 1 // Временный ID пользователя
    }));

    setBalance(prev => prev - amount);
    setBetAmount('');
    toast.info(`Ставка ${amount} на ${type}`);
  };

  return (
    <GameContainer>
      <Balance>Баланс: {balance}</Balance>
      <Timer>{gameState.countdown}</Timer>
      
      <RouletteWheel>
        {gameState.currentNumber}
      </RouletteWheel>

      <BetInput
        type="number"
        value={betAmount}
        onChange={(e) => setBetAmount(e.target.value)}
        placeholder="Введите сумму ставки"
        min="0"
        max={balance}
      />

      <BettingControls>
        <BetButton
          color="#ff4444"
          onClick={() => placeBet('red')}
          disabled={gameState.isRunning}
        >
          Red (2x)
        </BetButton>
        <BetButton
          color="#4CAF50"
          onClick={() => placeBet('green')}
          disabled={gameState.isRunning}
        >
          Green (14x)
        </BetButton>
        <BetButton
          color="#333"
          onClick={() => placeBet('black')}
          disabled={gameState.isRunning}
        >
          Black (2x)
        </BetButton>
      </BettingControls>

      <HistoryContainer>
        {gameState.history.map((item, index) => (
          <HistoryItem key={index} result={item.color}>
            {item.number}
          </HistoryItem>
        ))}
      </HistoryContainer>
    </GameContainer>
  );
}

export default DoubleGame; 
let tg = window.Telegram.WebApp;
let ws = new WebSocket('wss://your-backend-url.com');
let gameState = {
    balance: 1000,
    history: [],
    isRunning: false
};

let gameTimer;
let currentTime = 15;
let userBalance = 1000;
let currentBets = {
    red: [],
    green: [],
    black: []
};
let username = "Вы"; // Имя текущего пользователя
let lastWinningColor = null; // Последний выигрышный цвет
let userHasBet = false; // Флаг, указывающий, сделал ли пользователь ставку
let gameInProgress = false; // Флаг, указывающий, идет ли игра
let pendingBets = new Map(); // Хранит активные ставки: {color: {amount, timestamp}}

// Инициализация Telegram WebApp
tg.expand();
tg.enableClosingConfirmation();

// Получаем элементы DOM
const balanceElement = document.querySelector('.balance-display span');
const timerElement = document.getElementById('timer');
const rouletteElement = document.querySelector('#roulette .number');
const betInput = document.getElementById('betAmount');
const betButtons = document.querySelectorAll('.bet-btn');
const historyContainer = document.getElementById('history');
const sideMenu = document.getElementById('sideMenu');
const overlay = document.getElementById('overlay');
const menuProfilePhoto = document.getElementById('menuProfilePhoto');
const usernameElement = document.getElementById('username');
const tabButtons = document.querySelectorAll('.tab-btn');
const gameTabs = document.querySelectorAll('.game-tab');

// Функция для переключения меню
function toggleMenu() {
    sideMenu.classList.toggle('active');
    overlay.classList.toggle('active');
}

// Установка данных пользователя
if (tg.initDataUnsafe.user) {
    const user = tg.initDataUnsafe.user;
    if (user.photo_url) {
        menuProfilePhoto.style.backgroundImage = `url(${user.photo_url})`;
        document.getElementById('profilePhoto').style.backgroundImage = `url(${user.photo_url})`;
    }
    usernameElement.textContent = user.username || 'User';
}

// Переключение вкладок
tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const game = button.dataset.game;
        
        // Убираем активный класс у всех кнопок и вкладок
        tabButtons.forEach(btn => btn.classList.remove('active'));
        gameTabs.forEach(tab => tab.classList.remove('active'));
        
        // Добавляем активный класс выбранной кнопке и вкладке
        button.classList.add('active');
        document.getElementById(game).classList.add('active');
        
        // Если выбрана не DOUBLE, показываем уведомление
        if (game !== 'double') {
            tg.showAlert('Эта игра пока в разработке');
        }
    });
});

// WebSocket обработчики
ws.onopen = () => {
    console.log('Connected to server');
};

ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
        case 'bets_update':
            // Преобразуем данные в нужный формат
            const redBets = data.bets.red.map(bet => ({ name: bet.username, amount: bet.amount }));
            const greenBets = data.bets.green.map(bet => ({ name: bet.username, amount: bet.amount }));
            const blackBets = data.bets.black.map(bet => ({ name: bet.username, amount: bet.amount }));
            
            updateBetsColumn('red', redBets);
            updateBetsColumn('green', greenBets);
            updateBetsColumn('black', blackBets);
            break;
        case 'game_state':
            updateGameState(data.state);
            break;
        case 'timer':
            updateTimer(data.time);
            break;
        case 'balance_update':
            updateBalance(data.balance);
            break;
        case 'game_result':
            processGameResult(data);
            break;
        case 'bet_error':
            handleBetError(data);
            break;
        case 'game_started':
            gameInProgress = true;
            break;
    }
};

// Функция для обновления ставок в колонке
function updateBetsColumn(color, bets) {
    const column = document.querySelector(`.bets-column.${color}`);
    if (!column) return;

    const betsList = column.querySelector('.bets-list');
    if (!betsList) return;

    // Очищаем список ставок
    betsList.innerHTML = '';

    if (!bets || bets.length === 0) {
        const emptyItem = document.createElement('div');
        emptyItem.className = 'bet-item empty';
        emptyItem.textContent = 'Нет ставок';
        betsList.appendChild(emptyItem);
        return;
    }

    // Обновляем список ставок
    bets.forEach(bet => {
        const betItem = document.createElement('div');
        betItem.className = 'bet-item';
        
        const playerInfo = document.createElement('div');
        playerInfo.className = 'player-info';
        
        const avatar = document.createElement('div');
        avatar.className = 'player-avatar';
        avatar.style.backgroundColor = getRandomColor(bet.name);
        
        const name = document.createElement('div');
        name.className = 'player-name';
        name.textContent = bet.name;
        
        const amount = document.createElement('div');
        amount.className = 'bet-amount';
        amount.textContent = `${bet.amount.toLocaleString()} ₽`;
        
        playerInfo.appendChild(avatar);
        playerInfo.appendChild(name);
        betItem.appendChild(playerInfo);
        betItem.appendChild(amount);
        
        // Если это новая ставка текущего пользователя, добавляем анимацию
        if (bet.name === username && bet.isNew) {
            betItem.style.animation = 'newBetAppear 0.3s ease-out';
            // Добавляем анимацию для колонки
            column.style.animation = 'columnBounce 0.5s ease-out';
            // Удаляем анимацию после её завершения
            column.addEventListener('animationend', () => {
                column.style.animation = '';
            });
        }
        
        betsList.appendChild(betItem);
    });
}

// Функция для генерации случайного цвета на основе имени
function getRandomColor(name) {
    // Простой алгоритм для генерации цвета на основе строки
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Создаем цвета из HSL для лучшей яркости и насыщенности
    const h = Math.abs(hash % 360);
    return `hsl(${h}, 70%, 50%)`;
}

// Вспомогательная функция для склонения слова "игрок"
function getPlayersCountText(count) {
    if (count === 1) return 'игрок';
    if (count >= 2 && count <= 4) return 'игрока';
    return 'игроков';
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
        tg = window.Telegram.WebApp;
        tg.expand();
        
        // Получаем данные пользователя
        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            const user = tg.initDataUnsafe.user;
            username = user.first_name || 'Вы';
            
            if (document.getElementById('username')) {
                document.getElementById('username').textContent = username;
            }
            
            // Если есть фото профиля, устанавливаем его
            if (user.photo_url) {
                const profilePhoto = document.getElementById('menuProfilePhoto');
                if (profilePhoto) {
                    profilePhoto.style.backgroundImage = `url(${user.photo_url})`;
                }
            }
        }
    }
    
    // Устанавливаем начальный баланс
    updateBalance(1000);
    
    // Обновляем отображение баланса
    updateBalanceDisplay();
    
    // Инициализация кнопок быстрых ставок
    initQuickBetButtons();
    
    // Инициализация кнопок ставок
    initBetButtons();
    
    // Инициализация вкладок
    initTabs();
    
    // Запуск игрового цикла
    startGameCycle();
    
    // Инициализация WebSocket соединения
    initWebSocket();
});

// Инициализация WebSocket соединения
function initWebSocket() {
    try {
        ws = new WebSocket('wss://your-backend-url.com');
        
        ws.onopen = () => {
            console.log('Соединение с сервером установлено');
            // Разблокируем кнопки ставок
            const betButtons = document.querySelectorAll('.bet-btn');
            betButtons.forEach(btn => btn.disabled = false);
        };
        
        ws.onclose = () => {
            console.log('Соединение с сервером закрыто');
            // Пытаемся переподключиться через 3 секунды
            setTimeout(initWebSocket, 3000);
        };
        
        ws.onerror = (error) => {
            console.error('Ошибка WebSocket:', error);
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                switch(data.type) {
                    case 'bet_accepted':
                        handleBetAccepted(data);
                        break;
                    case 'bet_error':
                        handleBetError(data);
                        break;
                    case 'bets_update':
                        // Обновляем ставки в колонках
                        if (data.bets) {
                            updateBetsColumn('red', data.bets.red || []);
                            updateBetsColumn('green', data.bets.green || []);
                            updateBetsColumn('black', data.bets.black || []);
                        }
                        break;
                        
                    case 'game_state':
                        // Обновляем состояние игры
                        if (data.state) {
                            updateGameState(data.state);
                        }
                        break;
                        
                    case 'timer':
                        // Обновляем таймер
                        if (data.time !== undefined) {
                            updateTimer(data.time);
                        }
                        break;
                        
                    case 'result':
                        // Обрабатываем результат игры
                        processGameResult(data);
                        break;
                        
                    case 'balance_update':
                        // Обновляем баланс пользователя
                        if (data.balance !== undefined) {
                            userBalance = data.balance;
                            updateBalanceDisplay();
                        }
                        break;
                        
                    case 'player_joined':
                        // Показываем уведомление о новом игроке
                        if (data.username) {
                            showNotification(`${data.username} присоединился к игре`, 'info');
                        }
                        break;
                        
                    case 'player_bet':
                        // Обрабатываем ставку другого игрока
                        handlePlayerBet(data);
                        break;
                        
                    case 'error':
                        // Обрабатываем ошибку от сервера
                        handleServerError(data);
                        break;
                }
            } catch (error) {
                console.error('Ошибка при обработке сообщения:', error);
            }
        };
    } catch (error) {
        console.error('Ошибка при создании WebSocket:', error);
        setTimeout(initWebSocket, 3000);
    }
}

// Обработка ставки игрока
function handlePlayerBet(data) {
    // Проверяем наличие необходимых данных
    if (!data.color || !data.username || data.amount === undefined) {
        console.error('Неверный формат данных ставки:', data);
        return;
    }
    
    // Добавляем ставку в соответствующую колонку
    if (!currentBets[data.color]) {
        currentBets[data.color] = [];
    }
    
    // Проверяем, есть ли уже ставка от этого игрока
    const existingBetIndex = currentBets[data.color].findIndex(bet => bet.name === data.username);
    
    if (existingBetIndex !== -1) {
        // Обновляем существующую ставку
        currentBets[data.color][existingBetIndex].amount += data.amount;
    } else {
        // Добавляем новую ставку
        currentBets[data.color].push({
            name: data.username,
            amount: data.amount,
            avatar: data.avatar || null
        });
    }
    
    // Обновляем отображение колонки
    updateBetsColumn(data.color, currentBets[data.color]);
}

// Функция для размещения ставки
function placeBet(color, amount) {
    if (!amount || amount <= 0) {
        showNotification('Введите сумму ставки', 'error');
        return false;
    }

    if (amount > userBalance) {
        showNotification('Недостаточно средств', 'error');
        return false;
    }

    if (gameInProgress) {
        showNotification('Дождитесь следующей игры', 'error');
        return false;
    }

    if (pendingBets.has(color)) {
        showNotification('Вы уже сделали ставку на этот цвет', 'error');
        return false;
    }

    try {
        // Снимаем сумму с баланса
        const newBalance = userBalance - amount;
        updateBalance(newBalance);

        // Сохраняем ставку
        pendingBets.set(color, {
            amount: amount,
            timestamp: Date.now()
        });

        // Добавляем ставку в текущие ставки для отображения
        if (!currentBets[color]) {
            currentBets[color] = [];
        }
        
        // Добавляем флаг isNew для новой ставки
        currentBets[color].push({
            name: username,
            amount: amount,
            isNew: true // Добавляем флаг для новой ставки
        });
        
        updateBetsColumn(color, currentBets[color]);

        // Отправляем ставку на сервер
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'place_bet',
                color: color,
                amount: amount,
                username: username
            }));
            showNotification(`Ставка ${amount.toLocaleString()} ₽ на ${getColorName(color)}`, 'success');
            return true;
        } else {
            handleBetError({color, amount});
            return false;
        }
    } catch (error) {
        console.error('Ошибка при отправке ставки:', error);
        handleBetError({color, amount});
        return false;
    }
}

// Обработка результатов игры
function processGameResult(result) {
    gameInProgress = false;
    lastWinningColor = result.color;
    
    // Обрабатываем все ставки
    for (const [betColor, betInfo] of pendingBets) {
        if (betColor === result.color) {
            // Выигрышная ставка
            const multiplier = getMultiplier(result.color);
            const winAmount = betInfo.amount * multiplier;
            
            // Обновляем баланс с выигрышем
            updateBalance(userBalance + winAmount);
            
            showNotification(
                `Выигрыш ${winAmount.toLocaleString()} ₽! (x${multiplier})`, 
                'success'
            );
        } else {
            // Проигрышная ставка
            showNotification(
                `Проигрыш ${betInfo.amount.toLocaleString()} ₽. Выпало ${getColorName(result.color)}`,
                'error'
            );
        }
    }
    
    // Очищаем все ставки
    pendingBets.clear();
    resetBets();
    
    // Добавляем результат в историю
    addToHistory(result.number, result.color);
}

// Получение множителя для цвета
function getMultiplier(color) {
    switch (color) {
        case 'green':
            return 14;
        case 'red':
        case 'black':
            return 2;
        default:
            return 0;
    }
}

// Обработка ошибки ставки
function handleBetError(data) {
    if (data.color && pendingBets.has(data.color)) {
        // Возвращаем средства
        const betInfo = pendingBets.get(data.color);
        updateBalance(userBalance + betInfo.amount);
        
        // Удаляем ставку
        pendingBets.delete(data.color);
        
        // Обновляем отображение
        if (currentBets[data.color]) {
            currentBets[data.color] = currentBets[data.color].filter(
                bet => bet.name !== username
            );
            updateBetsColumn(data.color, currentBets[data.color]);
        }
    }
    
    showNotification('Ошибка при размещении ставки', 'error');
}

// Сброс ставок
function resetBets() {
    for (const color in currentBets) {
        currentBets[color] = currentBets[color].filter(
            bet => bet.name !== username
        );
        updateBetsColumn(color, currentBets[color]);
    }
    pendingBets.clear();
}

// Обновление состояния игры
function updateGameState(state) {
    if (state.isRunning !== undefined) {
        gameInProgress = state.isRunning;
    }
    
    // Обновляем другие параметры состояния игры, если они есть
    if (state.timer !== undefined) {
        updateTimer(state.timer);
    }
}

// Обновление таймера
function updateTimer(time) {
    timerElement.textContent = time;
    gameState.isRunning = time > 0;
    
    betButtons.forEach(btn => {
        btn.disabled = gameState.isRunning;
    });
}

// Показ результата
function showResult(number) {
    rouletteElement.textContent = number;
    
    let color = 'black';
    if (number === 0) color = 'green';
    else if (number <= 7) color = 'red';
    
    addToHistory(number, color);
}

// Обновление баланса
function updateBalance(newBalance) {
    userBalance = newBalance;
    const balanceElement = document.querySelector('.balance');
    if (balanceElement) {
        balanceElement.textContent = userBalance.toLocaleString() + ' ₽';
    }
}

// Обработка игровых событий
function handleGameEvent(data) {
    switch(data.type) {
        case 'countdown':
            updateTimer(data.time);
            break;
            
        case 'result':
            showResult(data.number);
            if (data.balance !== undefined) {
                updateBalance(data.balance);
            }
            break;
            
        case 'balance':
            updateBalance(data.balance);
            break;
    }
}

// Обработка ввода ставки
betInput.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    if (value > gameState.balance) {
        e.target.value = gameState.balance;
    }
});

// Инициализация при загрузке страницы
window.addEventListener('load', () => {
    tg.ready();
    connect();
});

function startGameCycle() {
    const timerElement = document.querySelector('.timer');
    const rouletteItems = document.querySelector('.roulette-items');
    const rouletteContainer = document.querySelector('.roulette-container');
    
    // Настраиваем начальное состояние
    rouletteItems.style.opacity = '0';
    rouletteContainer.style.display = 'block';
    
    // Позиционируем и стилизуем таймер
    timerElement.style.cssText = `
        position: absolute;
        left: 50%;
        top: calc(50% - 10px);
        transform: translate(-50%, -50%);
        font-size: 42px;
        font-weight: bold;
        color: white;
        text-shadow: 0 0 20px rgba(0, 157, 255, 0.8);
        z-index: 100;
        opacity: 1;
        transition: opacity 0.3s ease;
        pointer-events: none;
    `;
    
    // Убедимся, что таймер находится внутри контейнера рулетки
    if (timerElement.parentElement !== rouletteContainer) {
        rouletteContainer.appendChild(timerElement);
    }
    
    function updateTimer() {
        if (currentTime > 0) {
            // Обновляем таймер
            timerElement.textContent = currentTime;
            currentTime--;
            
            // Меняем цвет для последних 5 секунд
            if (currentTime <= 5) {
                timerElement.style.color = '#FF3B5C';
                timerElement.style.textShadow = '0 0 20px rgba(255, 59, 92, 0.8)';
            } else {
                timerElement.style.color = 'white';
                timerElement.style.textShadow = '0 0 20px rgba(0, 157, 255, 0.8)';
            }
        } else {
            // Запускаем рулетку
            spinRoulette();
            
            // Очищаем интервал
            clearInterval(gameTimer);
        }
    }
    
    // Запускаем первый цикл
    updateTimer();
    
    // Устанавливаем интервал
    clearInterval(gameTimer);
    gameTimer = setInterval(() => {
        if (currentTime > 0) {
            updateTimer();
        }
    }, 1000);
}

function spinRoulette() {
    // Устанавливаем флаг, что игра идет
    gameInProgress = true;
    
    const rouletteItems = document.querySelector('.roulette-items');
    const rouletteContainer = document.querySelector('.roulette-container');
    const timerElement = document.querySelector('.timer');
    const itemWidth = 140; // Ширина одного элемента
    const itemsCount = document.querySelectorAll('.roulette-item').length;
    const randomOffset = Math.floor(Math.random() * itemsCount) * itemWidth;
    const totalOffset = itemsCount * itemWidth * 3 + randomOffset;
    
    // Скрываем таймер
    timerElement.style.opacity = '0';
    
    // Показываем рулетку
    rouletteItems.style.opacity = '1';
    rouletteItems.style.transition = 'opacity 0.3s ease';
    
    // Добавляем звуковой эффект
    playSpinSound();
    
    // Добавляем класс для анимации
    rouletteContainer.classList.add('spinning');
    
    // Добавляем эффект вибрации
    addShakeEffect(rouletteContainer);
    
    // Анимируем элементы рулетки
    animateRouletteItems();
    
    // Основная анимация прокрутки (10 секунд)
    rouletteItems.style.transition = 'transform 10s cubic-bezier(0.21, 0.53, 0.29, 0.99)';
    rouletteItems.style.transform = `translateX(-${totalOffset}px)`;
    
    // Определяем выигрышный цвет
    const items = document.querySelectorAll('.roulette-item');
    const winningIndex = Math.floor(randomOffset / itemWidth);
    const winningItem = items[winningIndex % items.length];
    
    if (winningItem.classList.contains('red')) {
        lastWinningColor = 'red';
    } else if (winningItem.classList.contains('green')) {
        lastWinningColor = 'green';
    } else {
        lastWinningColor = 'black';
    }
    
    // Подсвечиваем выигрышный элемент в конце анимации
    setTimeout(() => {
        highlightWinningItem(winningItem);
    }, 9800);
    
    // Анимация завершения рулетки и появления таймера
    setTimeout(() => {
        // Плавно скрываем рулетку
        rouletteItems.style.transition = 'opacity 0.3s ease';
        rouletteItems.style.opacity = '0';
        
        setTimeout(() => {
            // Сбрасываем позицию рулетки
            rouletteItems.style.transition = 'none';
            rouletteItems.style.transform = 'translateX(0)';
            rouletteContainer.classList.remove('spinning');
            
            // Воспроизводим звук выигрыша
            playWinSound(lastWinningColor);
            
            // Показываем таймер
            timerElement.style.transition = 'opacity 0.3s ease';
            timerElement.style.opacity = '1';
            
            // Запускаем новый цикл
            currentTime = 15;
            startGameCycle();
        }, 300);
    }, 10000);
}

// Функция для добавления эффекта вибрации
function addShakeEffect(element) {
    let intensity = 3;
    const duration = 1000; // 1 секунда
    const startTime = Date.now();
    
    function shake() {
        const elapsed = Date.now() - startTime;
        if (elapsed < duration) {
            // Уменьшаем интенсивность со временем
            intensity = 3 * (1 - elapsed / duration);
            
            // Случайное смещение
            const xShift = (Math.random() - 0.5) * intensity;
            const yShift = (Math.random() - 0.5) * intensity;
            
            element.style.transform = `translate(${xShift}px, ${yShift}px)`;
            
            requestAnimationFrame(shake);
        } else {
            element.style.transform = '';
        }
    }
    
    shake();
}

// Функция для анимации элементов рулетки
function animateRouletteItems() {
    const items = document.querySelectorAll('.roulette-item');
    
    items.forEach((item, index) => {
        // Добавляем небольшую задержку для каждого элемента
        setTimeout(() => {
            item.style.transform = 'skew(-15deg) scale(1.05)';
            item.style.filter = 'brightness(1.2)';
            
            setTimeout(() => {
                item.style.transform = 'skew(-15deg) scale(1)';
                item.style.filter = 'brightness(1)';
            }, 300);
        }, index * 50 % 500); // Циклическая задержка
    });
}

// Функция для подсветки выигрышного элемента
function highlightWinningItem(item) {
    // Добавляем класс для подсветки
    item.classList.add('winning');
    
    // Создаем эффект пульсации
    let pulseCount = 0;
    const maxPulses = 3;
    
    function pulse() {
        if (pulseCount < maxPulses) {
            item.style.transform = 'skew(-15deg) scale(1.1)';
            item.style.filter = 'brightness(1.5)';
            item.style.boxShadow = '0 0 20px rgba(255, 255, 255, 0.8)';
            
            setTimeout(() => {
                item.style.transform = 'skew(-15deg) scale(1)';
                item.style.filter = 'brightness(1)';
                item.style.boxShadow = 'none';
                
                pulseCount++;
                setTimeout(pulse, 200);
            }, 200);
        } else {
            // Удаляем класс после завершения анимации
            item.classList.remove('winning');
            item.style = '';
        }
    }
    
    pulse();
}

// Функция для воспроизведения звука вращения
function playSpinSound() {
    // Здесь можно добавить воспроизведение звука
    // Например, через Web Audio API или HTML5 Audio
    // Для примера оставим пустую функцию
}

// Функция для воспроизведения звука выигрыша
function playWinSound(color) {
    // Здесь можно добавить воспроизведение звука в зависимости от цвета
    // Для примера оставим пустую функцию
}

// Обработка выигрышей
function processWinnings() {
    if (!lastWinningColor) return;
    
    // Коэффициенты выигрыша
    const multipliers = {
        red: 2,
        black: 2,
        green: 14
    };
    
    // Обрабатываем выигрышные ставки
    if (currentBets[lastWinningColor].length > 0) {
        currentBets[lastWinningColor].forEach(bet => {
            if (bet.name === username) {
                const winAmount = bet.amount * multipliers[lastWinningColor];
                userBalance += winAmount;
                updateBalanceDisplay();
                showNotification(`Вы выиграли ${winAmount.toLocaleString()} ₽!`, 'success');
            }
        });
    } else if (userHasBet) {
        // Если пользователь сделал ставку, но не на выигрышный цвет
        showNotification(`Вы проиграли. Выпало ${getColorName(lastWinningColor)}`, 'error');
    }
    
    // Добавляем результат в историю
    addToHistory(lastWinningColor);
    
    // Показываем уведомление о выигрышном цвете
    showNotification(`Выпало ${getColorName(lastWinningColor)}!`, 'info');
}

// Обновление отображения баланса
function updateBalanceDisplay() {
    const balanceElement = document.querySelector('.balance-amount');
    if (balanceElement) {
        balanceElement.textContent = userBalance.toLocaleString() + ' ₽';
    }
}

function initQuickBetButtons() {
    const betInput = document.querySelector('.bet-input');
    const quickBetButtons = document.querySelectorAll('.quick-bet-btn');
    
    quickBetButtons.forEach(button => {
        button.addEventListener('click', function() {
            const action = this.textContent;
            let currentValue = parseInt(betInput.value) || 0;
            
            switch(action) {
                case 'Очистить':
                    betInput.value = '';
                    break;
                case '+1':
                    betInput.value = currentValue + 1;
                    break;
                case '+10':
                    betInput.value = currentValue + 10;
                    break;
                case '+100':
                    betInput.value = currentValue + 100;
                    break;
                case '+1000':
                    betInput.value = currentValue + 1000;
                    break;
                case 'x2':
                    betInput.value = currentValue * 2;
                    break;
                case '1/2':
                    betInput.value = Math.floor(currentValue / 2);
                    break;
                case 'Max':
                    betInput.value = userBalance;
                    break;
            }
        });
    });
}

// Инициализация вкладок
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const gameTabs = document.querySelectorAll('.game-tab');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const gameId = this.getAttribute('data-game');
            
            // Убираем активный класс со всех кнопок и вкладок
            tabButtons.forEach(btn => btn.classList.remove('active'));
            gameTabs.forEach(tab => tab.classList.remove('active'));
            
            // Добавляем активный класс нужной кнопке и вкладке
            this.classList.add('active');
            document.getElementById(gameId).classList.add('active');
        });
    });
}

// Получение текста для склонения слова "ставка"
function getBetsCountText(count) {
    if (count % 10 === 1 && count % 100 !== 11) {
        return 'ставка';
    } else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
        return 'ставки';
    } else {
        return 'ставок';
    }
}

// Получение названия цвета
function getColorName(color) {
    switch(color) {
        case 'red': return 'красное';
        case 'green': return 'зеленое';
        case 'black': return 'черное';
        default: return color;
    }
}

// Показ уведомления
function showNotification(message, type = 'info') {
    // Проверяем, существует ли контейнер для уведомлений
    let notificationContainer = document.querySelector('.notification-container');
    
    if (!notificationContainer) {
        notificationContainer = document.createElement('div');
        notificationContainer.className = 'notification-container';
        document.body.appendChild(notificationContainer);
        
        // Добавляем стили для уведомлений
        const style = document.createElement('style');
        style.textContent = `
            .notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 12px;
                max-width: 320px;
                pointer-events: none;
            }
            
            .notification {
                padding: 16px;
                border-radius: 12px;
                color: white;
                font-weight: 600;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2);
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
                display: flex;
                align-items: center;
                border-left: 4px solid rgba(255, 255, 255, 0.2);
                position: relative;
                overflow: hidden;
                transform: translateX(120%);
                opacity: 0;
                transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), 
                            opacity 0.3s ease,
                            margin-top 0.4s ease,
                            max-height 0.4s ease,
                            padding 0.4s ease;
                pointer-events: auto;
                max-height: 100px;
            }
            
            .notification.show {
                transform: translateX(0);
                opacity: 1;
            }
            
            .notification.hide {
                transform: translateX(120%);
                opacity: 0;
                margin-top: -10px;
                max-height: 0;
                padding-top: 0;
                padding-bottom: 0;
                border-width: 0;
            }
            
            .notification::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 1px;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
            }
            
            .notification::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 0;
                width: 100%;
                height: 3px;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
            }
            
            .notification.info {
                background: linear-gradient(135deg, rgba(45, 123, 244, 0.9) 0%, rgba(69, 160, 255, 0.9) 100%);
                border-left-color: #45A0FF;
                animation: pulseInfo 2s infinite ease-in-out;
            }
            
            .notification.success {
                background: linear-gradient(135deg, rgba(0, 200, 150, 0.9) 0%, rgba(0, 230, 171, 0.9) 100%);
                border-left-color: #00E6AB;
                animation: pulseSuccess 2s infinite ease-in-out;
            }
            
            .notification.error {
                background: linear-gradient(135deg, rgba(255, 59, 92, 0.9) 0%, rgba(255, 91, 127, 0.9) 100%);
                border-left-color: #FF5B7F;
                animation: pulseError 2s infinite ease-in-out;
            }
            
            @keyframes pulseInfo {
                0% { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 rgba(45, 123, 244, 0); }
                50% { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 20px rgba(45, 123, 244, 0.3); }
                100% { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 rgba(45, 123, 244, 0); }
            }
            
            @keyframes pulseSuccess {
                0% { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 rgba(0, 200, 150, 0); }
                50% { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 20px rgba(0, 200, 150, 0.3); }
                100% { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 rgba(0, 200, 150, 0); }
            }
            
            @keyframes pulseError {
                0% { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 rgba(255, 59, 92, 0); }
                50% { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 20px rgba(255, 59, 92, 0.3); }
                100% { box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 rgba(255, 59, 92, 0); }
            }
            
            .notification-icon {
                margin-right: 12px;
                width: 24px;
                height: 24px;
                flex-shrink: 0;
                background-position: center;
                background-repeat: no-repeat;
                filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
            }
            
            .notification.info .notification-icon {
                background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23fff"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>');
            }
            
            .notification.success .notification-icon {
                background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23fff"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>');
            }
            
            .notification.error .notification-icon {
                background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23fff"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>');
            }
            
            .notification-content {
                flex-grow: 1;
                text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
                letter-spacing: 0.01em;
            }
            
            @media (max-width: 768px) {
                .notification-container {
                    max-width: 90%;
                    right: 5%;
                }
                
                .notification {
                    padding: 14px;
                    font-size: 14px;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Создаем очередь уведомлений, если ее еще нет
    if (!window.notificationQueue) {
        window.notificationQueue = [];
    }
    
    // Создаем объект уведомления
    const notificationData = {
        message,
        type
    };
    
    // Добавляем уведомление в очередь
    window.notificationQueue.push(notificationData);
    
    // Проверяем, можно ли показать уведомление сейчас
    processNotificationQueue();
}

// Функция для обработки очереди уведомлений
function processNotificationQueue() {
    // Если очереди нет, выходим
    if (!window.notificationQueue || window.notificationQueue.length === 0) {
        return;
    }
    
    const notificationContainer = document.querySelector('.notification-container');
    if (!notificationContainer) return;
    
    // Проверяем, сколько уведомлений уже отображается
    const visibleNotifications = notificationContainer.querySelectorAll('.notification:not(.hide)').length;
    
    // Если отображается меньше 3 уведомлений, показываем следующее
    if (visibleNotifications < 3 && window.notificationQueue.length > 0) {
        const nextNotification = window.notificationQueue.shift();
        displayNotification(nextNotification.message, nextNotification.type);
    }
}

// Функция для отображения уведомления
function displayNotification(message, type) {
    const notificationContainer = document.querySelector('.notification-container');
    if (!notificationContainer) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = document.createElement('div');
    icon.className = 'notification-icon';
    
    const content = document.createElement('div');
    content.className = 'notification-content';
    content.textContent = message;
    
    notification.appendChild(icon);
    notification.appendChild(content);
    
    notificationContainer.appendChild(notification);
    
    // Добавляем класс show после добавления в DOM для анимации
    setTimeout(() => {
        notification.classList.add('show');
    }, 50);
    
    // Удаляем уведомление через 3 секунды
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
                
                // После удаления уведомления проверяем очередь
                processNotificationQueue();
            }
        }, 500);
    }, 3000);
}

// Обработка результата игры
function processGameResult(data) {
    // Определяем выигрышный цвет
    lastWinningColor = data.color;
    
    // Показываем уведомление о результате
    showNotification(`Выпало ${getColorName(lastWinningColor)}!`, 'info');
    
    // Если пользователь выиграл
    if (data.winners && data.winners.includes(username)) {
        const winAmount = data.winAmount || 0;
        showNotification(`Вы выиграли ${winAmount.toLocaleString()} ₽!`, 'success');
    } else if (userHasBet) {
        // Если пользователь проиграл
        showNotification(`Вы проиграли. Выпало ${getColorName(lastWinningColor)}`, 'error');
    }
    
    // Добавляем результат в историю
    addToHistory(data.number || 0, lastWinningColor);
    
    // Сбрасываем ставки
    resetBets();
}

// Инициализация кнопок ставок
function initBetButtons() {
    const betButtons = document.querySelectorAll('.bet-btn');
    const betInput = document.querySelector('.bet-input');
    
    if (!betButtons.length || !betInput) {
        console.error('Не найдены кнопки ставок или поле ввода');
        return;
    }
    
    betButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Проверяем, идет ли игра
            if (gameInProgress) {
                showNotification('Дождитесь следующей игры', 'error');
                return;
            }
            
            // Проверяем, сделал ли пользователь уже ставку
            if (userHasBet) {
                showNotification('Вы уже сделали ставку', 'error');
                return;
            }
            
            const betAmount = parseInt(betInput.value);
            if (!betAmount || betAmount <= 0) {
                showNotification('Введите сумму ставки', 'error');
                return;
            }
            
            if (betAmount > userBalance) {
                showNotification('Недостаточно средств', 'error');
                return;
            }
            
            const color = this.classList.contains('red') ? 'red' : 
                          this.classList.contains('green') ? 'green' : 'black';
            
            // Сохраняем текущий баланс для возможного восстановления
            const previousBalance = userBalance;
            
            // Снимаем сумму с баланса
            userBalance -= betAmount;
            updateBalanceDisplay();
            
            // Отправляем ставку на сервер
            const success = placeBet(color, betAmount);
            
            // Если отправка не удалась, восстанавливаем баланс
            if (!success) {
                userBalance = previousBalance;
                updateBalanceDisplay();
                return;
            }
            
            // Очищаем поле ввода
            betInput.value = '';
        });
    });
}

// Обработка ошибки от сервера
function handleServerError(data) {
    if (data.errorType === 'bet_failed' && data.betAmount) {
        // Восстанавливаем баланс, если ставка не прошла
        userBalance += data.betAmount;
        updateBalanceDisplay();
        userHasBet = false;
        
        // Показываем уведомление об ошибке
        showNotification(data.message || 'Ошибка при размещении ставки', 'error');
    } else {
        // Показываем общее уведомление об ошибке
        showNotification(data.message || 'Произошла ошибка', 'error');
    }
}

// Обновляем инициализацию при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    startGameCycle();
});

// Добавляем стили анимации
const style = document.createElement('style');
style.textContent = `
    @keyframes newBetAppear {
        0% {
            transform: translateY(-20px);
            opacity: 0;
        }
        100% {
            transform: translateY(0);
            opacity: 1;
        }
    }
    
    @keyframes columnBounce {
        0% {
            transform: translateY(0);
        }
        20% {
            transform: translateY(-10px);
        }
        40% {
            transform: translateY(5px);
        }
        60% {
            transform: translateY(-3px);
        }
        80% {
            transform: translateY(2px);
        }
        100% {
            transform: translateY(0);
        }
    }
`;
document.head.appendChild(style); 
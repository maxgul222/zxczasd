# Casino Double Game

Веб-приложение с игрой Double, построенное на FastAPI и React.

## Структура проекта

```
├── backend/           # Python FastAPI backend
│   ├── app/
│   │   ├── main.py
│   │   ├── routes/
│   │   ├── models/
│   │   └── utils/
├── frontend/         # React TypeScript frontend
│   ├── src/
│   ├── public/
│   └── package.json
└── README.md
```

## Установка и запуск

### Бэкенд

1. Создайте виртуальное окружение:
```bash
python -m venv venv
source venv/bin/activate  # для Linux/Mac
venv\Scripts\activate     # для Windows
```

2. Установите зависимости:
```bash
pip install -r requirements.txt
```

3. Запустите сервер:
```bash
cd backend
uvicorn app.main:app --reload
```

### Фронтенд

1. Установите зависимости:
```bash
cd frontend
npm install
```

2. Запустите приложение:
```bash
npm start
```

## Деплой

- Бэкенд: GitHub Actions + Railway/Heroku
- Фронтенд: Netlify

## Переменные окружения

Создайте файл `.env` в корне проекта:

```
SECRET_KEY=your_secret_key
FRONTEND_URL=http://localhost:3000
``` 
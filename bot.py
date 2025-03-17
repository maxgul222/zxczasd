import logging
from aiogram import Bot, Dispatcher, types
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from aiogram.utils import executor
from config import BOT_TOKEN, WEBAPP_URL

# Настройка логирования
logging.basicConfig(level=logging.INFO)

# Инициализация бота и диспетчера
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher(bot)

# Создание клавиатуры с кнопкой для открытия веб-приложения
def get_webapp_keyboard():
    keyboard = InlineKeyboardMarkup()
    keyboard.add(InlineKeyboardButton(
        text="🎰 Играть в Double",
        web_app=WebAppInfo(url=WEBAPP_URL)
    ))
    return keyboard

# Обработчик команды /start
@dp.message_handler(commands=['start'])
async def cmd_start(message: types.Message):
    await message.answer(
        "👋 Добро пожаловать в Casino Double!\n\n"
        "🎲 Нажмите кнопку ниже, чтобы начать игру:",
        reply_markup=get_webapp_keyboard()
    )

if __name__ == '__main__':
    executor.start_polling(dp, skip_updates=True) 
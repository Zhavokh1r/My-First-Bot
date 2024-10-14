const { Telegraf, Markup } = require("telegraf");
const axios = require("axios");
const mongoose = require("mongoose");

const bot = new Telegraf("7920480275:AAHI0f00oeO6dIrkWRnsXj33s3Dzcu2-Ljw"); // Замените на токен вашего бота
const channelId = "@DataVizMaster"; // Ваш канал
let myId = "Y6727184943"; // Ваш ID для отправки сообщений всем
const mongoURL = "mongodb+srv://dddhhh:hhhddd@cluster0.lk5yv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"; // Ваш URL MongoDB

mongoose
  .connect(mongoURL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log("MongoDB connection error: ", err));

const { Schema, model } = require("mongoose");

const userSchema = new Schema({
  telegramId: { type: Number, required: true, unique: true },
  firstName: String,
  lastName: String,
  username: String,
  createdAt: { type: Date, default: Date.now },
});

const User = model("User", userSchema);

// Функция проверки подписки
async function checkSubscription(userId) {
  try {
    const res = await axios.get(
      `https://api.telegram.org/bot${bot.token}/getChatMember?chat_id=${channelId}&user_id=${userId}`
    );
    const status = res.data.result.status;
    return (
      status === "member" || status === "administrator" || status === "creator"
    );
  } catch (error) {
    console.error("Error checking subscription:", error);
    return false;
  }
}

// Обработчик команды /start
bot.start(async (ctx) => {
  console.log("Команда /start вызвана пользователем:", ctx.from.id);
  
  const { id, first_name, last_name, username } = ctx.from;

  // Проверяем подписку
  const isSubscribed = await checkSubscription(id);

  if (!isSubscribed) {
    ctx.reply(
      `Привет, ${first_name}, пожалуйста, подпишитесь на наш канал сначала.`,
      Markup.inlineKeyboard([
        Markup.button.url(
          "Подписаться",
          `https://t.me/${channelId.replace("@", "")}`
        ),
        Markup.button.callback("Проверить подписку", "check_subscription"),
      ])
    );
    return; // Важно добавить return, чтобы остановить выполнение функции
  }

  // Добавляем пользователя в базу данных
  try {
    let user = await User.findOne({ telegramId: id });
    if (!user) {
      user = new User({
        telegramId: id,
        firstName: first_name,
        lastName: last_name,
        username: username,
      });
      await user.save();
      ctx.reply(`Добро пожаловать, ${first_name}! Вы добавлены в нашу базу данных.`);
    } else {
      ctx.reply(`С возвращением, ${first_name}!`);
    }
  } catch (error) {
    console.error("Ошибка при добавлении пользователя в базу данных:", error);
    if (error.code !== 11000) {
      ctx.reply("Произошла ошибка, пожалуйста, попробуйте позже.");
    } else {
      console.log("Пользователь уже существует в базе данных:", id);
    }
  }

  // Отправляем список товаров
  await sendProductList(ctx);
});

// Обработка кнопки для проверки подписки
bot.action("check_subscription", async (ctx) => {
  const userId = ctx.from.id;
  const isSubscribed = await checkSubscription(userId);

  if (isSubscribed) {
    ctx.reply(`Спасибо за подписку, ${ctx.from.first_name}!`);
    // Отправляем список товаров после подтверждения подписки
    await sendProductList(ctx);
  } else {
    ctx.reply("Пожалуйста, подпишитесь на канал сначала.");
  }
});

// Функция отправки списка товаров
async function sendProductList(ctx) {
  try {
    const response = await axios.get("https://fakestoreapi.com/products");
    const products = response.data;

    ctx.reply(
      "Вот список товаров:",
      Markup.inlineKeyboard(
        products.map((product) => {
          return [Markup.button.callback(product.title, product.id)];
        })
      )
    );
  } catch (error) {
    console.error("Ошибка при получении товаров:", error);
    ctx.reply("Произошла ошибка при загрузке товаров.");
  }
}

// Обработка нажатия на товар
bot.action(/^\d+$/, async (ctx) => {
  const productId = ctx.callbackQuery.data; // Получаем ID продукта
  try {
    const response = await axios.get(
      `https://fakestoreapi.com/products/${productId}`
    );
    const product = response.data;

    const message = `Название: ${product.title}\nЦена: ${product.price}`;

    await ctx.replyWithPhoto(product.image, { caption: message });
  } catch (error) {
    console.error("Ошибка при получении товара:", error);
    ctx.reply("Товар не найден по заданному ID.");
  }
});

// Функция отправки сообщений всем пользователям
async function sendMessageToAllUsers(message) {
  try {
    const users = await User.find();

    for (const user of users) {
      try {
        await bot.telegram.sendMessage(user.telegramId, message);
      } catch (error) {
        console.error(`Не удалось отправить сообщение ${user.telegramId}:`, error);
      }
    }
  } catch (error) {
    console.error("Ошибка при получении пользователей:", error);
  }
}

// Команда для отправки рекламы всем пользователям
bot.command("send_ad", (ctx) => {
  let id = ctx.from.id;
  if (id == myId) {
    const message = "Новое предложение!"; // Ваше рекламное сообщение
    sendMessageToAllUsers(message)
      .then(() => {
        ctx.reply("Реклама отправлена всем пользователям!");
      })
      .catch((error) => {
        ctx.reply("Не удалось отправить рекламу.");
        console.error("Ошибка при отправке рекламы:", error);
      });
  } else {
    ctx.reply("Вы не авторизованы для отправки рекламы.");
  }
});

// Запуск бота
bot.launch();

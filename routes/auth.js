const express = require('express');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Payments = require('../models/Payments');
const authenticate = require('../middleware/authenticate');
const {getSuccessResponse, getErrorResponse} = require("../utils/functions");

const router = express.Router();

router.post('/register', async (req, res) => {
    const {username, email, password} = req.body;

    try {
        const existingUserName = await User.findOne({
            username: username
        });
    
        if (existingUserName) {
            return res.status(400).json(getErrorResponse('Користувач з таким ніком вже існує'));
        }

        const existingUserEmail = await User.findOne({
            email: email
        });

        if (existingUserEmail) {
            return res.status(400).json(getErrorResponse('Користувач з таким email вже існує'));
        }

        const user = new User({username, email, password});
        await user.save();
        const token = jwt.sign({id: user._id}, process.env.JWT_SECRET, {expiresIn: '1h'});
        res.status(201).json(getSuccessResponse({token}, 'Ви успішно зареєструвались'));
    } catch (err) {
        console.log(err); 
        res.status(400).json(getErrorResponse('Помилка реєстрації'));
    }
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        // Находим пользователя по имени
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(404).json(getErrorResponse(`Користувач з ніком ${username} не знайдений`));
        }

        // Проверяем пароль
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json(getErrorResponse('Неправильний пароль'));
        }

        // Генерируем accessToken
        const accessToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '1d' } // Время жизни accessToken
        );

        // Генерируем refreshToken
        const refreshToken = jwt.sign(
            { id: user._id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' } // Время жизни refreshToken
        );

        // (Необязательно) Сохранение refreshToken в базе данных или другой системе хранения
        // user.refreshToken = refreshToken;
        // await user.save();

        // Возвращаем оба токена клиенту
        return res.status(200).json(getSuccessResponse({ accessToken, refreshToken }));
    } catch (err) {
        console.error(err);
        return res.status(500).json(getErrorResponse('Помилка авторизації. Зверніться до адміністратора'));
    }
});

router.post('/refresh', async (req, res) => {
    const refreshToken = req.body.refreshToken; // Получаем refreshToken из тела запроса

    if (!refreshToken) {
        return res.status(400).json(getErrorResponse('Час сесії вичерпано. Увійдіть в акаунт знову'));
    }

    try {
        // Проверяем refreshToken
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        // Находим пользователя по ID из токена
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(404).json(getErrorResponse('Користувач не знайдений'));
        }

        // Генерируем новый accessToken
        const accessToken = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: '1d' } // Устанавливаем время жизни accessToken
        );

        // Генерируем refreshToken
        const newRefreshToken = jwt.sign(
            { id: user._id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' } // Время жизни refreshToken
        );

        // Возвращаем новый токен
        return res.status(201).json(getSuccessResponse({ accessToken, refreshToken: newRefreshToken }));
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json(getErrorResponse('Час сесії вичерпано. Увійдіть в акаунт знову', 401));
        }
        if (err.name === 'JsonWebTokenError') {
            return res.status(401).json(getErrorResponse('Час сесії вичерпано. Увійдіть в акаунт знову', 401));
        }
        return res.status(500).json(getErrorResponse('Час сесії вичерпано. Увійдіть в акаунт знову', 401));
    }
});

router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.status(200).json(getSuccessResponse({user}));
    } catch (err) {
        res.status(500).json(getErrorResponse('Сталася помилка отримання даних користувача'));
    }
});

router.post('/me', authenticate, async (req, res) => {
    const {type_report} = req.body;
    try {
        const user = await User.findByIdAndUpdate(req.user.id, {type_report: type_report}).select('-password');
        await user.save();
        res.status(200).json(getSuccessResponse({user}, 'Налаштування користувача збережено'));
    } catch (err) {
        res.status(500).json(getErrorResponse('Сталася помилка'));
    }
});

router.get('/check-payment', authenticate, async (req, res) => {
    try {
        // Получаем данные авторизованного пользователя
        const user = await User.findById(req.user.id).select('-password');

        if (!user) {
            return res.status(404).json(getErrorResponse('Користувач не знайдений'));
        }

        // Проверяем наличие записи в таблице Payments
        let paymentRecord = await Payments.findOne({ clientName: user.username });

        if (paymentRecord) {
            // Если запись найдена, возвращаем положительный ответ
            return res.status(200).json(getSuccessResponse({
                user,
                paymentInfo: paymentRecord,
            }));
        }

        // Если записи нет, делаем запрос к API
        let allDonates = [];
        let page = 0;
        let isLastPage = false;

        while (!isLastPage) {
            const { data: externalData } = await axios.get(process.env.DONATELLO_URI, {
                headers: {
                    'X-Token': process.env.DONATELLO_TOKEN,
                },
                params: {
                    page,
                    size: 100,
                },
            });

            if (!externalData || !externalData.content) {
                return res.status(500).json(getErrorResponse('Сталася помилка'));
            }

            allDonates = allDonates.concat(externalData.content);
            isLastPage = externalData.last;
            page += 1;
        }

        // Ищем совпадение clientName с логином пользователя
        const match = allDonates.find(item => item.clientName === user.username);

        if (match) {
            // Если пользователь найден, записываем в таблицу Payments
            paymentRecord = new Payments({
                clientName: user.username,
                amount: match.amount,
                paymentDate: match.paymentDate,
                currency: match.currency,
                createdAt: match.createdAt
            });

            await paymentRecord.save();

            return res.status(200).json(getSuccessResponse({
                user,
                paymentInfo: paymentRecord,
            }));
        }

        // Если пользователь не найден, возвращаем ошибку
        return res.status(404).json(getErrorResponse('Дані про оплату не знайдені'));
    } catch (err) {
        console.error(err);
        res.status(500).json(getErrorResponse('Помикла отримання даних з Donatello'));
    }
});


module.exports = router;
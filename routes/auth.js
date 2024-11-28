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
        const user = new User({username, email, password});
        await user.save();
        const token = jwt.sign({id: user._id}, process.env.JWT_SECRET, {expiresIn: '1h'});
        res.status(201).json(getSuccessResponse({token}, 'Ви успішно зареєструвались'));
    } catch (err) {
        res.status(400).json(getErrorResponse('Error registering user'));
    }
});

router.post('/login', async (req, res) => {
    const {username, password} = req.body;
    try {
        const user = await User.findOne({username});
        if (!user) return res.status(404).json(getErrorResponse('User not found'));

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json(getErrorResponse('Invalid credentials'));
        }

        const token = jwt.sign({id: user._id}, process.env.JWT_SECRET, {expiresIn: '1h'});
        res.status(200).json(getSuccessResponse({token}));
    } catch (err) {
        res.status(500).json(getErrorResponse('Error logging in'));
    }
});

router.post('/refresh', async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        const token = jwt.sign({id: user._id}, process.env.JWT_SECRET, {expiresIn: '1h'});
        res.status(201).json(getSuccessResponse({token}));
    } catch (err) {
        res.status(500).json(getErrorResponse('Error fetching user data'));
    }
});

router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.status(200).json(getSuccessResponse({user}));
    } catch (err) {
        res.status(500).json(getErrorResponse('Error fetching user data'));
    }
});

router.get('/check-payment', authenticate, async (req, res) => {
    try {
        // Получаем данные авторизованного пользователя
        const user = await User.findById(req.user.id).select('-password');

        if (!user) {
            return res.status(404).json(getErrorResponse('User not found'));
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
                return res.status(500).json(getErrorResponse('Failed to fetch external data'));
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
        return res.status(404).json(getErrorResponse('No matching payment info found'));
    } catch (err) {
        console.error(err);
        res.status(500).json(getErrorResponse('Error fetching user data or external API'));
    }
});


module.exports = router;
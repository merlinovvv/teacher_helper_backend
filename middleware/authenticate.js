const jwt = require('jsonwebtoken');
const { getErrorResponse } = require("../utils/functions");

const authenticate = async (req, res, next) => {     
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json(getErrorResponse('Помилка авторизації'));

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!token) return res.status(401).json(getErrorResponse('Помилка авторизації'));

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        console.error('JWT Error:', err);
        res.status(401).json(getErrorResponse('Помилка авторизації'));
    }
};

module.exports = authenticate;

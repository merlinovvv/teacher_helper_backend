const jwt = require('jsonwebtoken');
const { getErrorResponse } = require("../utils/functions");
const User = require('../models/User');

const authenticate = async (req, res, next) => {
    const authHeader = req.header('Authorization');
    if (!authHeader) return res.status(401).json(getErrorResponse('Access denied'));

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    if (!token) return res.status(401).json(getErrorResponse('Access denied'));

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch (err) {
        console.error('JWT Error:', err);
        res.status(400).json(getErrorResponse('Invalid token'));
    }
};

module.exports = authenticate;

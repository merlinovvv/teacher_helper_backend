const express = require("express");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const GradesGroupsReports = require("../models/GradesGroupsReports");
const Payments = require("../models/Payments");
const authenticate = require("../middleware/authenticate");
const { getSuccessResponse, getErrorResponse } = require("../utils/functions");

const router = express.Router();

router.get("/users", authenticate, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (user.user_role === "admin") {
    try {
      const users = await User.find().select("-password");

      // Получаем всех пользователей из базы данных
      const newUsers = await Promise.all(
        users.map(async (us) => {
          const reports = await GradesGroupsReports.find({ userId: us._id });
          return {
            ...us.toObject(),
            reports: reports,
          };
        })
      );

      // Возвращаем пользователей в ответе
      res.status(200).json(getSuccessResponse({ users: newUsers }));
    } catch (err) {
      console.error("Error fetching users:", err.message);

      // Возвращаем ошибку при возникновении проблем
      res
        .status(500)
        .json(getErrorResponse("Сталася помилка отримання даних користувачів"));
    }
  } else {
    res
      .status(400)
      .json(getErrorResponse("Вам заборонено отримувати ці дані", {}));
  }
});

module.exports = router;

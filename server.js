require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const approvedDomains = ['http://teacher-helper.pp.ua', 'https://teacher-helper.pp.ua', 'http://grades-helper.pp.ua', 'https://grades-helper.pp.ua']

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || origin.startsWith('http://localhost') || approvedDomains.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('Failed to connect to MongoDB', err));

app.listen(process.env.PORT, () => {
    console.log(`Server running on port ${process.env.PORT}`);
});

const authRoutes = require('./routes/auth');
const gradesByGroupsRoutes = require('./routes/gradesByGroups');

app.use('/api/auth', authRoutes);
app.use('/api/grades-groups', gradesByGroupsRoutes);

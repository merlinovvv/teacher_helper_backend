const mongoose = require('mongoose');

const GroupsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Ссылка на коллекцию User
        required: true
    },
    subject: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subjects', // Ссылка на коллекцию Subjects
        required: true
    },
    schoolClass: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Classes', // Ссылка на коллекцию Classes
        required: true
    },
    groups: [
        {
            name: { type: String, required: true }, // Название группы
            assigment_dates: { type: [Date], default: [] },   // Список дат
            control_dates: { type: [Date], default: [] }   // Список дат
        }
    ]
});

module.exports = mongoose.model('Groups', GroupsSchema);

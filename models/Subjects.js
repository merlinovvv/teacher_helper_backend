const mongoose = require('mongoose');

const SubjectsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Ссылка на коллекцию User
        required: true
    },
    name: { type: String, required: true }
});

module.exports = mongoose.model('Subjects', SubjectsSchema); 
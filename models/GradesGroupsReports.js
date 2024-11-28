const mongoose = require('mongoose');

const GradesGroupsReportsSchema = new mongoose.Schema({
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
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Ссылка на коллекцию User
        required: true
    }
});

module.exports = mongoose.model('GradesGroupsReports', GradesGroupsReportsSchema);

const mongoose = require('mongoose');

const PaymentsSchema = new mongoose.Schema({
    pubId: { type: String, required: false },
    clientName: { type: String, required: true },
    amount: { type: String, required: true },
    currency: { type: String, required: true },
    createdAt: { type: String, required: true },
});

module.exports = mongoose.model('Payments', PaymentsSchema);
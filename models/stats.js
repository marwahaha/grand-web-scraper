
const mongoose = require('mongoose')

const { Schema } = mongoose

const statsSchema = new Schema({
    categoryName: { type: String },
    newUserNumber: { type: Number },
    newProposalNumber: { type: Number },
    sortOption: { type: String },
    typeOption: { type: String },
    typeOptionIndex: { type: Number },
    originalTextOnTotals: { type: String },
    pretendedTotal: { type: Number },
    pretendedSubtotal: { type: Number },
    totalScanned: { type: Number },
    totalTreated: { type: Number },
    utimeSpent: { type: Number },
    utimeTotalWaited: { type: Number },
    completeCollectFailed: { type: Boolean, default: false },
    failReason: { type: String, default: 'n/a' },
    errObject: { type: Object, default: null },
    created: { type: Date, default: Date.now() },
})

module.exports = mongoose.model('Stats', statsSchema)

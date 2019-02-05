const mongoose = require('mongoose')

const { Schema } = mongoose

const proposalSchema = new Schema({
    name: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    category: { type: Schema.Types.ObjectId, required: true, ref: 'Category' },
    infoFetched: { type: Boolean, default: false },
    registered: { type: Date },
    registeredText: { type: String },
    qna: [Schema.Types.Mixed],
    deleted: { type: Boolean, default: false },
})

module.exports = mongoose.model('Proposal', proposalSchema)

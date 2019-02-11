const mongoose = require('mongoose')

const { Schema } = mongoose

const userSchema = new Schema({
    name: { type: String, required: true },
    infoFetched: { type: Boolean, default: false },
    registered: { type: Date },
    type: { type: String },
    deleted: { type: Boolean, default: false },
    undeleted: { type: Number, default: 0 },
})

userSchema.index({ name: 1 }, { unique: true })

module.exports = mongoose.model('User', userSchema)

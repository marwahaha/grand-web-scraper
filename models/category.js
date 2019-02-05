const mongoose = require('mongoose')

const { Schema } = mongoose

const categorySchema = new Schema({
    name: { type: String, required: true },
    baseUrl: { type: String, required: true },
    infoFetched: { type: Boolean, default: false },
})
categorySchema.index({ name: 1, baseUrl: 1 }, { unique: true })

module.exports = mongoose.model('Category', categorySchema)

const mongoose = require('mongoose')

const utils = require('../_utils')

mongoose.connect(utils.getConfig().connectionString, {
    useCreateIndex: true,
    useNewUrlParser: true,
})

const Stats = require('../models/stats')
const Proposal = require('../models/proposal')
const Category = require('../models/category');

(async () => {
    const categories = await Category.find()

    let total = 0
    for (let i = categories.length - 1; i >= 0; i--) {
        const query = {
            categoryName: categories[i].name,
            sortOption: 'random', // random gives us real number
            completeCollectFailed: false, // last successful entry
        }
        // only one entry per category
        const stat = await Stats.find(query).sort({ created: -1 }).limit(1)
        if (stat && stat.length === 1) total += stat[0].pretendedTotal
    }

    const dbTotal = await Proposal.countDocuments({ deleted: { $ne: true } })
    console.log({ total, dbTotal, ratio: Math.round(dbTotal / total * 1e3) / 1e3 })

    process.exit()
})().catch((err) => {
    console.log('!!!!----FATAL ERROR----!!!!')
    console.log(err)
    console.log('!!!!----FATAL ERROR----!!!!')
    process.exit()
})

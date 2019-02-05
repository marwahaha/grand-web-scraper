const cheerio = require('cheerio')
const moment = require('moment')

const User = require('../models/user')

module.exports = async (page, closeFn, url, userId) => {
    let closing = false
    const getOut = (err) => {
        if (page) {
            closing = true
            // Stats.create(statsObject, () => {
            //     closeFn(page)
            // })
            closeFn(page)
        }
        if (err) console.log('getting out', err)
    }

    const dest = await page.goto(url).catch(getOut)
    // resource not found?
    if (dest.status() === 404) {
        // then consider this (if found) as probably deleted since
        await User.updateOne({ _id: userId }, {
            deleted: true,
        }).catch(getOut)
    }
    if (dest.status() !== 200) return
    if (closing) return

    // this page is mostly rendered on the server side so we don't need to wait for anything
    const html = await page.content().catch(getOut)
    if (closing) return
    const $ = cheerio.load(html)

    try {
        // eslint-disable-next-line
        const infos = $('ul.profile__infos > li').map(function () { return $(this).text() }).get()
        const date = infos[0].match(/([0-9/]+)/)[1]

        await User.updateOne({ _id: userId }, {
            registered: moment(date, 'Do/MM/YYYY').toDate(),
            type: infos[1],
            infoFetched: true,
        }).catch(getOut)
    } catch (e) {
        console.log('ERROR:userProfile -> info parsing', e)
        return
    }

    getOut()
}

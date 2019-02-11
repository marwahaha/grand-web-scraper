const cheerio = require('cheerio')
const moment = require('moment')

const utils = require('../_utils')

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
        if (utils.getConfig().testMode) {
            console.log('userProfile error 404')
            return
        }
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

        const obj = {
            registered: moment(date, 'Do/MM/YYYY').toDate(),
            type: infos[1],
            infoFetched: true,
        }

        const user = await User.findOne({ _id: userId })
        if (user && user.deleted && user.deleted === true) {
            obj.deleted = false
            obj.undeleted = user.deleted ? user.deleted + 1 : 1
        }

        if (utils.getConfig().testMode) {
            const condition = !!obj && !!obj.type && typeof obj.type === 'string'
            console.log(`userProfile success => ${condition}`)
            return
        }

        await User.updateOne({ _id: userId }, obj).catch(getOut)
    } catch (e) {
        console.log('ERROR:userProfile -> info parsing', e)
        return
    }

    getOut()
}

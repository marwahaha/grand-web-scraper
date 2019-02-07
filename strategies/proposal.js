const cheerio = require('cheerio')
const moment = require('moment')

const utils = require('../_utils')

const Proposal = require('../models/proposal')

module.exports = async (page, closeFn, url, proposalId) => {
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
    if (dest.status() === 404) {
        if (utils.getConfig().testMode) {
            console.log('proposal error 404')
            return
        }
        // consider this (if found) as probably deleted since
        await Proposal.updateOne({ _id: proposalId }, {
            deleted: true,
        }).catch(getOut)
    }
    if (dest.status() !== 200) return
    if (closing) return

    await page.waitForSelector('#proposal-page-tabs-tab-content').catch(getOut)
    if (closing) return

    const html = await page.content().catch(getOut)
    if (closing) return
    const $ = cheerio.load(html)

    try {
        const dateAndHoursText = $('.media-body > .excerpt > span > span')
            // eslint-disable-next-line
            .map(function () { return $(this).text() }).get()[1]
        const dateAndHoursOnly = dateAndHoursText.match(/([0-9]+ .+[0-9]+)$/)[1]
        const registered = moment(dateAndHoursOnly, 'Do MMMM YYYY à h:mm').toDate()

        // to get the number of proposal
        const $QnA = $('#proposal-page-tabs-pane-content .block > div')
        const QnA = []
        for (let i = $QnA.length - 1; i >= 0; i--) {
            const question = $($QnA[i].children[0]).text()
            const answer = $($QnA[i].children[1]).text()
            if (question) {
                QnA.push({ question, answer })
            }
        }

        const obj = {
            registered, registeredText: dateAndHoursText, qna: QnA, infoFetched: true,
        }

        if (utils.getConfig().testMode) {
            const condition = !!obj
                && !!obj.registeredText && typeof obj.registeredText === 'string'
                && !!obj.qna && typeof obj.qna === 'object'
            console.log(`proposal success => ${condition}`)
            return
        }

        await Proposal.updateOne({ _id: proposalId }, obj).catch(getOut)
    } catch (e) {
        console.log('ERROR:proposalPage -> info parsing', e)
        return
    }

    getOut()
}

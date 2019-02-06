

const cheerio = require('cheerio')

const utils = require('../_utils')

const Category = require('../models/category')
const User = require('../models/user')
const Proposal = require('../models/proposal')
const Stats = require('../models/stats')


// TODO: eventually scrape the values too
const whosWhat = []
whosWhat[1] = 'Citoyen / Citoyenne'
whosWhat[4] = 'Élu / élue et Institution'
whosWhat[2] = 'Organisation à but lucratif'
whosWhat[3] = 'Organisation à but non lucratif'

const selectorForLoadMoreButton = '#proposal-list-pagination-footer button'

module.exports = async (page, closeFn, url, categoryName) => {
    const statsObject = {
        categoryName,
        newUserNumber: 0,
        newProposalNumber: 0,
        sortOption: 'random',
        typeOption: 'n/a',
        typeOptionIndex: 1,
        originalTextOnTotals: '',
        pretendedTotal: -1,
        pretendedSubtotal: -1,
        totalScanned: 0,
        totalTreated: 0,
        utimeSpent: new Date(),
        utimeTotalWaited: 0,
        completeCollectFailed: true,
    }

    let closing = false
    const getOut = () => {
        statsObject.utimeSpent = (new Date()) - statsObject.utimeSpent
        if (page) {
            closing = true
            Stats.create(statsObject, () => {
                closeFn(page)
            })
        }
        console.log(statsObject)
    }

    const dest = await page.goto(url)
        .catch((err) => {
            statsObject.failReason = `goto ${url}`
            statsObject.errObject = err
            getOut()
        })
    // resource not found?
    if (dest.status() !== 200) {
        statsObject.failReason = `page.goto ${url} error ${dest.status()}`
        getOut()
    }
    if (closing) return

    await page.waitForSelector(selectorForLoadMoreButton)
        .catch((err) => {
            statsObject.failReason = 'no reload button?'
            statsObject.errObject = err
            getOut()
        })
    if (closing) return

    await utils.asyncIsElementVisible(page, selectorForLoadMoreButton)
    if (closing) return
    statsObject.utimeTotalWaited += await utils.asyncMiniDelay(page, 0)
    const sortingSelector = '#proposal-sorting'
    const filterSelector = '#proposal-filter-types'


    // await page.select(sortingSelector, 'last')
    // statsObject.sortOption = 'last'


    const roll = Math.round(Math.random() * 100)
    if (roll < 5) { // 5% check first (shouldn't change much)
        await page.select(sortingSelector, 'old')
        statsObject.sortOption = 'old'
    } else if (roll < 35) { // 30% to be sure to check last posts sometimes
        await page.select(sortingSelector, 'last')
        statsObject.sortOption = 'last'
    } // 85% chance to leave it to 'random'
    await utils.asyncIsElementVisible(page, selectorForLoadMoreButton)
    statsObject.utimeTotalWaited += await utils.asyncMiniDelay(page, 0)
    const reroll = Math.round(Math.random() * 100)
    if (reroll < 5) { // 5% for any of the fewer groups
        const subreroll = Math.floor(Math.random() * 3 + 2)
        await page.select(filterSelector, subreroll.toString())
        statsObject.typeOption = `${whosWhat[subreroll]}`
        statsObject.typeOptionIndex = subreroll
    } else { // 95% chance for option "Citoyen / Citoyenne" which is the biggest group
        await page.select(filterSelector, '1')
        statsObject.typeOption = `${whosWhat[1]}`
        statsObject.typeOptionIndex = 1
    }


    let loadMoreVisible = await utils.asyncIsElementVisible(page, selectorForLoadMoreButton)
    while (loadMoreVisible) {
        statsObject.utimeTotalWaited += await utils.asyncMiniDelay(page, 300)
        await page
            .click(selectorForLoadMoreButton)
            .catch(() => {})
        loadMoreVisible = await utils.asyncIsElementVisible(page, selectorForLoadMoreButton)
    }


    const html = await page.content()
        .catch((err) => {
            statsObject.failReason = 'content fetch failed'
            statsObject.errObject = err
            getOut()
        })
    if (closing) return
    const $ = cheerio.load(html)
    statsObject.originalTextOnTotals = $('#details .proposal__step-page div > h3 > span').text()
    const totalText = statsObject.originalTextOnTotals
    statsObject.pretendedTotal = utils.prepareAndParseInt(totalText.match(/([0-9]+) prop/), 1)
    statsObject.pretendedSubtotal = utils.prepareAndParseInt(totalText.match(/(.+) sur/), 1)

    const cards = $('ul.media-list.proposal-preview-list > li')

    const href = $(cards[0]).find('div.card__body__infos > a').attr('href')
    const baseUrl = href && href.substr ? href.substr(0, href.length - href.split('/').pop().length) : null
    if (!baseUrl) {
        statsObject.failReason = 'no base url'
        getOut()
        return
    }


    const categoryFound = await Category.findOne({ baseUrl }).catch(() => {
        statsObject.failReason = 'category find failed'
        getOut()
    })
    if (closing) return
    let category = categoryFound
    if (!category) {
        category = await Category.create({ baseUrl, name: statsObject.categoryName }).catch(() => {
            statsObject.failReason = 'no new category'
            getOut()
        })
    }
    if (closing) return


    for (let i = cards.length - 1; i >= 0; i--) {
        const el = cards[i]

        statsObject.totalScanned += 1

        const username = $(el).find('div.ellipsis > a').attr('href').split('/').pop()
        const name = $(el).find('div.card__body__infos > a').attr('href').split('/').pop()

        let _quit_ = false

        const userFound = await User.findOne({ name: username }).catch(() => { _quit_ = true })
        if (_quit_) continue
        let user = userFound
        if (!user) {
            user = await User.create({ name: username }).catch(() => { _quit_ = true })
            if (_quit_) continue
            statsObject.newUserNumber += 1
        }

        const proposalFound = await Proposal.findOne({ name }).catch(() => { _quit_ = true })
        if (_quit_) continue
        if (!proposalFound) {
            await Proposal.create({
                name,
                user: user.id,
                category: category.id,
            }).catch(() => { _quit_ = true })
            if (_quit_) continue

            statsObject.newProposalNumber += 1
        }

        statsObject.totalTreated += 1
    }

    statsObject.completeCollectFailed = false
    getOut()
}

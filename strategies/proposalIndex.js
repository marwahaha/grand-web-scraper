const cheerio = require('cheerio')

const proposalPageStrategy = require('../strategies/proposal')
const userProfilePageStrategy = require('./user')

const utils = require('../_utils')

const Category = require('../models/category')
const User = require('../models/user')
const Proposal = require('../models/proposal')
const Stats = require('../models/stats')


const selectorForLoadMoreButton = '#proposal-list-pagination-footer button'

module.exports = async (page, closeFn, url, categoryName) => {
    const statsObject = {
        categoryName,
        newUserNumber: 0,
        newProposalNumber: 0,
        sortOption: 'random',
        typeOption: 'n/a',
        typeOptionIndex: -1,
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
    const getOut = async () => {
        statsObject.utimeSpent = (new Date()) - statsObject.utimeSpent
        if (page) {
            closing = true
            // bypass for test purpose
            if (utils.getConfig().testMode) {
                if (statsObject.failReason) {
                    console.log(statsObject)
                }
                return
            }
            await Stats.create(statsObject, () => {})
            closeFn(page)
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

    await page.waitForSelector('#proposal__step-page-rendered')
        .catch((err) => {
            statsObject.failReason = 'error rendering content'
            statsObject.errObject = err
            getOut()
        })
    if (closing) return

    statsObject.utimeTotalWaited += await utils.asyncMiniDelay(page, 0)
    const sortingSelector = '#proposal-sorting'


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


    const loadCheerio = async () => {
        const html = await page.content()
            .catch((err) => {
                statsObject.failReason = 'content fetch failed'
                statsObject.errObject = err
                getOut()
            })
        if (closing) return null
        return cheerio.load(html)
    }

    let cards = []
    const getTheLinks = async () => {
        const $ = await loadCheerio()
        if (closing || typeof $ !== 'function') return
        const list = $('ul.media-list.proposal-preview-list > li')
        if (list && list.length) cards = list
    }

    let loadMoreVisible = await utils.asyncIsElementVisible(page, selectorForLoadMoreButton)

    let $ = await loadCheerio()
    if (closing || typeof $ !== 'function') return
    statsObject.originalTextOnTotals = $('#details .proposal__step-page div > h3 > span').text()
    const totalText = statsObject.originalTextOnTotals
    statsObject.pretendedTotal = utils.prepareAndParseInt(totalText.match(/(.+) prop/), 1)
    statsObject.pretendedSubtotal = -1
    await getTheLinks()
    const href = $(cards[0]).find('div.card__body__infos > a').attr('href')
    const baseUrl = href && href.substr ? href.substr(0, href.length - href.split('/').pop().length) : null

    // TODO: MAYBE rework the code to insert new elements while spamming the "load more" button
    while (loadMoreVisible) {
        statsObject.utimeTotalWaited += await utils.asyncMiniDelay(page, 300)
        await page
            .click(selectorForLoadMoreButton)
            .catch(() => {})
        await getTheLinks()
        loadMoreVisible = await utils.asyncIsElementVisible(page, selectorForLoadMoreButton)
    }

    $ = await loadCheerio()
    if (closing || typeof $ !== 'function') return

    await getTheLinks()

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
    if (!category && !utils.getConfig().testMode) {
        category = await Category.create({ baseUrl, name: statsObject.categoryName }).catch(() => {
            statsObject.failReason = 'no new category'
            getOut()
        })
    }
    if (closing) return

    // we use an empty close function to avoid closing the page
    const doit = async (_f, _u, _id) => _f(page, () => { }, _u, _id)

    // TODO: MAYBE rework the code to insert new elements while spamming the "load more" button
    for (let i = cards.length - 1; i >= 0; i--) {
        const el = cards[i]

        statsObject.totalScanned += 1

        const username = $(el).find('div.ellipsis > a').attr('href').split('/').pop()
        const name = $(el).find('div.card__body__infos > a').attr('href').split('/').pop()

        let _quit_ = false
        const quitSequence = () => { _quit_ = true }

        // bypass for test purpose
        if (utils.getConfig().testMode) {
            const condition = true
            console.log(`proposalIndex success => ${condition}`)
            return
        }

        const userFound = await User.findOne({ name: username }).catch(quitSequence)
        if (_quit_) continue
        let user = userFound
        if (!user && !utils.getConfig().testMode) {
            user = await User.create({ name: username }).catch(quitSequence)
            if (_quit_) continue

            statsObject.newUserNumber += 1

            await doit(userProfilePageStrategy, `${utils.getConfig().domain}/profile/${username}`, user.id)
                .catch(console.log)
        }

        const proposalFound = await Proposal.findOne({ name }).catch(quitSequence)
        if (_quit_) continue
        if (!proposalFound && !utils.getConfig().testMode) {
            const proposal = await Proposal.create({
                name,
                user: user.id,
                category: category.id,
            }).catch(quitSequence)
            if (_quit_) continue

            await doit(proposalPageStrategy, `${category.baseUrl}${category.name}`, proposal.id)
                .catch(console.log)

            statsObject.newProposalNumber += 1
        }

        statsObject.totalTreated += 1
    }

    statsObject.completeCollectFailed = false
    getOut()
}

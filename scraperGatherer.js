const cheerio = require('cheerio')
const puppeteer = require('puppeteer')
const mongoose = require('mongoose')

const utils = require('./_utils')

mongoose.connect(utils.getConfig().connectionString, {
    useCreateIndex: true,
    useNewUrlParser: true,
})

const User = require('./models/user')
const Proposal = require('./models/proposal')

const proposalPageStrategy = require('./strategies/proposal')
const userProfilePageStrategy = require('./strategies/user')
const proposalIndexPageStrategy = require('./strategies/proposalIndex');


// -
// - STEP 1
// -
// - launch an async function and initiate a pupeteer browser
// -

(async () => {
    // utils.setTestMode() // debug
    const browser = await puppeteer.launch({
        // headless: false, // debug
        executablePath: utils.getConfig().chromePath,
    }).catch((err) => {
        console.log('browser crashed maybe', err)
        process.exit()
    })

    let pageNumber = 0
    const asyncNewPage = async () => {
        pageNumber++
        const page = await browser.newPage().catch(console.log)
        await utils.asyncPageRequestInterceptor(page).catch(console.log)
        return page
    }
    const browserClose = async (__page__) => {
        if (__page__) {
            await __page__.close().catch()
        }
        if (pageNumber - 1 <= 0) {
            await browser.close().catch()
            process.exit()
        }
        pageNumber--
    }

    // -
    // - STEP 2
    // -
    // - first scrape the index page to check on category
    // - second launch a new page with a scrape strategy for each category found
    // -

    const page = await asyncNewPage().catch(console.log)

    const dest = await page.goto(`${utils.getConfig().domain}/pages/partagez-vos-propositions`)
        .catch((err) => {
            console.log(err)
            browserClose(page)
        })
    // resource not found?
    if (dest.status() !== 200) {
        const waitDelay = 3e3 // seconds
        console.log(`page.goto error ${dest.status()}...waiting ${waitDelay / 1e3} sec before closing...`)
        await utils.asyncDelay(waitDelay)
        await browserClose(page)
    }

    const html = await page.content().catch((err) => {
        console.log(err)
        browserClose(page)
    })
    const $ = cheerio.load(html)

    const links = $('main div > div > a')

    if (links.length === 0) {
        const waitDelay = 45e3 // seconds
        console.log(`unable to read main page...waiting ${waitDelay / 1e3} sec before closing...`)
        await utils.asyncDelay(waitDelay)
        await browserClose(page)
    }

    // const el = links[0] // debug
    for (let i = links.length - 1; i >= 0; i--) {
        const el = links[i]

        const url = el.attribs.href
        // const url = '/project/democratie-et-citoyennete-1/collect/participez-a-la-recherche-collective-de-solutions' // debug
        const name = url.match(/\/project\/([^/]+)\//)[1]

        const newPage = await asyncNewPage().catch(console.log)
        proposalIndexPageStrategy(newPage, browserClose, `${utils.getConfig().domain}${url}`, name)
            .catch((err) => {
                console.log(`proposalIndexPageStrategy broke for some reason on ${name}`, err)
                browserClose()
            })
        await utils.asyncDelay(Math.round(Math.random() * 2e3 + 1e3))
    }

    // -
    // - STEP 3
    // -
    // - scrape user and proposal pages while waiting for the other pages to die
    // -

    const asyncFetchInfos = async () => {
        // we need a promise so we can fetch asynchronously both users and proposals
        // but also wait up until the very end of both requests
        let fetchedItems = []
        await (() => {
            const p = new Promise((resolve, reject) => {
                let calls = 0
                const handleResolve = (err, res) => {
                    if (calls) {
                        if (err) {
                            calls = 0
                            reject(err)
                        }
                        fetchedItems = utils.concatAndMix(fetchedItems, res)
                        if (calls - 1 <= 0) resolve()
                        calls--
                    }
                }

                const rule = { infoFetched: { $ne: true }, deleted: { $ne: true } }

                calls++
                User.find(rule, handleResolve).limit(25)
                calls++
                Proposal.find(rule, handleResolve).populate('category').limit(25)
            })
            return p
        })().catch(console.log)

        for (let i = fetchedItems.length - 1; i >= 0; i--) {
            const item = fetchedItems[i]

            // we use an empty close function to avoid closing the page
            const doit = async (_f, _u) => _f(page, () => { }, _u, item._id)

            if (item.user) {
                // this is a proposal
                await doit(proposalPageStrategy, `${item.category.baseUrl}${item.category.name}`)
                    .catch(console.log)
            } else {
                // this is a user
                await doit(userProfilePageStrategy, `${utils.getConfig().domain}/profile/${item.name}`)
                    .catch(console.log)
            }

            // gracefully quit if all other pages already did
            if (pageNumber === 1) return false
        }

        return true
    }

    // restart the whole process if at least one other page is still alive
    while (pageNumber > 1) {
        await asyncFetchInfos()
    }

    await browserClose(page)
})().catch((err) => {
    console.log('!!!!----FATAL ERROR----!!!!')
    console.log(err)
    console.log('!!!!----FATAL ERROR----!!!!')
    process.exit()
})

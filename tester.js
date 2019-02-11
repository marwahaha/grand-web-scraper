const cheerio = require('cheerio')
const puppeteer = require('puppeteer')
const mongoose = require('mongoose')

const utils = require('./_utils')

// test mode is on
utils.setTestMode()

mongoose.connect(utils.getConfig().connectionString, {
    useCreateIndex: true,
    useNewUrlParser: true,
})

const User = require('./models/user')
const Proposal = require('./models/proposal')

const proposalPageStrategy = require('./strategies/proposal')
const userProfilePageStrategy = require('./strategies/user')
const proposalIndexPageStrategy = require('./strategies/proposalIndex')


const domain = 'https://granddebat.fr';

// -
// - STEP 1
// -
// - launch an async function and initiate a pupeteer browser
// -

(async () => {
    const browser = await puppeteer.launch({
        // headless: false,
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

    const dest = await page.goto(`${domain}/pages/partagez-vos-propositions`)
        .catch((err) => {
            console.log(err)
            browserClose(page)
        })
    // resource not found?
    if (dest.status() !== 200) {
        console.log(`page.goto error ${dest.status()}`)
        await browserClose(page)
    }

    const html = await page.content().catch((err) => {
        console.log(err)
        browserClose(page)
    })
    const $ = cheerio.load(html)

    const links = $('main div > div > a')

    if (links.length === 0) {
        console.log('unable to read main page')
    } else {
        const condition = true
        console.log(`categoryIndex success => ${condition}`)
    }

    const el = links[0]

    const url = el.attribs.href
    const name = url.match(/\/project\/([^/]+)\//)[1]

    await proposalIndexPageStrategy(page, () => { }, `${domain}${url}`, name)
        .catch((err) => {
            console.log(`proposalIndexPageStrategy broke for some reason on ${name}`, err)
        })

    // -
    // - STEP 3
    // -
    // - scrape user and proposal pages while waiting for the other pages to die
    // -

    const rule = {}
    const fetchedItems = [
        await User.findOne(rule, () => {}),
        await Proposal.findOne(rule, () => {}).populate('category'),
    ]

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
            await doit(userProfilePageStrategy, `${domain}/profile/${item.name}`)
                .catch(console.log)
        }
    }

    await browserClose(page)
})().catch((err) => {
    console.log('!!!!----FATAL ERROR----!!!!')
    console.log(err)
    console.log('!!!!----FATAL ERROR----!!!!')
    process.exit()
})

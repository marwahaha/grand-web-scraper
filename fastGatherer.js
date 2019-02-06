const puppeteer = require('puppeteer')
const mongoose = require('mongoose')

const utils = require('./_utils')

mongoose.connect(utils.getConfig().connectionString, {
    useCreateIndex: true,
    useNewUrlParser: true,
})

const User = require('./models/user')
const Proposal = require('./models/proposal')
require('./models/category') // load the schema that's all...

const proposalPageStrategy = require('./strategies/proposal')
const userProfilePageStrategy = require('./strategies/userProfile')

const PROCESS_NUM = 4;

// -
// - STEP 1
// -
// - launch an async function and initiate a pupeteer browser
// -

(async () => {
    const browser = await puppeteer.launch({
        // headless: false,
        executablePath: 'D:/Programs/chrome-win/chrome.exe',
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
    const browserClose = (__page__) => {
        if (__page__) {
            __page__.close()
        }
        if (pageNumber - 1 <= 0) {
            browser.close()
            process.exit()
        }
        pageNumber--
    }

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
            User.find(rule, handleResolve)
            calls++
            Proposal.find(rule, handleResolve).populate('category')
        })
        return p
    })().catch(console.log)

    console.log(`${fetchedItems.length} items to go through`)

    const process = async (__page__) => {
        let pageTreatedNumber = 0
        setInterval(() => {
            const pageTreatedPerHour = Math.round(pageTreatedNumber / 6 * 100) / 100
            pageTreatedNumber = 0
            console.log(`speed is ${pageTreatedPerHour} req/h`)
        }, 10 * 60e3) // 10min
        // we use an empty close function to avoid closing the page
        const doit = async (_f, _u, _id) => _f(__page__, () => { }, _u, _id)
        const popit = async () => {
            const item = fetchedItems.pop()
            if (!item) {
                browserClose(__page__)
                return false
            }

            if (item.user) {
                // this is a proposal
                await doit(proposalPageStrategy, `${item.category.baseUrl}${item.category.name}`)
                    .catch(console.log)
            } else {
                // this is a user
                await doit(userProfilePageStrategy, `https://granddebat.fr/profile/${item.name}`)
                    .catch(console.log)
            }

            pageTreatedNumber++

            return true
        }
        // eslint-disable-next-line
        while (await popit()) {}
    }

    // launch PROCESS_NUM process
    for (let i = PROCESS_NUM; i > 0; i--) {
        process(await asyncNewPage().catch(console.log), i)
    }
})().catch((err) => {
    console.log('!!!!----FATAL ERROR----!!!!')
    console.log(err)
    console.log('!!!!----FATAL ERROR----!!!!')
    process.exit()
})

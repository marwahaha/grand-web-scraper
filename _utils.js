
// simple config
const config = {
    connectionString: 'mongodb://localhost:27017/db',
    chromePath: 'D:/Programs/chrome-win/chrome.exe',
    testMode: false,
}

module.exports = {
    getConfig: () => config,
    setTestMode: () => { config.testMode = true },
    // simple delay
    asyncDelay: t => new Promise(resolve => setTimeout(resolve, t)),

    // better (but probably heavier) parser than parseInt
    prepareAndParseInt: (obj, index) => {
        if (obj && obj[index] && obj[index].replace) {
            const s = obj[index]
            let num = 0
            for (let i = 0; i < s.length; i++) {
                if (s[i].match(/[0-9]/)) {
                    if (num > 0) num *= 10
                    num += parseInt(s[i], 10)
                }
            }

            return num
        }
        return -1
    },

    // function "wrapper" with pupeteer to wait for a given element to be visible
    asyncIsElementVisible: async (page, cssSelector) => {
        let visible = true
        await page
            .waitForSelector(cssSelector, { visible: true, timeout: 5000 })
            .catch(() => {
                visible = false
            })
        return visible
    },

    // blocks images and fonts for a given request (small optimisation)
    asyncPageRequestInterceptor: async (page) => {
        await page.setRequestInterception(true).catch((err) => { console.log(err) })
        page.on('request', (request) => {
            if (['image', 'font'].indexOf(request.resourceType()) !== -1) {
                request.abort()
            } else {
                request.continue()
            }
        })
    },

    // mix a1 into a2 evenly split
    concatAndMix: (a1, a2) => {
        const a3 = []
        const l1 = a1 && a1.length ? a1.length : 0
        const l2 = a2 && a2.length ? a2.length : 0
        const max = l1 >= l2 ? l1 : l2

        for (let i = max - 1; i >= 0; i--) {
            if (i < l1) a3.push(a1[i])
            if (i < l2) a3.push(a2[i])
        }
        return a3
    },

    // create a delay to test/bypass eventual anti-bot rules
    asyncMiniDelay: async (page, mod) => {
        // const waitingTime = Math.round(Math.random() * mod + 100)
        // await page.waitFor(waitingTime).catch((err) => { console.log(err) })
        // return waitingTime
        return 0
    },
}
// -
// - STEP 1
// -
// - launch an async function and initiate a pupeteer browser
// -
// -
// - STEP 2
// -
// - first scrape the index page to check on category
// - second launch a new page with a scrape strategy for each category found
// -
// -
// - STEP 3
// -
// - scrape user and proposal pages while waiting for the other pages to die
// -

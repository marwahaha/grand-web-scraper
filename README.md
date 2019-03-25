Grand-web-scraper (Deprecated)
==============================

Project "abandonned" for the data is accessible through the API. Fun project tho.

This is a not very optimized scraper.
This scraper is suspected to never be able to get all of the info (and the gathering has a time complexity probably worse than `O(n ^ n)`).
The scraper randomly selects filter and sort option in the index page to get as many data as possible.
It's programmed to have 30% to check for last entries so the scraper can be continuously run.

Installation
------------
`npm install`

Make sure you have a mongodb process runing in the background.
Make sure you have the correct info registered in the config object in `_utils.js` file.

Run the scraper
---------------
`node scraperGatherer`

The scraper opens multiple pages. The main page is used to gather info about users and proposals and the others are to build the scraperGatherer.
The scraperGatherer is composed of a proposal list which is scraped before each proposal gets scrape (by a gatherer).
You can run it an infinite number of time with a `nodemon` or `forever` process like `forever index.js`.

Run the gatherer
----------------
`node fastGatherer`

The gatherer is here to rush the gathering of user and proposal details info.
A specific instance of a similar "gatherer" is run int he main page of the scraper.

Run the tester
--------------
`node tester`

Tester must return a simple 'success => ${condition}' for each different page (4 in total).

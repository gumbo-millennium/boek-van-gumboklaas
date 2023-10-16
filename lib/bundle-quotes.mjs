import chalk from "chalk";
import { cache } from "./cache.mjs"
import puppeteer from 'puppeteer';

export const bundleQuotes = async (options) => {
    const cachedQuotes = cache.getKey('quotes');
    if (! cachedQuotes) {
        console.log(chalk.red('No quotes available, download some quotes first.'));
        return false;
    }

    // Select a subset of quotes
    const quoteLimit = options.single ? 1 : Number.parseInt(options.limit);
    const wantedQuotes = quoteLimit > 0 ? cachedQuotes.slice(0, quoteLimit) : cachedQuotes;

    let browser = null;
    try {
        console.log(chalk.blue('Closing browser...'));
        browser = await puppeteer.launch({ headless: 'new' });

        // Load dist/index.html
        console.log(chalk.blue('Loading page...'));
        const page = await browser.newPage();

        const pathAsUrl = new URL(path, 'file://');

        await page.goto(pathAsUrl, {
            waitUntil: 'networkidle2',
        });

        // Inject quotes into page
        console.log(chalk.blue(`Rendering ${wantedQuotes.length} quotes...`));

        const totalQuotes = wantedQuotes.length;
        let currentQuote = 0;

        const spinner = ora({
            text: 'Rendering quotes...',
            suffixText: () => ` ${currentQuote}/${totalQuotes}`,
        }).start();

        const intlDateRender = Intl.DateTimeFormat('nl', { dateStyle: 'long' });

        for (const quote of wantedQuotes) {
            currentQuote++;

            await page.evaluate((quote) => {
                document.querySelector('[data-content="quote"]').innerHTML = quote.quote;
                document.querySelector('[data-content="author"]').innerHTML = quote.author;
                document.querySelector('[data-content="source"]').innerHTML = intlDateRender.format(new Date(quote.date));
            }, quote);

            const quotePath = path.join('dist', `quote-${quote.id}.pdf`);
            await page.pdf({
                path: quotePath,
                format: 'a5',
                printBackground: true,
            });
        }
    } finally {
        if (browser) {
            console.log(chalk.blue('Closing browser...'));
            await browser.close();
        }
    }

}

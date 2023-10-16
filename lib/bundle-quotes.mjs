import path from 'path';
import chalk from "chalk";
import { cache } from "./cache.mjs"
import puppeteer from 'puppeteer';
import appRoot from 'app-root-path';
import ora from 'ora';

export const bundleQuotes = async (options) => {
    const cachedQuotes = cache.getKey('quotes');
    if (! cachedQuotes) {
        console.log(chalk.red('No quotes available, download some quotes first.'));
        return false;
    }

    // Select a subset of quotes
    const quoteLimit = options.single ? 1 : Number.parseInt(options.limit);
    const wantedQuotes = quoteLimit > 0 ? cachedQuotes.slice(0, quoteLimit) : cachedQuotes;

    const pathAsUrl = new URL(path.join(String(appRoot), 'dist', 'index.html'), 'file://');

    const totalQuotes = wantedQuotes.length;
    let currentQuote = 0;
    const suffixText = () => ` ${currentQuote}/${totalQuotes}`;

    const spinner = ora({
        text: 'Starting browser...',
        color: 'yellow',
    }).start();

    let browser = null;
    try {
        browser = await puppeteer.launch({ headless: 'new' });

        // Load dist/index.html
        spinner.text = `Loading page ${chalk.yellow(pathAsUrl)}...`;
        const page = await browser.newPage();

        await page.goto(pathAsUrl, {
            waitUntil: 'networkidle2',
        });

        // Inject quotes into page
        spinner.color = 'blue';
        spinner.text = 'Rendering quotes...';

        const intlDateRender = Intl.DateTimeFormat('nl', { dateStyle: 'long' });

        for (const quote of wantedQuotes) {
            currentQuote++;
            spinner.suffixText = suffixText()

            await page.evaluate((quote, date) => {
                document.querySelector('[data-content="quote"]').innerHTML = quote.quote;
                document.querySelector('[data-content="author"]').innerHTML = quote.author;
                document.querySelector('[data-content="date"]').innerHTML = date;
            }, quote, intlDateRender.format(new Date(quote.date)));

            const quotePath = path.join('dist', `quote-${quote.id}.pdf`);
            await page.pdf({
                path: quotePath,
                // a4, but landscape
                // width: '297mm',
                // height: '210mm',
                format: 'a4',
                orientation: 'portrait',
                pageRanges: '1',
                printBackground: true,
            });
        }

        spinner.succeed(`Rendered ${wantedQuotes.length} quotes.`);
    } catch (error) {
        spinner.fail('Failed to render quotes.');
        throw error;
    } finally {
        if (browser) {
            console.log(chalk.blue('Closing browser...'));
            await browser.close();
        }
    }

}

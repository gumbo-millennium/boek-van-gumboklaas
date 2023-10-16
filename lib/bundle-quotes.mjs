import path, { resolve } from 'path';
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
    const targetPdf = path.join(String(appRoot), 'dist', 'gumbo-book.pdf');

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

        const defaultDpi = 96; // 96 is the default DPI for Chrome
        const dpi = 96;
        page.setViewport({
            width: Math.round(Number.parseInt('297mm', 10) * (dpi / 25.4)), // 1 inch = 25.4mm
            height: Math.round(Number.parseInt('210mm', 10) * (dpi / 25.4)),
            deviceScaleFactor: dpi / defaultDpi,
        })

        await page.goto(pathAsUrl, {
            waitUntil: 'networkidle2',
        });

        // Inject quotes into page
        spinner.color = 'magenta';
        spinner.text = 'Preparing quotes...';

        const intlDateRender = Intl.DateTimeFormat('nl', { dateStyle: 'long' });

        const preparedQuotes = wantedQuotes.map(quote => ({
            quote: quote.quote.replace(/\n/g, "<br />"),
            author: quote.author,
            date: intlDateRender.format(new Date(quote.date)),
        }));

        spinner.text = 'Rendering quotes...';

        for (const quote of preparedQuotes) {
            currentQuote++;
            spinner.suffixText = suffixText()

            await page.evaluate((quote, date) => {
                const quoteId = crypto.randomUUID();
                const newQuote = document.querySelector('template[data-content="quote-template"]').content.cloneNode(true);

                const newQuoteInner = newQuote.firstElementChild;
                newQuoteInner.setAttribute('id', quoteId);

                newQuoteInner.querySelector(`[data-content="quote"]`).innerHTML = quote.quote;
                newQuoteInner.querySelector(`[data-content="author"]`).innerHTML = quote.author;
                newQuoteInner.querySelector(`[data-content="date"]`).innerHTML = quote.date;

                document.body.appendChild(newQuote);
            }, quote);
        }

        spinner.suffixText = '';
        spinner.text = "Finalizing...";
        await page.waitForNetworkIdle();

        // Render quotes to PDF
        spinner.color = 'cyan';
        spinner.suffixText = '';
        spinner.text = 'Rendering PDF...';

        await page.pdf({
            path: targetPdf,
            // a4, but landscape
            width: '297mm',
            height: '210mm',
            // format: 'a4',
            // orientation: 'portrait',
            printBackground: true,
        });

        spinner.succeed(`Rendered ${wantedQuotes.length} quotes.`);
    } catch (error) {
        spinner.suffixText = '';
        spinner.fail(`Failed to render quotes: ${error}`);
        throw error;
    } finally {
        if (browser) {
            console.log(chalk.blue('Closing browser...'));
            await browser.close();
        }
    }

}

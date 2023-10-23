import path from 'path';
import chalk from "chalk";
import { cache } from "./cache.mjs"
import puppeteer from 'puppeteer';
import appRoot from 'app-root-path';
import { confirm } from "@inquirer/prompts";
import ora from 'ora';

/**
 * Configurable
 */
const pathAsUrl = new URL(path.join(String(appRoot), 'dist', 'index.html'), 'file://');
const targetPdf = path.join(String(appRoot), 'dist', 'Gumbo Book der Sinterklaas.pdf');

export const bundleQuotes = async (options) => {
    const downloadedQuotes = cache.getKey('quotes');
    if (! downloadedQuotes) {
        console.log(chalk.red('No quotes available, download some quotes first.'));
        return false;
    }

    const filteredQuotes = cache.getKey('quotes-sorted');
    if (! filteredQuotes && !confirm({
            message: 'No filtered quotes available. Use the non-filtered ones?',
            default: false
    })) {
        return false;
    }

    const cachedQuotes = filteredQuotes || downloadedQuotes;

    // Select a subset of quotes
    const quoteLimit = options.single ? 1 : Number.parseInt(options.limit);
    const wantedQuotes = quoteLimit > 0 ? cachedQuotes.slice(0, quoteLimit) : cachedQuotes;

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
            id: quote.id,
            quote: quote.quote.replace(/\n/g, "<br />"),
            author: quote.author,
            date: intlDateRender.format(new Date(quote.date)),
        }));

        spinner.text = 'Rendering quotes...';

        const quoteIdPageMap = new Map();
        preparedQuotes.forEach(async (quote, index) => {
            spinner.suffixText = `${index + 1} / ${totalQuotes.length}`;
            quoteIdPageMap.set(quote.id, index + 1);

            await page.evaluate((quote, date) => {
                const quoteId = crypto.randomUUID();
                const newQuote = document.querySelector('template[data-content="quote-template"]').content.cloneNode(true);

                const newQuoteInner = newQuote.firstElementChild;
                newQuoteInner.setAttribute('id', quoteId);

                newQuoteInner.querySelector(`[data-content="quote"]`).innerHTML = quote.quote;
                newQuoteInner.querySelector(`[data-content="author"]`).innerHTML = quote.author;
                newQuoteInner.querySelector(`[data-content="date"]`).innerHTML = quote.date;

                document.querySelector('[data-content="quotes"]').appendChild(newQuote);
            }, quote);
        });

        // Clear the suffix
        spinner.suffixText = '';

        // Render an index
        if (! wantedQuotes[0].subjects) {
            console.warn('No subjects found, skipping index...');
        } else {
            spinner.text = "Writing index...";

            const subjectsAndPages = new Map(
                [...new Set(wantedQuotes.map(quote => quote.subjects).flat())]
                .sort((a, b) => a.localeCompare(b))
                .map(subject => [subject, []])
            );

            wantedQuotes.forEach(quote => {
                quote.subjects.forEach(subject => {
                    subjectsAndPages.get(subject).push(quoteIdPageMap.get(quote.id));
                });
            });

            const subjectsAndPagesPrepped = [...subjectsAndPages.entries()]
                .map(([subject, pages]) => [
                    subject,
                    pages.sort((a, b) => Number(a) - Number(b)).join(', ')
                ]);

            await page.evaluate((subjectsAndPages) => {
                const indexTemplate = document.querySelector('template[data-content="index-template"]').content;
                const index = document.querySelector('[data-content="index"]');
                const indexList = index.querySelector('[data-content="index-list"]');

                subjectsAndPages.forEach(([subject, pages]) => {
                    const newNode = indexTemplate.cloneNode(true);
                    newNode.querySelector('[data-content=name]').textContent = subject;
                    newNode.querySelector('[data-content=pages]').textContent = pages;
                    indexList.appendChild(newNode)
                });

                index.classList.remove('hidden');
            }, subjectsAndPagesPrepped);
        }

        // Wait for networkIdle
        spinner.text = 'Waiting...';
        await new Promise(resolve => setTimeout(resolve, 1000));
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
            timeout: 60_000, // allow for one minute, this file is large...
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

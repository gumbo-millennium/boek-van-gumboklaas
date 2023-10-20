import chalk from "chalk";
import { cache } from "./cache.mjs";
import { confirm } from "@inquirer/prompts";
import axios, { isCancel, AxiosError } from "axios";
import { httpFetch } from "./http.mjs";
import ora from "ora";

const looksLikeAQuote = (quote) => {
    return /".+"\s?-\s?.+/.test(quote) ||
        /“.+”\s?-\s?.+/.test(quote) ||
        /‘.+’\s?-\s?.+/.test(quote) ||
        /'.+'\s?-\s?.+/.test(quote) ||
        / - .+/.test(quote);
}

const buildAuthorRegexp = (authors) => {
    return new RegExp(`-${
        authors.map(author => author.trim().split(/\W/)[0]).join('|')
    }`, 'i');
}

export const filterQuotes = async () => {
    if (!cache.getKey('quotes')) {
        console.log(chalk.red('No API token set. Please run `gumbo-book download` first.'));
        return false;
    }

    const progress = ora('Filtering quotes...').start();
    /** @var {Array} quotes */
    const quotes = Array.from(cache.getKey('quotes'));

    progress.text = 'Building regexp...';
    const authorRegexp = buildAuthorRegexp(quotes.map(({ author }) => author))

    progress.text = 'Filtering on quote-like structure';
    const filteredQuotes = quotes.filter(({ quote }) => {
        return looksLikeAQuote(quote) || authorRegexp.test(quote);
    });

    progress.text = 'De-duplicating...';
    const existingQuotes = [];
    const duplicateQuotes = [];
    const uniqueQuotes = filteredQuotes.reverse().filter((quote) => {
        const trimmedAsciiQuote = quote.quote.trim().replace(/[^a-z0-9-.!?, ]/gi, '').toLowerCase();
        if (existingQuotes.includes(trimmedAsciiQuote)){
            duplicateQuotes.push(quote);
            return false;
        }

        existingQuotes.push(trimmedAsciiQuote);
        return true;
    });

    progress.text = 'Sorting...';
    uniqueQuotes.sort((a, b) => {
        const diff = new Date(a).getTime() < new Date(b).getTime();
        return diff < 0 ? -1 : diff > 0 ? 1 : 0;
    });

    progress.text = 'Saving...';
    cache.setKey('quotes-sorted', uniqueQuotes);

    progress.succeed(`Filtered ${quotes.length} quotes to ${uniqueQuotes.length} quotes.`);

    const uniqueQuoteIds = uniqueQuotes.map(({ id }) => id);
    const duplicateQuoteIds = duplicateQuotes.map(({ id }) => id);
    const droppedQuotes = quotes.filter(({ id }) => !uniqueQuoteIds.includes(id) && !duplicateQuoteIds.includes(id));

    cache.setKey('quotes-dropped', droppedQuotes);


    uniqueQuotes.forEach((quote) => {
        console.log(`${chalk.green('Accepted')}: ${quote.quote}`)
    })

    duplicateQuotes.forEach((quote) => {
        console.log(`${chalk.blue('Duplicate')}: ${quote.quote}`)
    })

    droppedQuotes.forEach((quote) => {
        console.log(`${chalk.red('Dropped')}: ${quote.quote}`)
    })

    return true;
}

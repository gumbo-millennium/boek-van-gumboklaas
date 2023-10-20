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

/**
 *
 * @param {Quote[]} quotes
 * @param {String[]} additionalAuthors
 * @returns {RegExp[]}
 */
const buildAuthorRegexp = (quotes, additionalAuthors) => {
    const quoteAuthors = quotes.map(({ author }) => author);
    const authors = [...quoteAuthors, ...additionalAuthors]
        .map(value => String(value).toLowerCase().split(/\W/)[0])
        .sort()
        .filter((author, index, self) => self.indexOf(author) === index);

    const authorsAsOption = `(${authors.join('|')})`;
    return [
        new RegExp(`.+[-:]\\s?${authorsAsOption}`, 'i'),
        new RegExp(`^['"“‘].+[’”"']\\s+${authorsAsOption}`, 'i'),
    ];
}

export const filterQuotes = async (options) => {
    if (!cache.getKey('quotes')) {
        console.log(chalk.red('No API token set. Please run `gumbo-book download` first.'));
        return false;
    }

    const progress = ora('Filtering quotes...').start();
    /** @var {Array} quotes */
    const quotes = Array.from(cache.getKey('quotes'));

    progress.text = 'Building regexp...';
    const authorRegexps = buildAuthorRegexp(quotes, options.authors || []);
    const authorMatcher = (quote) => authorRegexps.some((regexp) => regexp.test(quote));

    progress.text = 'Filtering on quote-like structure';
    const filteredQuotes = quotes.filter(({ quote }) => {
        return looksLikeAQuote(quote) || authorMatcher(quote);
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

    const uniqueQuoteIds = uniqueQuotes.map(({ id }) => id);
    const duplicateQuoteIds = duplicateQuotes.map(({ id }) => id);
    const droppedQuotes = quotes.filter(({ id }) => !uniqueQuoteIds.includes(id) && !duplicateQuoteIds.includes(id));
    cache.setKey('quotes-dropped', droppedQuotes);

    progress.succeed(`Filtered ${quotes.length} quotes to ${uniqueQuotes.length} quotes (${duplicateQuotes.length} duplicates).`);

    if (options.verbose) {
        uniqueQuotes.forEach((quote) => {
            console.log(`${chalk.green('Accepted')}: ${quote.quote}`)
        })

        duplicateQuotes.forEach((quote) => {
            console.log(`${chalk.blue('Duplicate')}: ${quote.quote}`)
        })

        droppedQuotes.forEach((quote) => {
            console.log(`${chalk.red('Dropped')}: ${quote.quote}`)
        })
    }

    return true;
}

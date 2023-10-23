import chalk from "chalk";
import { cache } from "./cache.mjs";
import { confirm } from "@inquirer/prompts";
import axios, { isCancel, AxiosError } from "axios";
import { httpFetch } from "./http.mjs";
import ora from "ora";

const looksLikeAQuoteRegexp = /^['"“‘](?<quote>.+)[’”"']\s?[:-]?(?<author>.+)$/img;

const formatName = (name) => name.trim().replace(/(^\w|(?<=\W)\w)/g, (m) => m.toUpperCase());
const formatLikeASentence = (quote) => quote.replace(/(^\w|(?<=\.\s?)\w)/g, (m) => ` ${m}`.toUpperCase()).trim();

/**
 * @param {Quote}
 * @returns {String|null}
 */
const testIfQuoteAndFormat = ({quote}) => {
    const matches = [...String(quote).matchAll(looksLikeAQuoteRegexp)];

    if (matches.length === 0) {
        return null;
    }

    const quotesInBody = [];
    matches.forEach(({ groups: { quote, author } }) => {
        quotesInBody.push(`“${formatLikeASentence(quote)}” — ${formatName(author)}`);
    })

    return quotesInBody.join('\n');
}

export const filterQuotes = async (options) => {
    if (!cache.getKey('quotes')) {
        console.log(chalk.red('No API token set. Please run `gumbo-book download` first.'));
        return false;
    }

    const progress = ora('Filtering quotes...').start();
    /** @var {Array} quotes */
    const quotes = Array.from(cache.getKey('quotes'));

    progress.text = 'Filtering on quote-like structure';
    const filteredQuotes = quotes.map((quote) => {
        const formattedQuote = testIfQuoteAndFormat(quote);
        return formattedQuote ? {
            ...quote,
            quote: formattedQuote,
        } : null;
    }).filter(Boolean.bind(null));

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
        const diff = new Date(b).getTime() < new Date(a).getTime();
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

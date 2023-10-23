import { cache } from "./cache.mjs";
import appRoot from 'app-root-path';
import chalk from "chalk";
import fs from 'fs/promises';
import path from 'path';
import ora from "ora";

/**
 * @typedef {Object} Quote
 * @param {String} id
 * @param {String} quote
 * @param {String} author
 * @param {String} date
 *
 * @typedef {Quote} MatchedQuote
 * @param {QuoteMatch[]} matches
 *
 * @typedef {Object} QuoteMatch
 * @property {String} author
 * @property {String} quote
 */

const quoteOptions = [
    /^['"“‘](?<quote>.+?)[’”"']\s?[:-](?<author>.{0,25})$/m,
];0

const formatName = (name) => name
    .trim()
    .replace(/(^\w|(?<=\W'’)\w)/g, (m) => m.toUpperCase());

const formatLikeASentence = (quote) => quote
    .trim() // Remove excess whitespace
    .replace(/^['"“‘]|['"”’]$/g, '') // Remove quote marks
    .replace(/(^\w|(?<=\.\s?)\w)/g, (m) => ` ${m}`.toUpperCase()) // Convert to sentence case
    .trim(); // Trim initital whitespace

/**
 * @param {Quote} quote
 * @returns {QuoteMatch[]|null}
 */
const testAndParseQuote = (quote) => {
    const text = quote.quote.trim();

    const matchingRegexp = quoteOptions.find((regexp) => regexp.test(text));
    const matchesAsMap = new Map(quoteOptions.map((regexp) => [String(regexp), regexp.test(text)]))

    if (! matchingRegexp) {
        return null;
    }

    const globalRegexp = new RegExp(matchingRegexp, 'gim')
    const matches = Array.from(text.matchAll(globalRegexp));
    if (! matches) {
        console.error('Failed to match quote %o against regexp %s', text, matchingRegexp);
    }

    const matchesAsArray = matches.map(({ groups: { quote, author }}) => ({ quote, author }));

    // Matched empty author, mark as invalid.
    if (matchesAsArray.some(({ author }) => !author || author.trim().length === 0)) {
        return null;
    }

    return {
        ...quote,
        matches: matches.map(({ groups: { quote, author }}) => ({ quote, author }))
    };
}

/**
 * @param {MatchedQuote} quote
 * @return {String}
 */
const formatQuotes = (quote) => {
    return quote.matches
        .map(({ quote, author }) => `“${formatLikeASentence(quote)}” – ${formatName(author)}`) // Note: U+2013 as the dash
        .join('\n');
}

export const filterQuotes = async (options) => {
    if (!cache.getKey('quotes')) {
        console.log(chalk.red('No API token set. Please run `gumbo-book download` first.'));
        return false;
    }

    const progress = ora('Filtering quotes...').start();
    /** @var {Array} quotes */
    const quotes = Array.from(cache.getKey('quotes'));

    progress.text = 'Allocating all authors...';
    const allAuthors = [...quotes.map(({ author }) => author), ...options.authors ?? []]
        .map((author) => String(author).trim().split(/\W/)[0].toLowerCase())
        .filter((author) => author.length > 0)
        .filter((author, index, self) => self.indexOf(author) === index)
        .sort()

    quoteOptions.push(new RegExp(`^
        (?<quote>.+)
        (\\s+[-:~]\\s*|[-:~]\\s+)
        (?<author>
            (?:${allAuthors.join('|')})
            (?:.*?)
        )
    $`.replace(/\s+/g, ''), 'im'));

    progress.text = 'Filtering and mapping...';
    const idsToSkip = options.skipIds || [];
    const filteredQuotes = quotes
        .map(testAndParseQuote.bind(null))
        .filter(Boolean.bind(null))
        .filter(({ id }) => !idsToSkip.includes(id));

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

    progress.text = 'Formatting...';
    const uniqueFormattedQuotes = uniqueQuotes.map((quote) => {
        const formattedQuote = formatQuotes(quote);
        return {
            ...quote,
            quote: formattedQuote,
            subjects: quote.matches.map(({ author }) => formatName(author)),
        };
    });

    progress.text = 'Sorting...';
    uniqueFormattedQuotes.sort((a, b) => {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
    });

    progress.text = 'Saving...';
    cache.setKey('quotes-sorted', uniqueFormattedQuotes);

    // Write to file
    progress.text = 'Writing to file...';
    const saveableQuotes = uniqueFormattedQuotes.map(quote => ({
        id: quote.id,
        quote: quote.quote.split('\n'),
        author: quote.author,
        author_verified: quote.author_verified,
        date: new Date(quote.date).toISOString(),
        subjects: quote.subjects,
    }));
    const basicContents = JSON.stringify(saveableQuotes, null, 4);
    const quotesBySubject = new Map();
    saveableQuotes.forEach((quote) => {
        quote.subjects.forEach((subject) => {
            if (! quotesBySubject.has(subject)) {
                quotesBySubject.set(subject, []);
            }

            quotesBySubject.get(subject).push(quote);
        });
    });
    const quotesSortedBySubject = [...quotesBySubject.entries()].sort(([a], [b]) => a.localeCompare(b))
    const subjectsContents = JSON.stringify(Object.fromEntries(quotesSortedBySubject), null, 4);
    await Promise.all([
        fs.writeFile(path.resolve(String(appRoot), 'dist', 'quotes.json'), basicContents),
        fs.writeFile(path.resolve(String(appRoot), 'dist', 'quotes-by-subject.json'), subjectsContents),
    ]);

    const uniqueQuoteIds = uniqueFormattedQuotes.map(({ id }) => id);
    const duplicateQuoteIds = duplicateQuotes.map(({ id }) => id);
    const droppedQuotes = quotes.filter(({ id }) => !uniqueQuoteIds.includes(id) && !duplicateQuoteIds.includes(id));
    cache.setKey('quotes-dropped', droppedQuotes);

    progress.succeed(`Filtered ${quotes.length} quotes to ${uniqueFormattedQuotes.length} quotes (${duplicateQuotes.length} duplicates).`);

    if (options.verbose) {
        uniqueFormattedQuotes.forEach((quote) => {
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

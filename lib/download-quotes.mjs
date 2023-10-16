import chalk from "chalk";
import { cache } from "./cache.mjs";
import { confirm } from "@inquirer/prompts";

export const downloadQuotes = async () => {
    if (! cache.getKey('token')) {
        console.log(chalk.red('No API token set. Please run `gumbo-book auth` first.'));
        return false;
    }

    if (cache.getKey('quotes')) {
        const redownload = await confirm({
            type: 'confirm',
            message: 'Quotes already exist. Re-download?',
            default: true,
        });

        if (! redownload)
            return;
    }

    const quoteRequest = new Request('https://gumbo-millennium.nl/api/quotes/book', {
        method: 'GET',
        headers: [
            ['Accept', 'application/json'],
            ['Authorization', `Bearer ${cache.getKey('token')}`],
        ],
    });

    try {
        const result = await fetch(quoteRequest);
        const quotes = await result.json();

        cache.setKey('quotes', quotes);
        console.log(chalk.green(`Downloaded ${quotes.length} quotes.`));
    } catch (error) {
        console.log(chalk.red('Error downloading quotes:'));
        console.log(chalk.red(error));
        return false;
    }
}

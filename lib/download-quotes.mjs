import chalk from "chalk";
import { cache } from "./cache.mjs";
import { confirm } from "@inquirer/prompts";
import axios, {isCancel, AxiosError} from "axios";
import { httpFetch } from "./http.mjs";
import ora from "ora";

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

    const progress = ora('Downloading quotes...').start();

    try {
        const result = await httpFetch('/api/quotes/book');

        const { data: quotes } = result.data;
        cache.setKey('quotes', quotes);

        progress.succeed(`Downloaded ${quotes.length} quotes.`);
    } catch (error) {
        progress.fail(`Failed to download quotes.`);
        console.log(chalk.red(error));
        return false;
    }
}

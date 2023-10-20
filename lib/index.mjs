import { program } from 'commander';
import { setToken } from './set-token.mjs';
import { downloadQuotes } from './download-quotes.mjs';
import { bundleQuotes } from './bundle-quotes.mjs';
import { showDebug } from './show-debug.mjs';
import { filterQuotes } from './filter-quotes.mjs';

program
    .name('gumbo-book')
    .description("Utility to create a PDF book from the Gumbo API")

program
    .command('auth')
    .description('Authenticate with the Gumbo API')
    .argument('[token]', 'The API token to configure')
    .option('--clear', 'Clear the API token')
    .action(setToken);

program
    .command('download')
    .description('Download the list of quotes from the Gumbo API')
    .action(downloadQuotes);

program
    .command('filter')
    .description('Filter the downloaded quotes to something that looks like quotes')
    .option('--authors <authors...>', 'Filter in additional authors')
    .option('--verbose', 'Show verbose output')
    .action(filterQuotes);

program
    .command('bundle')
    .description('Bundle the quotes into a PDF book')
    .option('--limit <number>', 'Limit the number of quotes to bundle')
    .option('--single', 'Bundle a single quote, overwrites --limit')
    .action(bundleQuotes);

program
    .command('debug')
    .description('Show debug information')
    .option('--clear', 'Clear the cache')
    .action(showDebug);

program.parse();

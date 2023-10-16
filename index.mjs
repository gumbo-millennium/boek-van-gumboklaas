#!/usr/bin/env node

import { program } from 'commander';
import { setToken } from './lib/set-token.mjs';
import { downloadQuotes } from './lib/download-quotes.mjs';
import { bundleQuotes } from './lib/bundle-quotes.mjs';

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
    .command('bundle')
    .description('Bundle the quotes into a PDF book')
    .option('--limit <number>', 'Limit the number of quotes to bundle')
    .option('--single', 'Bundle a single quote, overwrites --limit')
    .action(bundleQuotes);

program.parse();

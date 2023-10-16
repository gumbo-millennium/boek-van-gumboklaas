import chalk from "chalk"
import { cache } from "./cache.mjs"

export const showDebug = (options) => {
    if (options.clear) {
        cache.destroy();
        console.log(chalk.green('Cache cleared.'));
        return;
    }

    const properties = [
        ['API token', cache.getKey('token')],
        ['Quote count', cache.getKey('quotes')?.length],
    ];

    console.log(chalk.bold.blue('Debug information'));

    properties.forEach(([label, value]) => {
        console.log(`- ${label}: ${value ? chalk.yellow(value) : chalk.gray('not set')}`);
    });
}

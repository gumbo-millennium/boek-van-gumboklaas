import { input, confirm } from '@inquirer/prompts';
import { cache } from "./cache.mjs"
import chalk from "chalk";

const clearToken = () => {
    cache.removeKey('token');
    console.log(chalk.green('API token cleared.'));
}

const saveToken = token => {
    cache.setKey('token', token);
    console.log(chalk.green('API token stored.'));
}

const setToken = async (userGivenToken, options) => {
    if (options.clear) {
        clearToken();
        return;
    }

    if (userGivenToken) {
        saveToken(userGivenToken);
        return;
    }

    if (cache.getKey('token')) {
        const overwrite = await confirm({
            type: 'confirm',
            name: 'overwrite',
            message: 'API token already set, overwrite?',
            default: false,
        })

        if (!overwrite) {
            console.log(chalk.gray('Not overwriting token.'));
            return;
        }
    }

    const token = await input({
        message: 'Please enter an API token:',
        validate: (input) => {
            if (input.length < 1)
                return 'You must enter a token.';

            if (!input.match(/^\d+\|(?:[a-z0-9]{40})$/i))
                return 'API key seems to be invalid';

            return true;
        }
    });

    console.log(`Thank you for specifying token ${chalk.yellow(token)}`);
    saveToken(token);
}

export { setToken }

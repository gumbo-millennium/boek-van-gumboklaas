import { input, confirm } from '@inquirer/prompts';
import { cache } from "./cache.mjs"
import { httpFetch } from "./http.mjs";
import chalk from "chalk";

const clearToken = () => {
    cache.removeKey('token');
    console.log(chalk.green('API token cleared.'));
}

const saveToken = async (token, verify = true) => {
    const oldToken = cache.getKey('token');
    cache.setKey('token', String(token).trim());
    console.log(chalk.green('API token stored.'));

    if (!verify || await verifyToken())
        return;

    console.log(chalk.gray('Restoring old token.'));
    cache.setKey('token', oldToken);
    console.log(chalk.yellow('Old token restored.'));
}

const verifyToken = async () => {
    const { ok, data } = await httpFetch('/api/me');

    if (ok) {
        console.log(chalk.green('Token verified.'));
        console.log(`You are logged in as ${chalk.yellow(data.name)}.`);
        return true;
    }

    console.log(chalk.red('Token verification failed.'));
    return false;
}

const setToken = async (userGivenToken, { verify, clear }) => {
    if (clear) {
        clearToken();
        return;
    }

    if (userGivenToken) {
        await saveToken(userGivenToken, verify);
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

    await saveToken(token, verify);
}

export { setToken }

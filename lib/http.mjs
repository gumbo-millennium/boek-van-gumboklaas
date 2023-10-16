import axios from 'axios'
import { cache } from './cache.mjs'

const defaultUrl = 'https://www.gumbo-millennium.nl/';
const fromBaseUrl = (url) => new URL(url, defaultUrl);

export const httpFetch = async (url, properties = {}) => {
    const fullUrl = fromBaseUrl(url)

    const request = new Request(fullUrl, {
        // Defaults
        method: 'GET',

        // Now expand the properties
        ...properties,

        // Add the access token
        headers: {
            ...properties.headers,
            'User-Agent': `Gumbo Millennium Book Builder (${process.env.npm_package_version}); Axios/${axios.VERSION}`,
            'Authorization': `Bearer ${cache.getKey('token')}`,
            'Accept': 'application/json',
        },
    })

    try {
        const response = await fetch(request)

        const bodyText = await response.text()
        let bodyJson = undefined
        try {
            bodyJson = JSON.parse(bodyText)
        } catch (error) {
            // Ignore
        }

        return {
            ok: response.ok,
            status: response.status,
            statusText: response,
            headers: response.headers,
            data: bodyJson !== undefined ? bodyJson : null,
            text: bodyText,
        }
    } catch (error) {
        console.error(`HTTP call to %s failed: %s`, fullUrl.pathname, error)

        return {
            ok: false,
            status: 600,
            statusText: 'Network error',
            headers: {},
            data: error,
            text: String(error),
        }
    }
}

import flatcache from 'flat-cache';

const cache = flatcache.load('gumboBook');

process.addListener('beforeExit', () => cache.save());

export { cache };

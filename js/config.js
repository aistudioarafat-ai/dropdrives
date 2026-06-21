/**
 * DropDrive Configuration
 * 
 * IMPORTANT: Replace DROPBOX_APP_KEY with your own Dropbox App key.
 * To get one:
 * 1. Go to https://www.dropbox.com/developers/apps
 * 2. Create a new app → "Scoped access" → "Full Dropbox"
 * 3. Add redirect URI: http://localhost:5500 (or your deployment URL)
 * 4. Enable scopes: account_info.read, files.metadata.read, files.metadata.write,
 *    files.content.read, files.content.write, sharing.read, sharing.write
 * 5. Copy the App Key below
 */

const CONFIG = {
    DROPBOX_APP_KEY: 'b0ieioero7ybsoe',
    DROPBOX_AUTH_URL: 'https://www.dropbox.com/oauth2/authorize',
    DROPBOX_TOKEN_URL: 'https://api.dropboxapi.com/oauth2/token',
    DROPBOX_API_URL: 'https://api.dropboxapi.com/2',
    DROPBOX_CONTENT_URL: 'https://content.dropboxapi.com/2',
    REDIRECT_URI: window.location.origin + '/',
    SCOPES: [
        'account_info.read',
        'files.metadata.read',
        'files.metadata.write',
        'files.content.read',
        'files.content.write',
        'sharing.read',
        'sharing.write'
    ].join(' '),
    STORAGE_KEYS: {
        TOKEN: 'dropdrive_token',
        FAVORITES: 'dropdrive_favs',
        RECENT: 'dropdrive_recent',
        VIEW_MODE: 'dropdrive_view',
        THEME: 'dropdrive_theme',
        CACHE_PREFIX: 'dropdrive_cache_'
    },
    CACHE_TTL: 60000,
    PAGE_SIZE: 100,
    SEARCH_DEBOUNCE: 300
};
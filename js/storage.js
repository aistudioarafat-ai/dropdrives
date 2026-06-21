/**
 * DropDrive Storage Module
 * Manages all client-side persistence (localStorage)
 */
const Storage = {
    _get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },

    _set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            return false;
        }
    },

    _remove(key) {
        localStorage.removeItem(key);
    },

    // ---- Token Management ----
    getToken() {
        return this._get(CONFIG.STORAGE_KEYS.TOKEN);
    },

    setToken(tokenData) {
        return this._set(CONFIG.STORAGE_KEYS.TOKEN, tokenData);
    },

    clearToken() {
        this._remove(CONFIG.STORAGE_KEYS.TOKEN);
    },

    // ---- Favorites ----
    getFavorites() {
        return this._get(CONFIG.STORAGE_KEYS.FAVORITES) || [];
    },

    isFavorite(path) {
        return this.getFavorites().includes(path);
    },

    addFavorite(path) {
        const favs = this.getFavorites();
        if (!favs.includes(path)) {
            favs.push(path);
            this._set(CONFIG.STORAGE_KEYS.FAVORITES, favs);
        }
        return favs;
    },

    removeFavorite(path) {
        let favs = this.getFavorites();
        favs = favs.filter(f => f !== path);
        this._set(CONFIG.STORAGE_KEYS.FAVORITES, favs);
        return favs;
    },

    toggleFavorite(path) {
        if (this.isFavorite(path)) {
            this.removeFavorite(path);
            return false;
        } else {
            this.addFavorite(path);
            return true;
        }
    },

    // ---- Recent Files ----
    getRecent() {
        return this._get(CONFIG.STORAGE_KEYS.RECENT) || [];
    },

    addRecent(file, action) {
        const recents = this.getRecent();
        // Remove duplicate entry for same path
        const filtered = recents.filter(r => r.path !== file.path_lower);
        filtered.unshift({
            path: file.path_lower,
            name: file.name,
            isDir: file['.tag'] === 'folder',
            action: action || 'opened',
            timestamp: Date.now(),
            file: file
        });
        // Keep max 50
        if (filtered.length > 50) filtered.pop();
        this._set(CONFIG.STORAGE_KEYS.RECENT, filtered);
        return filtered;
    },

    clearRecent() {
        this._remove(CONFIG.STORAGE_KEYS.RECENT);
    },

    // ---- View Mode ----
    getViewMode() {
        return this._get(CONFIG.STORAGE_KEYS.VIEW_MODE) || 'grid';
    },

    setViewMode(mode) {
        this._set(CONFIG.STORAGE_KEYS.VIEW_MODE, mode);
    },

    toggleViewMode() {
        const current = this.getViewMode();
        const next = current === 'grid' ? 'list' : 'grid';
        this.setViewMode(next);
        return next;
    },

    // ---- Theme ----
    getTheme() {
        return this._get(CONFIG.STORAGE_KEYS.THEME) || 'light';
    },

    setTheme(theme) {
        this._set(CONFIG.STORAGE_KEYS.THEME, theme);
    },

    // ---- Cache ----
    getCache(key) {
        const data = this._get(CONFIG.STORAGE_KEYS.CACHE_PREFIX + key);
        if (!data) return null;
        if (Date.now() - data.timestamp > CONFIG.CACHE_TTL) {
            this._remove(CONFIG.STORAGE_KEYS.CACHE_PREFIX + key);
            return null;
        }
        return data.value;
    },

    setCache(key, value) {
        this._set(CONFIG.STORAGE_KEYS.CACHE_PREFIX + key, {
            value,
            timestamp: Date.now()
        });
    },

    clearCache() {
        const keys = Object.keys(localStorage);
        keys.filter(k => k.startsWith(CONFIG.STORAGE_KEYS.CACHE_PREFIX))
            .forEach(k => localStorage.removeItem(k));
    },

    clearAll() {
        this.clearCache();
        this._remove(CONFIG.STORAGE_KEYS.FAVORITES);
        this._remove(CONFIG.STORAGE_KEYS.RECENT);
        this._remove(CONFIG.STORAGE_KEYS.TOKEN);
        this._remove(CONFIG.STORAGE_KEYS.VIEW_MODE);
        this._remove(CONFIG.STORAGE_KEYS.THEME);
    }
};

// Expose as global
window.Storage = Storage;
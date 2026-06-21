/**
 * DropDrive Settings Module
 * Manages theme, preferences, and settings UI
 */
const settings = {
    _currentTheme: 'light',
    _accountInfo: null,

    async init() {
        this._currentTheme = Storage.getTheme();
        this.applyTheme(this._currentTheme);
        this._updateThemeIcon();

        try {
            this._accountInfo = await DropboxAPI.getAccountInfo();
            this._updateAvatar();
        } catch (e) {
            // Silently fail, avatar will show placeholder
        }
    },

    applyTheme(theme) {
        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        this._currentTheme = theme;
    },

    toggleTheme() {
        const themes = ['light', 'dark', 'auto'];
        const currentIdx = themes.indexOf(this._currentTheme);
        const nextTheme = themes[(currentIdx + 1) % themes.length];
        
        this._currentTheme = nextTheme;
        Storage.setTheme(nextTheme);
        this.applyTheme(nextTheme);
        this._updateThemeIcon();
        this._updateSettingsUI();
    },

    _updateThemeIcon() {
        const icon = document.getElementById('themeIcon');
        if (!icon) return;
        
        switch (this._currentTheme) {
            case 'light':
                icon.innerHTML = '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>';
                break;
            case 'dark':
                icon.innerHTML = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
                break;
            case 'auto':
                icon.innerHTML = '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
                break;
        }
    },

    _updateAvatar() {
        const avatarEl = document.getElementById('userAvatar');
        if (!avatarEl) return;

        if (this._accountInfo) {
            const name = this._accountInfo.name?.display_name || 'User';
            const email = this._accountInfo.email || '';
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
            
            if (this._accountInfo.profile_photo_url) {
                avatarEl.innerHTML = `<img src="${this._escapeHtml(this._accountInfo.profile_photo_url)}" alt="${this._escapeHtml(name)}" class="avatar-img">`;
            } else {
                avatarEl.textContent = initials;
            }
            avatarEl.title = `${name}\n${email}`;
        } else {
            avatarEl.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
        }
    },

    _updateSettingsUI() {
        // Update settings page if it's the current view
        const content = document.getElementById('content');
        if (content && content.querySelector('.settings-page')) {
            this.renderSettings();
        }
    },

    async renderSettings() {
        const content = document.getElementById('content');
        if (!content) return;

        if (!this._accountInfo) {
            try {
                this._accountInfo = await DropboxAPI.getAccountInfo();
                this._updateAvatar();
            } catch (e) {}
        }

        const account = this._accountInfo || { name: { display_name: 'User' }, email: '' };
        const theme = this._currentTheme;

        content.innerHTML = `
            <div class="view-container settings-page">
                <div class="view-header">
                    <h2>Settings</h2>
                </div>
                
                <div class="settings-sections">
                    <!-- Account Section -->
                    <div class="settings-card glass">
                        <h3 class="settings-section-title">Account</h3>
                        <div class="settings-account">
                            <div class="settings-avatar">
                                ${account.profile_photo_url 
                                    ? `<img src="${this._escapeHtml(account.profile_photo_url)}" alt="" class="avatar-img-large">`
                                    : `<div class="avatar-placeholder">${(account.name.display_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</div>`
                                }
                            </div>
                            <div class="settings-account-info">
                                <p class="settings-account-name">${this._escapeHtml(account.name.display_name || 'Unknown')}</p>
                                <p class="settings-account-email">${this._escapeHtml(account.email || 'No email')}</p>
                            </div>
                        </div>
                    </div>

                    <!-- Theme Section -->
                    <div class="settings-card glass">
                        <h3 class="settings-section-title">Theme</h3>
                        <div class="settings-options">
                            <label class="settings-option" onclick="settings.setThemeFromSettings('light')">
                                <input type="radio" name="theme" value="light" ${theme === 'light' ? 'checked' : ''}>
                                <span class="settings-option-label">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="5"/>
                                        <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                                        <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                                    </svg>
                                    Light
                                </span>
                            </label>
                            <label class="settings-option" onclick="settings.setThemeFromSettings('dark')">
                                <input type="radio" name="theme" value="dark" ${theme === 'dark' ? 'checked' : ''}>
                                <span class="settings-option-label">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                                    </svg>
                                    Dark
                                </span>
                            </label>
                            <label class="settings-option" onclick="settings.setThemeFromSettings('auto')">
                                <input type="radio" name="theme" value="auto" ${theme === 'auto' ? 'checked' : ''}>
                                <span class="settings-option-label">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <circle cx="12" cy="12" r="5"/>
                                        <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                                        <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                                        <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" opacity="0.4"/>
                                    </svg>
                                    Auto
                                </span>
                            </label>
                        </div>
                    </div>

                    <!-- Storage Section -->
                    <div class="settings-card glass">
                        <h3 class="settings-section-title">Storage</h3>
                        <div class="settings-storage-info">
                            <button class="btn btn-secondary" onclick="ui.navigate('storage')">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <ellipse cx="12" cy="5" rx="9" ry="3"/>
                                    <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
                                    <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                                </svg>
                                View Storage Details
                            </button>
                        </div>
                    </div>

                    <!-- Cache Section -->
                    <div class="settings-card glass">
                        <h3 class="settings-section-title">Cache & Data</h3>
                        <div class="settings-actions">
                            <button class="btn btn-secondary" onclick="settings.clearAppCache()">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"/>
                                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                </svg>
                                Clear Cache
                            </button>
                            <button class="btn btn-secondary" onclick="settings.clearRecentHistory()">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <polyline points="12 6 12 12 16 14"/>
                                </svg>
                                Clear Recent History
                            </button>
                        </div>
                    </div>

                    <!-- About Section -->
                    <div class="settings-card glass">
                        <h3 class="settings-section-title">About</h3>
                        <div class="settings-about">
                            <p><strong>DropDrive</strong> v1.0</p>
                            <p>Cloud storage powered by Dropbox API</p>
                            <p class="settings-about-links">
                                <a href="https://www.dropbox.com/developers" target="_blank">Dropbox Developers</a>
                            </p>
                        </div>
                    </div>

                    <!-- Reset Configuration -->
                    <div class="settings-card glass settings-card-danger">
                        <button class="btn btn-danger btn-full" onclick="auth.logout()">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="1 4 1 10 7 10"/>
                                <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
                            </svg>
                            Reset Configuration
                        </button>
                    </div>
                </div>
            </div>
        `;
    },
    async refreshDropboxConnection() {
        try {
            if (auth.isAuthenticated()) {
                const info = await DropboxAPI.getAccountInfo();
                this._accountInfo = info;
                this._updateAvatar();
                ui.showToast('Connection refreshed successfully!', 'success');
                this.renderSettings();
            } else {
                ui.showToast('No active connection', 'error');
            }
        } catch (e) {
            ui.showToast('Failed to refresh connection: ' + (e.message || 'Unknown error'), 'error');
        }
    },

    _maskKey(key) {
        if (!key || key.length < 8) return key || '—';
        return key.substring(0, 4) + '••••' + key.substring(key.length - 4);
    },

    _formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    },

    setThemeFromSettings(theme) {
        this._currentTheme = theme;
        Storage.setTheme(theme);
        this.applyTheme(theme);
        this._updateThemeIcon();
    },

    clearAppCache() {
        Storage.clearCache();
        ui.showToast('Cache cleared successfully!', 'success');
    },

    clearRecentHistory() {
        Storage.clearRecent();
        ui.showToast('Recent history cleared!', 'success');
    },

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Expose as global
window.settings = settings;
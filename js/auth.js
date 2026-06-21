/**
 * DropDrive Authentication Module
 * Handles Dropbox OAuth 2.0 PKCE Flow
 */
const auth = {
    _codeVerifier: null,

    init() {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (code) {
            window.history.replaceState({}, document.title, window.location.pathname);
            return this._handleAuthCode(code);
        }

        if (error) {
            window.history.replaceState({}, document.title, window.location.pathname);
            return false;
        }

        if (DropboxAPI.init()) {
            return true;
        }

        return false;
    },

    _generateCodeVerifier() {
        const array = new Uint8Array(64);
        crypto.getRandomValues(array);
        return btoa(String.fromCharCode(...array))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    },

    async _generateCodeChallenge(verifier) {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(digest)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    },

    async login() {
        try {
            const btn = document.getElementById('loginBtn');
            btn.disabled = true;
            btn.textContent = 'Connecting...';

            this._codeVerifier = this._generateCodeVerifier();
            const codeChallenge = await this._generateCodeChallenge(this._codeVerifier);
            sessionStorage.setItem('dropdrive_code_verifier', this._codeVerifier);

            const authUrl = new URL(CONFIG.DROPBOX_AUTH_URL);
            authUrl.searchParams.set('client_id', CONFIG.DROPBOX_APP_KEY);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('redirect_uri', CONFIG.REDIRECT_URI);
            authUrl.searchParams.set('code_challenge', codeChallenge);
            authUrl.searchParams.set('code_challenge_method', 'S256');
            authUrl.searchParams.set('token_access_type', 'offline');
            authUrl.searchParams.set('scope', CONFIG.SCOPES);

            window.location.href = authUrl.toString();
        } catch (e) {
            const btn = document.getElementById('loginBtn');
            btn.disabled = false;
            btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
            </svg> Sign in with Dropbox`;
        }
    },

    async _handleAuthCode(code) {
        try {
            const verifier = sessionStorage.getItem('dropdrive_code_verifier');
            if (!verifier) return false;
            sessionStorage.removeItem('dropdrive_code_verifier');

            const response = await fetch(CONFIG.DROPBOX_TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    code,
                    grant_type: 'authorization_code',
                    client_id: CONFIG.DROPBOX_APP_KEY,
                    redirect_uri: CONFIG.REDIRECT_URI,
                    code_verifier: verifier
                })
            });

            if (!response.ok) return false;
            const tokenData = await response.json();
            this._processTokenResponse(tokenData);
            return true;
        } catch (e) {
            return false;
        }
    },

    _processTokenResponse(tokenData) {
        const token = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: Date.now() + (tokenData.expires_in || 14400) * 1000,
            account_id: tokenData.account_id,
            uid: tokenData.uid
        };
        Storage.setToken(token);
        DropboxAPI.setToken(token.access_token);
    },

    async refreshToken() {
        try {
            const tokenData = Storage.getToken();
            if (!tokenData || !tokenData.refresh_token) return false;

            const response = await fetch(CONFIG.DROPBOX_TOKEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: tokenData.refresh_token,
                    client_id: CONFIG.DROPBOX_APP_KEY
                })
            });

            if (!response.ok) return false;
            const newToken = await response.json();

            tokenData.access_token = newToken.access_token;
            tokenData.expires_at = Date.now() + (newToken.expires_in || 14400) * 1000;
            if (newToken.refresh_token) tokenData.refresh_token = newToken.refresh_token;

            Storage.setToken(tokenData);
            DropboxAPI.setToken(tokenData.access_token);
            return true;
        } catch (e) {
            return false;
        }
    },

    async restoreSession() {
        const tokenData = Storage.getToken();
        if (!tokenData) return false;
        if (Date.now() > tokenData.expires_at - 300000) {
            return await this.refreshToken();
        }
        DropboxAPI.init();
        return true;
    },

    logout() {
        DropboxAPI.clearToken();
        Storage.clearToken();
        document.getElementById('app').classList.add('hidden');
        document.getElementById('loginScreen').classList.remove('hidden');
        const btn = document.getElementById('loginBtn');
        btn.disabled = false;
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
        </svg> Sign in with Dropbox`;
    },

    isAuthenticated() {
        return !!DropboxAPI._token;
    }
};

window.auth = auth;
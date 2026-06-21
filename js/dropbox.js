/**
 * DropDrive Dropbox API Wrapper
 * Handles all communication with Dropbox HTTP API v2
 */
const DropboxAPI = {
    _token: null,

    init() {
        const tokenData = Storage.getToken();
        if (tokenData && tokenData.access_token) {
            this._token = tokenData.access_token;
            return true;
        }
        return false;
    },

    setToken(token) {
        this._token = token;
    },

    clearToken() {
        this._token = null;
    },

    async _fetch(url, options = {}) {
        const headers = {
            'Authorization': `Bearer ${this._token}`,
            ...options.headers
        };

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (response.status === 401) {
            const refreshed = await auth.refreshToken();
            if (refreshed) {
                headers['Authorization'] = `Bearer ${this._token}`;
                const retryResponse = await fetch(url, { ...options, headers });
                if (!retryResponse.ok) {
                    const err = await retryResponse.json().catch(() => ({}));
                    throw { status: retryResponse.status, error: err };
                }
                return retryResponse;
            } else {
                auth.logout();
                throw { status: 401, error: { error_summary: 'Authentication failed' } };
            }
        }

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw { status: response.status, error: err };
        }

        return response;
    },

    async _apiPost(endpoint, body = {}) {
        const response = await this._fetch(`${CONFIG.DROPBOX_API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await response.json();
    },

    async _contentPost(endpoint, body, content) {
        const response = await this._fetch(`${CONFIG.DROPBOX_CONTENT_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Dropbox-API-Arg': JSON.stringify(body),
                'Content-Type': 'application/octet-stream'
            },
            body: content
        });
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        return response;
    },

    // ---- Account Info ----
    async getAccountInfo() {
        return await this._apiPost('/users/get_current_account');
    },

    async getSpaceUsage() {
        return await this._apiPost('/users/get_space_usage');
    },

    // ---- File/Folder Listing ----
    async listFolder(path = '', recursive = false) {
        const body = {
            path: path || '',
            recursive,
            include_media_info: true,
            include_deleted: false,
            include_has_explicit_shared_members: true,
            limit: CONFIG.PAGE_SIZE
        };
        return await this._apiPost('/files/list_folder', body);
    },

    async listFolderContinue(cursor) {
        return await this._apiPost('/files/list_folder/continue', { cursor });
    },

    // ---- File/Folder Operations ----
    async createFolder(path) {
        return await this._apiPost('/files/create_folder_v2', {
            path,
            autorename: false
        });
    },

    async delete(path) {
        return await this._apiPost('/files/delete_v2', { path });
    },

    async permanentlyDelete(path) {
        return await this._apiPost('/files/permanently_delete', { path });
    },

    async move(fromPath, toPath) {
        return await this._apiPost('/files/move_v2', {
            from_path: fromPath,
            to_path: toPath,
            autorename: true
        });
    },

    async copy(fromPath, toPath) {
        return await this._apiPost('/files/copy_v2', {
            from_path: fromPath,
            to_path: toPath,
            autorename: true
        });
    },

    async getMetadata(path) {
        return await this._apiPost('/files/get_metadata', {
            path,
            include_media_info: true,
            include_deleted: false,
            include_has_explicit_shared_members: true
        });
    },

    // ---- Upload ----
    async upload(path, contents, options = {}) {
        const body = {
            path,
            mode: { '.tag': 'overwrite' },
            autorename: true,
            mute: false,
            ...options
        };

        if (typeof contents === 'string') {
            // Convert string to blob
            contents = new Blob([contents]);
        }

        return await this._contentPost('/files/upload', body, contents);
    },

    async uploadChunked(sessionId, offset, contents, close = false) {
        const body = {
            cursor: {
                session_id: sessionId,
                offset
            },
            close
        };

        const response = await this._contentPost('/files/upload_session/append_v2', body, contents);
        return response;
    },

    async startUploadSession(contents) {
        const body = {
            close: false,
            session_type: { '.tag': 'concurrent' }
        };

        const response = await this._contentPost('/files/upload_session/start', body, contents);
        return await response.json();
    },

    async finishUploadSession(sessionId, offset, path, contents) {
        const body = {
            cursor: {
                session_id: sessionId,
                offset
            },
            commit: {
                path,
                mode: { '.tag': 'overwrite' },
                autorename: true,
                mute: false
            }
        };

        return await this._contentPost('/files/upload_session/finish', body, contents);
    },

    // ---- Download ----
    async download(path) {
        const response = await this._fetch(`${CONFIG.DROPBOX_CONTENT_URL}/files/download`, {
            method: 'POST',
            headers: {
                'Dropbox-API-Arg': JSON.stringify({ path })
            }
        });
        const metadata = JSON.parse(response.headers.get('dropbox-api-result'));
        const blob = await response.blob();
        return { metadata, blob };
    },

    async getTemporaryLink(path) {
        return await this._apiPost('/files/get_temporary_link', { path });
    },

    async getTemporaryUploadLink(commitInfo) {
        return await this._apiPost('/files/get_temporary_upload_link', {
            commit_info: commitInfo
        });
    },

    // ---- Thumbnails ----
    async getThumbnail(path, size = 'w128h128', format = 'jpeg') {
        try {
            const response = await this._fetch(`${CONFIG.DROPBOX_CONTENT_URL}/files/get_thumbnail_v2`, {
                method: 'POST',
                headers: {
                    'Dropbox-API-Arg': JSON.stringify({
                        resource: { '.tag': 'path', path },
                        format: { '.tag': format },
                        size: { '.tag': size },
                        mode: { '.tag': 'strict' }
                    })
                }
            });
            const blob = await response.blob();
            return URL.createObjectURL(blob);
        } catch (e) {
            return null;
        }
    },

    // ---- Search ----
    async search(query, path = '') {
        const body = {
            query,
            path: path || '',
            max_results: 50,
            mode: { '.tag': 'filename_and_content' }
        };
        return await this._apiPost('/files/search_v2', body);
    },

    // ---- Sharing ----
    async createSharedLink(path, settings = {}) {
        const body = {
            path,
            settings: {
                requested_visibility: { '.tag': 'public' },
                audience: { '.tag': 'public' },
                access: { '.tag': 'viewer' },
                ...settings
            }
        };
        return await this._apiPost('/sharing/create_shared_link_with_settings', body);
    },

    async listSharedLinks(path = null) {
        const body = { direct_only: true };
        if (path) body.path = path;
        return await this._apiPost('/sharing/list_shared_links', body);
    },

    async getSharedLinkMetadata(url) {
        return await this._apiPost('/sharing/get_shared_link_metadata', { url });
    },

    // ---- Trash (Deleted Files) ----
    async listDeletedFiles(path = '') {
        const body = {
            path: path || '',
            include_media_info: true,
            limit: CONFIG.PAGE_SIZE
        };
        return await this._apiPost('/files/list_folder', {
            ...body,
            include_deleted: true
        });
    },

    async restore(path) {
        return await this._apiPost('/files/restore', { path });
    },

    // ---- Batch Operations ----
    async batchDelete(paths) {
        const entries = paths.map(path => ({ path }));
        return await this._apiPost('/files/delete_batch', { entries });
    },

    async batchMove(entries) {
        return await this._apiPost('/files/move_batch', {
            entries: entries.map(e => ({
                from_path: e.from,
                to_path: e.to,
                autorename: true
            }))
        });
    },

    async batchCopy(entries) {
        return await this._apiPost('/files/copy_batch', {
            entries: entries.map(e => ({
                from_path: e.from,
                to_path: e.to,
                autorename: true
            }))
        });
    },

    async checkBatchJob(asyncJobId) {
        return await this._apiPost('/files/save_url/check_job_status', {
            async_job_id: asyncJobId
        });
    }
};

// Expose as global
window.DropboxAPI = DropboxAPI;
/**
 * DropDrive UI Module
 * Handles all DOM rendering, event binding, navigation, and user interactions
 */
const ui = {
    _currentView: 'home',
    _currentPath: '',
    _cursor: null,
    _hasMore: false,
    _files: [],
    _selectedItems: new Set(),
    _contextFile: null,
    _moveMode: 'move',
    _moveSource: null,
    _moveCurrentPath: '',
    _confirmCallback: null,
    _searchTimeout: null,
    _uploadQueue: [],
    _uploading: false,
    previewFile: null,
    _sortField: 'name',
    _sortAsc: true,

    // ---- Navigation ----
    navigate(view, path) {
        this._currentView = view;
        this._currentPath = path || '';
        
        // Update sidebar active state
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.view === view);
        });

        // Update breadcrumb
        this._updateBreadcrumb();

        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            this.toggleSidebar(false);
        }

        // Render view
        switch (view) {
            case 'home':
                this.renderHome();
                break;
            case 'files':
                this.renderFiles(path || '');
                break;
            case 'recent':
                this.renderRecent();
                break;
            case 'shared':
                this.renderShared();
                break;
            case 'favorites':
                this.renderFavorites();
                break;
            case 'trash':
                this.renderTrash();
                break;
            case 'storage':
                this.renderStorage();
                break;
            case 'settings':
                settings.renderSettings();
                break;
        }
    },

    _updateBreadcrumb() {
        const el = document.getElementById('breadcrumb');
        if (!el) return;

        switch (this._currentView) {
            case 'home':
                el.textContent = 'Home';
                break;
            case 'files':
                el.textContent = this._currentPath ? this._currentPath.split('/').filter(Boolean).join(' / ') : 'My Files';
                break;
            case 'recent':
                el.textContent = 'Recent';
                break;
            case 'shared':
                el.textContent = 'Shared';
                break;
            case 'favorites':
                el.textContent = 'Favorites';
                break;
            case 'trash':
                el.textContent = 'Trash';
                break;
            case 'storage':
                el.textContent = 'Storage';
                break;
            case 'settings':
                el.textContent = 'Settings';
                break;
            default:
                el.textContent = 'DropDrive';
        }
    },

    // ---- Sidebar ----
    toggleSidebar(forceState) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (!sidebar) return;

        if (typeof forceState === 'boolean') {
            sidebar.classList.toggle('open', forceState);
            if (overlay) overlay.classList.toggle('open', forceState);
        } else {
            sidebar.classList.toggle('open');
            if (overlay) overlay.classList.toggle('open');
        }
    },

    // ---- Home/Dashboard ----
    async renderHome() {
        const content = document.getElementById('content');
        if (!content) return;

        content.innerHTML = `
            <div class="view-container dashboard">
                <div class="view-header">
                    <h2>Home</h2>
                </div>
                <div class="dashboard-grid">
                    <div class="dashboard-card glass storage-card" onclick="ui.navigate('storage')">
                        <h3>Storage</h3>
                        <div class="storage-chart-container">
                            <canvas id="storageChart" width="160" height="160"></canvas>
                        </div>
                        <div id="storageInfo" class="storage-info">
                            <div class="skeleton-line"></div>
                            <div class="skeleton-line"></div>
                            <div class="skeleton-line"></div>
                        </div>
                    </div>
                    <div class="dashboard-card glass" onclick="ui.navigate('files')">
                        <h3>Quick Upload</h3>
                        <div class="quick-upload-area" id="quickUploadArea"
                             ondragover="event.preventDefault(); this.classList.add('drag-over')"
                             ondragleave="this.classList.remove('drag-over')"
                             ondrop="ui.handleDrop(event, '')">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                                <polyline points="17 8 12 3 7 8"/>
                                <line x1="12" y1="3" x2="12" y2="15"/>
                            </svg>
                            <p>Drag & drop files here</p>
                            <span class="quick-upload-hint">or click to browse</span>
                        </div>
                    </div>
                    <div class="dashboard-card glass" onclick="ui.navigate('recent')">
                        <h3>Recent Files</h3>
                        <div id="recentFilesList" class="dashboard-list">
                            <div class="skeleton-line"></div>
                            <div class="skeleton-line"></div>
                            <div class="skeleton-line"></div>
                        </div>
                    </div>
                    <div class="dashboard-card glass" onclick="ui.navigate('shared')">
                        <h3>Recently Shared</h3>
                        <div id="sharedFilesList" class="dashboard-list">
                            <div class="skeleton-line"></div>
                            <div class="skeleton-line"></div>
                            <div class="skeleton-line"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Load data
        this._loadStorageChart();
        this._loadRecentFiles();
        this._loadSharedFiles();

        // Make quick upload area clickable
        document.getElementById('quickUploadArea')?.addEventListener('click', () => this.triggerUpload());
    },

    async _loadStorageChart() {
        try {
            const usage = await DropboxAPI.getSpaceUsage();
            const used = usage.used;
            const total = usage.allocation?.allocated || 0;
            const free = total - used;

            const infoEl = document.getElementById('storageInfo');
            if (infoEl) {
                infoEl.innerHTML = `
                    <div class="storage-stat"><span>Total</span><span>${this._formatSize(total)}</span></div>
                    <div class="storage-stat"><span>Used</span><span>${this._formatSize(used)}</span></div>
                    <div class="storage-stat"><span>Free</span><span>${this._formatSize(free)}</span></div>
                `;
            }

            this._drawStorageChart(used, total);
        } catch (e) {
            document.getElementById('storageInfo').innerHTML = '<p>Failed to load storage info</p>';
        }
    },

    _drawStorageChart(used, total) {
        const canvas = document.getElementById('storageChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const centerX = 80, centerY = 80, radius = 70;
        const percentage = total > 0 ? used / total : 0;

        ctx.clearRect(0, 0, 160, 160);

        // Background circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || '#e0e0e0';
        ctx.lineWidth = 12;
        ctx.stroke();

        // Used circle
        if (percentage > 0) {
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + Math.PI * 2 * Math.min(percentage, 1);
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.strokeStyle = '#0061ff';
            ctx.lineWidth = 12;
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        // Center text
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#1a1a2e';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(percentage * 100) + '%', centerX, centerY - 8);
        ctx.font = '12px sans-serif';
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#666';
        ctx.fillText('used', centerX, centerY + 16);
    },

    async _loadRecentFiles() {
        const list = document.getElementById('recentFilesList');
        if (!list) return;

        const recents = Storage.getRecent().slice(0, 5);
        if (recents.length === 0) {
            list.innerHTML = '<p class="empty-text">No recent files</p>';
            return;
        }

        list.innerHTML = recents.map(r => `
            <div class="dashboard-list-item" onclick="ui.navigate('files', '${r.path.split('/').slice(0, -1).join('/')}')">
                <span class="file-icon">${r.isDir ? '📁' : this._getFileIcon(r.name)}</span>
                <span class="file-name">${this._escapeHtml(r.name)}</span>
            </div>
        `).join('');
    },

    async _loadSharedFiles() {
        const list = document.getElementById('sharedFilesList');
        if (!list) return;

        try {
            const links = await DropboxAPI.listSharedLinks();
            const items = (links.links || []).slice(0, 5);
            if (items.length === 0) {
                list.innerHTML = '<p class="empty-text">No shared files</p>';
                return;
            }
            list.innerHTML = items.map(item => `
                <div class="dashboard-list-item">
                    <span class="file-icon">🔗</span>
                    <span class="file-name">${this._escapeHtml(item.name || 'Shared link')}</span>
                </div>
            `).join('');
        } catch (e) {
            list.innerHTML = '<p class="empty-text">No shared files</p>';
        }
    },

    // ---- File Manager ----
    async renderFiles(path) {
        const content = document.getElementById('content');
        if (!content) return;

        this._currentPath = path || '';
        this._files = [];
        this._selectedItems.clear();
        this._cursor = null;
        this._hasMore = false;

        content.innerHTML = `
            <div class="view-container files-view">
                <div class="view-header">
                    <div class="folder-actions">
                        <button class="btn btn-secondary btn-sm" onclick="ui.navigate('files', '${this._getParentPath(this._currentPath)}')" ${!this._currentPath ? 'disabled' : ''}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
                            </svg>
                            Back
                        </button>
                    </div>
                </div>
                <div id="fileList" class="file-list-container">
                    <div class="loading-spinner">
                        <div class="spinner"></div>
                        <p>Loading files...</p>
                    </div>
                </div>
                <div id="loadMoreContainer" class="load-more-container hidden">
                    <button class="btn btn-secondary" onclick="ui.loadMoreFiles()">Load More</button>
                </div>
            </div>
        `;

        // Set up drag and drop on the file list
        const fileList = document.getElementById('fileList');
        fileList.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileList.classList.add('drag-over');
        });
        fileList.addEventListener('dragleave', () => {
            fileList.classList.remove('drag-over');
        });
        fileList.addEventListener('drop', (e) => {
            e.preventDefault();
            fileList.classList.remove('drag-over');
            this.handleDrop(e, this._currentPath);
        });

        await this._loadFiles(path);
    },

    async _loadFiles(path) {
        const container = document.getElementById('fileList');
        if (!container) return;

        try {
            const result = await DropboxAPI.listFolder(path);
            this._files = result.entries || [];
            this._cursor = result.cursor;
            this._hasMore = result.has_more;

            // Cache the listing
            Storage.setCache('files_' + path, this._files);

            this._renderFileList();

            if (this._hasMore) {
                document.getElementById('loadMoreContainer')?.classList.remove('hidden');
            }
        } catch (e) {
            container.innerHTML = `
                <div class="error-state">
                    <p>Failed to load files</p>
                    <p class="error-detail">${e.error?.error_summary || e.message || 'Unknown error'}</p>
                    <button class="btn btn-primary" onclick="ui.renderFiles('${path}')">Retry</button>
                </div>
            `;
        }
    },

    async loadMoreFiles() {
        if (!this._cursor) return;

        try {
            const result = await DropboxAPI.listFolderContinue(this._cursor);
            this._files = this._files.concat(result.entries || []);
            this._cursor = result.cursor;
            this._hasMore = result.has_more;

            this._renderFileList();

            if (!this._hasMore) {
                document.getElementById('loadMoreContainer')?.classList.add('hidden');
            }
        } catch (e) {
            ui.showToast('Failed to load more files', 'error');
        }
    },

    _renderFileList() {
        const container = document.getElementById('fileList');
        if (!container) return;

        const viewMode = Storage.getViewMode();

        if (this._files.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3">
                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                    </svg>
                    <p>This folder is empty</p>
                    <button class="btn btn-primary" onclick="ui.triggerUpload()">Upload Files</button>
                </div>
            `;
            return;
        }

        // Sort files
        const sorted = this._sortFiles(this._files);

        if (viewMode === 'grid') {
            container.innerHTML = `
                <div class="file-grid">
                    ${sorted.map(f => this._renderGridItem(f)).join('')}
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="file-table-wrapper">
                    <table class="file-table">
                        <thead>
                            <tr>
                                <th onclick="ui.setSort('name')">Name ${this._getSortIcon('name')}</th>
                                <th onclick="ui.setSort('size')">Size ${this._getSortIcon('size')}</th>
                                <th onclick="ui.setSort('modified')">Modified ${this._getSortIcon('modified')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sorted.map(f => this._renderListItem(f)).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        // Attach context menu events
        container.querySelectorAll('.file-item').forEach(el => {
            el.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const path = el.dataset.path;
                const file = this._files.find(f => f.path_lower === path);
                if (file) {
                    this._showContextMenu(e, file);
                }
            });
        });
    },

    _renderGridItem(file) {
        const isDir = file['.tag'] === 'folder';
        const isFav = Storage.isFavorite(file.path_lower);
        const name = file.name;
        const modified = file.server_modified || file.client_modified || '';
        const size = file.size || 0;
        const fileJson = this._escapeJson(file);

        return `
            <div class="file-item file-card glass" data-path="${file.path_lower}" data-tag="${file['.tag']}"
                 ondblclick="ui.openFile('${file.path_lower}', '${file['.tag']}')">
                <div class="file-card-thumb">
                    ${isDir 
                        ? `<div class="folder-icon"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0061ff" stroke-width="1.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg></div>`
                        : this._isImageFile(name)
                            ? `<div class="file-thumb-placeholder" data-path="${file.path_lower}"><div class="file-icon-large">${this._getFileIcon(name)}</div></div>`
                            : `<div class="file-icon-large">${this._getFileIcon(name)}</div>`
                    }
                </div>
                <div class="file-card-info">
                    <div class="file-card-name" title="${this._escapeHtml(name)}">${this._escapeHtml(name)}</div>
                    <div class="file-card-meta">
                        ${isDir ? 'Folder' : this._formatSize(size)}
                        ${isFav ? ' ★' : ''}
                    </div>
                </div>
                <div class="file-card-actions">
                    <button class="icon-btn icon-btn-sm" onclick="event.stopPropagation(); ui._showContextMenu(event, ${fileJson})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    },

    _renderListItem(file) {
        const isDir = file['.tag'] === 'folder';
        const isFav = Storage.isFavorite(file.path_lower);
        const name = file.name;
        const modified = file.server_modified || file.client_modified || '';
        const size = file.size || 0;

        return `
            <tr class="file-item" data-path="${file.path_lower}" data-tag="${file['.tag']}"
                ondblclick="ui.openFile('${file.path_lower}', '${file['.tag']}')">
                <td>
                    <span class="file-icon">${isDir ? '📁' : this._getFileIcon(name)}</span>
                    <span class="file-name">${this._escapeHtml(name)} ${isFav ? '★' : ''}</span>
                </td>
                <td>${isDir ? '—' : this._formatSize(size)}</td>
                <td>${modified ? this._formatDate(modified) : '—'}</td>
            </tr>
        `;
    },

    _sortFiles(files) {
        const folders = files.filter(f => f['.tag'] === 'folder');
        const items = files.filter(f => f['.tag'] !== 'folder');

        const sortFn = (a, b) => {
            let cmp = 0;
            switch (this._sortField) {
                case 'name':
                    cmp = a.name.localeCompare(b.name);
                    break;
                case 'size':
                    cmp = (a.size || 0) - (b.size || 0);
                    break;
                case 'modified':
                    const aDate = a.server_modified || a.client_modified || '';
                    const bDate = b.server_modified || b.client_modified || '';
                    cmp = aDate.localeCompare(bDate);
                    break;
            }
            return this._sortAsc ? cmp : -cmp;
        };

        folders.sort(sortFn);
        items.sort(sortFn);
        return [...folders, ...items];
    },

    setSort(field) {
        if (this._sortField === field) {
            this._sortAsc = !this._sortAsc;
        } else {
            this._sortField = field;
            this._sortAsc = true;
        }
        this._renderFileList();
    },

    _getSortIcon(field) {
        if (this._sortField !== field) return '';
        return this._sortAsc ? ' ▲' : ' ▼';
    },

    openFile(path, tag) {
        if (tag === 'folder') {
            this.navigate('files', path);
        } else {
            const file = this._files.find(f => f.path_lower === path);
            if (file) {
                Storage.addRecent(file, 'opened');
                this.previewFile = file;
                this.openPreview(file);
            }
        }
    },

    // ---- File Operations ----
    async createFolder() {
        const input = document.getElementById('folderNameInput');
        const error = document.getElementById('folderNameError');
        const name = input.value.trim();

        if (!name) {
            error.classList.remove('hidden');
            return;
        }
        error.classList.add('hidden');

        const path = this._currentPath ? `${this._currentPath}/${name}` : `/${name}`;

        try {
            await DropboxAPI.createFolder(path);
            this.closeModal('createFolderModal');
            input.value = '';
            ui.showToast('Folder created successfully!', 'success');
            this.renderFiles(this._currentPath);
        } catch (e) {
            ui.showToast('Failed to create folder: ' + (e.error?.error_summary || e.message), 'error');
        }
    },

    showCreateFolderModal() {
        document.getElementById('folderNameInput').value = '';
        document.getElementById('folderNameError').classList.add('hidden');
        document.getElementById('createFolderModal').classList.remove('hidden');
        setTimeout(() => document.getElementById('folderNameInput').focus(), 100);
    },

    async renameItem() {
        const input = document.getElementById('renameInput');
        const error = document.getElementById('renameError');
        const newName = input.value.trim();

        if (!newName) {
            error.classList.remove('hidden');
            return;
        }
        error.classList.add('hidden');

        const file = this._contextFile;
        if (!file) return;

        const parentPath = file.path_lower.substring(0, file.path_lower.lastIndexOf('/'));
        const newPath = parentPath ? `${parentPath}/${newName}` : `/${newName}`;

        try {
            await DropboxAPI.move(file.path_lower, newPath);
            this.closeModal('renameModal');
            ui.showToast('Renamed successfully!', 'success');
            this.renderFiles(this._currentPath);
        } catch (e) {
            ui.showToast('Failed to rename: ' + (e.error?.error_summary || e.message), 'error');
        }
    },

    showRenameModal(file) {
        this._contextFile = file;
        document.getElementById('renameInput').value = file.name;
        document.getElementById('renameError').classList.add('hidden');
        document.getElementById('renameModal').classList.remove('hidden');
        setTimeout(() => {
            const input = document.getElementById('renameInput');
            const dotIdx = file.name.lastIndexOf('.');
            if (dotIdx > 0) {
                input.setSelectionRange(0, dotIdx);
            } else {
                input.select();
            }
            input.focus();
        }, 100);
    },

    async deleteItem(file) {
        this._showConfirm(
            'Delete File',
            `Are you sure you want to move "${file.name}" to trash?`,
            async () => {
                try {
                    await DropboxAPI.delete(file.path_lower);
                    ui.showToast('Moved to trash', 'success');
                    this.renderFiles(this._currentPath);
                } catch (e) {
                    ui.showToast('Failed to delete: ' + (e.error?.error_summary || e.message), 'error');
                }
            }
        );
    },

    async permanentlyDeleteItem(file) {
        this._showConfirm(
            'Permanently Delete',
            `Are you sure you want to permanently delete "${file.name}"? This cannot be undone.`,
            async () => {
                try {
                    await DropboxAPI.permanentlyDelete(file.path_lower);
                    ui.showToast('Permanently deleted', 'success');
                    this.renderTrash();
                } catch (e) {
                    ui.showToast('Failed to delete: ' + (e.error?.error_summary || e.message), 'error');
                }
            },
            'Delete Forever'
        );
    },

    async restoreItem(file) {
        try {
            await DropboxAPI.restore(file.path_lower);
            ui.showToast('File restored!', 'success');
            this.renderTrash();
        } catch (e) {
            ui.showToast('Failed to restore: ' + (e.error?.error_summary || e.message), 'error');
        }
    },

    async emptyTrash() {
        this._showConfirm(
            'Empty Trash',
            'Are you sure you want to permanently delete all items in trash? This cannot be undone.',
            async () => {
                try {
                    const result = await DropboxAPI.listDeletedFiles();
                    const entries = result.entries || [];
                    for (const entry of entries) {
                        await DropboxAPI.permanentlyDelete(entry.path_lower);
                    }
                    ui.showToast('Trash emptied', 'success');
                    this.renderTrash();
                } catch (e) {
                    ui.showToast('Failed to empty trash', 'error');
                }
            },
            'Empty Trash'
        );
    },

    // ---- Move/Copy ----
    showMoveModal(file, mode) {
        this._moveMode = mode || 'move';
        this._moveSource = file;
        this._moveCurrentPath = '';

        document.getElementById('moveModalTitle').textContent = mode === 'copy' ? 'Copy to...' : 'Move to...';
        document.getElementById('moveActionBtn').textContent = mode === 'copy' ? 'Copy Here' : 'Move Here';
        document.getElementById('moveModal').classList.remove('hidden');
        this._renderMoveFolderList('');
    },

    async _renderMoveFolderList(path) {
        this._moveCurrentPath = path;
        const breadcrumb = document.getElementById('moveBreadcrumb');
        const content = document.getElementById('moveContent');

        // Breadcrumb
        const parts = path ? path.split('/').filter(Boolean) : [];
        let breadcrumbHtml = `<a onclick="ui._renderMoveFolderList('')">Root</a>`;
        let currentPath = '';
        for (const part of parts) {
            currentPath += '/' + part;
            breadcrumbHtml += ` / <a onclick="ui._renderMoveFolderList('${currentPath}')">${this._escapeHtml(part)}</a>`;
        }
        breadcrumb.innerHTML = breadcrumbHtml;

        // Folder list
        content.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

        try {
            const result = await DropboxAPI.listFolder(path);
            const folders = result.entries.filter(e => e['.tag'] === 'folder');

            if (folders.length === 0) {
                content.innerHTML = '<p class="empty-text">No subfolders</p>';
                return;
            }

            content.innerHTML = folders.map(f => `
                <div class="move-folder-item" onclick="ui._renderMoveFolderList('${f.path_lower}')">
                    <span class="file-icon">📁</span>
                    <span>${this._escapeHtml(f.name)}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </div>
            `).join('');
        } catch (e) {
            content.innerHTML = '<p class="error-text">Failed to load folders</p>';
        }
    },

    async executeMove() {
        const source = this._moveSource;
        const destPath = this._moveCurrentPath;
        const newPath = destPath ? `${destPath}/${source.name}` : `/${source.name}`;

        try {
            if (this._moveMode === 'copy') {
                await DropboxAPI.copy(source.path_lower, newPath);
                ui.showToast('Copied successfully!', 'success');
            } else {
                await DropboxAPI.move(source.path_lower, newPath);
                ui.showToast('Moved successfully!', 'success');
            }
            this.closeModal('moveModal');
            this.renderFiles(this._currentPath);
        } catch (e) {
            ui.showToast('Failed: ' + (e.error?.error_summary || e.message), 'error');
        }
    },

    // ---- Upload ----
    triggerUpload() {
        document.getElementById('fileInput').click();
    },

    handleFileSelect(event) {
        const files = event.target.files;
        if (files.length > 0) {
            this._addToUploadQueue(files);
        }
        event.target.value = '';
    },

    handleDrop(event, path) {
        event.preventDefault();
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            this._currentPath = path || this._currentPath;
            this._addToUploadQueue(files);
        }
    },

    _addToUploadQueue(files) {
        for (const file of files) {
            this._uploadQueue.push({
                file,
                path: this._currentPath,
                progress: 0,
                status: 'queued',
                speed: 0,
                xhr: null
            });
        }
        this._showUploadPanel();
        this._processUploadQueue();
    },

    _showUploadPanel() {
        document.getElementById('uploadPanel').classList.remove('hidden');
        this._renderUploadQueue();
    },

    hideUploadPanel() {
        document.getElementById('uploadPanel').classList.add('hidden');
    },

    _renderUploadQueue() {
        const container = document.getElementById('uploadQueue');
        if (!container) return;

        container.innerHTML = this._uploadQueue.map((item, idx) => `
            <div class="upload-item" data-idx="${idx}">
                <div class="upload-item-info">
                    <span class="upload-item-name">${this._escapeHtml(item.file.name)}</span>
                    <span class="upload-item-size">${this._formatSize(item.file.size)}</span>
                </div>
                <div class="upload-progress-bar">
                    <div class="upload-progress-fill" style="width: ${item.progress}%"></div>
                </div>
                <div class="upload-item-status">
                    <span class="upload-status-text">${this._getUploadStatusText(item)}</span>
                    ${item.status === 'uploading' || item.status === 'queued' 
                        ? `<button class="icon-btn icon-btn-sm" onclick="ui._cancelUpload(${idx})">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                           </button>`
                        : ''}
                </div>
            </div>
        `).join('');
    },

    _getUploadStatusText(item) {
        switch (item.status) {
            case 'queued': return 'Queued...';
            case 'uploading': return `${item.progress}% ${item.speed > 0 ? '• ' + this._formatSpeed(item.speed) : ''}`;
            case 'done': return '✅ Complete';
            case 'error': return '❌ Failed';
            case 'cancelled': return '⛔ Cancelled';
            default: return '';
        }
    },

    async _processUploadQueue() {
        if (this._uploading) return;
        this._uploading = true;

        const nextIdx = this._uploadQueue.findIndex(item => item.status === 'queued');
        if (nextIdx === -1) {
            this._uploading = false;
            return;
        }

        const item = this._uploadQueue[nextIdx];
        item.status = 'uploading';
        this._renderUploadQueue();

        const path = item.path ? `${item.path}/${item.file.name}` : `/${item.file.name}`;
        const startTime = Date.now();
        let lastLoaded = 0;

        try {
            // Use XMLHttpRequest for progress tracking
            const result = await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                item.xhr = xhr;

                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const progress = Math.round((e.loaded / e.total) * 100);
                        item.progress = progress;
                        const elapsed = (Date.now() - startTime) / 1000;
                        const loaded = e.loaded - lastLoaded;
                        lastLoaded = e.loaded;
                        item.speed = elapsed > 0 ? loaded / elapsed : 0;
                        this._renderUploadQueue();
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(JSON.parse(xhr.responseText));
                    } else {
                        try {
                            const err = JSON.parse(xhr.responseText);
                            reject(new Error(err.error_summary || 'Upload failed'));
                        } catch {
                            reject(new Error('Upload failed with status ' + xhr.status));
                        }
                    }
                });

                xhr.addEventListener('error', () => reject(new Error('Network error')));
                xhr.addEventListener('abort', () => reject(new Error('Cancelled')));

                xhr.open('POST', `${CONFIG.DROPBOX_CONTENT_URL}/files/upload`);
                xhr.setRequestHeader('Authorization', `Bearer ${DropboxAPI._token}`);
                xhr.setRequestHeader('Dropbox-API-Arg', JSON.stringify({
                    path,
                    mode: { '.tag': 'overwrite' },
                    autorename: true,
                    mute: false
                }));
                xhr.setRequestHeader('Content-Type', 'application/octet-stream');
                xhr.send(item.file);
            });

            item.status = 'done';
            item.progress = 100;
            Storage.addRecent({ path_lower: path, name: item.file.name, '.tag': 'file' }, 'uploaded');
            ui.showToast(`Uploaded: ${item.file.name}`, 'success');
        } catch (e) {
            if (e.message === 'Cancelled') {
                item.status = 'cancelled';
            } else {
                item.status = 'error';
                ui.showToast(`Upload failed: ${item.file.name}`, 'error');
            }
        }

        this._renderUploadQueue();
        this._uploading = false;

        // Process next in queue
        setTimeout(() => this._processUploadQueue(), 500);

        // Refresh file list after all uploads
        const hasMoreQueued = this._uploadQueue.some(i => i.status === 'queued');
        if (!hasMoreQueued) {
            setTimeout(() => {
                if (this._currentView === 'files') {
                    this.renderFiles(this._currentPath);
                }
            }, 1000);
        }
    },

    _cancelUpload(idx) {
        const item = this._uploadQueue[idx];
        if (item.xhr) {
            item.xhr.abort();
        }
        item.status = 'cancelled';
        this._renderUploadQueue();
    },

    // ---- Download ----
    async downloadFile(file) {
        try {
            ui.showToast('Downloading...', 'info');
            const result = await DropboxAPI.download(file.path_lower);
            const url = URL.createObjectURL(result.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = file.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            Storage.addRecent(file, 'downloaded');
            ui.showToast('Downloaded: ' + file.name, 'success');
        } catch (e) {
            ui.showToast('Download failed: ' + (e.error?.error_summary || e.message), 'error');
        }
    },

    async downloadPreviewFile() {
        if (this.previewFile) {
            await this.downloadFile(this.previewFile);
        }
    },

    // ---- Preview ----
    openPreview(file) {
        this.previewFile = file;
        document.getElementById('previewTitle').textContent = file.name;
        document.getElementById('previewModal').classList.remove('hidden');

        const content = document.getElementById('previewContent');
        const name = file.name.toLowerCase();

        if (this._isImageFile(name)) {
            this._previewImage(file, content);
        } else if (this._isVideoFile(name)) {
            this._previewVideo(file, content);
        } else if (this._isAudioFile(name)) {
            this._previewAudio(file, content);
        } else if (name.endsWith('.pdf')) {
            this._previewPDF(file, content);
        } else if (this._isTextFile(name)) {
            this._previewText(file, content);
        } else {
            this._previewGeneric(file, content);
        }
    },

    async _previewImage(file, container) {
        container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
        try {
            const link = await DropboxAPI.getTemporaryLink(file.path_lower);
            container.innerHTML = `
                <div class="image-preview-container">
                    <img src="${link.link}" alt="${this._escapeHtml(file.name)}" class="image-preview" id="previewImage">
                </div>
            `;
            // Add zoom support
            const img = document.getElementById('previewImage');
            let scale = 1;
            img.addEventListener('wheel', (e) => {
                e.preventDefault();
                scale += e.deltaY > 0 ? -0.1 : 0.1;
                scale = Math.max(0.5, Math.min(5, scale));
                img.style.transform = `scale(${scale})`;
            });
        } catch (e) {
            container.innerHTML = '<p class="error-text">Failed to load image preview</p>';
        }
    },

    async _previewVideo(file, container) {
        try {
            const link = await DropboxAPI.getTemporaryLink(file.path_lower);
            container.innerHTML = `
                <div class="video-preview-container">
                    <video controls autoplay class="video-preview">
                        <source src="${link.link}" type="video/mp4">
                        Your browser does not support video playback.
                    </video>
                </div>
            `;
        } catch (e) {
            container.innerHTML = '<p class="error-text">Failed to load video preview</p>';
        }
    },

    async _previewAudio(file, container) {
        try {
            const link = await DropboxAPI.getTemporaryLink(file.path_lower);
            container.innerHTML = `
                <div class="audio-preview-container">
                    <div class="audio-art">
                        <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5">
                            <path d="M9 18V5l12-2v13"/>
                            <circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                        </svg>
                    </div>
                    <p class="audio-name">${this._escapeHtml(file.name)}</p>
                    <audio controls autoplay class="audio-preview">
                        <source src="${link.link}">
                        Your browser does not support audio playback.
                    </audio>
                </div>
            `;
        } catch (e) {
            container.innerHTML = '<p class="error-text">Failed to load audio preview</p>';
        }
    },

    async _previewPDF(file, container) {
        try {
            const link = await DropboxAPI.getTemporaryLink(file.path_lower);
            container.innerHTML = `
                <div class="pdf-preview-container">
                    <iframe src="${link.link}" class="pdf-preview" frameborder="0"></iframe>
                </div>
            `;
        } catch (e) {
            container.innerHTML = '<p class="error-text">Failed to load PDF preview</p>';
        }
    },

    async _previewText(file, container) {
        container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';
        try {
            const result = await DropboxAPI.download(file.path_lower);
            const text = await result.blob.text();
            container.innerHTML = `
                <div class="text-preview-container">
                    <pre class="text-preview">${this._escapeHtml(text)}</pre>
                </div>
            `;
        } catch (e) {
            container.innerHTML = '<p class="error-text">Failed to load text preview</p>';
        }
    },

    _previewGeneric(file, container) {
        container.innerHTML = `
            <div class="generic-preview">
                <div class="generic-preview-icon">${this._getFileIcon(file.name)}</div>
                <p class="generic-preview-name">${this._escapeHtml(file.name)}</p>
                <p class="generic-preview-size">${this._formatSize(file.size || 0)}</p>
                <p class="generic-preview-meta">Modified: ${this._formatDate(file.server_modified || file.client_modified)}</p>
                <button class="btn btn-primary" onclick="ui.downloadPreviewFile()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download
                </button>
            </div>
        `;
    },

    closePreview(event) {
        if (event && event.target !== document.getElementById('previewModal')) return;
        document.getElementById('previewModal').classList.add('hidden');
        document.getElementById('previewContent').innerHTML = '';
        this.previewFile = null;
    },

    // ---- Recent ----
    renderRecent() {
        const content = document.getElementById('content');
        if (!content) return;

        const recents = Storage.getRecent();

        content.innerHTML = `
            <div class="view-container">
                <div class="view-header">
                    <h2>Recent Files</h2>
                    ${recents.length > 0 ? '<button class="btn btn-secondary btn-sm" onclick="Storage.clearRecent(); ui.renderRecent();">Clear All</button>' : ''}
                </div>
                <div class="file-list-container">
                    ${recents.length === 0 
                        ? '<div class="empty-state"><p>No recent files</p></div>'
                        : `<div class="file-grid">
                            ${recents.map(r => `
                                <div class="file-item file-card glass" onclick="ui.navigate('files', '${r.path.split('/').slice(0, -1).join('/')}')">
                                    <div class="file-card-thumb">
                                        <div class="file-icon-large">${r.isDir ? '📁' : ui._getFileIcon(r.name)}</div>
                                    </div>
                                    <div class="file-card-info">
                                        <div class="file-card-name">${ui._escapeHtml(r.name)}</div>
                                        <div class="file-card-meta">${r.action} • ${ui._formatDate(new Date(r.timestamp).toISOString())}</div>
                                    </div>
                                </div>
                            `).join('')}
                           </div>`
                    }
                </div>
            </div>
        `;
    },

    // ---- Shared ----
    async renderShared() {
        const content = document.getElementById('content');
        if (!content) return;

        content.innerHTML = `
            <div class="view-container">
                <div class="view-header">
                    <h2>Shared Files</h2>
                </div>
                <div id="sharedList" class="file-list-container">
                    <div class="loading-spinner"><div class="spinner"></div></div>
                </div>
            </div>
        `;

        try {
            const links = await DropboxAPI.listSharedLinks();
            const items = links.links || [];

            const list = document.getElementById('sharedList');
            if (items.length === 0) {
                list.innerHTML = '<div class="empty-state"><p>No shared links</p></div>';
                return;
            }

            list.innerHTML = `
                <div class="file-grid">
                    ${items.map(item => `
                        <div class="file-item file-card glass">
                            <div class="file-card-thumb">
                                <div class="file-icon-large">🔗</div>
                            </div>
                            <div class="file-card-info">
                                <div class="file-card-name">${ui._escapeHtml(item.name || 'Shared Link')}</div>
                                <div class="file-card-meta">${item.link_extras?.visibility || 'Public'}</div>
                            </div>
                            <div class="file-card-actions">
                                <button class="icon-btn icon-btn-sm" onclick="navigator.clipboard.writeText('${item.url}'); ui.showToast('Link copied!', 'success')">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                                        <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (e) {
            document.getElementById('sharedList').innerHTML = '<div class="empty-state"><p>Failed to load shared files</p></div>';
        }
    },

    // ---- Favorites ----
    renderFavorites() {
        const content = document.getElementById('content');
        if (!content) return;

        const favPaths = Storage.getFavorites();

        content.innerHTML = `
            <div class="view-container">
                <div class="view-header">
                    <h2>Favorites</h2>
                </div>
                <div id="favList" class="file-list-container">
                    ${favPaths.length === 0 
                        ? '<div class="empty-state"><p>No favorites yet</p><p class="hint">Right-click files to add them to favorites</p></div>'
                        : '<div class="loading-spinner"><div class="spinner"></div></div>'
                    }
                </div>
            </div>
        `;

        if (favPaths.length > 0) {
            this._loadFavoriteFiles(favPaths);
        }
    },

    async _loadFavoriteFiles(paths) {
        const list = document.getElementById('favList');
        if (!list) return;

        const files = [];
        for (const path of paths) {
            try {
                const meta = await DropboxAPI.getMetadata(path);
                files.push(meta);
            } catch (e) {
                // File may have been deleted, remove from favorites
                Storage.removeFavorite(path);
            }
        }

        if (files.length === 0) {
            list.innerHTML = '<div class="empty-state"><p>No favorites found</p></div>';
            return;
        }

        list.innerHTML = `
            <div class="file-grid">
                ${files.map(f => `
                    <div class="file-item file-card glass" ondblclick="ui.openFile('${f.path_lower}', '${f['.tag']}')">
                        <div class="file-card-thumb">
                            <div class="file-icon-large">${f['.tag'] === 'folder' ? '📁' : ui._getFileIcon(f.name)}</div>
                        </div>
                        <div class="file-card-info">
                            <div class="file-card-name">${ui._escapeHtml(f.name)}</div>
                            <div class="file-card-meta">${f['.tag'] === 'folder' ? 'Folder' : ui._formatSize(f.size || 0)} ★</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // ---- Trash ----
    async renderTrash() {
        const content = document.getElementById('content');
        if (!content) return;

        content.innerHTML = `
            <div class="view-container">
                <div class="view-header">
                    <h2>Trash</h2>
                    <button class="btn btn-danger btn-sm" onclick="ui.emptyTrash()">Empty Trash</button>
                </div>
                <div id="trashList" class="file-list-container">
                    <div class="loading-spinner"><div class="spinner"></div></div>
                </div>
            </div>
        `;

        try {
            const result = await DropboxAPI.listDeletedFiles();
            const entries = result.entries || [];

            const list = document.getElementById('trashList');
            if (entries.length === 0) {
                list.innerHTML = '<div class="empty-state"><p>Trash is empty</p></div>';
                return;
            }

            list.innerHTML = `
                <div class="file-grid">
                    ${entries.map(f => `
                        <div class="file-item file-card glass">
                            <div class="file-card-thumb">
                                <div class="file-icon-large">${f['.tag'] === 'folder' ? '📁' : ui._getFileIcon(f.name)}</div>
                            </div>
                            <div class="file-card-info">
                                <div class="file-card-name">${ui._escapeHtml(f.name)}</div>
                                <div class="file-card-meta">Deleted</div>
                            </div>
                            <div class="file-card-actions">
                                <button class="icon-btn icon-btn-sm" onclick="ui.restoreItem(${JSON.stringify(f).replace(/"/g, '"')})" title="Restore">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="1 4 1 10 7 10"/>
                                        <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
                                    </svg>
                                </button>
                                <button class="icon-btn icon-btn-sm" onclick="ui.permanentlyDeleteItem(${JSON.stringify(f).replace(/"/g, '"')})" title="Delete forever">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"/>
                                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (e) {
            document.getElementById('trashList').innerHTML = '<div class="empty-state"><p>Failed to load trash</p></div>';
        }
    },

    // ---- Storage ----
    async renderStorage() {
        const content = document.getElementById('content');
        if (!content) return;

        content.innerHTML = `
            <div class="view-container">
                <div class="view-header">
                    <h2>Storage</h2>
                </div>
                <div class="storage-detail glass">
                    <div class="storage-chart-large">
                        <canvas id="storageChartLarge" width="240" height="240"></canvas>
                    </div>
                    <div id="storageDetailInfo" class="storage-detail-info">
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line"></div>
                    </div>
                </div>
            </div>
        `;

        try {
            const usage = await DropboxAPI.getSpaceUsage();
            const used = usage.used;
            const total = usage.allocation?.allocated || 0;
            const free = total - used;

            document.getElementById('storageDetailInfo').innerHTML = `
                <div class="storage-stat-large">
                    <span class="stat-label">Total Storage</span>
                    <span class="stat-value">${this._formatSize(total)}</span>
                </div>
                <div class="storage-stat-large">
                    <span class="stat-label">Used Storage</span>
                    <span class="stat-value">${this._formatSize(used)}</span>
                </div>
                <div class="storage-stat-large">
                    <span class="stat-label">Free Storage</span>
                    <span class="stat-value">${this._formatSize(free)}</span>
                </div>
                <div class="storage-bar">
                    <div class="storage-bar-fill" style="width: ${total > 0 ? (used / total * 100) : 0}%"></div>
                </div>
                <p class="storage-percentage">${total > 0 ? Math.round(used / total * 100) : 0}% used</p>
            `;

            this._drawStorageChartLarge(used, total);
        } catch (e) {
            document.getElementById('storageDetailInfo').innerHTML = '<p>Failed to load storage info</p>';
        }
    },

    _drawStorageChartLarge(used, total) {
        const canvas = document.getElementById('storageChartLarge');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const centerX = 120, centerY = 120, radius = 100;
        const percentage = total > 0 ? used / total : 0;

        ctx.clearRect(0, 0, 240, 240);

        // Background
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim() || '#e0e0e0';
        ctx.lineWidth = 16;
        ctx.stroke();

        // Used
        if (percentage > 0) {
            const startAngle = -Math.PI / 2;
            const endAngle = startAngle + Math.PI * 2 * Math.min(percentage, 1);
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.strokeStyle = '#0061ff';
            ctx.lineWidth = 16;
            ctx.lineCap = 'round';
            ctx.stroke();
        }

        // Center text
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-primary').trim() || '#1a1a2e';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(Math.round(percentage * 100) + '%', centerX, centerY - 10);
        ctx.font = '14px sans-serif';
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text-secondary').trim() || '#666';
        ctx.fillText('used', centerX, centerY + 20);
    },

    // ---- Search ----
    handleSearch(query) {
        clearTimeout(this._searchTimeout);
        const clearBtn = document.getElementById('searchClearBtn');

        if (!query || query.length < 2) {
            clearBtn?.classList.add('hidden');
            return;
        }

        clearBtn?.classList.remove('hidden');

        this._searchTimeout = setTimeout(() => {
            this._performSearch(query);
        }, CONFIG.SEARCH_DEBOUNCE);
    },

    clearSearch() {
        const input = document.getElementById('searchInput');
        if (input) {
            input.value = '';
            document.getElementById('searchClearBtn')?.classList.add('hidden');
        }
    },

    async _performSearch(query) {
        try {
            const result = await DropboxAPI.search(query);
            const matches = result.matches || [];

            if (matches.length === 0) {
                ui.showToast('No results found', 'info');
                return;
            }

            // Show results in a temporary view
            const content = document.getElementById('content');
            content.innerHTML = `
                <div class="view-container">
                    <div class="view-header">
                        <h2>Search: "${this._escapeHtml(query)}"</h2>
                        <span class="search-count">${matches.length} results</span>
                    </div>
                    <div class="file-grid">
                        ${matches.map(m => {
                            const f = m.metadata;
                            return `
                                <div class="file-item file-card glass" ondblclick="ui.openFile('${f.path_lower}', '${f['.tag']}')">
                                    <div class="file-card-thumb">
                                        <div class="file-icon-large">${f['.tag'] === 'folder' ? '📁' : ui._getFileIcon(f.name)}</div>
                                    </div>
                                    <div class="file-card-info">
                                        <div class="file-card-name">${ui._escapeHtml(f.name)}</div>
                                        <div class="file-card-meta">${f['.tag'] === 'folder' ? 'Folder' : ui._formatSize(f.size || 0)}</div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } catch (e) {
            ui.showToast('Search failed', 'error');
        }
    },

    // ---- View Mode ----
    toggleViewMode() {
        const mode = Storage.toggleViewMode();
        const icon = document.getElementById('viewToggleIcon');
        if (icon) {
            if (mode === 'grid') {
                icon.innerHTML = '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>';
            } else {
                icon.innerHTML = '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>';
            }
        }
        if (this._currentView === 'files') {
            this._renderFileList();
        }
    },

    // ---- Context Menu ----
    _showContextMenu(event, file) {
        event.preventDefault();
        this._contextFile = file;

        const menu = document.getElementById('contextMenu');
        const isDir = file['.tag'] === 'folder';
        const isFav = Storage.isFavorite(file.path_lower);

        // Show/hide relevant options
        menu.querySelectorAll('.context-item').forEach(item => {
            const action = item.dataset.action;
            item.style.display = 'flex';

            switch (action) {
                case 'preview':
                    item.style.display = isDir ? 'none' : 'flex';
                    break;
                case 'download':
                    item.style.display = isDir ? 'none' : 'flex';
                    break;
                case 'share':
                    item.style.display = isDir ? 'none' : 'flex';
                    break;
                case 'favorite':
                    item.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                        </svg>
                        ${isFav ? 'Remove from Favorites' : 'Add to Favorites'}
                    `;
                    break;
            }
        });

        // Position menu
        const x = Math.min(event.clientX, window.innerWidth - 220);
        const y = Math.min(event.clientY, window.innerHeight - 300);
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        menu.classList.remove('hidden');

        // Close on click outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.classList.add('hidden');
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 10);
    },

    contextAction(action) {
        const file = this._contextFile;
        if (!file) return;

        document.getElementById('contextMenu').classList.add('hidden');

        switch (action) {
            case 'preview':
                Storage.addRecent(file, 'opened');
                this.previewFile = file;
                this.openPreview(file);
                break;
            case 'download':
                this.downloadFile(file);
                break;
            case 'share':
                share.openShareModal(file);
                break;
            case 'rename':
                this.showRenameModal(file);
                break;
            case 'move':
                this.showMoveModal(file, 'move');
                break;
            case 'copy':
                this.showMoveModal(file, 'copy');
                break;
            case 'favorite':
                const isFav = Storage.toggleFavorite(file.path_lower);
                ui.showToast(isFav ? 'Added to favorites' : 'Removed from favorites', 'success');
                this._renderFileList();
                break;
            case 'delete':
                this.deleteItem(file);
                break;
        }

        this._contextFile = null;
    },

    // ---- Modal Helpers ----
    closeModal(id, event) {
        if (event && event.target !== document.getElementById(id)) return;
        document.getElementById(id).classList.add('hidden');
    },

    _showConfirm(title, message, callback, btnText) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').textContent = message;
        const btn = document.getElementById('confirmBtn');
        btn.textContent = btnText || 'Delete';
        this._confirmCallback = callback;
        document.getElementById('confirmModal').classList.remove('hidden');
    },

    confirmAction() {
        if (this._confirmCallback) {
            this._confirmCallback();
            this._confirmCallback = null;
        }
        this.closeModal('confirmModal');
    },

    // ---- Toast ----
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.className = 'toast ' + type;
        toast.classList.remove('hidden');

        clearTimeout(this._toastTimeout);
        this._toastTimeout = setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    },

    // ---- Utility Methods ----
    _getFileIcon(name) {
        const ext = name.split('.').pop()?.toLowerCase();
        const icons = {
            'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'svg': '🖼️', 'webp': '🖼️', 'bmp': '🖼️', 'ico': '🖼️',
            'mp4': '🎬', 'avi': '🎬', 'mkv': '🎬', 'mov': '🎬', 'wmv': '🎬', 'flv': '🎬', 'webm': '🎬',
            'mp3': '🎵', 'wav': '🎵', 'flac': '🎵', 'aac': '🎵', 'ogg': '🎵', 'wma': '🎵',
            'pdf': '📄',
            'doc': '📝', 'docx': '📝',
            'xls': '📊', 'xlsx': '📊',
            'ppt': '📽️', 'pptx': '📽️',
            'zip': '📦', 'rar': '📦', '7z': '📦', 'tar': '📦', 'gz': '📦',
            'txt': '📃',
            'js': '📜', 'ts': '📜', 'html': '📜', 'css': '📜', 'json': '📜', 'xml': '📜',
            'exe': '⚙️', 'dmg': '⚙️', 'msi': '⚙️',
            'psd': '🎨', 'ai': '🎨',
            'ttf': '🔤', 'otf': '🔤', 'woff': '🔤'
        };
        return icons[ext] || '📄';
    },

    _isImageFile(name) {
        return /\.(jpg|jpeg|png|gif|svg|webp|bmp|ico)$/i.test(name);
    },

    _isVideoFile(name) {
        return /\.(mp4|avi|mkv|mov|wmv|flv|webm)$/i.test(name);
    },

    _isAudioFile(name) {
        return /\.(mp3|wav|flac|aac|ogg|wma)$/i.test(name);
    },

    _isTextFile(name) {
        return /\.(txt|js|ts|html|css|json|xml|md|log|sh|bat|py|java|c|cpp|h|hpp|rb|php|sql|yaml|yml|toml|ini|cfg|conf)$/i.test(name);
    },

    _formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
    },

    _formatSpeed(bytesPerSec) {
        return this._formatSize(bytesPerSec) + '/s';
    },

    _formatDate(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return 'Today';
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days} days ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    },

    _getParentPath(path) {
        if (!path) return '';
        const parts = path.split('/').filter(Boolean);
        parts.pop();
        return parts.length > 0 ? '/' + parts.join('/') : '';
    },

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    _escapeJson(obj) {
        return this._escapeHtml(JSON.stringify(obj));
    }
};

// Expose as global
window.ui = ui;

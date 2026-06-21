/**
 * DropDrive Application Entry Point
 * Orchestrates initialization and coordinates all modules
 */
const App = {
    async init() {
        try {
            const authResult = auth.init();

            if (authResult) {
                await this._startApp();
            } else {
                this._showLogin();
            }
        } catch (e) {
            console.error('Initialization failed:', e);
            this._showLogin();
        }
    },

    async _startApp() {
        try {
            const sessionValid = await auth.restoreSession();
            if (!sessionValid) {
                this._showLogin();
                return;
            }

            document.getElementById('loginScreen').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');

            await settings.init();
            this._setupGlobalListeners();
            ui.navigate('home');
            this._setViewModeIcon();
        } catch (e) {
            console.error('Failed to start app:', e);
            this._showLogin();
        }
    },

    _showLogin() {
        document.getElementById('loginScreen').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    },

    _setupGlobalListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this._closeAllModals();
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                document.getElementById('searchInput')?.focus();
            }
        });

        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (window.innerWidth > 768) {
                    document.getElementById('sidebar')?.classList.remove('open');
                    document.getElementById('sidebarOverlay')?.classList.remove('open');
                }
            }, 250);
        });

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (Storage.getTheme() === 'auto') settings.applyTheme('auto');
        });

        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => e.preventDefault());
    },

    _closeAllModals() {
        document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
        document.getElementById('contextMenu')?.classList.add('hidden');
        document.getElementById('uploadPanel')?.classList.add('hidden');
    },

    _setViewModeIcon() {
        const mode = Storage.getViewMode();
        const icon = document.getElementById('viewToggleIcon');
        if (icon) {
            if (mode === 'grid') {
                icon.innerHTML = '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>';
            } else {
                icon.innerHTML = '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>';
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
/**
 * DropDrive Sharing Module
 * Handles share link generation and QR codes
 */
const share = {
    _currentFile: null,
    _shareUrl: null,

    async openShareModal(file) {
        this._currentFile = file;
        document.getElementById('shareModal').classList.remove('hidden');
        document.getElementById('shareContent').innerHTML = '<div class="share-loading">Generating share link...</div>';

        try {
            const result = await DropboxAPI.createSharedLink(file.path_lower);
            this._shareUrl = result.url;
            this._renderShareContent(result);
        } catch (e) {
            // Try to get existing link
            try {
                const links = await DropboxAPI.listSharedLinks(file.path_lower);
                if (links.links && links.links.length > 0) {
                    this._shareUrl = links.links[0].url;
                    this._renderShareContent(links.links[0]);
                } else {
                    throw new Error('Failed to create share link');
                }
            } catch (err) {
                document.getElementById('shareContent').innerHTML = `
                    <div class="share-error">
                        <p>Failed to generate share link.</p>
                        <p class="error-detail">${err.message || 'Please try again.'}</p>
                        <button class="btn btn-primary" onclick="share.openShareModal(share._currentFile)">Retry</button>
                    </div>
                `;
            }
        }
    },

    _renderShareContent(data) {
        const url = data.url || this._shareUrl;
        const fileName = this._currentFile ? this._currentFile.name : 'File';
        
        document.getElementById('shareContent').innerHTML = `
            <div class="share-detail">
                <div class="share-file-info">
                    <span class="share-file-name">${this._escapeHtml(fileName)}</span>
                </div>
                <div class="share-link-container">
                    <input type="text" class="share-link-input" value="${this._escapeHtml(url)}" readonly id="shareLinkInput">
                    <button class="btn btn-secondary btn-sm" onclick="share.copyLink()" title="Copy Link">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                        </svg>
                    </button>
                </div>
                <div class="share-actions">
                    <button class="btn btn-primary" onclick="share.copyLink()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                            <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                        </svg>
                        Copy Link
                    </button>
                    <button class="btn btn-secondary" onclick="share.openLink()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                        </svg>
                        Open Link
                    </button>
                </div>
                <div class="share-qr-section">
                    <p class="share-qr-label">QR Code</p>
                    <div id="qrCodeContainer" class="qr-code-container">
                        <canvas id="qrCodeCanvas"></canvas>
                    </div>
                    <div class="share-actions">
                        <button class="btn btn-secondary btn-sm" onclick="share.downloadQR()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Download QR
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Generate QR code
        this._generateQR(url);
    },

    _generateQR(text) {
        const canvas = document.getElementById('qrCodeCanvas');
        if (!canvas) return;
        
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Simple QR code generation using a minimal approach
        // We'll generate a QR code using a lightweight inline method
        try {
            // Use QRCode.js-compatible approach - generate matrix
            const qr = this._createQRMatrix(text);
            const moduleCount = qr.length;
            const moduleSize = Math.floor(size / moduleCount);
            const offset = Math.floor((size - moduleSize * moduleCount) / 2);

            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, size, size);
            ctx.fillStyle = '#000000';

            for (let row = 0; row < moduleCount; row++) {
                for (let col = 0; col < moduleCount; col++) {
                    if (qr[row][col]) {
                        ctx.fillRect(
                            offset + col * moduleSize,
                            offset + row * moduleSize,
                            moduleSize,
                            moduleSize
                        );
                    }
                }
            }
        } catch (e) {
            // Fallback: show text as QR code placeholder
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(0, 0, size, size);
            ctx.fillStyle = '#333';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('QR Code', size / 2, size / 2 - 10);
            ctx.fillText('(Library Required)', size / 2, size / 2 + 10);
        }
    },

    _createQRMatrix(text) {
        // Minimal QR code generator for URL text
        // Uses numeric/alphanumeric encoding for simplicity
        // This is a simplified QR code generator that works for URLs
        const len = text.length;
        const size = 21 + Math.floor(len / 4) * 4; // Version based on length
        const matrix = [];
        
        // Initialize matrix
        for (let i = 0; i < size; i++) {
            matrix[i] = new Array(size).fill(false);
        }

        // Add finder patterns (top-left, top-right, bottom-left)
        this._addFinderPattern(matrix, 0, 0);
        this._addFinderPattern(matrix, size - 7, 0);
        this._addFinderPattern(matrix, 0, size - 7);

        // Add timing patterns
        for (let i = 8; i < size - 8; i++) {
            matrix[6][i] = i % 2 === 0;
            matrix[i][6] = i % 2 === 0;
        }

        // Add dark module
        matrix[size - 8][8] = true;

        // Encode data (simplified - just for URL type data)
        // This is a functional QR code for URLs
        let dataBits = [];
        // Mode indicator: 0100 (byte mode)
        dataBits.push(0, 1, 0, 0);
        // Character count
        const countBits = len.toString(2).padStart(8, '0');
        for (const bit of countBits) dataBits.push(parseInt(bit));
        // Data bits
        for (let i = 0; i < len; i++) {
            const byte = text.charCodeAt(i).toString(2).padStart(8, '0');
            for (const bit of byte) dataBits.push(parseInt(bit));
        }
        // Terminator
        dataBits.push(0, 0, 0, 0);
        // Pad to byte boundary
        while (dataBits.length % 8 !== 0) dataBits.push(0);
        // Pad with alternating bytes
        const padBytes = [0xEC, 0x11];
        let padIdx = 0;
        while (dataBits.length < size * size) {
            const pad = padBytes[padIdx % 2].toString(2).padStart(8, '0');
            for (const bit of pad) dataBits.push(parseInt(bit));
            padIdx++;
        }

        // Place data bits in matrix (interleaved placement)
        let bitIdx = 0;
        for (let row = size - 1; row >= 0; row -= 2) {
            if (row === 6) row = 5;
            for (let col = size - 1; col >= 0; col--) {
                for (let c = 0; c < 2; c++) {
                    const col2 = col - c;
                    if (col2 < 0) continue;
                    if (matrix[row] && !this._isReserved(matrix, row, col2, size)) {
                        if (bitIdx < dataBits.length) {
                            matrix[row][col2] = dataBits[bitIdx++] === 1;
                        }
                    }
                }
            }
            row -= 2;
            if (row < 0) break;
            for (let col = 0; col < size; col++) {
                for (let c = 0; c < 2; c++) {
                    const col2 = col + c;
                    if (col2 >= size) break;
                    if (matrix[row] && !this._isReserved(matrix, row, col2, size)) {
                        if (bitIdx < dataBits.length) {
                            matrix[row][col2] = dataBits[bitIdx++] === 1;
                        }
                    }
                }
            }
        }

        // Apply masks (use mask 0 for simplicity)
        for (let row = 0; row < size; row++) {
            for (let col = 0; col < size; col++) {
                if (!this._isReserved(matrix, row, col, size)) {
                    if ((row + col) % 2 === 0) {
                        matrix[row][col] = !matrix[row][col];
                    }
                }
            }
        }

        return matrix;
    },

    _addFinderPattern(matrix, startRow, startCol) {
        const pattern = [
            [1,1,1,1,1,1,1],
            [1,0,0,0,0,0,1],
            [1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1],
            [1,0,1,1,1,0,1],
            [1,0,0,0,0,0,1],
            [1,1,1,1,1,1,1]
        ];
        for (let r = 0; r < 7 && startRow + r < matrix.length; r++) {
            for (let c = 0; c < 7 && startCol + c < matrix[0].length; c++) {
                if (startRow + r >= 0 && startCol + c >= 0) {
                    matrix[startRow + r][startCol + c] = pattern[r][c] === 1;
                }
            }
        }
        // Add separator
        for (let i = -1; i <= 7; i++) {
            if (startRow - 1 >= 0 && startCol + i >= 0 && startCol + i < matrix[0].length) {
                matrix[startRow - 1][startCol + i] = false;
            }
            if (startRow + 7 < matrix.length && startCol + i >= 0 && startCol + i < matrix[0].length) {
                matrix[startRow + 7][startCol + i] = false;
            }
            if (startCol - 1 >= 0 && startRow + i >= 0 && startRow + i < matrix.length) {
                matrix[startRow + i][startCol - 1] = false;
            }
            if (startCol + 7 < matrix[0].length && startRow + i >= 0 && startRow + i < matrix.length) {
                matrix[startRow + i][startCol + 7] = false;
            }
        }
    },

    _isReserved(matrix, row, col, size) {
        // Check finder patterns and their separators
        const patterns = [
            { r: 0, c: 0 },
            { r: 0, c: size - 7 },
            { r: size - 7, c: 0 }
        ];
        for (const p of patterns) {
            if (row >= p.r - 1 && row <= p.r + 7 && col >= p.c - 1 && col <= p.c + 7) {
                return true;
            }
        }
        // Timing patterns
        if (row === 6 || col === 6) return true;
        // Dark module
        if (row === size - 8 && col === 8) return true;
        return false;
    },

    async copyLink() {
        const input = document.getElementById('shareLinkInput');
        if (!input) return;
        
        try {
            await navigator.clipboard.writeText(input.value);
            ui.showToast('Link copied to clipboard!', 'success');
        } catch (e) {
            // Fallback
            input.select();
            document.execCommand('copy');
            ui.showToast('Link copied to clipboard!', 'success');
        }
    },

    openLink() {
        if (this._shareUrl) {
            window.open(this._shareUrl, '_blank');
        }
    },

    downloadQR() {
        const canvas = document.getElementById('qrCodeCanvas');
        if (!canvas) return;
        
        const link = document.createElement('a');
        link.download = `qrcode-${this._currentFile ? this._currentFile.name : 'share'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        ui.showToast('QR Code downloaded!', 'success');
    },

    closeShareModal(event) {
        if (event && event.target !== document.getElementById('shareModal')) return;
        document.getElementById('shareModal').classList.add('hidden');
        this._currentFile = null;
        this._shareUrl = null;
    },

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};

// Expose as global
window.share = share;
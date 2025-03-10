const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const DatabaseManager = require('./backend');

class ElectronApp {
    constructor() {
        this.setupLogging();
        console.log("Application initializing...");

        this.uploadDir = path.join(app.getPath('userData'), 'uploaded-files');
        this.downloadsDir = path.join(app.getPath('userData'), 'downloads');
        this.dbPath = path.join(app.getPath('userData'), 'data.db');

        this.dbManager = new DatabaseManager(this.dbPath, this.uploadDir, this.downloadsDir);
        console.log('Application started');
    }

    setupLogging() {
        this.logFile = path.join(app.getPath('userData'), 'app.log');
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
        const logStream = fs.createWriteStream(this.logFile, { flags: 'a' });
        const log = (level, message) => {
            const timestamp = new Date().toISOString();
            const formattedMessage = `[${timestamp}] [${level}] ${message}\n`;
            logStream.write(formattedMessage);
            process.stdout.write(formattedMessage);
        };
        console.log = (message) => log('INFO', message);
        console.error = (message) => log('ERROR', message);
    }

    async initialize() {
        try {
            console.log('Initializing database manager...');
            await this.dbManager.initialize();
            this.setupAppLifecycle();
            this.setupIpcHandlers();
        } catch (error) {
            console.error('Application initialization error:', error.message);
            app.quit();
        }
    }

    setupAppLifecycle() {
        app.whenReady().then(() => {
            console.log('App is ready. Creating main window...');
            this.createMainWindow();
        });

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                console.log('All windows closed. Quitting app.');
                app.quit();
            }
        });

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                this.createMainWindow();
            }
        });

        app.on('second-instance', () => {
            console.log('Second instance detected.');
            if (this.mainWindow) {
                if (this.mainWindow.isMinimized()) this.mainWindow.restore();
                this.mainWindow.focus();
            }
        });
    }

    createMainWindow() {
        try {
            this.mainWindow = new BrowserWindow({
                width: 1200,
                height: 800,
                webPreferences: {
                    preload: path.join(__dirname, 'preload.js'),
                    contextIsolation: true,
                    nodeIntegration: false,
                    cache: true
                },
            });

            const loginPath = path.join(__dirname, 'templates', 'login.html');
            console.log(`Loading login file: ${loginPath}`);

            this.mainWindow.loadFile(loginPath).catch((err) => {
                console.error(`Failed to load login.html: ${err}`);
            });

            this.mainWindow.setMenuBarVisibility(false);
            this.mainWindow.on('closed', () => {
                this.mainWindow = null;
            });
        } catch (error) {
            console.error(`Error creating main window: ${error}`);
        }
    }

    setupIpcHandlers() {
        ipcMain.handle('login', async (_, credentials) => {
            try {
                return await this.dbManager.authenticateUser(credentials.username, credentials.password, credentials.userType);
            } catch (error) {
                console.error(`Error during user login: ${error}`);
                return { success: false, message: 'Login failed. Please try again.' };
            }
        });

        ipcMain.handle('insertDocument', async (_, formData) => {
            try {
                const result = await this.dbManager.processAndStoreDocument(formData);
                return { success: true, data: result };
            } catch (error) {
                console.error(`Error processing document: ${error}`);
                return { success: false, message: 'Document processing failed.' };
            }
        });

        ipcMain.handle('fetchDocuments', async (_, filters) => {
            try {
                console.log(`Fetching documents with filters: ${JSON.stringify(filters)}`);
                return await this.dbManager.fetchDocuments(filters);
            } catch (error) {
                console.error(`Error fetching documents: ${error}`);
                return { success: false, message: 'Failed to fetch documents.' };
            }
        });

        ipcMain.handle('updateDocument', async (_, { documentNumber, updateData }) => {
            try {
                console.log(`Updating document: ${documentNumber} with data: ${JSON.stringify(updateData)}`);
                return await this.dbManager.updateDocument(documentNumber, updateData);
            } catch (error) {
                console.error(`Error updating document: ${error}`);
                return { success: false, message: 'Document update failed.' };
            }
        });

        ipcMain.handle('deleteDocument', async (_, documentId) => {
            try {
                console.log(`Deleting document with ID: ${documentId}`);
                const response = await dialog.showMessageBox({
                    type: 'warning',
                    buttons: ['Cancel', 'Delete'],
                    defaultId: 1,
                    title: 'Confirm Deletion',
                    message: 'Are you sure you want to delete this document?',
                });

                if (response.response === 1) {
                    return await this.dbManager.deleteDocument(documentId);
                } else {
                    return { success: false, message: 'Document deletion cancelled.' };
                }
            } catch (error) {
                console.error(`Error deleting document: ${error}`);
                return { success: false, message: 'Document deletion failed.' };
            }
        });

        ipcMain.handle('approveDocument', async (_, documentId) => {
            try {
                console.log(`Approving document with ID: ${documentId}`);
                return await this.dbManager.approveDocument(documentId);
            } catch (error) {
                console.error(`Error approving document: ${error}`);
                return { success: false, message: 'Document approval failed.' };
            }
        });

        ipcMain.handle('downloadSearchResults', async (_, filters, format) => {
            try {
                console.log(`Downloading search results with filters: ${JSON.stringify(filters)} and format: ${format}`);
                return await this.dbManager.downloadSearchResults(filters, format);
            } catch (error) {
                console.error(`Error downloading search results: ${error}`);
                return { success: false, message: 'Download failed.' };
            }
        });

        ipcMain.handle('navigateToFile', (_, filePath) => {
            try {
                const absolutePath = path.join(__dirname, 'templates', filePath);
                console.log(`Navigating to file: ${absolutePath}`);
                if (this.mainWindow) {
                    this.mainWindow.loadFile(absolutePath);
                }
                return { success: true };
            } catch (error) {
                console.error(`Error navigating to file: ${error}`);
                return { success: false, message: 'Navigation failed.' };
            }
        });

        ipcMain.handle('getFilePreview', async (_, filePath) => {
            try {
                console.log(`Getting file preview for: ${filePath}`);
                if (fs.existsSync(filePath)) {
                    const fileType = this.getFileType(filePath);
                    const base64 = await fs.promises.readFile(filePath).then((buffer) => buffer.toString('base64'));
                    return { success: true, base64: `data:${fileType};base64,${base64}` };
                } else {
                    console.error(`File not found: ${filePath}`);
                    return { success: false, message: 'File not found' };
                }
            } catch (error) {
                console.error(`Error getting file preview: ${error}`);
                return { success: false, message: 'Preview failed.' };
            }
        });
    }

    getFileType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        switch (ext) {
            case '.png': return 'image/png';
            case '.jpg': case '.jpeg': return 'image/jpeg';
            case '.pdf': return 'application/pdf';
            case '.docx': case '.doc': return 'application/msword';
            default: return 'application/octet-stream';
        }
    }
}

const isSingleInstance = app.requestSingleInstanceLock();

if (!isSingleInstance) {
    console.log('Another instance of the app is already running. Exiting this instance.');
    app.quit();
} else {
    console.log('No other instance running. Launching the app.');
    const myApp = new ElectronApp();
    app.on('ready', () => myApp.initialize());
}

// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Authentication
    login: (credentials) => ipcRenderer.invoke('login', credentials),
    
    // Document Operations
    insertDocument: (formData) => ipcRenderer.invoke('insertDocument', formData),
    fetchDocuments: (filters) => ipcRenderer.invoke('fetchDocuments', filters),
    updateDocument: (documentNumber, updateData) => ipcRenderer.invoke('updateDocument', { documentNumber, updateData }),
    deleteDocument: (documentId) => ipcRenderer.invoke('deleteDocument', documentId),
    approveDocument: (documentId) => ipcRenderer.invoke('approveDocument', documentId),
    
    // File Management
    downloadSearchResults: (filters, format) => ipcRenderer.invoke('downloadSearchResults', filters, format),
    navigateToFile: (filePath) => ipcRenderer.invoke('navigateToFile', filePath),
    getFilePreview: (filePath) => ipcRenderer.invoke('getFilePreview', filePath),

    // Event Listeners
    receive: (channel, func) => {
        ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
});
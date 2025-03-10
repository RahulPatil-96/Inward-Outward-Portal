const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');
const pdfParser = require('pdf-parse');
const mammoth = require('mammoth');
const XLSX = require('xlsx');
const { spawn } = require('child_process');

class DatabaseManager {
    constructor(dbPath, uploadDir, downloadsDir) {
        this.dbPath = dbPath;
        this.uploadDir = uploadDir;
        this.downloadsDir = downloadsDir;

        if (!fs.existsSync(this.uploadDir)) {
            fs.mkdirSync(this.uploadDir, { recursive: true });
        }
        if (!fs.existsSync(this.downloadsDir)) {
            fs.mkdirSync(this.downloadsDir, { recursive: true });
        }
    }

    async initialize() {
        try {
            this.db = await this.connectDatabase();
            await this.createTables();
            await this.initializeDefaultUsers();
        } catch (err) {
            console.error('Error during initialization:', err);
            throw err;
        }
    }

    connectDatabase() {
        return new Promise((resolve, reject) => {
            const db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) return reject(err);
                db.run("PRAGMA journal_mode=WAL;", (err) => {
                    err ? reject(err) : resolve(db);
                });
            });
        });
    }

    async createTables() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run(
                    `CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        username TEXT UNIQUE NOT NULL,
                        password TEXT NOT NULL,
                        role TEXT,
                        user_type TEXT
                    );`,
                    (err) => {
                        if (err) return reject(err);
                        this.db.run(
                            `CREATE TABLE IF NOT EXISTS documents (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                flow_type TEXT,
                                document_number TEXT UNIQUE NOT NULL,
                                date TEXT,
                                time TEXT,
                                recipient TEXT,
                                document_type TEXT,
                                file_name TEXT,
                                file_path TEXT,
                                description TEXT,
                                status TEXT DEFAULT 'pending'
                            );`,
                            (err) => err ? reject(err) : resolve()
                        );
                    }
                );
            });
        });
    }

    async initializeDefaultUsers() {
        const defaultUsers = [
            { username: 'cyber_ps', password: 'cyber_ps123', role: 'admin', user_type: 'admin' },
            { username: 'user', password: 'user123', role: 'user', user_type: 'standard' },
        ];

        for (const user of defaultUsers) {
            try {
                await this.registerUser(user);
            } catch (err) {
                console.warn(`User init error: ${user.username}`, err.message);
            }
        }
    }

    async registerUser({ username, password, role, user_type }) {
        const hashedPassword = await bcrypt.hash(password, 10);
        return new Promise((resolve, reject) => {
            this.db.run(
                `INSERT OR IGNORE INTO users (username, password, role, user_type) 
                VALUES (?, ?, ?, ?)`,
                [username, hashedPassword, role, user_type],
                function (err) {
                    err ? reject(err) : resolve({ id: this.lastID });
                }
            );
        });
    }

    async authenticateUser(username, password, userType) {
        return new Promise((resolve, reject) => {
            this.db.get(
                `SELECT * FROM users WHERE username = ? AND user_type = ?`,
                [username, userType],
                async (err, user) => {
                    if (err) return reject(err);
                    if (!user) return resolve({ success: false, message: 'User not found' });
                    
                    const isMatch = await bcrypt.compare(password, user.password);
                    resolve(isMatch ? 
                        { success: true, user } : 
                        { success: false, message: 'Incorrect password' }
                    );
                }
            );
        });
    }

    async fetchDocuments(filters = {}) {
        const conditions = [];
        const params = [];

        if (filters.documentNumber && filters.documentNumber.trim() !== '') {
            conditions.push('document_number = ?');
            params.push(filters.documentNumber);
        }
        if (filters.flowType && filters.flowType.trim() !== '') {
            conditions.push('flow_type = ?');
            params.push(filters.flowType);
        }
        if (filters.documentType && filters.documentType.trim() !== '') {
            conditions.push('document_type = ?');
            params.push(filters.documentType);
        }
        if (filters.dateFrom && filters.dateTo) {
            conditions.push("date BETWEEN ? AND ?");
            params.push(filters.dateFrom, filters.dateTo);
        } else if (filters.dateFrom) {
            conditions.push("date = ?");
            params.push(filters.dateFrom);
        } else if (filters.dateTo) {
            conditions.push("date = ?");
            params.push(filters.dateTo);
        }
        
        if (filters.recipient && filters.recipient.trim() !== '') {
            conditions.push('recipient LIKE ?');
            params.push(`%${filters.recipient}%`);
        }

        const query = `SELECT * FROM documents ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''};`;

        return new Promise((resolve, reject) => {
            this.db.all(query, params, (err, rows) => {
                if (err) {
                    console.error('Error fetching documents:', err);
                    return reject(err);
                }
                resolve(rows);
            });
        });
    }

    async updateDocument(documentNumber, updateData) {
        return new Promise((resolve, reject) => {
            console.log(`Fetching document with number: ${documentNumber}`);
    
            this.db.get('SELECT id, file_path, file_name FROM documents WHERE document_number = ?', [documentNumber], (err, doc) => {
                if (err) {
                    console.error("Error fetching document details:", err);
                    return reject({ success: false, message: 'Error fetching document details: ' + err.message });
                }
                if (!doc) {
                    console.warn("No document found with the given document number:", documentNumber);
                    return reject({ success: false, message: 'No document found with the given document number' });
                }
    
                const documentId = doc.id;
                const originalFilePath = doc.file_path; // Original file path of the document
                console.log(`original file path:${originalFilePath}`);
    
                if (updateData.fileContent) {
                    console.log("New file content provided. Proceeding to overwrite the existing file...");
                    const providedExtension = path.extname(updateData.fileName) || '.txt'; // Default to .txt if not provided
                    const finalFilePath = path.join(this.uploadDir, documentNumber + providedExtension);
    
                    console.log(`Final File Path to Save: ${finalFilePath}`);
    
                    if (fs.existsSync(originalFilePath)) {
                        fs.unlink(originalFilePath, (err) => {
                            if (err) {
                                console.error("Error deleting the old file:", err);
                                return reject({ success: false, message: 'Error deleting the old file: ' + err.message });
                            }
                            console.log(`Old file deleted: ${originalFilePath}`);
                        });
                    }
    
                    fs.writeFile(finalFilePath, Buffer.from(updateData.fileContent), (err) => {
                        if (err) {
                            console.error(`Error writing the new file at path:"${ finalFilePath}`, err);
                            return reject({ success: false, message: `Error writing new file: ${err.message }`});
                        }
                        console.log(`File successfully written at ${finalFilePath}`);
    
                        const stmt = this.db.prepare(
                            `UPDATE documents SET
                                date = ?, time = ?, recipient = ?,
                                document_type = ?, file_name = ?, 
                                file_path = ?, description = ?
                            WHERE id = ?`
                        );
    
                        stmt.run(
                            updateData.date,
                            updateData.time,
                            updateData.recipient,
                            updateData.documentType,
                            documentNumber + providedExtension, // Updated file name with correct extension
                            finalFilePath, // Updated file path (absolute path)
                            updateData.description || '', // Optional description
                            documentId, // Pass the fetched document ID for update
                            function (err) {
                                if (err) {
                                    console.error("Error in updating document:", err);
                                    return reject({ success: false, message: 'Database error: ' + err.message });
                                }
                                if (this.changes === 0) {
                                    console.warn("No document found or no changes made.");
                                    return reject({ success: false, message: "No document found with the given document ID or no changes made" });
                                }
                                console.log("Document updated successfully.");
                                resolve({ success: true });
                            }
                        );
    
                        stmt.finalize();
                    });
                } else {
                    console.log("No new file content provided. Updating database fields only...");
    
                    const stmt = this.db.prepare(
                        `UPDATE documents SET
                            date = ?, time = ?, recipient = ?,
                            document_type = ?, description = ?
                        WHERE id = ?`
                    );
    
                    stmt.run(
                        updateData.date,
                        updateData.time,
                        updateData.recipient,
                        updateData.documentType,
                        updateData.description || '', // Optional description
                        documentId, // Pass the fetched document ID for update
                        function ( err) {
                            if (err) {
                                console.error("Error in updating document:", err);
                                return reject({ success: false, message: 'Database error: ' + err.message });
                            }
                            if (this.changes === 0) {
                                console.warn("No document found or no changes made.");
                                return reject({ success: false, message: "No document found with the given document ID or no changes made" });
                            }
                            console.log("Document updated successfully without new file.");
                            resolve({ success: true });
                        }
                    );
    
                    stmt.finalize();
                }
            });
        });
    }                         

    deleteDocument(documentId) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT file_path FROM documents WHERE id = ?', [documentId], (err, doc) => {
                if (err) return reject(err);
                if (doc) {
                    fs.unlink(doc.file_path, (err) => {
                        if (err) {
                            return reject(err); // Handle error deleting file
                        }
                    });
                }
            });
    
            this.db.run('DELETE FROM documents WHERE id = ?', [documentId], function (err) {
                if (err) return reject(err);
                resolve({ success: true });
            });
        });
    }        
    
    approveDocument(documentId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                `UPDATE documents SET status = 'approved' WHERE id = ?`,
                [documentId],
                function (err) {
                    if (err) return reject(err);
                    resolve({ success: true });
                }
            );
        });
    }

    async exportToExcel(documents, outputPath) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Documents');

        worksheet.columns = [
            { header: 'Doc No', key: 'document_number' },
            { header: 'Flow', key: 'flow_type' },
            { header: 'Date', key: 'date' },
            { header: 'Time', key: 'time' },
            { header: 'Recipient', key: 'recipient' },
            { header: 'Type', key: 'document_type' },
            { header: 'File Name', key: 'file_name' },
            { header: 'File Path', key: 'file_path' },
            { header: 'Description', key: 'description' },
            { header: 'Status', key: 'status' },
        ];

        documents.forEach((doc) => {
            const filePath = doc.file_path;
            const hyperlink = `file:///${filePath.replace(/\\/g, '/')}`;

            worksheet.addRow({
                document_number: doc.document_number,
                flow_type: doc.flow_type,
                date: doc.date,
                time: doc.time,
                recipient: doc.recipient,
                document_type: doc.document_type,
                file_name: doc.file_name,
                file_path: { text: filePath, hyperlink: hyperlink },
                description: doc.description,
                status: doc.status,
            });
        });

        await workbook.xlsx.writeFile(outputPath);
        return outputPath;
    }

    async generatePDFFromExcel(excelPath, outputPath) {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(excelPath);
        const worksheet = workbook.worksheets[0];
    
        const doc = new PDFDocument();
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);
    
        doc.fontSize(20).text('Document Search Results', { align: 'center' });
        doc.moveDown();
    
        const tableTop = 100;
        const rowHeight = 20;
        const marginLeft = 50; // Starting x position for the columns
        let currentY = tableTop;
    
        const columnWidths = Array(worksheet.columns.length).fill(0);
        worksheet.eachRow((row) => {
            row.eachCell((cell, colNumber) => {
                const cellText = String(cell.text || cell.value || '');
                const cellWidth = doc.widthOfString(cellText);
                columnWidths[colNumber - 1] = Math.max(columnWidths[colNumber - 1], cellWidth);
            });
        });
    
        const cellPadding = 4;
    
        const headerCells = worksheet.getRow(1).values.slice(1);
        doc.fontSize(10).font('Helvetica-Bold');
        headerCells.forEach((cell, index) => {
            const cellText = String(cell || '');
            const xPosition = marginLeft + columnWidths.slice(0, index).reduce((a, b) => a + b + cellPadding, 0);
            doc.rect(xPosition, currentY, columnWidths[index] + cellPadding * 2, rowHeight).stroke();
            doc.text(cellText, xPosition + cellPadding, currentY + cellPadding, {
                width: columnWidths[index] + cellPadding * 2,
                height: rowHeight,
                ellipsis: true,
                align: 'left'
            });
        });
        currentY += rowHeight;
    
        doc.font('Helvetica').fontSize(10);
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1) {
                row.eachCell((cell, colNumber) => {
                    const cellText = String(cell.text || cell.value || '');
                    const xPosition = marginLeft + columnWidths.slice(0, colNumber - 1).reduce((a, b) => a + b + cellPadding, 0);
                    doc.rect(xPosition, currentY, columnWidths[colNumber - 1] + cellPadding * 2, rowHeight).stroke();
                    doc.text(cellText, xPosition + cellPadding, currentY + cellPadding, {
                        width: columnWidths[colNumber - 1] + cellPadding * 2,
                        height: rowHeight,
                        ellipsis: true,
                        align: 'left'
                    });
                });
                currentY += rowHeight;
            }
        });
    
        doc.end();
    
        return new Promise((resolve, reject) => {
            stream.on('finish', () => resolve());
            stream.on('error', reject);
        });
    }

    async downloadSearchResults(filters, format) {
        const supportedFormats = ['excel', 'pdf'];
        if (!supportedFormats.includes(format)) {
            throw new Error('Unsupported format');
        }
    
        const documents = await this.fetchDocuments(filters);
        if (!documents || documents.length === 0) {
            throw new Error('No documents found');
        }
    
        let fileIndex = 1;
        let filePath;
        do {
            if (format === 'excel') {
                filePath = path.join(this.downloadsDir, `search_results${fileIndex}.xlsx`);
            } else if (format === 'pdf') {
                filePath = path.join(this.downloadsDir, `search_results${fileIndex}.pdf`);
            }
            fileIndex++;
        } while (fs.existsSync(filePath));
    
        try {
            if (format === 'excel') {
                await this.exportToExcel(documents, filePath);
                return { success: true, path: filePath };
            } else if (format === 'pdf') {
                const excelPath = path.join(this.downloadsDir, 'search_results_temp.xlsx');
                await this.exportToExcel(documents, excelPath);
                await this.generatePDFFromExcel(excelPath, filePath);
                fs.unlinkSync(excelPath);
                return { success: true, path: filePath };
            }
        } catch (err) {
            console.error('Error during download:', err);
            return { success: false, message: err.message };
        }
    }
}

module.exports = DatabaseManager;
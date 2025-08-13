# Inward-Outward Document Management System

## Overview
Inward-Outward Portal is a desktop application built with Electron that provides a comprehensive document management system for tracking inward and outward documents. It supports user authentication, document insertion, updating, approval, deletion, and searching. The app also manages file uploads and downloads, with export options to Excel and PDF formats. It includes automated backup scheduling and detailed logging for reliability.

## Features
- User authentication with role-based access (admin and standard users)
- Manage inward and outward documents with metadata (document number, date, recipient, type, description, status)
- Upload and store document files securely
- Search and filter documents by multiple criteria
- Update and approve documents
- Delete documents with confirmation
- Export search results to Excel or PDF
- File preview and navigation within the app
- Automated backup of database and uploaded files
- Detailed logging of application events
- Cross-platform desktop app powered by Electron and SQLite

## Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (version 16 or higher recommended)
- npm (comes with Node.js)

### Setup
1. Clone or download the repository.
2. Open a terminal in the project directory.
3. Run the following command to install dependencies:
   ```
   npm install
   ```

## Running the Application
To start the application in development mode, run:
```
npm start
```
This will launch the Electron app with logging enabled.

## Building the Application
To build a distributable installer for Windows, run:
```
npm run build
```
The output installer will be located in the `dist` directory.

## Project Structure
```
.
├── backend.js              # Database and backend logic (SQLite, document management)
├── main.js                 # Main Electron app initialization and IPC handlers
├── preload.js              # Preload script for Electron context isolation
├── render.js               # Renderer process script (UI logic)
├── package.json            # Project metadata and dependencies
├── assets/                 # Application icons and images
├── static/css/             # CSS stylesheets
├── templates/              # HTML templates for app UI
└── README.md               # This file
```

## Dependencies
- Electron: Desktop app framework
- SQLite3: Embedded database for document storage
- bcrypt: Password hashing for user authentication
- docx, exceljs, pdfkit: Document export and generation libraries

## Author
V&R

## License
ISC

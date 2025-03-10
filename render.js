document.addEventListener('DOMContentLoaded', () => {
    const currentPage = document.title;

    const Utils = {
        redirectTo: (page) => window.electronAPI.navigateToFile(page),
        showNotification: (message, type = 'info') => {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 5000);
        },
        resetForm: (form) => {
            form.reset();
            const filePreview = form.querySelector('#file-preview');
            if (filePreview) filePreview.innerHTML = '';
        }
    };

    // Utility function to create View/Delete buttons for files
    const createFileButton = (className, text, filePath, onClick) => {
        const button = document.createElement('button');
        button.classList.add(className);
        button.type = 'button';
        button.innerHTML = text === 'View' ? `<i class="fa fa-eye"></i> ${text}` : `<i class="fa fa-trash delete-doc"></i>`;
        button.style.marginRight = '10px';

        button.setAttribute('data-file', filePath);

        if (onClick) {
            button.addEventListener('click', onClick);
        } else {
            button.addEventListener('click', (event) => {
                const filePath = event.target.getAttribute('data-file');
                window.open(filePath, '_blank');
            });
        }
        return button;
    };

    // Function to update the flow type label dynamically
    const updateFlowTypeLabel = (flowType) => {
        const recipientLabel = document.querySelector('label[for="recipient"]');
        let iconElement = recipientLabel.querySelector('i');

        if (!iconElement) {
            iconElement = document.createElement('i');
            recipientLabel.insertBefore(iconElement, recipientLabel.firstChild);
        }

        if (!flowType) {
            recipientLabel.textContent = '';
            recipientLabel.appendChild(iconElement);
            iconElement.className = 'fas fa-user';
            recipientLabel.append(' Recipient');
        } else if (flowType === 'outward') {
            recipientLabel.textContent = '';
            recipientLabel.appendChild(iconElement);
            iconElement.className = 'fas fa-arrow-right';
            recipientLabel.append(' Forwarded To');
        } else {
            recipientLabel.textContent = '';
            recipientLabel.appendChild(iconElement);
            iconElement.className = 'fas fa-arrow-left';
            recipientLabel.append(' Received From');
        }
    };
    

    const handleOtherOption = (selectId, placeholder) => {
        const selectElement = document.getElementById(selectId);
    
        if (selectElement) {
            selectElement.addEventListener('change', function () {
                const selectedValue = selectElement.value;
    
                // If "Other" is selected, convert the select to an input field
                if (selectedValue === 'other') {
                    const inputElement = document.createElement('input');
                    inputElement.type = 'text';
                    inputElement.id = selectId + '-input';  // New ID for the input
                    inputElement.placeholder = placeholder;
                    inputElement.style.display = 'block';
                    inputElement.required = true;
    
                    // Insert the input field after the select element
                    selectElement.parentNode.appendChild(inputElement);
                    selectElement.style.display = 'none';  // Hide the select element
                } else {
                    // Revert to the original dropdown when not "Other"
                    const inputElement = document.getElementById(selectId + '-input');
                    if (inputElement) {
                        inputElement.remove();  // Remove the input field
                    }
    
                    selectElement.style.display = 'block';  // Show the select element again
                }
            });
        }
    };
    

    const setupTabNavigation = () => {
        document.querySelectorAll('.tab-btn').forEach((button) => {
            button.addEventListener('click', () => {
                const page = button.dataset.page;
                if (page) Utils.redirectTo(page);
                else console.warn('No page specified in data-page attribute.');
            });
        });
    };
    
    const setupHomeNavigation = () => {
        document.querySelectorAll('.home-icon').forEach((icon) => {
            icon.addEventListener('click', () => {
                Utils.redirectTo('dashboard.html');
                
                // const currentPage = window.location.pathname;
                // if (!currentPage.includes('login.html')) {
                //     Utils.redirectTo('dashboard.html');
                // }
            });
        });
    };    

    const setupLoginPage = () => {
        const loginForm = document.getElementById('loginForm');
        const passwordToggle = document.getElementById('togglePassword');
        const passwordInput = document.getElementById('password');
        const userTypeButtons = document.querySelectorAll('.tab-btn');
        const rememberMeCheckbox = document.getElementById('rememberMe');
    
        // Get user credentials from localStorage if available
        const savedUsername = localStorage.getItem('username');
        const savedPassword = localStorage.getItem('password');
        
        // Pre-fill login form if credentials are found
        if (savedUsername) {
            document.getElementById('username').value = savedUsername;
        }
        if (savedPassword) {
            document.getElementById('password').value = savedPassword;
            rememberMeCheckbox.checked = true; // Check the "Remember Me" checkbox
        }
    
        userTypeButtons.forEach((button) => {
            button.addEventListener('click', function () {
                userTypeButtons.forEach((btn) => btn.classList.remove('active'));
                this.classList.add('active');
            });
        });
    
        passwordToggle.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            passwordToggle.classList.toggle('fa-eye');
            passwordToggle.classList.toggle('fa-eye-slash');
        });
    
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const userType = document.querySelector('.tab-btn.active').dataset.type;
    
            try {
                const result = await window.electronAPI.login({ username, password, userType });
                if (result.success) Utils.redirectTo('dashboard.html');
                else Utils.showNotification(result.message, 'error');
            } catch (error) {
                Utils.showNotification('Login failed. Please try again.', 'error');
            }
        });
    };    

    const setupDashboardPage = () => {
        const loadDashboardStats = async () => {
            try {
                const documents = await window.electronAPI.fetchDocuments({});
                document.getElementById('total-documents').textContent = documents.length;
                document.getElementById('pending-documents').textContent = documents.filter(doc => doc.status === 'pending').length;
                document.getElementById('approved-documents').textContent = documents.filter(doc => doc.status === 'approved').length;
            } catch (error) {
                Utils.showNotification('Failed to load dashboard stats.', 'error');
            }
        };
    
        const setupLogoutButton = () => {
            const logoutButton = document.querySelector('.logout-btn');
            if (logoutButton) {
                logoutButton.addEventListener('click', function() {
                    window.location.href = 'login.html';
                });
            }
        };
    
        loadDashboardStats();
        setupLogoutButton();
    };

    const setupRegisterDocumentPage = () => {
        const registerForm = document.getElementById('register-form');
        const fileUpload = document.getElementById('file-upload');
        const flowTypeSelect = document.getElementById('flow-type');
        const documentNumberInput = document.getElementById('document-number');
        const recipientInput = document.getElementById('recipient');
        const customRecipientInput = document.getElementById('custom-recipient');
        const documentTypeInput = document.getElementById('document-type');
        const customDocumentTypeInput = document.getElementById('custom-document-type');
        const filePreview = document.getElementById('file-preview');
        const dateInput = document.getElementById('date');
        const timeInput = document.getElementById('time');
        const amPmSelect = document.getElementById('am-pm');
    
        // Set current date and time
        const now = new Date();
        dateInput.value = now.toISOString().split('T')[0];
        timeInput.value = now.toTimeString().split(' ')[0].slice(0, 5);
        amPmSelect.value = now.getHours() >= 12 ? 'PM' : 'AM';
    
        // Update flow type and document number dynamically
        flowTypeSelect.addEventListener('change', async () => {
            const flowType = flowTypeSelect.value;
            updateFlowTypeLabel(flowType);
    
            try {
                const documents = await window.electronAPI.fetchDocuments({ flowType });
                const maxID = documents.filter(doc => doc.flow_type === flowType).map(doc => parseInt(doc.document_number.split('-')[1])).sort((a, b) => b - a)[0] || 0;
                const nextNumber = maxID + 1;
                documentNumberInput.value = `${flowType === 'inward' ? 'IN' : 'OUT'}-${String(nextNumber).padStart(3, '0')}`;
            } catch (error) {
                Utils.showNotification('Failed to generate document number.', 'error');
            }
        });
    
        // Handle file upload preview
        fileUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const viewDocButton = createFileButton('view-doc', 'View', file.path);
                const deleteDocButton = createFileButton('delete-doc', 'Delete', file.path, () => {
                    filePreview.innerHTML = '';
                    fileUpload.value = '';
                    Utils.showNotification('Document deleted successfully!', 'success');
                });
    
                filePreview.innerHTML = '';
                filePreview.appendChild(viewDocButton);
                filePreview.appendChild(deleteDocButton);
            }
        });
    
        // Handle "Other" options for recipient and document type
        const handleOtherOption = (selectId, customInputId, placeholderText) => {
            const selectElement = document.getElementById(selectId);
            const customInputElement = document.getElementById(customInputId);
    
            selectElement.addEventListener('change', () => {
                if (selectElement.value === 'other') {
                    customInputElement.style.display = 'block';
                    customInputElement.placeholder = placeholderText;
                    customInputElement.focus();
                } else {
                    customInputElement.style.display = 'none';
                    customInputElement.value = '';
                }
            });
        };
    
        handleOtherOption('recipient', 'custom-recipient', 'Enter custom recipient');
        handleOtherOption('document-type', 'custom-document-type', 'Enter custom document type');
    
        // Handle form submission
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
    
            // Validate recipient
            let recipient = recipientInput.value === 'other' ? customRecipientInput.value.trim() : recipientInput.value;
            if (!recipient) {
                Utils.showNotification('Enter a valid recipient.', 'error');
                return;
            }
    
            // Validate document type
            let documentType = documentTypeInput.value === 'other' ? customDocumentTypeInput.value.trim() : documentTypeInput.value;
            if (!documentType) {
                Utils.showNotification('Enter a valid document type.', 'error');
                return;
            }
    
            // Collect form data
            const formData = {
                flowType: flowTypeSelect.value,
                documentNumber: documentNumberInput.value,
                date: dateInput.value,
                time: `${timeInput.value} ${amPmSelect.value}`,
                recipient: recipient,
                documentType: documentType,
                fileName: fileUpload.files[0]?.name || '',
                filePath: fileUpload.files[0]?.path || '',
                description: document.getElementById('description').value.trim(),
            };
    
            try {
                
                

                const result = await window.electronAPI.insertDocument(formData);
                if (result.success) {
                    Utils.showNotification('Document registered successfully!', 'success');
                    setTimeout(() => Utils.redirectTo('dashboard.html'), 300);
                } else {
                    Utils.showNotification(result.message, 'error');
                }
            } catch (error) {
                Utils.showNotification('Failed to register document.', 'error');
            }
        });
    };
    
        

    const setupEditDocumentPage = () => {
        const editForm = document.getElementById('edit-form');
        const searchButton = document.getElementById('search-btn');
        const documentDetails = document.getElementById('document-details');
        const currentFilePreview = document.getElementById('current-file-preview');
        const newFile = document.getElementById('new-file');
        const filePreview = document.getElementById('file-preview');
        const flowTypeSelect = document.getElementById('flow-type');
    
        // Initialize the flow type label based on the current selection
        updateFlowTypeLabel(flowTypeSelect.value);
    
        // Handle "Other" options for recipient and document type
        const handleOtherOption = (selectId, customInputId, placeholderText) => {
            const selectElement = document.getElementById(selectId);
            const customInputElement = document.getElementById(customInputId);
    
            selectElement.addEventListener('change', () => {
                if (selectElement.value === 'other') {
                    customInputElement.style.display = 'block';
                    customInputElement.placeholder = placeholderText;
                    customInputElement.focus();
                } else {
                    customInputElement.style.display = 'none';
                    customInputElement.value = ''; // Clear custom input
                }
            });
        };
    
        handleOtherOption('recipient', 'custom-recipient', 'Enter custom recipient');
        handleOtherOption('document-type', 'custom-document-type', 'Enter custom document type');
    
        const performSearch = async () => {
            const documentNumber = document.getElementById('document-number').value.trim();
            try {
                const documents = await window.electronAPI.fetchDocuments({ documentNumber });
                const doc = documents.find(document => document.document_number === documentNumber);
        
                if (doc) {
                    documentDetails.style.display = 'block';
        
                    // Select the dropdown elements
                    const documentTypeSelect = document.getElementById('document-type');
                    const recipientSelect = document.getElementById('recipient');
        
                     // Set fetched document_type
                if (doc.document_type) {
                    let optionExists = Array.from(documentTypeSelect.options).some(option => option.value === doc.document_type);
                    if (!optionExists) {
                        // Add the value temporarily if it doesn't exist
                        let newOption = new Option(doc.document_type, doc.document_type, true, true);
                        documentTypeSelect.add(newOption);
                    }
                    documentTypeSelect.value = doc.document_type;
                }
    
                // Set fetched recipient
                if (doc.recipient) {
                    let optionExists = Array.from(recipientSelect.options).some(option => option.value === doc.recipient);
                    if (!optionExists) {
                        // Add the value temporarily if it doesn't exist
                        let newOption = new Option(doc.recipient, doc.recipient, true, true);
                        recipientSelect.add(newOption);
                    }
                    recipientSelect.value = doc.recipient;
                }
        
                    // Populate other fields
                    flowTypeSelect.value = doc.flow_type || '';
                    updateFlowTypeLabel(flowTypeSelect.value);
        
                    document.getElementById('date').value = doc.date || '';
                    const [time, ampm] = (doc.time || '').split(' ');
                    document.getElementById('time').value = time || '';
                    document.getElementById('am-pm').value = ampm || '';
                    document.getElementById('description').value = doc.description || '';
        
                    console.log('Fetched Document:', doc);
        
                    // Handle file preview if file exists
                    if (doc.file_path) {
                        const viewDocButton = createFileButton('view-doc', 'View', doc.file_path);
                        currentFilePreview.innerHTML = ''; // Clear any previous content
                        currentFilePreview.appendChild(viewDocButton);
                    }
                } else {
                    Utils.showNotification('Document not found.', 'error');
                }
            } catch (error) {
                console.error('Error fetching document:', error);
                Utils.showNotification('Error fetching document.', 'error');
            }
        };      
    
        // Handle the search button click event
        searchButton.addEventListener('click', performSearch);
    
        // Handle the Enter key press in the document number input
        document.getElementById('document-number').addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent form submission
                performSearch(); // Call the search function
            }
        });
    
        // Handle the form submission for document update
        editForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // Get recipient and document type
            let recipient = document.getElementById('recipient').value.trim();
            if (recipient === 'other') {
                recipient = document.getElementById('custom-recipient').value.trim();
            }
    
            let documentType = document.getElementById('document-type').value.trim();
            if (documentType === 'other') {
                documentType = document.getElementById('custom-document-type').value.trim();
            }
    
            // Validation: Ensure custom inputs are provided when "Other" is selected
            if (recipient === '' && document.getElementById('recipient').value === 'other') {
                Utils.showNotification('Please enter a custom recipient.', 'error');
                return;
            }
    
            if (documentType === '' && document.getElementById('document-type').value === 'other') {
                Utils.showNotification('Please enter a custom document type.', 'error');
                return;
            }
    
            const documentNumber = document.getElementById('document-number').value;
            const fileContent = await getFileContent(newFile.files[0]); // Get file content
            const updateData = {
                flowType: flowTypeSelect.value || '',
                documentType: documentType,
                date: document.getElementById('date').value || '',
                time: `${document.getElementById('time').value} ${document.getElementById('am-pm').value}`,
                recipient: recipient,
                description: document.getElementById('description').value || '',
                fileContent: fileContent, // Include file content
                fileName: newFile.files[0]?.name || '',
                filePath: newFile.files[0]?.path || '',
            };
    
            try {
                const result = await window.electronAPI.updateDocument(documentNumber, updateData);
                if (result.success) {
                    Utils.showNotification('Document updated successfully!', 'success');
                    setTimeout(() => Utils.redirectTo('dashboard.html'), 300);
                } else {
                    Utils.showNotification(result.message, 'error');
                }
            } catch (error) {
                Utils.showNotification('Failed to update document.', 'error');
            }
        });
    
        // Update flow type label when the flow type is changed
        flowTypeSelect.addEventListener('change', () => updateFlowTypeLabel(flowTypeSelect.value));
    
        // Handle the cancel button click event to reset the form and hide document details
        document.getElementById('cancel-btn').addEventListener('click', () => {
            Utils.resetForm(editForm);
            documentDetails.style.display = 'none';
        });
    
        // Handle file input change event to create "View" and "Delete" buttons for the new file
        newFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                // Clear any previous file preview content
                filePreview.innerHTML = '';
    
                // Create "View" and "Delete" buttons for the new file
                const viewDocButton = createFileButton('view-doc', 'View', file.path);
                const deleteDocButton = createFileButton('delete-doc', 'Delete', file.path, () => {
                    filePreview.innerHTML = ''; // Clear preview area
                    newFile.value = ''; // Reset the file input
                    Utils.showNotification('Document deleted successfully!', 'success');
                });
    
                // Append the buttons to the file preview area
                filePreview.appendChild(viewDocButton);
                filePreview.appendChild(deleteDocButton);
            }
        });
    };
    
    // Function to get the file content as a buffer
    const getFileContent = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
            if (file) {
                reader.readAsArrayBuffer(file);
            } else {
                resolve(null);
            }
        });
    };
      

    const setupSearchDocumentPage = () => {
        const searchForm = document.getElementById('search-form');
        const resetBtn = document.getElementById('reset-btn');
        const searchResults = document.getElementById('search-results');
        const downloadButton = document.getElementById('download-btn');
        const downloadOptions = document.getElementById('download-options');
        const documentTypeSelect = document.getElementById('document-type');
        const customDocumentTypeInput = document.getElementById('custom-document-type');
        const recipientSelect = document.getElementById('recipient');
        const customRecipientInput = document.getElementById('custom-recipient');
        const flowTypeSelect = document.getElementById('flow-type');  // Assuming flow-type select exists in the DOM
    
        // Handle the 'other' options for custom recipient and document type
        handleOtherOption('recipient', 'custom-recipient', 'Enter custom recipient');
        handleOtherOption('document-type', 'custom-document-type', 'Enter custom document type');
    
        // Update flowType label when the flowType select changes
        flowTypeSelect.addEventListener('change', () => {
            updateFlowTypeLabel(flowTypeSelect.value);
        });
    
        // Initialize download button visibility
        downloadButton.style.display = 'none'; // Hide the download button initially

        resetBtn.addEventListener('click', () => {
            searchForm.reset();
            searchResults.innerHTML = '';
            downloadButton.style.display = 'none'; // Hide download button on reset
        });
    
        // Search form submission
        searchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
    
            const filters = {
                documentNumber: document.getElementById('document-number').value,
                flowType: flowTypeSelect.value,
                documentType: documentTypeSelect.value === 'other' ? customDocumentTypeInput.value : documentTypeSelect.value,
                recipient: recipientSelect.value === 'other' ? customRecipientInput.value : recipientSelect.value,
                dateFrom: document.getElementById('date-from').value,
                dateTo: document.getElementById('date-to').value,
            };
    
            const downloadSection = document.querySelector('.download-section');
            downloadSection.style.display = 'block'; // Show the download section
    
            try {
                const documents = await window.electronAPI.fetchDocuments(filters);
                displaySearchResults(documents);
    
                // Show the download button after results are displayed
                if (documents.length > 0) {
                    downloadButton.style.display = 'block';
                } else {
                    Utils.showNotification('No documents found.', 'info');
                }
            } catch (error) {
                Utils.showNotification('Error searching documents.', 'error');
            }
        });
    
        const displaySearchResults = (documents) => {
            searchResults.innerHTML = ''; // Clear any previous search results
    
            if (documents.length > 0) {
                const table = document.createElement('table');
                table.classList.add('search-results-table');
    
                const headerRow = document.createElement('tr');
                headerRow.innerHTML = `
                    <th>Doc No</th>
                    <th>Date & Time</th>
                    <th>Type</th>
                    <th>Recipient</th>
                    <th>Description</th>
                    <th>Actions</th>
                `;
                table.appendChild(headerRow);
    
                documents.forEach((doc) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${doc.document_number}</td>
                        <td>${doc.date} ${doc.time}</td>
                        <td>${doc.document_type}</td>
                        <td>${doc.recipient}</td>
                        <td>${doc.description}</td>
                        <td>
                            <button class="view-doc" data-id="${doc.id}" data-file="${doc.file_path}">
                                <i class="fa fa-eye"></i> View
                            </button>
                            <button class="approve-doc" data-id="${doc.id}">
                                <i class="fa fa-thumbs-up"></i> Approve
                            </button>
                            <button class="delete-doc" data-id="${doc.id}">
                                <i class="fa fa-trash"></i>
                            </button>
                        </td>
                    `;
                    table.appendChild(row);
                });
    
                searchResults.appendChild(table);
    
                // Add event listeners for the buttons in the newly created table
                documents.forEach((doc) => {
                    const row = table.querySelector(`tr:nth-child(${documents.indexOf(doc) + 2})`); // +2 to account for header row
                    row.querySelector('.view-doc').addEventListener('click', (event) => {
                        const filePath = event.target.getAttribute('data-file');
                        window.open(filePath, '_blank');
                    });
    
                    row.querySelector('.approve-doc').addEventListener('click', async () => {
                        const docId = doc.id;
                        try {
                            const result = await window.electronAPI.approveDocument(docId);
                            if (result.success) {
                                Utils.showNotification('Document approved successfully!', 'success');
                                row.remove(); // Remove the row from the table
                            } else {
                                Utils.showNotification(result.message, 'error');
                            }
                        } catch (error) {
                            Utils.showNotification('Failed to approve document.', 'error');
                        }
                    });
    
                    row.querySelector('.delete-doc').addEventListener('click', async () => {
                        const docId = doc.id;
                        try {
                            const result = await window.electronAPI.deleteDocument(docId);
                            if (result.success) {
                                Utils.showNotification('Document deleted successfully!', 'success');
                                row.remove(); // Remove the row from the table
                            } else {
                                Utils.showNotification(result.message, 'error');
                            }
                        } catch (error) {
                            Utils.showNotification('Failed to delete document.', 'error');
                        }
                    });
                });
            } else {
                searchResults.innerHTML = '<p>No results found.</p>';
            }
        };
    
        // Handle the download button click to toggle visibility of download options
        downloadButton.addEventListener('click', () => {
            downloadOptions.style.display = downloadOptions.style.display === 'none' ? 'block' : 'none';
        });
    
        // Handle the download format selection and file download
        const downloadOptionButtons = document.querySelectorAll('.download-option'); // Ensure this is defined
    
        downloadOptionButtons.forEach(button => {
            button.addEventListener('click', async (event) => {
                const format = event.target.getAttribute('data-value');
    
                // Prepare filters for the download request
                const filters = {
                    documentNumber: document.getElementById('document-number').value,
                    flowType: flowTypeSelect.value,
                    documentType: documentTypeSelect.value === 'other' ? customDocumentTypeInput.value : documentTypeSelect.value,
                    recipient: recipientSelect.value === 'other' ? customRecipientInput.value : recipientSelect.value,
                    dateFrom: document.getElementById('date-from').value,
                    dateTo: document.getElementById('date-to').value,
                };
    
                try {
                    const result = await window.electronAPI.downloadSearchResults(filters, format);
                    if (result.success) {
                        Utils.showNotification(`Documents downloaded successfully! Path: ${result.path}`, 'success');
                        downloadOptions.style.display = 'none'; // Hide the dropdown after download
                    } else {
                        Utils.showNotification(result.message, 'error');
                    }
                } catch (error) {
                    Utils.showNotification('Download failed.', 'error');
                }
            });
        });
    };  
    
    const initializePage = () => {
        switch (currentPage) {
            case 'Inward-Outward Login':
                setupLoginPage();
                break;
            case 'Dashboard - Inward-Outward Portal':
                setupDashboardPage();
                break;
            case 'Register Document':
                setupRegisterDocumentPage();
                break;
            case 'Edit Document':
                setupEditDocumentPage();
                break;
            case 'Search Documents':
                setupSearchDocumentPage();
                break;
            default:
                console.error('Unknown page title:', currentPage);
        }
    };

    setupTabNavigation();
    setupHomeNavigation();
    initializePage();
});
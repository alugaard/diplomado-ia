document.addEventListener('DOMContentLoaded', () => {
    // Buttons
    const manualBtn = document.getElementById('manualModeBtn');
    const archivoBtn = document.getElementById('archivoModeBtn');
    // Removed sidebar buttons
    const archiveRefreshBtn = document.getElementById('archiveRefreshBtn');
    const manualRefreshBtn = document.getElementById('manualRefreshBtn');
    const addManualRowBtn = document.getElementById('addManualRowBtn');
    const predictAllBtn = document.getElementById('predictAllBtn');

    // Content Areas
    const dropZone = document.getElementById('dropZone');
    const resultsTable = document.getElementById('resultsTable'); // Manual table
    const manualTableBody = document.getElementById('manualTableBody');
    const csvPreviewTable = document.getElementById('csvPreviewTable'); // CSV table container
    const csvTableContent = document.getElementById('csvTableContent'); // CSV table content
    // Removed actionTableBody and csvActionTableBody references
    const predictAllCsvBtn = document.getElementById('predictAllCsvBtn');

    // Inputs
    const fileInput = document.getElementById('fileInput');
    const uploadTrigger = document.getElementById('uploadTrigger');
    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');

    // Pagination Controls
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageIndicator = document.getElementById('pageIndicator');

    // Navigation Tabs
    const navCargas = document.getElementById('navCargas');
    const navDashboards = document.getElementById('navDashboards');
    const navHistorial = document.getElementById('navHistorial');
    const contentHeader = document.querySelector('.content-header');

    // Historial Elements
    const historialView = document.getElementById('historialView');
    const historialTableBody = document.getElementById('historialTableBody');
    const emptyHistorialMessage = document.getElementById('emptyHistorialMessage');

    // State
    let fileLoaded = false;
    let csvData = [];
    let csvHeader = [];
    let csvRows = [];
    let csvProbabilities = []; // Store probability data separately
    let currentFileBase64 = null;
    let showOriginalClass = false; // Toggle for "Clasificación Original" column
    let originalClassIndex = -1; // Index of the original classification column

    // Chart Instances
    let chartInstance = null; // Global History Chart
    let fileChartInstance = null; // File Specific Chart
    let countryChartInstance = null; // Country Chart

    // Pagination State
    let currentPage = 1;
    const itemsPerPage = 10;

    // --- Initialization ---
    // Reset all checkboxes on page load EXCEPT the one checked in HTML (default)
    allCheckboxes.forEach(cb => {
        // cb.checked = false; // Removed to respect HTML default Checked
        cb.disabled = false;

        // Add radio-like behavior
        cb.addEventListener('change', function () {
            if (this.checked) {
                allCheckboxes.forEach(otherCb => {
                    if (otherCb !== this) {
                        otherCb.checked = false;
                    }
                });
            }
        });
    });

    function getSelectedModelInfo() {
        // Map names to metadata
        const mapping = {
            'tf-idf': { id: 'tfidf', name: 'TF-IDF', class: 'bg-tfidf' },
            'gru': { id: 'gru', name: 'GRU', class: 'bg-gru' },
            'beto': { id: 'beto', name: 'BETO', class: 'bg-beto' },
            'gemini': { id: 'gemini', name: 'GEMINI', class: 'bg-gemini' }
        };

        const selected = Array.from(allCheckboxes).find(cb => cb.checked);
        if (selected) {
            return mapping[selected.name] || { id: selected.name, name: selected.name, class: '' };
        }
        return { id: 'none', name: 'None', class: '' };
    }

    function getSelectedModel() {
        return getSelectedModelInfo().id;
    }

    // --- View Switching Logic ---

    function showManualView() {
        manualBtn.classList.add('active');
        archivoBtn.classList.remove('active');

        // Contextual Buttons Visibility
        manualRefreshBtn.style.display = 'flex';
        archiveRefreshBtn.style.display = 'none';

        // Always show manual table in Manual mode, hide others
        dropZone.classList.add('hidden');
        csvPreviewTable.classList.add('hidden');
        resultsTable.classList.remove('hidden');
    }

    function showArchivoView() {
        archivoBtn.classList.add('active');
        manualBtn.classList.remove('active');

        // Contextual Buttons Visibility
        archiveRefreshBtn.style.display = 'flex';
        manualRefreshBtn.style.display = 'none';

        // Hide manual table
        resultsTable.classList.add('hidden');

        // Logic for DropZone vs CSV Preview based on State
        updateArchivoView();
    }

    function updateArchivoView() {
        if (!manualBtn.classList.contains('active')) { // Only if we are in Archivo view
            if (fileLoaded) {
                dropZone.classList.add('hidden');
                csvPreviewTable.classList.remove('hidden');
                renderCurrentPage();
            } else {
                dropZone.classList.remove('hidden');
                csvPreviewTable.classList.add('hidden');
                // Ensure icon is reset
                uploadTrigger.textContent = '+';
                uploadTrigger.classList.add('plus-icon');
                uploadTrigger.classList.remove('success-icon');
            }
        }
    }

    // --- Manual Data Entry Logic ---

    if (addManualRowBtn) {
        addManualRowBtn.addEventListener('click', () => {
            addEditableRow();
        });
    }

    function addEditableRow() {
        const row = document.createElement('tr');

        // Column 1: Comentario (Textarea)
        const tdComment = document.createElement('td');
        const textarea = document.createElement('textarea');
        textarea.className = 'manual-input manual-textarea';
        textarea.rows = 1; // Start small
        // Auto-resize logic
        textarea.addEventListener('input', function () {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
        });
        tdComment.appendChild(textarea);
        row.appendChild(tdComment);

        // Column 2: Clasificación (Input, Readonly or standard)
        const tdClass = document.createElement('td');
        const inputClass = document.createElement('input');
        inputClass.type = 'text';
        inputClass.className = 'manual-input';

        // Tooltip container wrapper for the input
        const tooltipContainer = document.createElement('div');
        tooltipContainer.className = 'tooltip-container';

        // Tooltip text span
        const tooltipText = document.createElement('span');
        tooltipText.className = 'tooltip-text';
        // tooltipText.textContent = "Probabilities will appear here"; 

        tooltipContainer.appendChild(inputClass);
        tooltipContainer.appendChild(tooltipText);
        tdClass.appendChild(tooltipContainer);

        row.appendChild(tdClass);

        // Column 3: Predecir Button (placeholder initially, then button)
        const actionTd = document.createElement('td');
        actionTd.style.textAlign = 'center'; // Center the button column
        actionTd.style.verticalAlign = 'middle';

        // Placeholder or empty initially
        actionTd.innerHTML = '&nbsp;';

        row.appendChild(actionTd);

        // Column 4: Add Button / Row Actions (Save Btn was here)
        // Wait, the "Save" button logic was creating a "Lock" action.
        // Let's adapt: The "Green Check" button was appended to 'actionTd' before.
        // But now we have a dedicated "Predecir" column.
        // The Green Check should probably be in the last column (where the + was in header)
        // OR temporarily in the Predecir column?
        // Let's stick to previous logic: There was an "Action Column" created in line 166.

        // Original logic: 
        // 1. Comment
        // 2. Class
        // 3. Action Td (Save Btn) -> becomes Predecir Btn? No, 'actionRowTd' became Predecir.

        // New Structure:
        // 1. Comment
        // 2. Class
        // 3. Predecir (New Column)
        // 4. Save/Add (Old action column)

        const toolsTd = document.createElement('td'); // For the Green Check
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-row-btn';
        saveBtn.textContent = '✔';

        toolsTd.appendChild(saveBtn);
        row.appendChild(toolsTd);

        manualTableBody.appendChild(row);

        // Update save event to pass actionTd (the Predecir column) to be populated
        saveBtn.onclick = () => {
            lockRow(row, saveBtn, toolsTd, actionTd);
        };
    }

    function lockRow(row, saveBtn, toolsTd, predictTd) {
        const inputs = row.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.disabled = true;
        });

        // Disable save button visually
        saveBtn.disabled = true;
        saveBtn.style.display = 'none'; // Hide save button

        // Create Predict Button in the Dedicated Predecir Column
        const predictBtn = document.createElement('button');
        predictBtn.classList.add('predict-row-btn');
        predictBtn.textContent = 'Predecir';
        predictBtn.classList.add('btn', 'btn-primary');
        predictBtn.style.fontSize = '12px';
        predictBtn.style.padding = '4px 8px';
        predictBtn.style.display = 'inline-flex';
        predictBtn.style.margin = '0 auto';

        // Add Delete Button (Red Cross) to the Actions Column
        toolsTd.innerHTML = ''; // Clear the green check
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-row-btn';
        deleteBtn.innerHTML = '&times;'; // Cross icon
        deleteBtn.title = 'Eliminar fila';
        deleteBtn.onclick = () => {
            row.remove();
        };
        toolsTd.appendChild(deleteBtn);

        // Clear placeholder and add button
        predictTd.innerHTML = '';
        predictTd.appendChild(predictBtn);

        predictBtn.addEventListener('click', () => {
            predictRow(row, predictBtn);
        });
    }


    // --- CSV Handling Logic ---

    uploadTrigger.addEventListener('click', () => {
        if (!fileLoaded) {
            fileInput.click();
        } else {
            // Click again to replace
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        handleFile(file);
    });

    // Drag and Drop Events
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault(); // allow drop
        dropZone.classList.add('drag-active');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-active');

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
            // Optional: Update actual input files so it's consistent?
            // fileInput.files = e.dataTransfer.files; 
        }
    });

    function handleFile(file) {
        if (file && (file.type === "text/csv" || file.name.endsWith('.csv'))) {
            // Text Reader for Preview
            const reader = new FileReader();
            reader.onload = function (event) {
                const text = event.target.result;
                parseCSV(text);
                fileLoaded = true;
                currentPage = 1; // Reset to first page
                updateArchivoView();
                saveUploadLog(file.name); // Log the upload
            };
            reader.readAsText(file);

            // Base64 Reader for API
            const readerB64 = new FileReader();
            readerB64.onload = function (e) {
                // Remove data URL prefix (e.g., "data:text/csv;base64,")
                currentFileBase64 = e.target.result.split(',')[1];
            };
            readerB64.readAsDataURL(file);
        } else {
            alert('Por favor carga un archivo CSV válido.');
        }
    }

    // --- Upload History (localStorage) ---

    function saveUploadLog(fileName) {
        const history = JSON.parse(localStorage.getItem('uploadHistory') || '[]');
        const entry = {
            fileName: fileName,
            uploadTime: new Date().toISOString(),
            uploader: 'Anónimo',
            csvHeader: csvHeader,
            csvRows: csvRows
        };
        history.unshift(entry); // Add to beginning (newest first)
        localStorage.setItem('uploadHistory', JSON.stringify(history));
    }

    function updateLatestHistoryEntry() {
        const history = JSON.parse(localStorage.getItem('uploadHistory') || '[]');
        if (history.length > 0) {
            history[0].csvHeader = csvHeader;
            history[0].csvRows = csvRows;
            history[0].modelClass = getSelectedModelInfo().class; // Store model color
            localStorage.setItem('uploadHistory', JSON.stringify(history));
        }
    }

    function loadUploadHistory() {
        const history = JSON.parse(localStorage.getItem('uploadHistory') || '[]');
        historialTableBody.innerHTML = '';

        if (history.length === 0) {
            emptyHistorialMessage.classList.remove('hidden');
            document.getElementById('historialTable').classList.add('hidden');
            return;
        }

        emptyHistorialMessage.classList.add('hidden');
        document.getElementById('historialTable').classList.remove('hidden');

        history.forEach((entry, index) => {
            const row = document.createElement('tr');

            const tdFile = document.createElement('td');
            tdFile.textContent = entry.fileName;

            const tdTime = document.createElement('td');
            const date = new Date(entry.uploadTime);
            tdTime.textContent = date.toLocaleString('es-CL');

            const tdUser = document.createElement('td');
            tdUser.textContent = entry.uploader;

            const tdActions = document.createElement('td');
            const viewBtn = document.createElement('button');
            viewBtn.className = 'view-btn';
            viewBtn.textContent = 'Ver';
            viewBtn.addEventListener('click', () => openModal(index));
            tdActions.appendChild(viewBtn);

            row.appendChild(tdFile);
            row.appendChild(tdTime);
            row.appendChild(tdUser);
            row.appendChild(tdActions);
            historialTableBody.appendChild(row);
        });
    }

    // --- Modal Logic ---

    const csvModal = document.getElementById('csvModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalTitle = document.getElementById('modalTitle');
    const modalTableHead = document.getElementById('modalTableHead');
    const modalTableBody = document.getElementById('modalTableBody');

    function openModal(entryIndex) {
        const history = JSON.parse(localStorage.getItem('uploadHistory') || '[]');
        const entry = history[entryIndex];
        if (!entry) return;

        modalTitle.textContent = entry.fileName;
        modalTableHead.innerHTML = '';
        modalTableBody.innerHTML = '';

        // Render Header
        if (entry.csvHeader && entry.csvHeader.length > 0) {
            const headerRow = document.createElement('tr');
            entry.csvHeader.forEach(cell => {
                const th = document.createElement('th');
                th.textContent = cell;
                headerRow.appendChild(th);
            });
            modalTableHead.appendChild(headerRow);
        }

        // Find classification column index
        let classColIndex = -1;
        if (entry.csvHeader) {
            classColIndex = entry.csvHeader.findIndex(h =>
                h.toLowerCase().includes('clasificación') || h.toLowerCase().includes('clasificacion')
            );
        }

        // Render Rows
        if (entry.csvRows && entry.csvRows.length > 0) {
            entry.csvRows.forEach(rowData => {
                const row = document.createElement('tr');
                rowData.forEach((cell, cellIndex) => {
                    const td = document.createElement('td');
                    td.textContent = cell ? cell.trim() : '';

                    // Apply model color to classification column
                    if (cellIndex === classColIndex && cell && cell.trim() !== '' && entry.modelClass) {
                        td.classList.add(entry.modelClass);
                    }

                    row.appendChild(td);
                });
                modalTableBody.appendChild(row);
            });
        }

        csvModal.classList.remove('hidden');
    }

    function closeModal() {
        csvModal.classList.add('hidden');
    }

    modalCloseBtn.addEventListener('click', closeModal);
    csvModal.addEventListener('click', (e) => {
        if (e.target === csvModal) closeModal();
    });

    function rowsToCsvBase64(headers, rows) {
        // Use semicolon as separator to match current parser
        const csvContent = [headers.join(';'), ...rows.map(row => row.join(';'))].join('\n');
        // Handle UTF-8 safely for btoa
        const bytes = new TextEncoder().encode(csvContent);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    function parseCSV(text) {
        // Simple CSV parser (assumes semi-colon separated)
        const rows = text.trim().split('\n');
        const data = rows.map(row => row.split(';'));

        if (data.length > 0) {
            csvHeader = data[0].map(h => h.trim()); // Trim headers
            csvRows = data.slice(1);

            // Check if "Clasificación" column exists
            const classIndex = csvHeader.findIndex(h => h.toLowerCase().includes('clasificación') || h.toLowerCase().includes('clasificacion'));

            if (classIndex !== -1) {
                // Store original classification values
                const originalValues = csvRows.map(row => row[classIndex] || '');

                // Insert "Clasificación Original" column right after "Clasificación"
                csvHeader.splice(classIndex + 1, 0, 'Clasificación Original');
                originalClassIndex = classIndex + 1;

                // Insert original values into new column and clear prediction column
                csvRows = csvRows.map((row, i) => {
                    // Ensure row has enough columns
                    while (row.length < classIndex + 1) row.push('');
                    // Insert original value at new column position
                    row.splice(classIndex + 1, 0, originalValues[i]);
                    // Clear the "Clasificación" column for new predictions
                    row[classIndex] = '';
                    return row;
                });
            } else {
                // No existing column, just add new "Clasificación"
                originalClassIndex = -1;
                csvHeader.push('Clasificación');
                csvRows = csvRows.map(row => {
                    while (row.length < csvHeader.length - 1) row.push('');
                    row.push('');
                    return row;
                });
            }

            // Reset visibility state
            showOriginalClass = false;

            // Initialize probabilities array matching rows
            csvProbabilities = new Array(csvRows.length).fill(null);
        } else {
            csvHeader = [];
            csvRows = [];
        }
    }

    function renderCurrentPage() {
        if (csvRows.length === 0) {
            csvTableContent.innerHTML = '';
            return;
        }

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageData = csvRows.slice(startIndex, endIndex);

        renderCSVTable(csvHeader, pageData);
        updatePaginationControls();
    }

    function renderCSVTable(header, rows) {
        csvTableContent.innerHTML = '';
        // csvActionTableBody removed

        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        header.forEach((cell, cellIndex) => {
            const th = document.createElement('th');
            const headerText = cell ? cell.trim() : '';

            // Check if this is the "Clasificación Original" column
            if (headerText === 'Clasificación Original') {
                th.className = showOriginalClass ? '' : 'col-hidden';
                th.textContent = headerText;
            } else if (headerText === 'Clasificación') {
                // If we have an original column to toggle
                if (originalClassIndex !== -1) {
                    const headerContainer = document.createElement('div');
                    headerContainer.style.display = 'flex';
                    headerContainer.style.alignItems = 'center';
                    headerContainer.style.gap = '0.5rem';

                    const textSpan = document.createElement('span');
                    textSpan.textContent = headerText;

                    const toggleBtn = document.createElement('button');
                    toggleBtn.className = 'toggle-col-btn';
                    // Show "expand" arrow if hidden, "collapse" arrow if shown
                    toggleBtn.innerHTML = showOriginalClass ? '→' : '←';
                    toggleBtn.title = showOriginalClass ? 'Ocultar Clasificación Original' : 'Mostrar Clasificación Original';
                    toggleBtn.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent any sorting if added later
                        showOriginalClass = !showOriginalClass;
                        renderCurrentPage();
                    });

                    headerContainer.appendChild(toggleBtn);
                    headerContainer.appendChild(textSpan);
                    th.appendChild(headerContainer);
                } else {
                    th.textContent = headerText;
                }
            } else {
                th.textContent = headerText;
            }

            headerRow.appendChild(th);
        });

        // Add "Predecir" Header Column with Button
        const thAction = document.createElement('th');
        thAction.style.textAlign = 'center';

        // Create the button dynamically
        const predictAllBtn = document.createElement('button');
        predictAllBtn.textContent = 'Predecir Todo';
        predictAllBtn.className = 'btn btn-primary';
        predictAllBtn.style.padding = '4px 8px';
        predictAllBtn.style.fontSize = '0.8rem';
        predictAllBtn.id = 'predictAllCsvBtn'; // Re-use ID for consistency

        predictAllBtn.addEventListener('click', () => {
            predictAllCsv();
        });

        thAction.appendChild(predictAllBtn);
        headerRow.appendChild(thAction);

        thead.appendChild(headerRow);
        csvTableContent.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        rows.forEach((rowData, index) => {
            const row = document.createElement('tr');
            // Global index for data awareness
            const globalIndex = (currentPage - 1) * itemsPerPage + index;

            rowData.forEach((cell, cellIndex) => {
                const td = document.createElement('td');
                const headerName = csvHeader[cellIndex] ? csvHeader[cellIndex].trim() : '';

                // Check if this is the "Clasificación Original" column
                if (headerName === 'Clasificación Original') {
                    td.className = showOriginalClass ? '' : 'col-hidden';
                    td.textContent = cell ? cell.trim() : '';
                    row.appendChild(td);
                    return; // Skip further processing for this column
                }

                // Check if this is the "Clasificación" column (for predictions)
                const isClassColumn = headerName === 'Clasificación';

                // Apply color if it is the classification column and has content
                if (isClassColumn && cell && cell.trim() !== '') {
                    const modelInfo = getSelectedModelInfo();
                    if (modelInfo.class) {
                        td.classList.add(modelInfo.class);
                    }
                }

                if (isClassColumn && csvProbabilities[globalIndex]) {
                    // Wrap in tooltip
                    const tooltipContainer = document.createElement('div');
                    tooltipContainer.className = 'tooltip-container';
                    tooltipContainer.innerHTML = ''; // Clear existing content to prevent accumulation

                    const spanContent = document.createElement('span');
                    spanContent.textContent = cell ? cell.trim() : '';

                    const tooltipText = document.createElement('span');
                    tooltipText.className = 'tooltip-text';
                    tooltipText.textContent = csvProbabilities[globalIndex];

                    tooltipContainer.appendChild(spanContent);
                    tooltipContainer.appendChild(tooltipText);
                    td.appendChild(tooltipContainer);
                } else {
                    td.textContent = cell ? cell.trim() : '';
                }

                row.appendChild(td);
            });
            tbody.appendChild(row);

            // Action Column (Predecir Button)
            const actionTd = document.createElement('td');
            actionTd.style.textAlign = 'center';
            actionTd.style.verticalAlign = 'middle';

            const predictBtn = document.createElement('button');
            predictBtn.className = 'predict-row-btn btn btn-primary';
            predictBtn.textContent = 'Predecir';
            predictBtn.style.fontSize = '12px';
            predictBtn.style.padding = '4px 8px';
            predictBtn.style.display = 'inline-flex'; // Ensure inline-flex
            predictBtn.style.margin = '0 auto';

            predictBtn.addEventListener('click', (e) => {
                predictCsvRow(globalIndex, rowData, row, e.currentTarget);
            });

            actionTd.appendChild(predictBtn);
            row.appendChild(actionTd);

            tbody.appendChild(row);
        });
        csvTableContent.appendChild(tbody);
    }

    function updatePaginationControls() {
        const totalPages = Math.ceil(csvRows.length / itemsPerPage);
        pageIndicator.textContent = `Página ${currentPage} de ${totalPages}`;

        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    }

    // --- Pagination Events ---

    prevPageBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderCurrentPage();
        }
    });

    nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(csvRows.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderCurrentPage();
        }
    });


    // --- Helper Function ---
    function formatProbabilities(probObj) {
        if (!probObj) return '';
        // sort by value descending for better readability? Optional but nice.
        // User just asked for "Label: Value".
        return Object.entries(probObj)
            .map(([label, score]) => `${label}: ${Number(score).toFixed(4)}`)
            .join('\n');
    }

    // --- Prediction Logic ---

    if (predictAllBtn) {
        predictAllBtn.addEventListener('click', () => {
            predictAll();
        });
    }

    if (predictAllCsvBtn) {
        predictAllCsvBtn.addEventListener('click', () => {
            predictAllCsv();
        });
    }

    async function predictAll() {
        setLoading(true);
        try {
            // Iterate over all rows in manualTableBody
            const rows = manualTableBody.querySelectorAll('tr');

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                // Predict button is now INSIDE the row (3rd column usually)
                const predictBtn = row.querySelector('.predict-row-btn');

                // If button exists (row is locked)
                if (predictBtn) {
                    await predictRow(row, predictBtn);
                }
            }
        } finally {
            setLoading(false);
        }
    }

    let activeRequests = 0;
    function setLoading(isLoading) {
        if (isLoading) {
            activeRequests++;
        } else {
            activeRequests = Math.max(0, activeRequests - 1);
        }

        const allPredictButtons = document.querySelectorAll('.predict-row-btn, #predictAllBtn, #predictAllCsvBtn');

        if (activeRequests > 0) {
            allPredictButtons.forEach(btn => {
                if (!btn.disabled) {
                    btn.dataset.originalContent = btn.innerHTML;
                    btn.disabled = true;
                    btn.innerHTML = '<div class="loading-container"><span class="spinner"></span></div>';
                }
            });
        } else if (activeRequests === 0) {
            allPredictButtons.forEach(btn => {
                btn.disabled = false;
                btn.innerHTML = btn.dataset.originalContent || (btn.id === 'predictAllBtn' || btn.id === 'predictAllCsvBtn' ? 'Predecir Todo' : 'Predecir');
            });
        }
    }

    function predictRow(row, btn) {
        const textarea = row.querySelector('textarea');
        const inputs = row.querySelectorAll('input');

        const comentario = textarea.value;
        // The classification input is the first input element now (since textarea is not an input tag)
        // Structure: [textarea (Comment), input (Classification)]
        const classificationInput = inputs[0];

        if (!comentario) return; // Skip if empty?

        const model = getSelectedModel();
        setLoading(true);

        return fetch(`${API_BASE_URL}/predict?model=${model}`, {
            method: 'POST',
            mode: 'cors', // Explicitly request CORS
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                comentario: comentario
            })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Success:', data);
                const modelInfo = getSelectedModelInfo();

                // Update Clasificación input
                if (data.prediccion) {
                    classificationInput.value = data.prediccion;

                    // Apply model color to the container (the td)
                    const targetCell = classificationInput.closest('td');
                    if (targetCell) {
                        targetCell.className = modelInfo.class;
                    }

                    // Ensure input itself is transparent to show cell background
                    classificationInput.classList.add(modelInfo.class);
                }

                // Update Probabilities Tooltip
                // Check if tooltip text element already exists, if not create it (should exist from addEditableRow)
                let tooltipText = row.querySelector('.tooltip-text');
                if (!tooltipText) {
                    // Fallback if not created initially
                    const container = row.querySelector('.tooltip-container');
                    if (container) {
                        tooltipText = document.createElement('span');
                        tooltipText.className = 'tooltip-text';
                        container.appendChild(tooltipText);
                    }
                }

                if (tooltipText && data.probabilidad) {
                    // Format: "Label: 0.50\nLabel: 0.30"
                    const probText = formatProbabilities(data.probabilidad);
                    tooltipText.textContent = probText;
                }
            })
            .catch((error) => {
                console.error('Error:', error);
                alert(`Error al predecir: ${error.message}. \n\nPosible causa: El servidor (localhost:7002) no está corriendo o no permite CORS (Cross-Origin Resource Sharing).`);
            })
            .finally(() => {
                setLoading(false);
            });
    }

    async function predictAllCsv() {
        if (csvRows.length === 0) {
            alert("No hay datos para predecir.");
            return;
        }

        setLoading(true);

        const batchSize = 100;
        const totalRows = csvRows.length;
        const batches = [];

        for (let i = 0; i < totalRows; i += batchSize) {
            batches.push({
                startIndex: i,
                rows: csvRows.slice(i, i + batchSize)
            });
        }

        const model = getSelectedModel();
        const classIndex = csvHeader.findIndex(h => h.toLowerCase().includes('clasificación') || h.toLowerCase().includes('clasificacion'));

        if (classIndex === -1) {
            alert('Error: No se encontró la columna "Clasificación" en la tabla.');
            setLoading(false);
            return;
        }

        const statusEl = document.getElementById('predictionStatus');
        if (statusEl) {
            statusEl.textContent = `Procesando lote 0 de ${batches.length}...`;
            statusEl.classList.remove('hidden');
        }

        try {
            // Sequential processing with async/await
            let batchCount = 0;
            for (const batch of batches) {
                batchCount++;
                if (statusEl) {
                    statusEl.textContent = `Procesando lote ${batchCount} de ${batches.length}...`;
                }

                const batchBase64 = rowsToCsvBase64(csvHeader, batch.rows);

                const response = await fetch(`${API_BASE_URL}/predict_csv?model=${model}`, {
                    method: 'POST',
                    mode: 'cors',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        archivo: batchBase64
                    })
                });

                if (!response.ok) {
                    throw new Error(`Batch starting at index ${batch.startIndex} failed: ${response.statusText}`);
                }

                const data = await response.json();

                if (Array.isArray(data)) {
                    data.forEach((item, index) => {
                        const globalIndex = batch.startIndex + index;
                        if (csvRows[globalIndex]) {
                            if (item.prediccion) {
                                csvRows[globalIndex][classIndex] = item.prediccion;
                            }
                            // Store formatted probability text
                            if (item.probabilidad) {
                                const probText = formatProbabilities(item.probabilidad);
                                csvProbabilities[globalIndex] = probText;
                            }
                        }
                    });
                }

                // Update UI incrementally after each batch
                renderCurrentPage();
            }

            if (statusEl) {
                statusEl.textContent = '¡Procesamiento completo!';
                setTimeout(() => {
                    statusEl.classList.add('hidden');
                }, 3000);
            }

            updateLatestHistoryEntry();
        } catch (error) {
            console.error('Error in sequential batch processing:', error);
            alert(`Error al procesar lotes: ${error.message}`);
            if (statusEl) statusEl.classList.add('hidden');
        } finally {
            setLoading(false);
        }
    }

    function predictCsvRow(globalIndex, rowData, rowElement, btn) {
        // Find indices
        const commentIndex = csvHeader.findIndex(h => h.toLowerCase().includes('comentario'));
        const classIndex = csvHeader.findIndex(h => h.toLowerCase().includes('clasificación') || h.toLowerCase().includes('clasificacion'));

        if (commentIndex === -1) {
            alert('No se encontró la columna "Comentario" en el CSV.');
            return;
        }

        const comentario = rowData[commentIndex];
        const model = getSelectedModel();
        setLoading(true);

        return fetch(`${API_BASE_URL}/predict?model=${model}`, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                comentario: comentario
            })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.prediccion) {
                    // Update internal data
                    const modelInfo = getSelectedModelInfo();
                    const resultText = data.prediccion;

                    if (classIndex !== -1) {
                        csvRows[globalIndex][classIndex] = resultText;

                        // Update Probabilities
                        if (data.probabilidad) {
                            const probText = formatProbabilities(data.probabilidad);
                            csvProbabilities[globalIndex] = probText;
                        }

                        // Update UI
                        const cells = rowElement.querySelectorAll('td');
                        const targetCell = cells[classIndex];
                        if (targetCell) {
                            targetCell.innerHTML = ''; // Clear content
                            targetCell.className = ''; // Reset class
                            targetCell.classList.add(modelInfo.class); // Apply generic class

                            if (csvProbabilities[globalIndex]) {
                                // Recreate Tooltip Structure
                                const tooltipContainer = document.createElement('div');
                                tooltipContainer.className = 'tooltip-container';

                                const spanContent = document.createElement('span');
                                spanContent.textContent = resultText;

                                const tooltipText = document.createElement('span');
                                tooltipText.className = 'tooltip-text';
                                tooltipText.textContent = csvProbabilities[globalIndex];

                                tooltipContainer.appendChild(spanContent);
                                tooltipContainer.appendChild(tooltipText);
                                targetCell.appendChild(tooltipContainer);
                            } else {
                                targetCell.textContent = resultText;
                            }
                        }
                    } else {
                        console.warn('Columna Clasificación no encontrada, no se puede actualizar la tabla visual.');
                        alert(`Predicción: ${data.prediccion}\n(No se pudo escribir en la tabla porque falta la columna "Clasificación")`);
                    }
                }
            })
            .catch((error) => {
                console.error('Error:', error);
            })
            .finally(() => {
                setLoading(false);
            });
    }


    // --- View Events ---

    manualBtn.addEventListener('click', showManualView);
    archivoBtn.addEventListener('click', showArchivoView);

    // Removed immediate change listener
    // previsualizarCheckbox.addEventListener('change', updateArchivoView);

    // Contextual Refresh Listeners
    if (archiveRefreshBtn) {
        archiveRefreshBtn.addEventListener('click', () => {
            fileInput.value = ''; // Important: Allows re-selecting the same file
            // csvData = []; // This was duplicated, csvRows is the main data source
            csvHeader = [];
            csvRows = [];
            csvProbabilities = [];
            currentFileBase64 = null;
            fileLoaded = false;
            updateArchivoView();
        });
    }

    if (manualRefreshBtn) {
        manualRefreshBtn.addEventListener('click', () => {
            manualTableBody.innerHTML = '';
        });
    }

    function showDashboardsView() {
        navCargas.classList.remove('active');
        navDashboards.classList.add('active');
        navHistorial.classList.remove('active');

        // Hide other views
        contentHeader.classList.add('hidden');
        dropZone.classList.add('hidden');
        resultsTable.classList.add('hidden');
        csvPreviewTable.classList.add('hidden');
        historialView.classList.add('hidden');

        // Show Dashboard
        const dashboardView = document.getElementById('dashboardView');
        dashboardView.classList.remove('hidden');

        // Render Global Chart
        const stats = calculateStats();
        renderChart(stats);

        // Populate File Selector and Render File Chart (default empty or first)
        populateFileSelector();

        // Render Country Chart
        renderCountryChart();
    }

    // --- Helper for Colors ---
    const chartColors = {
        felicitaciones: { bg: 'rgba(75, 192, 192, 0.6)', border: 'rgba(75, 192, 192, 1)' },
        sugerencia: { bg: 'rgba(255, 206, 86, 0.6)', border: 'rgba(255, 206, 86, 1)' },
        reclamo: { bg: 'rgba(255, 99, 132, 0.6)', border: 'rgba(255, 99, 132, 1)' }
    };

    function populateFileSelector() {
        const history = JSON.parse(localStorage.getItem('uploadHistory') || '[]');
        const selector = document.getElementById('historyFileSelector');

        // Clear existing options (except the first default one)
        selector.innerHTML = '<option value="">-- Seleccionar --</option>';

        history.forEach((entry, index) => {
            const option = document.createElement('option');
            option.value = index; // Use index as ID
            option.textContent = `${entry.fileName} (${new Date(entry.uploadTime).toLocaleString()})`;
            selector.appendChild(option);
        });

        // Add Listener only once (or remove old one to be safe, but simple overwrite works here)
        selector.onchange = (e) => {
            const selectedIndex = e.target.value;
            if (selectedIndex !== "") {
                renderFileChart(selectedIndex);
            } else {
                if (fileChartInstance) fileChartInstance.destroy();
            }
        };
    }

    function calculateStats() {
        const history = JSON.parse(localStorage.getItem('uploadHistory') || '[]');
        const stats = {
            'Felicitaciones y Agradecimientos': 0,
            'Sugerencia': 0,
            'Reclamo': 0
        };

        history.forEach(entry => {
            aggregateStatsFromEntry(entry, stats);
        });

        return stats;
    }

    function aggregateStatsFromEntry(entry, stats) {
        if (entry.csvRows && entry.csvHeader) {
            const classIndex = entry.csvHeader.findIndex(h => h.toLowerCase().includes('clasificación') || h.toLowerCase().includes('clasificacion'));

            if (classIndex !== -1) {
                entry.csvRows.forEach(row => {
                    const value = row[classIndex];
                    if (value) {
                        const normalized = value.trim();
                        if (stats.hasOwnProperty(normalized)) {
                            stats[normalized]++;
                        }
                    }
                });
            }
        }
    }

    function renderChart(stats) {
        const ctx = document.getElementById('classificationChart').getContext('2d');

        if (chartInstance) {
            chartInstance.destroy();
        }

        renderBarChart(ctx, stats, 'chartInstance', 'Cantidad de Registros');
    }

    function renderFileChart(fileIndex) {
        const history = JSON.parse(localStorage.getItem('uploadHistory') || '[]');
        const entry = history[fileIndex];

        if (!entry) return;

        const stats = {
            'Felicitaciones y Agradecimientos': 0,
            'Sugerencia': 0,
            'Reclamo': 0
        };

        aggregateStatsFromEntry(entry, stats);

        const ctx = document.getElementById('fileChart').getContext('2d');
        if (fileChartInstance) {
            fileChartInstance.destroy();
        }

        // We use a generic helper or duplicate logic. Let's make a generic helper.
        // But for now, direct implementation to ensure 'fileChartInstance' is assigned.

        const dataValues = [
            stats['Felicitaciones y Agradecimientos'],
            stats['Sugerencia'],
            stats['Reclamo']
        ];

        fileChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Felicitaciones', 'Sugerencias', 'Reclamos'],
                datasets: [{
                    label: `Registros en ${entry.fileName}`,
                    data: dataValues,
                    backgroundColor: [chartColors.felicitaciones.bg, chartColors.sugerencia.bg, chartColors.reclamo.bg],
                    borderColor: [chartColors.felicitaciones.border, chartColors.sugerencia.border, chartColors.reclamo.border],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                plugins: { legend: { display: false } }
            }
        });
    }

    function renderCountryChart() {
        const history = JSON.parse(localStorage.getItem('uploadHistory') || '[]');
        // Structure: { 'CountryName': { 'Felicitaciones...': 0, 'Sugerencia': 0, 'Reclamo': 0 } }
        const countryStats = {};

        history.forEach(entry => {
            if (entry.csvRows && entry.csvHeader) {
                const classIndex = entry.csvHeader.findIndex(h => h.toLowerCase().includes('clasificación') || h.toLowerCase().includes('clasificacion'));
                const countryIndex = entry.csvHeader.findIndex(h => h.toLowerCase().includes('país') || h.toLowerCase().includes('pais') || h.toLowerCase().includes('country'));

                if (classIndex !== -1) {
                    entry.csvRows.forEach(row => {
                        const classValue = row[classIndex] ? row[classIndex].trim() : null;
                        let countryValue = (countryIndex !== -1 && row[countryIndex]) ? row[countryIndex].trim() : 'Sin País';

                        if (countryValue === '') countryValue = 'Sin País';

                        if (classValue && ['Felicitaciones y Agradecimientos', 'Sugerencia', 'Reclamo'].includes(classValue)) {
                            if (!countryStats[countryValue]) {
                                countryStats[countryValue] = {
                                    'Felicitaciones y Agradecimientos': 0,
                                    'Sugerencia': 0,
                                    'Reclamo': 0
                                };
                            }
                            countryStats[countryValue][classValue]++;
                        }
                    });
                }
            }
        });

        const countries = Object.keys(countryStats).sort(); // Labels
        const datasetFelicitaciones = countries.map(c => countryStats[c]['Felicitaciones y Agradecimientos']);
        const datasetSugerencias = countries.map(c => countryStats[c]['Sugerencia']);
        const datasetReclamos = countries.map(c => countryStats[c]['Reclamo']);

        const ctx = document.getElementById('countryChart').getContext('2d');
        if (countryChartInstance) {
            countryChartInstance.destroy();
        }

        countryChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: countries,
                datasets: [
                    {
                        label: 'Felicitaciones',
                        data: datasetFelicitaciones,
                        backgroundColor: chartColors.felicitaciones.bg,
                        borderColor: chartColors.felicitaciones.border,
                        borderWidth: 1
                    },
                    {
                        label: 'Sugerencias',
                        data: datasetSugerencias,
                        backgroundColor: chartColors.sugerencia.bg,
                        borderColor: chartColors.sugerencia.border,
                        borderWidth: 1
                    },
                    {
                        label: 'Reclamos',
                        data: datasetReclamos,
                        backgroundColor: chartColors.reclamo.bg,
                        borderColor: chartColors.reclamo.border,
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, ticks: { precision: 0 } },
                    x: { stacked: false } // Grouped bars
                },
                plugins: { legend: { position: 'top' } }
            }
        });
    }

    // Generic Render Helper (Refactored from original renderChart)
    function renderBarChart(ctx, stats, instanceVarName, label) {
        // This function is just a placeholder to keep the diff clean if we were to fully refactor 
        // the original renderChart. For now, we kept the original logic inside renderChart 
        // but using the global chartInstance variable.

        // Re-implementing logic for the global chart here correctly:
        const dataValues = [
            stats['Felicitaciones y Agradecimientos'],
            stats['Sugerencia'],
            stats['Reclamo']
        ];

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Felicitaciones', 'Sugerencias', 'Reclamos'],
                datasets: [{
                    label: label,
                    data: dataValues,
                    backgroundColor: [chartColors.felicitaciones.bg, chartColors.sugerencia.bg, chartColors.reclamo.bg],
                    borderColor: [chartColors.felicitaciones.border, chartColors.sugerencia.border, chartColors.reclamo.border],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
                plugins: { legend: { display: false } }
            }
        });
    }

    // --- Navigation Tab Switching ---

    function showCargasView() {
        navCargas.classList.add('active');
        navDashboards.classList.remove('active');
        navHistorial.classList.remove('active');

        contentHeader.classList.remove('hidden');
        historialView.classList.add('hidden');
        document.getElementById('dashboardView').classList.add('hidden');

        // Restore Cargas sub-view state
        if (manualBtn.classList.contains('active')) {
            showManualView();
        } else {
            showArchivoView();
        }
    }

    function showHistorialView() {
        navCargas.classList.remove('active');
        navDashboards.classList.remove('active');
        navHistorial.classList.add('active');

        // Hide Cargas sub-views
        contentHeader.classList.add('hidden');
        dropZone.classList.add('hidden');
        resultsTable.classList.add('hidden');
        csvPreviewTable.classList.add('hidden');
        document.getElementById('dashboardView').classList.add('hidden');

        // Show Historial
        historialView.classList.remove('hidden');
        loadUploadHistory();
    }

    navCargas.addEventListener('click', showCargasView);
    navDashboards.addEventListener('click', showDashboardsView);
    navHistorial.addEventListener('click', showHistorialView);
});

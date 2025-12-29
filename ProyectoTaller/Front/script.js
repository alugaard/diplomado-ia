document.addEventListener('DOMContentLoaded', () => {
    // Buttons
    const manualBtn = document.querySelector('.mode-btn:first-child');
    const archivoBtn = document.querySelector('.mode-btn:last-child');
    const aceptarBtn = document.querySelector('.btn-primary'); // Using class, assuming it's the Aceptar button
    const restaurarBtn = document.querySelector('.btn-secondary');
    const addManualRowBtn = document.getElementById('addManualRowBtn');

    // Content Areas
    const dropZone = document.getElementById('dropZone');
    const resultsTable = document.getElementById('resultsTable'); // Manual table
    const manualTableBody = document.getElementById('manualTableBody');
    const csvPreviewTable = document.getElementById('csvPreviewTable'); // CSV table container
    const csvTableContent = document.getElementById('csvTableContent'); // CSV table content

    // Inputs
    const fileInput = document.getElementById('fileInput');
    const uploadTrigger = document.getElementById('uploadTrigger');
    const previsualizarCheckbox = document.querySelector('input[name="previsualizar"]');
    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');

    // Pagination Controls
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const pageIndicator = document.getElementById('pageIndicator');

    // State
    let fileLoaded = false;
    let csvData = [];
    let csvHeader = [];
    let csvRows = [];

    // Pagination State
    let currentPage = 1;
    const itemsPerPage = 10;

    // --- Initialization ---
    // Reset all checkboxes on page load
    allCheckboxes.forEach(cb => {
        cb.checked = false;
        cb.disabled = false;
    });

    // --- View Switching Logic ---

    function showManualView() {
        manualBtn.classList.add('active');
        archivoBtn.classList.remove('active');

        // Always show manual table in Manual mode, hide others
        dropZone.classList.add('hidden');
        csvPreviewTable.classList.add('hidden');
        resultsTable.classList.remove('hidden');
    }

    function showArchivoView() {
        archivoBtn.classList.add('active');
        manualBtn.classList.remove('active');

        // Hide manual table
        resultsTable.classList.add('hidden');

        // Logic for DropZone vs CSV Preview based on State
        updateArchivoView();
    }

    function updateArchivoView() {
        if (!manualBtn.classList.contains('active')) { // Only if we are in Archivo view
            if (fileLoaded && previsualizarCheckbox.checked) {
                dropZone.classList.add('hidden');
                csvPreviewTable.classList.remove('hidden');
                renderCurrentPage();
            } else {
                dropZone.classList.remove('hidden');
                csvPreviewTable.classList.add('hidden');
                updateIconState();
            }
        }
    }

    function updateIconState() {
        if (fileLoaded) {
            uploadTrigger.textContent = '✔';
            uploadTrigger.classList.add('success-icon');
            uploadTrigger.classList.remove('plus-icon');
        } else {
            uploadTrigger.textContent = '+';
            uploadTrigger.classList.add('plus-icon');
            uploadTrigger.classList.remove('success-icon');
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

        // 4 Editable Columns
        for (let i = 0; i < 4; i++) {
            const td = document.createElement('td');
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'manual-input';
            td.appendChild(input);
            row.appendChild(td);
        }

        // Action Column
        const actionTd = document.createElement('td');
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-row-btn';
        saveBtn.textContent = '✔';

        saveBtn.addEventListener('click', () => {
            lockRow(row, saveBtn);
        });

        actionTd.appendChild(saveBtn);
        row.appendChild(actionTd);

        manualTableBody.appendChild(row);
    }

    function lockRow(row, saveBtn) {
        const inputs = row.querySelectorAll('input');
        inputs.forEach(input => {
            input.disabled = true;
        });
        saveBtn.disabled = true;
        saveBtn.style.opacity = '0.5';
        saveBtn.style.cursor = 'default';
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
            const reader = new FileReader();
            reader.onload = function (event) {
                const text = event.target.result;
                parseCSV(text);
                fileLoaded = true;
                currentPage = 1; // Reset to first page
                updateArchivoView();
            };
            reader.readAsText(file);
        } else {
            alert('Por favor carga un archivo CSV válido.');
        }
    }

    function parseCSV(text) {
        // Simple CSV parser (assumes semi-colon separated)
        const rows = text.trim().split('\n');
        const data = rows.map(row => row.split(';'));

        if (data.length > 0) {
            csvHeader = data[0];
            csvRows = data.slice(1);
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

        // Header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        header.forEach(cell => {
            const th = document.createElement('th');
            th.textContent = cell ? cell.trim() : '';
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        csvTableContent.appendChild(thead);

        // Body
        const tbody = document.createElement('tbody');
        rows.forEach(rowData => {
            const row = document.createElement('tr');
            rowData.forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell ? cell.trim() : '';
                row.appendChild(td);
            });
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


    // --- View Events ---

    manualBtn.addEventListener('click', showManualView);
    archivoBtn.addEventListener('click', showArchivoView);

    // Removed immediate change listener
    // previsualizarCheckbox.addEventListener('change', updateArchivoView);

    // Aceptar Button - Apply Changes and Disable Checkboxes
    aceptarBtn.addEventListener('click', () => {
        updateArchivoView();
        allCheckboxes.forEach(cb => {
            cb.disabled = true;
        });
    });

    // Restaurar Button - Enable Checkboxes (Unlock)
    // Restaurar Button - Enable Checkboxes (Unlock)
    restaurarBtn.addEventListener('click', () => {
        // Unlock all checkboxes
        allCheckboxes.forEach(cb => {
            cb.disabled = false;
        });

        // Reset File State
        fileLoaded = false;
        fileInput.value = ''; // Important: Allows re-selecting the same file
        csvData = [];
        csvHeader = [];
        csvRows = [];

        // Update View
        updateArchivoView();
        updateIconState();
    });
});

document.addEventListener('DOMContentLoaded', () => {
    // Buttons
    const manualBtn = document.querySelector('.mode-btn:first-child');
    const archivoBtn = document.querySelector('.mode-btn:last-child');
    const aceptarBtn = document.querySelector('.btn-primary'); // Using class, assuming it's the Aceptar button
    const restaurarBtn = document.querySelector('.btn-secondary');
    const addManualRowBtn = document.getElementById('addManualRowBtn');
    const predictAllBtn = document.getElementById('predictAllBtn');

    // Content Areas
    const dropZone = document.getElementById('dropZone');
    const resultsTable = document.getElementById('resultsTable'); // Manual table
    const manualTableBody = document.getElementById('manualTableBody');
    const csvPreviewTable = document.getElementById('csvPreviewTable'); // CSV table container
    const csvTableContent = document.getElementById('csvTableContent'); // CSV table content
    const actionTableBody = document.getElementById('actionTableBody');
    const csvActionTableBody = document.getElementById('csvActionTableBody');
    const predictAllCsvBtn = document.getElementById('predictAllCsvBtn');

    // Inputs
    const fileInput = document.getElementById('fileInput');
    const uploadTrigger = document.getElementById('uploadTrigger');
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
    let currentFileBase64 = null;

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
        tdClass.appendChild(inputClass);
        row.appendChild(tdClass);

        // Action Column (for the main table, will be hidden)
        const actionTd = document.createElement('td');
        const saveBtn = document.createElement('button');
        saveBtn.className = 'save-row-btn';
        saveBtn.textContent = '✔';

        // Initial listener, will be overwritten
        saveBtn.addEventListener('click', () => {
            // This listener will be replaced below
        });

        actionTd.appendChild(saveBtn);
        row.appendChild(actionTd);
        manualTableBody.appendChild(row);

        // Add corresponding row to Action Table
        const actionRow = document.createElement('tr');
        const actionRowTd = document.createElement('td');
        actionRowTd.style.border = 'none';
        actionRowTd.style.background = 'transparent';
        actionRowTd.style.padding = '10px'; // Match table padding

        // Placeholder or empty initially
        actionRowTd.innerHTML = '&nbsp;';

        actionRow.appendChild(actionRowTd);
        actionTableBody.appendChild(actionRow);

        // Update save event to pass actionRowTd
        saveBtn.onclick = () => { // Overwrite previous listener logic slightly to include actionRowTd
            lockRow(row, saveBtn, actionTd, actionRowTd);
        };
    }

    function lockRow(row, saveBtn, actionTd, actionRowTd) {
        const inputs = row.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.disabled = true;
        });

        // Disable save button visually
        saveBtn.disabled = true;
        saveBtn.style.display = 'none'; // Hide save button

        // Create Predict Button in the Action Table
        const predictBtn = document.createElement('button');
        predictBtn.className = 'predict-row-btn';
        predictBtn.textContent = 'Predecir';
        predictBtn.className = 'btn btn-primary'; // Use same style as Predict All? Or simpler?
        predictBtn.style.fontSize = '12px';
        predictBtn.style.padding = '4px 8px';

        predictBtn.addEventListener('click', () => {
            predictRow(row, actionRowTd); // Pass actionRowTd to maybe show result there? Or just predict.
        });

        // Clear placeholder and add button
        actionRowTd.innerHTML = '';
        actionRowTd.appendChild(predictBtn);
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

    function parseCSV(text) {
        // Simple CSV parser (assumes semi-colon separated)
        const rows = text.trim().split('\n');
        const data = rows.map(row => row.split(';'));

        if (data.length > 0) {
            csvHeader = data[0].map(h => h.trim()); // Trim headers
            csvRows = data.slice(1);

            // Ensure "Clasificación" column exists
            const classIndex = csvHeader.findIndex(h => h.toLowerCase().includes('clasificación') || h.toLowerCase().includes('clasificacion'));

            if (classIndex === -1) {
                // Add column to header
                csvHeader.push('Clasificación');
                // Add empty value to each row
                csvRows = csvRows.map(row => {
                    // Normalize row length to header length first if needed, then add
                    while (row.length < csvHeader.length - 1) {
                        row.push('');
                    }
                    row.push('');
                    return row;
                });
            }
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
        csvActionTableBody.innerHTML = '';

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
        rows.forEach((rowData, index) => {
            const row = document.createElement('tr');
            rowData.forEach(cell => {
                const td = document.createElement('td');
                td.textContent = cell ? cell.trim() : '';
                row.appendChild(td);
            });
            tbody.appendChild(row);

            // Action Row
            const actionRow = document.createElement('tr');
            const actionTd = document.createElement('td');
            actionTd.style.border = 'none';
            actionTd.style.background = 'transparent';
            actionTd.style.padding = '10px';

            const predictBtn = document.createElement('button');
            predictBtn.className = 'predict-row-btn btn btn-primary';
            predictBtn.textContent = 'Predecir';
            predictBtn.style.fontSize = '12px';
            predictBtn.style.padding = '4px 8px';

            // Global index for data awareness
            const globalIndex = (currentPage - 1) * itemsPerPage + index;

            predictBtn.addEventListener('click', () => {
                predictCsvRow(globalIndex, rowData, row);
            });

            actionTd.appendChild(predictBtn);
            actionRow.appendChild(actionTd);
            csvActionTableBody.appendChild(actionRow);
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

    function predictAll() {
        // Iterate over all rows in manualTableBody
        const rows = manualTableBody.querySelectorAll('tr');
        const actionRows = actionTableBody.querySelectorAll('tr');

        rows.forEach((row, index) => {
            // Find corresponding action button in actionTable
            const actionRow = actionRows[index];
            if (actionRow) {
                const predictBtn = actionRow.querySelector('button'); // Assuming button is the predict button
                // If button exists (row is locked)
                if (predictBtn && !predictBtn.disabled) {
                    predictRow(row);
                }
            }
        });
    }

    function predictRow(row) {
        const textarea = row.querySelector('textarea');
        const inputs = row.querySelectorAll('input');

        const comentario = textarea.value;
        // The classification input is the first input element now (since textarea is not an input tag)
        // Structure: [textarea (Comment), input (Classification)]
        const classificationInput = inputs[0];

        if (!comentario) return; // Skip if empty?

        fetch('http://localhost:7002/predict', {
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
                // Update Clasificación input
                if (data.prediccion) {
                    classificationInput.value = data.prediccion;
                }
            })
            .catch((error) => {
                console.error('Error:', error);
                alert(`Error al predecir: ${error.message}. \n\nPosible causa: El servidor (localhost:7002) no está corriendo o no permite CORS (Cross-Origin Resource Sharing).`);
            });
    }

    function predictAllCsv() {
        if (!currentFileBase64) {
            alert("No hay archivo cargado para predecir.");
            return;
        }

        const btn = document.getElementById('predictAllCsvBtn');
        const originalText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Prediciendo...";

        fetch('http://localhost:7002/predict_csv', {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                archivo: currentFileBase64
            })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server returned ${response.status}: ${response.statusText}`);
                }
                return response.json();
            })
            .then(data => {
                if (Array.isArray(data)) {
                    // Find Classification Column Index
                    const classIndex = csvHeader.findIndex(h => h.toLowerCase().includes('clasificación') || h.toLowerCase().includes('clasificacion'));

                    if (classIndex === -1) {
                        alert('Error: No se encontró la columna "Clasificación" en la tabla.');
                        return;
                    }

                    // Update rows
                    let matchCount = 0;
                    data.forEach((item, index) => {
                        if (csvRows[index]) {
                            // Verify if generic index matching or if we should try to match by comment?
                            // Assuming 1-to-1 in order for this batch operation.
                            if (item.prediccion) {
                                csvRows[index][classIndex] = item.prediccion;
                                matchCount++;
                            }
                        }
                    });

                    renderCurrentPage();
                    alert(`Predicción completa. Se actualizaron ${matchCount} filas.`);

                } else if (data.archivo) {
                    // Fallback for Base64 if needed, or remove if strictly JSON now.
                    // Keeping previous logic commented out or just replacing it entirely as requested.
                    // The user said "This is the api response", implying the other one was wrong.
                    console.warn("Received 'archivo' format but expected JSON array. Trying legacy decode...");
                    // ... (legacy decode logic could go here if we wanted to support both, but let's stick to the request)
                    try {
                        const binaryString = atob(data.archivo);
                        const bytes = new Uint8Array(binaryString.length);
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }
                        const decodedCsv = new TextDecoder().decode(bytes);
                        parseCSV(decodedCsv);
                        renderCurrentPage();
                        alert("Predicción completa (Base64).");
                    } catch (e) {
                        alert("Formato de respuesta no reconocido.");
                    }
                } else {
                    console.warn("Respuesta inesperada:", data);
                    alert("La respuesta del servidor no tiene el formato esperado (Array de predicciones).");
                }
            })
            .catch(error => {
                console.error('Error:', error);
                alert(`Error al predecir todo: ${error.message}`);
            })
            .finally(() => {
                btn.disabled = false;
                btn.textContent = originalText;
            });
    }

    function predictCsvRow(globalIndex, rowData, rowElement) {
        // Find indices
        const commentIndex = csvHeader.findIndex(h => h.toLowerCase().includes('comentario'));
        const classIndex = csvHeader.findIndex(h => h.toLowerCase().includes('clasificación') || h.toLowerCase().includes('clasificacion'));

        if (commentIndex === -1) {
            alert('No se encontró la columna "Comentario" en el CSV.');
            return;
        }

        const comentario = rowData[commentIndex];
        if (!comentario) return;

        fetch('http://localhost:7002/predict', {
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
                    if (classIndex !== -1) {
                        csvRows[globalIndex][classIndex] = data.prediccion;

                        // Update UI
                        const cells = rowElement.querySelectorAll('td');
                        if (cells[classIndex]) {
                            cells[classIndex].textContent = data.prediccion;
                            // Highlight change
                            cells[classIndex].style.backgroundColor = '#e6fffa';
                            setTimeout(() => {
                                cells[classIndex].style.backgroundColor = '';
                            }, 2000);
                        }
                    } else {
                        console.warn('Columna Clasificación no encontrada, no se puede actualizar la tabla visual.');
                        alert(`Predicción: ${data.prediccion}\n(No se pudo escribir en la tabla porque falta la columna "Clasificación")`);
                    }
                }
            })
            .catch((error) => {
                console.error('Error:', error);
            });
    }


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
        currentFileBase64 = null;

        // Update View
        updateArchivoView();
    });
});

// main.js
Dropzone.autoDiscover = false;

// Global Variables
let worker;
let sampleFiles = [];
let specificChrsContent = {};
let activeFileIds = new Set(); // Track active file IDs
let mainDataLoaded = false; // Flag to check if main data is loaded

// Initialize Web Worker
function initializeWorker() {
    worker = new Worker('scripts/worker.js');

    worker.onmessage = function (event) {
        const { type, fileId, percentage, statusText, result, error, message, fileName } = event.data;

        if (type === 'pyodide-ready') {
            console.log('Pyodide is ready in the worker.');
        }

        if (type === 'error') {
            console.error(message);
            alert(message);
        }

        if (type === 'progress') {
            if (!activeFileIds.has(fileId)) {
                // The file has been removed; ignore updates
                console.warn(`Received progress for inactive fileId: ${fileId}`);
                return;
            }
            updateProgressBar(fileId, percentage, statusText,
                percentage === 100 && statusText === 'Completed' ? 'bg-success' :
                    (statusText.startsWith('Failed') ? 'bg-danger' : 'bg-info'));
            if (percentage === 100 && statusText.startsWith('Failed')) {
                alert(`Processing failed for ${fileId}: ${error}`);
            }
        }
        if (type === 'result') {
            if (activeFileIds.has(fileId)) {
                displayResultsInTable(result, fileId, fileName);
            } else {
                console.warn(`Received result for inactive fileId: ${fileId}`);
            }
        }
    };

    // No need to send an 'init' message unless the worker expects it
}

initializeWorker();

// Define the directory structure
const speciesData = {
    "dog": {
        "genomes": {
            "canfam3.1": {
                "specific_chrs": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
                    "11", "12", "13", "14", "15", "16", "17", "18",
                    "19", "20", "21", "22", "23", "24", "25", "26",
                    "27", "28", "29", "30", "31", "32", "33", "34",
                    "35", "36", "37", "38", "X", "Y"]
            }
            // Add more genomes as needed
        },
        "y_chr": ["Y"],
        "amplicons": ["extracted_exome"]
    },
    "human": {
        "genomes": {
            "hg38": {
                "specific_chrs": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10",
                    "11", "12", "13", "14", "15", "16", "17", "18",
                    "19", "20", "21", "22", "X", "Y"]
            },
            "other_genome": {
                "specific_chrs": ["1", "2", "3", "X", "Y"]
            }
            // Add more genomes as needed
        },
        "y_chr": ["Y1", "Y2"],
        "amplicons": ["exome"]
    }
    // Add more species as needed
};

// Function to show or hide the loading animation
function showLoadingAnimation(show) {
    const loader = document.getElementById('loadingAnimation');
    loader.style.display = show ? 'flex' : 'none';
}

// Function to sanitize file names
function sanitizeFileName(fileName) {
    return fileName.replace(/[^a-z0-9\-_.]/gi, '_'); // Replace non-alphanumeric characters with '_'
}

// Function to handle file data based on type
async function handleFileData(file, fileType) {
    const fileContent = await file.text();
    const sanitizedFileName = sanitizeFileName(file.name);
    const uniqueFileName = `${Date.now()}-${sanitizedFileName}`; // Ensure uniqueness

    if (fileType === 'sample') {
        sampleFiles.push({ name: uniqueFileName, content: fileContent, type: 'sample' });
    } else if (fileType === 'genome') {
        // Only one genome file is allowed; replace if a new one is uploaded
        sampleFiles = sampleFiles.filter(f => f.type !== 'genome');
        sampleFiles.push({ name: uniqueFileName, content: fileContent, type: 'genome' });
    } else if (fileType === 'amplicon') {
        // Only one amplicon file is allowed; replace if a new one is uploaded
        sampleFiles = sampleFiles.filter(f => f.type !== 'amplicon');
        sampleFiles.push({ name: uniqueFileName, content: fileContent, type: 'amplicon' });
    }

    // Update the file object with the unique name
    file.name = uniqueFileName;
}

// Function to setup Dropzone for different file types
function setupDropzone(elementId, fileType) {
    return new Dropzone(elementId, {
        url: '#', // Dummy action as no server interaction is required
        autoProcessQueue: false, // Don't process queue as we're handling files client-side
        clickable: true,
        previewsContainer: false, // Disable preview
        acceptedFiles: '.sig,.zip', // Accept .sig and .zip files
        init: function () {
            this.on('addedfile', async function (file) {
                if (fileType === 'genome' && this.files.length > 1) {
                    this.removeFile(this.files[0]); // Keep only the most recent file if only one is allowed
                }

                // Sanitize and assign a unique name
                await handleFileData(file, fileType);

                // Create a unique identifier for the file
                const fileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                activeFileIds.add(fileId);

                // Create file entry with progress bar
                const uploadedFilesContainer = document.getElementById('uploaded-files');
                const fileRow = document.createElement('div');
                fileRow.className = 'file-info row mb-2';
                fileRow.id = fileId;
                fileRow.innerHTML = `
                    <div class="col-6">${file.name} - ${(file.size / 1024).toFixed(2)} KB</div>
                    <div class="col-4">
                        <div class="progress">
                            <div id="${fileId}-progress" class="progress-bar" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
                        </div>
                    </div>
                    <div class="col-2 text-right">
                        <button class="btn btn-danger btn-sm remove-file">Remove</button>
                    </div>
                `;

                // Append the file row to the container
                uploadedFilesContainer.appendChild(fileRow);

                // Handle remove button
                fileRow.querySelector('.remove-file').addEventListener('click', () => {
                    this.removeFile(file);
                    uploadedFilesContainer.removeChild(fileRow);
                    activeFileIds.delete(fileId);
                    if (fileType === 'sample') {
                        sampleFiles = sampleFiles.filter(f => f.name !== file.name);
                    } else if (fileType === 'genome') {
                        sampleFiles = sampleFiles.filter(f => !(f.type === 'genome' && f.name === file.name));
                    } else if (fileType === 'amplicon') {
                        sampleFiles = sampleFiles.filter(f => !(f.type === 'amplicon' && f.name === file.name));
                    }
                    // Remove corresponding table row
                    removeTableRow(file.name, fileId);
                });

                // Handle file data
                if (file.name.endsWith('.zip')) {
                    // Handle ZIP files
                    try {
                        const zip = await JSZip.loadAsync(file);
                        const sigFiles = Object.keys(zip.files).filter(name => !zip.files[name].dir && name.endsWith('.sig'));

                        if (sigFiles.length === 0) {
                            throw new Error('No .sig files found in the ZIP archive.');
                        }

                        // Show loading modal
                        showLoadingAnimation(true);

                        // Process each .sig file
                        const processingPromises = sigFiles.map(async (name) => {
                            const zipEntry = zip.files[name];
                            const sigContent = await zipEntry.async("string");
                            const uniqueZipFileName = `${Date.now()}-${sanitizeFileName(zipEntry.name)}`; // Ensure uniqueness

                            // Store extracted .sig files as samples with unique names
                            sampleFiles.push({ name: uniqueZipFileName, content: sigContent, type: 'sample' });

                            // Generate a unique fileId for the extracted file
                            const extractedFileId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                            activeFileIds.add(extractedFileId);

                            // Create file entry with progress bar for extracted file
                            const uploadedFilesContainerInner = document.getElementById('uploaded-files');
                            const extractedFileRow = document.createElement('div');
                            extractedFileRow.className = 'file-info row mb-2';
                            extractedFileRow.id = extractedFileId;
                            extractedFileRow.innerHTML = `
                                <div class="col-6">${uniqueZipFileName} - ${(sigContent.length / 1024).toFixed(2)} KB</div>
                                <div class="col-4">
                                    <div class="progress">
                                        <div id="${extractedFileId}-progress" class="progress-bar" role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
                                    </div>
                                </div>
                                <div class="col-2 text-right">
                                    <button class="btn btn-danger btn-sm remove-file">Remove</button>
                                </div>
                            `;
                            uploadedFilesContainerInner.appendChild(extractedFileRow);

                            // Handle remove button for extracted file
                            extractedFileRow.querySelector('.remove-file').addEventListener('click', () => {
                                uploadedFilesContainerInner.removeChild(extractedFileRow);
                                activeFileIds.delete(extractedFileId);
                                sampleFiles = sampleFiles.filter(f => f.name !== uniqueZipFileName);
                                removeTableRow(uniqueZipFileName, extractedFileId);
                            });

                            // Push the processing promise to the array
                            return processSignature(uniqueZipFileName, sigContent, extractedFileId);
                        });

                        // Await all processing promises
                        await Promise.all(processingPromises);

                        // Hide loading modal after processing
                        showLoadingAnimation(false);
                    } catch (error) {
                        console.error('Error extracting ZIP file:', error);
                        showLoadingAnimation(false); // Ensure loader is hidden on error
                        // Update progress bar to indicate failure for the main ZIP file
                        updateProgressBar(fileId, 100, 'Failed', 'bg-danger');
                        activeFileIds.delete(fileId);
                    }
                }
                else if (file.name.endsWith('.sig')) {
                    // Handle individual .sig files
                    try {
                        const content = await file.text();
                        console.log(`Uploaded ${file.name}:`);
                        // console.log(content);
                        // Store sample files
                        sampleFiles.push({ name: file.name, content: content, type: 'sample' });
                        // Push the processing promise to the array
                        const processingPromise = processSignature(file.name, content, fileId);

                        // Show loading modal
                        showLoadingAnimation(true);

                        // Await the processing
                        await processingPromise;

                        // Hide loading modal after processing
                        showLoadingAnimation(false);
                    } catch (error) {
                        console.error(`Error processing ${file.name}:`, error);
                        // Update progress bar to indicate failure
                        updateProgressBar(fileId, 100, 'Failed', 'bg-danger');
                        activeFileIds.delete(fileId);
                        showLoadingAnimation(false);
                    }
                }
            });

            this.on('removedfile', function (file) {
                // Find the corresponding fileId
                const fileRow = document.getElementById(file.id);
                if (fileRow) {
                    const fileId = fileRow.id;
                    activeFileIds.delete(fileId);
                    removeTableRow(file.name, fileId);
                }

                if (file.type === 'application/zip') {
                    // Remove extracted files from the list
                    sampleFiles = sampleFiles.filter(sig => !file.name.includes(sig.name));
                } else if (file.name.endsWith('.sig')) {
                    // Remove from sampleFiles
                    sampleFiles = sampleFiles.filter(sig => sig.name !== file.name);
                }
                // Remove corresponding table row
                removeTableRow(file.name, null);
            });
        }
    });
}

// Function to remove a table row based on sample name and optionally fileId
function removeTableRow(sampleName, fileId) {
    const rows = document.querySelectorAll('#resultsTableBody tr');
    rows.forEach(row => {
        const cells = row.getElementsByTagName('td');
        if (cells.length > 1) { // Ensure there are enough cells
            const rowFileId = cells[0].textContent;
            const rowSampleName = cells[1].textContent;
            if (fileId) {
                if (rowFileId === fileId) {
                    row.remove();
                }
            } else {
                if (rowSampleName === sampleName) {
                    row.remove();
                }
            }
        }
    });
    // If no rows left, hide the table container
    if (document.getElementById('resultsTableBody').rows.length === 0) {
        document.getElementById('resultsTableContainer').style.display = 'none';
    }
}

// Function to process a single signature file
async function processSignature(fileName, sigContent, fileId) {
    try {
        // Update progress to 10%
        updateProgressBar(fileId, 10, 'Starting...', 'bg-info');

        // Check if main data is loaded
        if (!window.loadedGenomeSig) {
            alert('Genome file is not loaded. Please load genome data first.');
            updateProgressBar(fileId, 100, 'Failed: Genome not loaded', 'bg-danger');
            activeFileIds.delete(fileId);
            return;
        }

        if (!window.loadedYchrSig) {
            alert('Y Chromosome file is not loaded. Please load Y Chromosome data first.');
            updateProgressBar(fileId, 100, 'Failed: Y Chromosome not loaded', 'bg-danger');
            activeFileIds.delete(fileId);
            return;
        }

        console.log(`Processing ${fileName}:`);

        // Get loaded genome and y_chr content
        const genomeContent = window.loadedGenomeSig;
        const ychrContent = window.loadedYchrSig;

        // Get selected species and genome
        const selectedSpecies = document.getElementById('species-select').value;
        const selectedGenome = document.getElementById('genome-select').value;

        // Get specific chromosomes for the selected genome
        const genomeData = speciesData[selectedSpecies].genomes[selectedGenome];
        const specificChrs = genomeData.specific_chrs;

        // Initialize specificChrsContent
        specificChrsContent = {};

        // Populate specificChrsContent from already fetched data
        specificChrs.forEach(chr => {
            if (window.specificChrsLoaded && window.specificChrsLoaded[chr]) {
                specificChrsContent[chr] = window.specificChrsLoaded[chr];
            } else {
                console.warn(`Specific chromosome ${chr} not loaded.`);
                specificChrsContent[chr] = ''; // Or handle as needed
            }
        });

        // Update progress to 40%
        updateProgressBar(fileId, 40, 'Preparing data for processing...', 'bg-info');

        // Load amplicon file if available from window
        let ampliconContent = null;
        if (window.loadedAmpliconSig) {
            ampliconContent = window.loadedAmpliconSig;
            console.log(`Loaded Amplicon:`);
        }

        // Prepare data to send to the worker
        const data = {
            fileId, // Pass the unique fileId
            fileName,
            sigContent,
            genomeContent,
            ychrContent,
            specificChrsContent,
            ampliconContent
        };

        // Send data to the worker for processing
        try {
            // Make sure data is serializable
            const testPayload = JSON.parse(JSON.stringify(data));
            worker.postMessage({ type: 'process-signature', data });
        } catch (error) {
            console.error('Error serializing data before sending to worker:', error);
            updateProgressBar(fileId, 100, 'Failed: Data serialization error', 'bg-danger');
            activeFileIds.delete(fileId);
        }

    } catch (error) {
        console.error(`Error processing ${fileName}:`, error);
        // Update progress bar to indicate failure
        updateProgressBar(fileId, 100, 'Failed', 'bg-danger');
        activeFileIds.delete(fileId);
    }
}

// Function to display results in the table
function displayResultsInTable(result, fileId, fileName) {
    const resultsTableBody = document.getElementById('resultsTableBody');
    const resultsTableHead = document.getElementById('resultsTableHead');

    // Define headers including 'File ID' and 'Sample Name'
    const keys = Object.keys(result);
    const headers = [...keys];

    // If headers are not yet created, create them
    if (resultsTableHead.innerHTML.trim() === '') {
        const headerRow = document.createElement('tr');
        headers.forEach(header => {
            const headerCell = document.createElement('th');
            headerCell.textContent = header;
            headerRow.appendChild(headerCell);
        });
        resultsTableHead.appendChild(headerRow);
    }

    // Create a new row for the result
    const row = document.createElement('tr');

    // Add File ID
    const fileIdCell = document.createElement('td');
    fileIdCell.textContent = fileId;
    // row.appendChild(fileIdCell);

    // Add Sample Name
    const sampleNameCell = document.createElement('td');
    sampleNameCell.textContent = fileName;
    // row.appendChild(sampleNameCell);

    // Add other result cells
    keys.forEach(key => {
        const cell = document.createElement('td');
        cell.textContent = result[key] || 'N/A';  // Use 'N/A' if value is missing
        row.appendChild(cell);
    });
    resultsTableBody.appendChild(row);

    // Show the results table container
    document.getElementById('resultsTableContainer').style.display = 'block';

    // Remove the fileId from active files as processing is complete
    activeFileIds.delete(fileId);
}

// Function to export the table as a TSV file
function exportTableToTSV() {
    const resultsTable = document.querySelector('table.table-striped');
    let tsv = '';

    // Extract headers
    const headers = Array.from(resultsTable.querySelectorAll('thead th'))
        .map(header => header.textContent)
        .join('\t') + '\n';
    tsv += headers;

    // Extract rows
    const rows = Array.from(resultsTable.querySelectorAll('tbody tr')).map(row => {
        return Array.from(row.cells)
            .map(cell => cell.textContent)
            .join('\t');
    }).join('\n');

    tsv += rows;

    // Create a downloadable TSV file
    const blob = new Blob([tsv], { type: 'text/tab-separated-values' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'results.tsv';
    link.click();
}

// Add export button functionality
document.addEventListener('DOMContentLoaded', function () {
    const exportButton = document.getElementById('exportButton');
    exportButton.addEventListener('click', exportTableToTSV);
});

// Function to setup Dropzone for samples
setupDropzone('#sample-upload-form', 'sample');

// Handle Species/Genome/Y Chromosome/Amplicon Selections
document.addEventListener('DOMContentLoaded', function () {
    const speciesSelect = document.getElementById('species-select');
    const genomeSelect = document.getElementById('genome-select');
    const ychrSelect = document.getElementById('ychr-select');
    const ampliconSelect = document.getElementById('amplicon-select');
    const loadDataButton = document.getElementById('load-data-button');
    const logInfo = document.getElementById('log-info');

    // Populate Species Dropdown
    for (const species in speciesData) {
        const option = document.createElement('option');
        option.value = species;
        option.textContent = species.charAt(0).toUpperCase() + species.slice(1);
        speciesSelect.appendChild(option);
    }

    // Event Listener for Species Selection
    speciesSelect.addEventListener('change', function () {
        const selectedSpecies = this.value;
        genomeSelect.innerHTML = '<option value="" disabled selected>Select Reference Genome</option>';
        genomeSelect.disabled = true;

        ychrSelect.innerHTML = '<option value="" disabled selected>Select Y Chromosome</option>';
        ychrSelect.disabled = true;

        ampliconSelect.innerHTML = '<option value="" disabled selected>Select Amplicon (Optional)</option>';
        ampliconSelect.disabled = true;

        loadDataButton.disabled = true;

        if (selectedSpecies && Object.keys(speciesData[selectedSpecies].genomes).length > 0) {
            for (const genome in speciesData[selectedSpecies].genomes) {
                const option = document.createElement('option');
                option.value = genome;
                option.textContent = genome;
                genomeSelect.appendChild(option);
            }
            genomeSelect.disabled = false;

            // Automatically select the first genome and trigger change
            genomeSelect.selectedIndex = 1;
            genomeSelect.dispatchEvent(new Event('change'));
        }
    });

    // Event Listener for Genome Selection
    genomeSelect.addEventListener('change', function () {
        const selectedSpecies = speciesSelect.value;
        const selectedGenome = this.value;
        ychrSelect.innerHTML = '<option value="" disabled selected>Select Y Chromosome</option>';
        ychrSelect.disabled = true;

        ampliconSelect.innerHTML = '<option value="" disabled selected>Select Amplicon (Optional)</option>';
        ampliconSelect.disabled = true;

        loadDataButton.disabled = true;

        if (selectedSpecies && selectedGenome && speciesData[selectedSpecies].genomes[selectedGenome].specific_chrs.length > 0) {
            speciesData[selectedSpecies].y_chr.forEach(ychr => {
                const option = document.createElement('option');
                option.value = ychr;
                option.textContent = ychr;
                ychrSelect.appendChild(option);
            });
            ychrSelect.disabled = false;

            // Automatically select the first Y chromosome and trigger change
            ychrSelect.selectedIndex = 1;
            ychrSelect.dispatchEvent(new Event('change'));
        }
    });

    // Event Listener for Y Chromosome Selection
    ychrSelect.addEventListener('change', function () {
        const selectedSpecies = speciesSelect.value;
        const selectedGenome = genomeSelect.value;
        const selectedYchr = this.value;
        ampliconSelect.innerHTML = '<option value="" disabled selected>Select Amplicon (Optional)</option>';
        ampliconSelect.disabled = true;
        loadDataButton.disabled = true;

        if (selectedSpecies && selectedGenome && selectedYchr) {
            if (speciesData[selectedSpecies].amplicons.length > 0) {
                speciesData[selectedSpecies].amplicons.forEach(amplicon => {
                    const option = document.createElement('option');
                    option.value = amplicon;
                    option.textContent = amplicon;
                    ampliconSelect.appendChild(option);
                });
                ampliconSelect.disabled = false;

                // Optionally, select the first amplicon
                ampliconSelect.selectedIndex = 1;
                ampliconSelect.dispatchEvent(new Event('change'));
            }
            loadDataButton.disabled = false;
        }
    });

    // Event Listener for Amplicon Selection (Optional)
    ampliconSelect.addEventListener('change', function () {
        // Amplicon is optional; no additional actions required for now
    });

    // Event Listener for Load Data Button
    loadDataButton.addEventListener('click', async function () {
        if (mainDataLoaded) {
            alert('Main data is already loaded.');
            return;
        }

        const selectedSpecies = speciesSelect.value;
        const selectedGenome = genomeSelect.value;
        const selectedYchr = ychrSelect.value;
        const selectedAmplicon = ampliconSelect.value;

        // Construct paths
        const genomePath = `data/species/${selectedSpecies}/genomes/${selectedGenome}/${selectedGenome}.sig`;
        const ychrPath = `data/species/${selectedSpecies}/y_chr/${selectedYchr}.sig`;
        const ampliconPath = selectedAmplicon ? `data/species/${selectedSpecies}/amplicons/${selectedAmplicon}.sig` : null;

        // Validate paths by attempting to fetch them
        showLoadingAnimation(true);
        try {
            // Fetch Genome File
            const genomeResponse = await fetch(genomePath);
            if (!genomeResponse.ok) {
                throw new Error(`Genome file not found: ${genomePath}`);
            }
            const genomeContent = await genomeResponse.text();
            console.log(`Loaded Genome (${selectedGenome}):`);
            console.log(genomeContent.substring(0, 50)); // Log first 50 characters

            // Fetch Y Chromosome File
            const ychrResponse = await fetch(ychrPath);
            if (!ychrResponse.ok) {
                throw new Error(`Y Chromosome file not found: ${ychrPath}`);
            }
            const ychrContent = await ychrResponse.text();
            console.log(`Loaded Y Chromosome (${selectedYchr}):`);
            console.log(ychrContent.substring(0, 50)); // Log first 50 characters

            // Fetch Specific Chromosomes
            const specificChrs = speciesData[selectedSpecies].genomes[selectedGenome].specific_chrs;
            window.specificChrsLoaded = {};

            const chrPromises = specificChrs.map(async (chr) => {
                const chrPath = `data/species/${selectedSpecies}/genomes/${selectedGenome}/specific_chrs/${chr}.sig`;
                try {
                    const response = await fetch(chrPath);
                    if (response.ok) {
                        const chrSigContent = await response.text();
                        window.specificChrsLoaded[chr] = chrSigContent;
                        console.log(`Loaded specific chromosome (${chr}):`);
                    } else {
                        console.error(`Failed to load chromosome file: ${chrPath}. Status: ${response.status} - ${response.statusText}`);
                        window.specificChrsLoaded[chr] = ''; // Handle missing chromosome data as needed
                    }
                } catch (error) {
                    console.error(`Error fetching specific chromosome (${chr}) from ${chrPath}:`, error);
                    window.specificChrsLoaded[chr] = ''; // Handle fetch error
                }
            });

            await Promise.all(chrPromises);

            // Fetch Amplicon File if selected
            let ampliconContent = null;
            if (ampliconPath) {
                const ampliconResponse = await fetch(ampliconPath);
                if (!ampliconResponse.ok) {
                    throw new Error(`Amplicon file not found: ${ampliconPath}`);
                }
                ampliconContent = await ampliconResponse.text();
                console.log(`Loaded Amplicon (${selectedAmplicon}):`);
                // console.log(ampliconContent.substring(0, 50)); // Log first 50 characters
            }

            // Assign fetched contents to global variables
            window.loadedGenomeSig = genomeContent;
            window.loadedYchrSig = ychrContent;
            window.loadedAmpliconSig = ampliconContent;

            logInfo.style.display = 'block';
            logInfo.textContent = `Loaded data for ${selectedSpecies} - ${selectedGenome} - ${selectedYchr}${selectedAmplicon ? ' - ' + selectedAmplicon : ''}`;

            // Mark main data as loaded
            mainDataLoaded = true;

            // Disable Load Data button to prevent reloading
            loadDataButton.disabled = true;
            loadDataButton.textContent = 'Data Loaded';
        } catch (error) {
            console.error('Error loading data files:', error);
            alert(error.message);
        } finally {
            showLoadingAnimation(false);
        }
    });
});

// Helper functions to get genome, y_chr, and amplicon content
function getGenomeContent() {
    const genomeFileObj = sampleFiles.find(f => f.type === 'genome');
    return genomeFileObj ? genomeFileObj.content : '{}';
}

function getYchrContent() {
    const ychrFileObj = sampleFiles.find(f => f.type === 'y_chr');
    return ychrFileObj ? ychrFileObj.content : '{}';
}

function getAmpliconContent() {
    const ampliconFileObj = sampleFiles.find(f => f.type === 'amplicon');
    return ampliconFileObj ? ampliconFileObj.content : null;
}

/**
 * Updates the progress bar for a specific file.
 * @param {string} fileId - The unique identifier for the file.
 * @param {number} percentage - The completion percentage (0-100).
 * @param {string} statusText - The status text to display.
 * @param {string} [additionalClass] - Optional Bootstrap class for the progress bar (e.g., 'bg-success').
 */
function updateProgressBar(fileId, percentage, statusText, additionalClass = '') {
    const progressBar = document.getElementById(`${fileId}-progress`);
    if (progressBar) {
        progressBar.style.width = `${percentage}%`;
        progressBar.setAttribute('aria-valuenow', percentage);
        progressBar.textContent = `${percentage}% - ${statusText}`;
        if (additionalClass) {
            progressBar.className = `progress-bar ${additionalClass}`;
        } else {
            // Reset to default if no additional class is provided
            progressBar.className = 'progress-bar';
        }
    }
}
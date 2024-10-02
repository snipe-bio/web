// main.js
Dropzone.autoDiscover = false;

// Global Variables
let pyodide;
let sampleFiles = [];
let specificChrsContent = {};

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

// Function to load Pyodide and required Python packages
async function loadPyodideAndPackages() {
    showLoadingAnimation(true);
    try {
        console.log('Loading Pyodide...');
        pyodide = await loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",
            fullStdLib: true
        });
        console.log('Pyodide loaded successfully.');

        console.log('Loading Python packages...');
        await pyodide.loadPackage(['micropip', 'numpy', 'pandas', 'scipy', 'scikit-learn']);
        console.log('Python packages loaded successfully.');

        console.log('Loading local Python files...');
        const response = await fetch('snipe.py');
        const code = await response.text();
        pyodide.runPython(code);
        console.log('Local Python files loaded successfully.');

        await pyodide.runPythonAsync(`
            print(dir(SigType))
        `);
        console.log('Python code executed successfully.');

        return pyodide;
    } catch (error) {
        console.error('Failed to load Pyodide or packages:', error);
    } finally {
        showLoadingAnimation(false);
    }
}

// Initialize Pyodide
let pyodideReady = loadPyodideAndPackages();

// Function to handle file data based on type
async function handleFileData(file, fileType) {
    const fileContent = await file.text();

    if (fileType === 'sample') {
        sampleFiles.push({ name: file.name, content: fileContent, type: 'sample' });
    } else if (fileType === 'genome') {
        // Only one genome file is allowed; replace if a new one is uploaded
        sampleFiles = sampleFiles.filter(f => f.type !== 'genome');
        sampleFiles.push({ name: file.name, content: fileContent, type: 'genome' });
    } else if (fileType === 'amplicon') {
        // Only one amplicon file is allowed; replace if a new one is uploaded
        sampleFiles = sampleFiles.filter(f => f.type !== 'amplicon');
        sampleFiles.push({ name: file.name, content: fileContent, type: 'amplicon' });
    }
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

                const fileRowContainer = document.querySelector(elementId + ' .file-list');
                if (fileRowContainer) {
                    const fileRow = document.createElement('div');
                    fileRow.className = 'file-info row';
                    fileRow.innerHTML = `<div class="col-8">${file.name} - ${(file.size / 1024).toFixed(2)} KB</div>
                                         <div class="col-4 text-right"><button class="btn btn-danger btn-sm remove-file">Remove</button></div>`;

                    fileRow.querySelector('.remove-file').addEventListener('click', () => {
                        this.removeFile(file);
                        fileRowContainer.removeChild(fileRow);
                        if (fileType === 'sample') {
                            sampleFiles = sampleFiles.filter(f => f.name !== file.name);
                        } else if (fileType === 'genome') {
                            sampleFiles = sampleFiles.filter(f => !(f.type === 'genome' && f.name === file.name));
                        } else if (fileType === 'amplicon') {
                            sampleFiles = sampleFiles.filter(f => !(f.type === 'amplicon' && f.name === file.name));
                        }
                        // Remove corresponding table row
                        removeTableRow(file.name);
                    });

                    fileRowContainer.appendChild(fileRow);
                }

                // Handle file data
                if (file.type === 'application/zip') {
                    // Handle ZIP files
                    const zip = new JSZip();
                    try {
                        const content = await zip.loadAsync(file);
                        const processingPromises = []; // Array to hold processing promises

                        content.forEach(async (relativePath, zipEntry) => {
                            if (!zipEntry.dir && zipEntry.name.endsWith('.sig')) {
                                const sigContent = await zipEntry.async("string");
                                console.log(`Extracted ${zipEntry.name}:`);
                                // console.log(sigContent);
                                // Store extracted .sig files as samples
                                sampleFiles.push({ name: zipEntry.name, content: sigContent, type: 'sample' });
                                // Push the processing promise to the array
                                processingPromises.push(processSignature(zipEntry.name, sigContent));
                            }
                        });

                        // Show loading modal
                        showLoadingAnimation(true);

                        // Await all processing promises
                        await Promise.all(processingPromises);

                        // Hide loading modal after processing
                        showLoadingAnimation(false);
                    } catch (error) {
                        console.error('Error extracting ZIP file:', error);
                        showLoadingAnimation(false); // Ensure loader is hidden on error
                    }
                } else if (file.name.endsWith('.sig')) {
                    // Handle individual .sig files
                    const content = await file.text();
                    console.log(`Uploaded ${file.name}:`);
                    console.log(content);
                    // Store sample files
                    sampleFiles.push({ name: file.name, content: content, type: 'sample' });
                    // Push the processing promise to the array
                    const processingPromise = processSignature(file.name, content);

                    // Show loading modal
                    showLoadingAnimation(true);

                    // Await the processing
                    await processingPromise;

                    // Hide loading modal after processing
                    showLoadingAnimation(false);
                }
            });

            this.on('removedfile', function (file) {
                if (file.type === 'application/zip') {
                    // Remove extracted files from the list
                    sampleFiles = sampleFiles.filter(sig => !file.name.includes(sig.name));
                } else if (file.name.endsWith('.sig')) {
                    // Remove from sampleFiles
                    sampleFiles = sampleFiles.filter(sig => sig.name !== file.name);
                }
                // Remove corresponding table row
                removeTableRow(file.name);
            });
        }
    });
}

// Function to remove a table row based on sample name
function removeTableRow(sampleName) {
    const rows = document.querySelectorAll('#resultsTableBody tr');
    rows.forEach(row => {
        if (row.cells[0].textContent === sampleName) {
            row.remove();
        }
    });
    // If no rows left, hide the table container
    if (document.getElementById('resultsTableBody').rows.length === 0) {
        document.getElementById('resultsTableContainer').style.display = 'none';
    }
}

// Function to process a single signature file
async function processSignature(fileName, sigContent) {
    const pyodide = await pyodideReady;
    try {
        // Check if genome and y_chr files are loaded from window
        if (!window.loadedGenomeSig) {
            alert('Genome file is not loaded. Please load genome data first.');
            return;
        }

        if (!window.loadedYchrSig) {
            alert('Y Chromosome file is not loaded. Please load Y Chromosome data first.');
            return;
        }

        // console log sigContent
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

        // Fetch each specific chromosome .sig file
        const chrPromises = specificChrs.map(async (chr) => {
            const chrPath = `data/species/${selectedSpecies}/genomes/${selectedGenome}/specific_chrs/${chr}.sig`;
            try {
                const response = await fetch(chrPath);
                if (response.ok) {
                    const chrSigContent = await response.text();
                    specificChrsContent[chr] = chrSigContent;
                    console.log(`Loaded specific chromosome (${chr}):`);
                    // console.log(chrSigContent.substring(0, 50)); // Log first 50 characters
                } else {
                    console.warn(`Specific chromosome file not found: ${chrPath}`);
                }
            } catch (error) {
                console.error(`Error fetching specific chromosome (${chr}):`, error);
            }
        });

        // Await all chromosome fetches
        await Promise.all(chrPromises);

        // Load amplicon file if available from window
        let ampliconContent = null;
        if (window.loadedAmpliconSig) {
            ampliconContent = window.loadedAmpliconSig;
            console.log(`Loaded Amplicon (${window.loadedAmpliconSig.name}):`);
            console.log(ampliconContent.substring(0, 50)); // Log first 50 characters
        }

        // Set Python variables
        pyodide.globals.set('genome_sig_str', JSON.stringify(genomeContent));
        pyodide.globals.set('ychr_sig_str', JSON.stringify(ychrContent));
        pyodide.globals.set('specific_chrs_sigs', JSON.stringify(specificChrsContent));
        pyodide.globals.set('amplicon_sig_str', JSON.stringify(ampliconContent) || '{}');
        pyodide.globals.set('sample_sig_str', JSON.stringify(sigContent));

        // set signature file name
        pyodide.globals.set('fileName', fileName);

        // Run Python processing
        const pythonCode = `
import json

def parse_json_string(json_str):
    try:
        # If the string starts and ends with quotes, it's a doubly wrapped JSON string
        if json_str.startswith('"') and json_str.endswith('"'):
            json_str = json.loads(json_str)  # First load to remove the extra wrapping quotes
        return json.loads(json_str)  # Final load to get the actual JSON object
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON: {e}")
        return None

result = process_sample(
        snipe_sample=json.dumps((parse_json_string(sample_sig_str))),
        snipe_genome=json.dumps(parse_json_string(genome_sig_str)),
        snipe_amplicon=json.dumps(parse_json_string(amplicon_sig_str)),
        dict_chrs_snipe_sigs=json.dumps(parse_json_string(specific_chrs_sigs)),
        biosample_id=fileName,
        bioproject_id=fileName,
        sample_id=fileName,
        assay_type="WGS",
    )

result_json = {
"SRA Experiment accession": result["SRA Experiment accession"],
"BioSample accession": result["BioSample accession"],
"BioProject accession": result["BioProject accession"],
"SRA Assay type": result["SRA Assay type"],
"Number of bases": result["Number of bases"],
"Library Layout": result["Library Layout"],
"Total unique k-mers": result["Total unique k-mers"],
"Genomic unique k-mers": result["Genomic unique k-mers"],
"Exome unique k-mers": result["Exome unique k-mers"],
"Genome coverage index": result["Genome coverage index"],
"Exome coverage index": result["Exome coverage index"],
"k-mer total abundance": result["k-mer total abundance"],
"k-mer mean abundance": result["k-mer mean abundance"],
"Genomic k-mers total abundance": result["Genomic k-mers total abundance"],
"Genomic k-mers mean abundance": result["Genomic k-mers mean abundance"],
"Genomic k-mers median abundance": result["Genomic k-mers median abundance"],
"Exome k-mers total abundance": result["Exome k-mers total abundance"],
"Exome k-mers mean abundance": result["Exome k-mers mean abundance"],
"Exome k-mers median abundance": result["Exome k-mers median abundance"],
"Mapping index": result["Mapping index"],
"Predicted contamination index": result["Predicted contamination index"],
"Empirical contamination index": result["Empirical contamination index"],
"Sequencing errors index": result["Sequencing errors index"],
"Autosomal k-mer mean abundance CV": result["Autosomal k-mer mean abundance CV"],
"Exome enrichment score": result["Exome enrichment score"],
"Predicted Assay type": result["Predicted Assay type"],
"chrX Ploidy score": result["chrX Ploidy score"],
"chrY Coverage score": result["chrY Coverage score"],
"Median-trimmed relative coverage": result["Median-trimmed relative coverage"],
"Relative mean abundance": result["Relative mean abundance"],
"Relative coverage": result["Relative coverage"],
"Coverage of 1fold more sequencing": result["Coverage of 1fold more sequencing"],
"Coverage of 2fold more sequencing": result["Coverage of 2fold more sequencing"],
"Coverage of 5fold more sequencing": result["Coverage of 5fold more sequencing"],
"Coverage of 9fold more sequencing": result["Coverage of 9fold more sequencing"],
"Relative total abundance": result["Relative total abundance"]
}

result_json
        `;

        const result = await pyodide.runPythonAsync(pythonCode);
        const resultObj = result.toJs()
        // console.log('Sample result:', resultObj); // Debugging line

        // Display the result in the table
        displayResultsInTable(resultObj);
    } catch (error) {
        console.error(`Error processing ${fileName}:`, error);
    }
}



// Function to display results in the table
// Function to display results in the table
function displayResultsInTable(result) {
    const resultsTableBody = document.getElementById('resultsTableBody');
    const resultsTableHead = document.getElementById('resultsTableHead');

    // Get the keys from the result object to dynamically generate the table headers
    const keys = Object.keys(result);

    // If headers are not yet created, create them
    if (resultsTableHead.innerHTML.trim() === '') {
        // Create table headers dynamically based on the result keys
        const headerRow = document.createElement('tr');
        keys.forEach(key => {
            const headerCell = document.createElement('th');
            headerCell.textContent = key;
            headerRow.appendChild(headerCell);
        });
        resultsTableHead.appendChild(headerRow);
    }

    // Create a new row for the result
    const row = document.createElement('tr');
    keys.forEach(key => {
        const cell = document.createElement('td');
        cell.textContent = result[key] || 'N/A';  // Use 'N/A' if value is missing
        row.appendChild(cell);
    });
    resultsTableBody.appendChild(row);

    // Show the results table container
    document.getElementById('resultsTableContainer').style.display = 'block';
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

            // Fetch Amplicon File if selected
            let ampliconContent = null;
            if (ampliconPath) {
                const ampliconResponse = await fetch(ampliconPath);
                if (!ampliconResponse.ok) {
                    throw new Error(`Amplicon file not found: ${ampliconPath}`);
                }
                ampliconContent = await ampliconResponse.text();
                // console.log(`Loaded Amplicon (${selectedAmplicon}):`);
                console.log(ampliconContent.substring(0, 50)); // Log first 50 characters
            }

            // Assign fetched contents to global variables
            window.loadedGenomeSig = genomeContent;
            window.loadedYchrSig = ychrContent;
            window.loadedAmpliconSig = ampliconContent;

            logInfo.style.display = 'block';
            logInfo.textContent = `Loaded data for ${selectedSpecies} - ${selectedGenome} - ${selectedYchr}${selectedAmplicon ? ' - ' + selectedAmplicon : ''}`;
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
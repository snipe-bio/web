// worker.js

importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js');

let pyodideReadyPromise = loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",
});

async function initializePyodide() {
    try {
        console.log('Initializing Pyodide...');
        self.pyodide = await pyodideReadyPromise;
        console.log('Pyodide loaded.');
        await self.pyodide.loadPackage(['micropip', 'numpy', 'pandas', 'scipy', 'scikit-learn']);
        console.log('Packages loaded.');

        // Fetch and run snipe.py
        console.log('Fetching snipe.py...');
        const response = await fetch('../snipe.py');
        if (!response.ok) {
            throw new Error(`Failed to fetch snipe.py: ${response.status} ${response.statusText}`);
        }
        const code = await response.text();
        console.log('Running snipe.py...');
        self.pyodide.runPython(code);
        console.log('snipe.py executed successfully.');

        self.postMessage({ type: 'pyodide-ready' });
    } catch (error) {
        console.error('Error initializing Pyodide:', error);
        self.postMessage({ type: 'error', message: `Pyodide Initialization Error: ${error.message}` });
    }
}

initializePyodide();

self.onmessage = async (event) => {
    const { type, data } = event.data;

    if (type === 'process-signature') {
        const { fileId, fileName, sigContent, genomeContent, ychrContent, specificChrsContent, ampliconContent } = data;

        try {
            console.log(`Processing signature for fileId: ${fileId}, fileName: ${fileName}`);

            // Update progress to 50%
            self.postMessage({ type: 'progress', fileId: fileId, percentage: 50, statusText: 'Setting up Python environment...' });

            // Set Python variables
            self.pyodide.globals.set('genome_sig_str', JSON.stringify(genomeContent));
            self.pyodide.globals.set('ychr_sig_str', JSON.stringify(ychrContent));
            self.pyodide.globals.set('specific_chrs_snipe_sigs', JSON.stringify(specificChrsContent));
            self.pyodide.globals.set('amplicon_sig_str', JSON.stringify(ampliconContent) || '{}');
            self.pyodide.globals.set('sample_sig_str', JSON.stringify(sigContent));
            self.pyodide.globals.set('fileName', fileName);
            console.log('Python variables set.');

            // Update progress to 60%
            self.postMessage({ type: 'progress', fileId: fileId, percentage: 60, statusText: 'Running Python processing...' });
            console.log('Running Python code...');

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
    dict_chrs_snipe_sigs=json.dumps(parse_json_string(specific_chrs_snipe_sigs)),
    biosample_id=fileName,
    bioproject_id=fileName,
    sample_id=fileName,
    assay_type="WGS",
)

result_json = {
    "SRA Experiment accession": result.get("SRA Experiment accession", "N/A"),
    "BioSample accession": result.get("BioSample accession", "N/A"),
    "BioProject accession": result.get("BioProject accession", "N/A"),
    "SRA Assay type": result.get("SRA Assay type", "N/A"),
    "Number of bases": result.get("Number of bases", "N/A"),
    "Library Layout": result.get("Library Layout", "N/A"),
    "Total unique k-mers": result.get("Total unique k-mers", "N/A"),
    "Genomic unique k-mers": result.get("Genomic unique k-mers", "N/A"),
    "Exome unique k-mers": result.get("Exome unique k-mers", "N/A"),
    "Genome coverage index": result.get("Genome coverage index", "N/A"),
    "Exome coverage index": result.get("Exome coverage index", "N/A"),
    "k-mer total abundance": result.get("k-mer total abundance", "N/A"),
    "k-mer mean abundance": result.get("k-mer mean abundance", "N/A"),
    "Genomic k-mers total abundance": result.get("Genomic k-mers total abundance", "N/A"),
    "Genomic k-mers mean abundance": result.get("Genomic k-mers mean abundance", "N/A"),
    "Genomic k-mers median abundance": result.get("Genomic k-mers median abundance", "N/A"),
    "Exome k-mers total abundance": result.get("Exome k-mers total abundance", "N/A"),
    "Exome k-mers mean abundance": result.get("Exome k-mers mean abundance", "N/A"),
    "Exome k-mers median abundance": result.get("Exome k-mers median abundance", "N/A"),
    "Mapping index": result.get("Mapping index", "N/A"),
    "Predicted contamination index": result.get("Predicted contamination index", "N/A"),
    "Empirical contamination index": result.get("Empirical contamination index", "N/A"),
    "Sequencing errors index": result.get("Sequencing errors index", "N/A"),
    "Autosomal k-mer mean abundance CV": result.get("Autosomal k-mer mean abundance CV", "N/A"),
    "Exome enrichment score": result.get("Exome enrichment score", "N/A"),
    "Predicted Assay type": result.get("Predicted Assay type", "N/A"),
    "chrX Ploidy score": result.get("chrX Ploidy score", "N/A"),
    "chrY Coverage score": result.get("chrY Coverage score", "N/A"),
    "Median-trimmed relative coverage": result.get("Median-trimmed relative coverage", "N/A"),
    "Relative mean abundance": result.get("Relative mean abundance", "N/A"),
    "Relative coverage": result.get("Relative coverage", "N/A"),
    "Coverage of 1fold more sequencing": result.get("Coverage of 1fold more sequencing", "N/A"),
    "Coverage of 2fold more sequencing": result.get("Coverage of 2fold more sequencing", "N/A"),
    "Coverage of 5fold more sequencing": result.get("Coverage of 5fold more sequencing", "N/A"),
    "Coverage of 9fold more sequencing": result.get("Coverage of 9fold more sequencing", "N/A"),
    "Relative total abundance": result.get("Relative total abundance", "N/A")
}

result_json
`;

            const result = await self.pyodide.runPythonAsync(pythonCode);
            console.log('Python code executed successfully.');

            const resultObj = result.toJs();
            console.log('Result obtained from Python:', resultObj);

            // Ensure resultObj is serializable
            const serializableResult = JSON.parse(JSON.stringify(resultObj));

            // Update progress to 100%
            self.postMessage({ type: 'progress', fileId: fileId, percentage: 100, statusText: 'Completed' });
            self.postMessage({ type: 'result', fileId: fileId, result: serializableResult });

            console.log(`Processing completed for fileId: ${fileId}`);
        } catch (error) {
            console.error(`Error processing ${fileName} in worker:`, error);
            self.postMessage({ type: 'progress', fileId: fileId, percentage: 100, statusText: 'Failed', error: error.message });
        }
    }
};



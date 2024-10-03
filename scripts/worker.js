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

            // Update progress to 10%
            self.postMessage({ type: 'progress', fileId: fileId, percentage: 10, statusText: 'Starting...' });

            // Set Python variables
            self.pyodide.globals.set('genome_sig_str', JSON.stringify(genomeContent));
            self.pyodide.globals.set('ychr_sig_str', JSON.stringify(ychrContent));
            self.pyodide.globals.set('specific_chrs_snipe_sigs', JSON.stringify(specificChrsContent));
            self.pyodide.globals.set('amplicon_sig_str', JSON.stringify(ampliconContent) || '{}');
            self.pyodide.globals.set('sample_sig_str', JSON.stringify(sigContent));
            self.pyodide.globals.set('fileName', fileName);
            self.pyodide.globals.set('fileId', fileId);
            console.log('Python variables set.');

            // Update progress to 60%
            self.postMessage({ type: 'progress', fileId: fileId, percentage: 60, statusText: 'Snipe in progress...' });
            console.log('Running Python code...');

            // Run Python processing
            const pythonCode = `
import json


file_name = fileName.split('.')[0]

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
        biosample_id=file_name,
        bioproject_id=file_name,
        sample_id=file_name,
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

            // Update progress to 80%
            const result = await self.pyodide.runPythonAsync(pythonCode);
            console.log('Python code executed successfully.');

            const resultObj = result.toJs();
            console.log('Result obtained from Python:', resultObj);

            // Ensure resultObj is serializable
            const serializableResult = JSON.parse(JSON.stringify(resultObj));

            // Update progress to 90%
            self.postMessage({ type: 'progress', fileId: fileId, percentage: 90, statusText: 'Processing results...' });

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


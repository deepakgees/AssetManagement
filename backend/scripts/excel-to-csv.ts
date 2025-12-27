import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Converts each worksheet in an Excel file to separate CSV files
 * @param excelFilePath - Path to the Excel file
 * @param outputDir - Directory where CSV files will be saved (defaults to same directory as Excel file)
 */
function convertExcelToCSV(excelFilePath: string, outputDir?: string): void {
  try {
    // Check if file exists
    if (!fs.existsSync(excelFilePath)) {
      throw new Error(`Excel file not found: ${excelFilePath}`);
    }

    // Read the Excel file
    console.log(`Reading Excel file: ${excelFilePath}`);
    const workbook = XLSX.readFile(excelFilePath);

    // Get the base name of the Excel file (without extension)
    const excelBaseName = path.basename(excelFilePath, path.extname(excelFilePath));
    
    // Determine output directory
    const finalOutputDir = outputDir || path.dirname(excelFilePath);
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(finalOutputDir)) {
      fs.mkdirSync(finalOutputDir, { recursive: true });
    }

    // Get all sheet names
    const sheetNames = workbook.SheetNames;
    console.log(`Found ${sheetNames.length} worksheet(s): ${sheetNames.join(', ')}`);

    // Convert each sheet to CSV
    sheetNames.forEach((sheetName, index) => {
      try {
        // Get the worksheet
        const worksheet = workbook.Sheets[sheetName];
        
        // Convert to CSV
        const csvData = XLSX.utils.sheet_to_csv(worksheet);
        
        // Create a safe filename from sheet name (remove invalid characters)
        const safeSheetName = sheetName.replace(/[<>:"/\\|?*]/g, '_').trim();
        const csvFileName = `${excelBaseName}-${safeSheetName}.csv`;
        const csvFilePath = path.join(finalOutputDir, csvFileName);
        
        // Write CSV file
        fs.writeFileSync(csvFilePath, csvData, 'utf8');
        console.log(`✓ Created: ${csvFilePath}`);
      } catch (error) {
        console.error(`✗ Error converting sheet "${sheetName}":`, error);
      }
    });

    console.log(`\n✓ Successfully converted ${sheetNames.length} worksheet(s) to CSV files in: ${finalOutputDir}`);
  } catch (error) {
    console.error('Error converting Excel to CSV:', error);
    process.exit(1);
  }
}

// Main execution
const excelFilePath = process.argv[2];
const outputDir = process.argv[3];

if (!excelFilePath) {
  console.error('Usage: ts-node excel-to-csv.ts <excel-file-path> [output-directory]');
  console.error('Example: ts-node excel-to-csv.ts ../templates/taxpnl-ZH5597-2025_2026-Q1-Q3.xlsx');
  console.error('Example: ts-node excel-to-csv.ts C:\\Work\\AssetManagement\\templates\\taxpnl-ZH5597-2025_2026-Q1-Q3.xlsx');
  process.exit(1);
}

// Resolve absolute path if relative
const resolvedPath = path.isAbsolute(excelFilePath) 
  ? excelFilePath 
  : path.resolve(process.cwd(), excelFilePath);

const resolvedOutputDir = outputDir 
  ? (path.isAbsolute(outputDir) ? outputDir : path.resolve(process.cwd(), outputDir))
  : undefined;

convertExcelToCSV(resolvedPath, resolvedOutputDir);


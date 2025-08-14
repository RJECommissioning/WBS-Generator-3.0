import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { parseXERFile } from './xerParser.js';

/**
 * Enhanced File Parser with Better XER Detection
 * 
 * ENHANCED: Better detection of XER files regardless of extension
 * ENHANCED: Comprehensive logging for debugging
 * ENHANCED: Support for both .xer and .txt extensions for XER files
 */

// Enhanced file type detection with XER content analysis
const detectFileType = (filename, content = '', fileBuffer = null) => {
  console.log('=== DETECTING FILE TYPE ===');
  console.log('Filename:', filename);
  console.log('Content length:', content.length);
  console.log('Has file buffer:', !!fileBuffer);
  
  const extension = filename.split('.').pop().toLowerCase();
  console.log('File extension:', extension);
  
  // 1. Excel files (binary detection)
  if (extension === 'xlsx' || extension === 'xls') {
    console.log('✅ Detected as Excel by extension');
    return 'excel_equipment_list';
  }
  
  // 2. Excel files disguised as CSV (buffer detection)
  if (fileBuffer && extension === 'csv') {
    const uint8Array = new Uint8Array(fileBuffer.slice(0, 4));
    const header = Array.from(uint8Array).map(b => String.fromCharCode(b)).join('');
    
    if (header === 'PK\x03\x04') {
      console.log('✅ Detected as Excel by binary header (PK)');
      return 'excel_equipment_list';
    }
  }
  
  // 3. XER files by extension
  if (extension === 'xer') {
    console.log('✅ Detected as XER by extension');
    return 'xer';
  }
  
  // 4. Content-based detection for text files (.txt, .csv)
  if (content && content.length > 0) {
    console.log('Analyzing content for type detection...');
    
    // XER content detection (works for .txt and .csv files with XER content)
    if (isXERContent(content)) {
      console.log('✅ Detected as XER by content analysis');
      return 'xer';
    }
    
    // Existing project CSV detection
    if (extension === 'csv') {
      const lines = content.split('\n').slice(0, 5);
      const headers = lines[0].toLowerCase();
      console.log('CSV headers:', headers.substring(0, 100));
      
      if (headers.includes('wbs_code') && headers.includes('parent_wbs_code')) {
        console.log('✅ Detected as existing project CSV');
        return 'existing_project';
      } else if (headers.includes('equipment') || headers.includes('description')) {
        console.log('✅ Detected as equipment list CSV');
        return 'equipment_list';
      }
    }
  }
  
  console.log('❓ Unknown file type');
  return 'unknown';
};

// Enhanced XER content detection
const isXERContent = (content) => {
  console.log('Checking if content is XER format...');
  
  if (!content || content.length < 100) {
    console.log('Content too short to be XER');
    return false;
  }
  
  // Check for XER-specific markers
  const xerMarkers = [
    '%T PROJWBS',     // Most important - PROJWBS table
    'ERMHDR',         // XER header
    '%T PROJECT',     // Project table
    '%F\t',          // Field definition with tab
    '%R\t'           // Record with tab
  ];
  
  const foundMarkers = xerMarkers.filter(marker => content.includes(marker));
  console.log('XER markers found:', foundMarkers);
  
  // Need at least PROJWBS table and field/record markers
  const hasProjWBS = content.includes('%T PROJWBS');
  const hasFieldDef = content.includes('%F');
  const hasRecords = content.includes('%R');
  
  console.log('XER content check:', {
    hasProjWBS,
    hasFieldDef,
    hasRecords,
    foundMarkers: foundMarkers.length
  });
  
  // Must have PROJWBS table and basic XER structure
  return hasProjWBS && hasFieldDef && hasRecords;
};

// Main parser dispatcher with enhanced logging
export const parseFile = async (file) => {
  try {
    console.log('=== STARTING FILE PARSING ===');
    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: new Date(file.lastModified).toISOString()
    });

    // Read file as array buffer first
    const fileBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(file);
    });

    console.log('File buffer loaded:', fileBuffer.byteLength, 'bytes');

    // Try binary detection first
    const fileType = detectFileType(file.name, '', fileBuffer);
    
    if (fileType === 'excel_equipment_list') {
      console.log('Processing as Excel file...');
      return {
        type: 'equipment_list',
        ...(await parseExcelFile(fileBuffer, file.name))
      };
    }

    // Read as text for content-based detection
    console.log('Reading file as text for content analysis...');
    const content = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });

    console.log('Text content loaded:', content.length, 'characters');
    console.log('First 200 characters:', content.substring(0, 200));

    // Detect file type based on content
    const textFileType = detectFileType(file.name, content);
    console.log('Final detected type:', textFileType);
    
    switch (textFileType) {
      case 'equipment_list':
        console.log('Processing as equipment list CSV...');
        return {
          type: 'equipment_list',
          ...(await parseCSVEquipmentList(content))
        };
        
      case 'xer':
        console.log('Processing as XER file...');
        return await parseXERFile(content);
        
      case 'existing_project':
        console.log('Processing as existing project CSV...');
        return {
          type: 'existing_project',
          hasData: false,
          data: [],
          dataLength: 0,
          originalHeaders: []
        };
        
      default:
        console.error('❌ Unsupported file type:', textFileType);
        throw new Error(`Unsupported file type: ${textFileType}. Supported formats: CSV, Excel (.xlsx), XER, TXT (with XER content)`);
    }

  } catch (error) {
    console.error('=== FILE PARSING FAILED ===');
    console.error('Error details:', error);
    throw new Error(`File parsing failed: ${error.message}`);
  }
};

// Excel file parser with enhanced logging
const parseExcelFile = (fileBuffer, filename) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('=== PARSING EXCEL FILE ===');
      console.log('File:', filename);
      
      const workbook = XLSX.read(fileBuffer, { 
        type: 'buffer',
        cellDates: true,
        cellNF: false,
        cellText: false
      });
      
      console.log('Workbook loaded, sheets:', workbook.SheetNames);
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      console.log('Processing sheet:', sheetName);
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        raw: false,
        dateNF: 'yyyy-mm-dd'
      });
      
      console.log('Raw data rows:', jsonData.length);
      
      if (jsonData.length < 2) {
        throw new Error('Excel file must have at least a header row and one data row');
      }
      
      const headers = jsonData[0].map(header => 
        header ? header.toString().toLowerCase().replace(/\s+/g, '_') : ''
      );
      
      console.log('Headers:', headers);
      
      const equipment = jsonData.slice(1)
        .map((row, index) => {
          const item = {};
          headers.forEach((header, colIndex) => {
            if (header) {
              item[header] = row[colIndex] || '';
            }
          });
          return item;
        })
        .filter(item => {
          return Object.values(item).some(value => 
            value && value.toString().trim() !== ''
          );
        });

      console.log('Processed equipment count:', equipment.length);
      
      if (equipment.length === 0) {
        throw new Error('No valid equipment data found in Excel file');
      }
      
         // Process the equipment data
    processData(equipment, headers)
      .then(result => {
        resolve({
          hasData: result.hasData,
          data: result.data,
          dataLength: result.dataLength,
          originalHeaders: result.originalHeaders,
          type: 'equipment_list'
        });
      })
  .catch(reject);

    } catch (error) {
      console.error('Excel parsing failed:', error);
      reject(new Error(`Excel parsing failed: ${error.message}`));
    }
  });
};

// CSV Equipment List Parser with enhanced logging
export const parseCSVEquipmentList = (csvContent) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('=== PARSING CSV EQUIPMENT LIST ===');
      console.log('Content length:', csvContent.length);
      
      Papa.parse(csvContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimitersToGuess: [',', '\t', '|', ';'],
        transformHeader: (header) => {
          return header.trim().toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
        },
        transform: (value, header) => {
          if (typeof value === 'string') {
            return value.trim();
          }
          return value;
        },
        complete: (results) => {
          try {
            console.log('Papa Parse complete, errors:', results.errors.length);
            
            if (results.errors.length > 0) {
              console.warn('CSV parsing warnings:', results.errors);
            }

            let equipment = results.data;
            console.log('Raw parsed data:', equipment.length, 'rows');
            
            equipment = equipment.filter(item => {
              return Object.values(item).some(value => 
                value && value.toString().trim() !== ''
              );
            });

            console.log('Filtered equipment:', equipment.length, 'rows');

            if (equipment.length === 0) {
              throw new Error('No valid equipment data found in CSV file');
            }

            processData(equipment, results.meta.fields || [])
              .then(result => {
                console.log('CSV processing complete:', result);
                resolve({
                  hasData: result.hasData,
                  data: result.data,
                  dataLength: result.dataLength,
                  originalHeaders: result.originalHeaders,
                  type: 'equipment_list'
                });
              })
              .catch(reject);

          } catch (processingError) {
            console.error('CSV processing error:', processingError);
            reject(new Error(`Error processing CSV data: ${processingError.message}`));
          }
        },
        error: (error) => {
          console.error('Papa Parse error:', error);
          reject(new Error(`CSV parsing failed: ${error.message}`));
        }
      });

    } catch (error) {
      console.error('CSV parsing failed:', error);
      reject(new Error(`Failed to parse equipment list: ${error.message}`));
    }
  });
};

// Shared data processing function with enhanced logging
const processData = (equipment, originalHeaders) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('=== PROCESSING EQUIPMENT DATA ===');
      console.log('Input:', equipment.length, 'items');
      console.log('Original headers:', originalHeaders);
      
      // Filter valid equipment
      const validEquipment = equipment.filter(item => {
        const possibleIds = ['equipment_number', 'equipment_no', 'equipment_code', 'code', 'equipment', 'tag', 'id'];
        return possibleIds.some(field => 
          item[field] && item[field].toString().trim() !== ''
        );
      });

      console.log('Valid equipment after filtering:', validEquipment.length);

      if (validEquipment.length === 0) {
        throw new Error('No equipment with valid identifiers found');
      }

      // Log sample data for debugging
      console.log('Sample equipment data:');
      validEquipment.slice(0, 3).forEach((item, index) => {
        console.log(`  ${index + 1}.`, item);
      });

      // Enhanced validation
      const validation = validateHeaders(Object.keys(validEquipment[0] || {}));
      console.log('Header validation:', validation);
      
      if (!validation.hasRequiredFields) {
        console.warn('Missing required fields:', validation.missingFields);
      }

      resolve({
        hasData: validEquipment.length > 0,
        data: validEquipment,
        dataLength: validEquipment.length,
        originalHeaders: originalHeaders,
        validation: validation,
        totalItems: validEquipment.length
      });

    } catch (error) {
      console.error('Equipment data processing failed:', error);
      reject(new Error(`Equipment data processing failed: ${error.message}`));
    }
  });
};

// Header validation helper with enhanced logging
const validateHeaders = (headers) => {
  console.log('Validating headers:', headers);
  
  const required = ['equipment_number', 'description'];
  const optional = ['parent_equipment_number', 'commissioning_yn', 'subsystem', 'plu_field'];
  
  const missingRequired = required.filter(field => !headers.includes(field));
  const missingOptional = optional.filter(field => !headers.includes(field));
  
  const validation = {
    hasRequiredFields: missingRequired.length === 0,
    missingFields: missingRequired,
    missingOptionalFields: missingOptional,
    availableFields: headers,
    score: ((required.length - missingRequired.length) + (optional.length - missingOptional.length)) / (required.length + optional.length)
  };
  
  console.log('Validation result:', validation);
  return validation;
};

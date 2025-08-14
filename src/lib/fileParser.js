import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { stringHelpers, validationHelpers } from '../utils';

/**
 * Complete File Parser - NO DUPLICATES, CLEAN BUILD
 * CRITICAL FIX: Correct column mapping for parent_equipment_number
 */

// Excel Equipment List Parser with DEBUG
export const parseExcelFile = (fileBuffer, filename) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('🔍 PARSING EXCEL FILE WITH COLUMN DEBUG');
      
      // Parse Excel workbook
      const workbook = XLSX.read(fileBuffer, {
        cellStyles: true,
        cellFormulas: true,
        cellDates: true,
        cellNF: true,
        sheetStubs: false
      });

      console.log('Excel Workbook Sheets:', workbook.SheetNames);

      // Find the equipment sheet
      let sheetName = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('equipment') || 
        name.toLowerCase().includes('list')
      ) || workbook.SheetNames.find(name => 
        !name.toLowerCase().includes('cover') && 
        !name.toLowerCase().includes('summary')
      ) || workbook.SheetNames[0];

      console.log('Using sheet:', sheetName);

      const worksheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      console.log('Sheet range:', range);

      // Convert to arrays (preserving order)
      const rawData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        defval: '',
        raw: false
      });

      console.log('Raw data rows:', rawData.length);
      console.log('First row (headers):', rawData[0]);

      // Clean up headers (remove empty columns at the end)
      let headers = rawData[0] || [];
      
      let lastMeaningfulColumn = -1;
      for (let i = headers.length - 1; i >= 0; i--) {
        if (headers[i] && headers[i].toString().trim() !== '') {
          lastMeaningfulColumn = i;
          break;
        }
      }
      
      headers = headers.slice(0, lastMeaningfulColumn + 1);
      
      console.log('Cleaned headers count:', headers.length);
      console.log('Cleaned headers:', headers);

      // 🔍 CRITICAL DEBUG: Show exact column positions
      console.log('🔍 EXCEL COLUMN MAPPING:');
      headers.forEach((header, index) => {
        console.log(`   Column ${index}: "${header}"`);
      });

      // Normalize header names  
      const normalizedHeaders = headers.map(header => 
        header.toString().trim().toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '')
      );

      console.log('Normalized headers:', normalizedHeaders);

      // Convert data rows to objects with CORRECT column mapping
      const dataRows = rawData.slice(1);
      const equipment = dataRows
        .filter(row => row && row.length > 0)
        .map((row, rowIndex) => {
          const item = {};
          
          // 🔍 CRITICAL DEBUG: Log exact column data for first 5 rows
          if (rowIndex < 5) {
            console.log(`🔍 ROW ${rowIndex + 2} RAW DATA:`);
            console.log(`   Col 4 (Parent Equip): "${row[4]}"`);
            console.log(`   Col 5 (Equipment): "${row[5]}"`);
            console.log(`   Col 13 (Commissioning): "${row[13]}"`);
          }
          
          // Map each normalized header to its corresponding column data
          normalizedHeaders.forEach((header, index) => {
            if (header && header.trim() !== '' && row[index] !== undefined) {
              item[header] = row[index] || '';
              
              // 🔍 DEBUG: Show parent equipment mapping specifically
              if (rowIndex < 5 && header === 'parent_equipment_number') {
                console.log(`   MAPPED: parent_equipment_number = "${row[index]}" (from col ${index})`);
              }
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
      
      // 🔍 FINAL VERIFICATION: Show processed items
      console.log('🔍 PROCESSED EQUIPMENT SAMPLE:');
      equipment.slice(0, 5).forEach((item, index) => {
        console.log(`   Processed ${index + 1}:`, {
          equipment_number: item.equipment_number,
          parent_equipment_number: item.parent_equipment_number,
          commissioning_yn: item.commissioning_yn
        });
      });

      // Process the equipment data
      processData(equipment, normalizedHeaders)
        .then(result => {
          console.log('Equipment processing complete:', {
            totalProcessed: result.totalItems,
            validationErrors: result.validation?.errors?.length || 0,
            originalHeaders: result.originalHeaders
          });
          
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

// CSV Equipment List Parser
export const parseCSVEquipmentList = (csvContent) => {
  return new Promise((resolve, reject) => {
    try {
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
            if (results.errors.length > 0) {
              console.warn('CSV parsing warnings:', results.errors);
            }

            let equipment = results.data;
            
            equipment = equipment.filter(item => {
              return Object.values(item).some(value => 
                value && value.toString().trim() !== ''
              );
            });

            processData(equipment, results.meta.fields || [])
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

          } catch (processingError) {
            reject(new Error(`Error processing CSV data: ${processingError.message}`));
          }
        },
        error: (error) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        }
      });

    } catch (error) {
      reject(new Error(`Failed to parse equipment list: ${error.message}`));
    }
  });
};

// Shared data processing function
const processData = (equipment, originalHeaders) => {
  return new Promise((resolve, reject) => {
    try {
      // Filter valid equipment
      equipment = equipment.filter(item => {
        const possibleIds = ['equipment_number', 'equipment_no', 'equipment_code', 'code', 'equipment', 'tag', 'id'];
        return possibleIds.some(field => 
          item[field] && item[field].toString().trim() !== ''
        );
      });

      // 🔍 FINAL DEBUG: Show data going to equipment processor
      console.log('🔍 DATA TO EQUIPMENT PROCESSOR:');
      equipment.slice(0, 5).forEach((item, index) => {
        console.log(`   To Processor ${index + 1}:`, {
          equipment_number: item.equipment_number,
          parent_equipment_number: item.parent_equipment_number,
          commissioning_yn: item.commissioning_yn
        });
      });

      // Enhanced validation
      const validation = validateHeaders(Object.keys(equipment[0] || {}));
      
      if (!validation.hasRequiredFields) {
        console.warn('Missing required fields:', validation.missingFields);
      }

      resolve({
        hasData: equipment.length > 0,
        data: equipment,
        dataLength: equipment.length,
        originalHeaders: originalHeaders,
        validation: validation,
        totalItems: equipment.length
      });

    } catch (error) {
      console.error('Equipment data processing failed:', error);
      reject(new Error(`Equipment data processing failed: ${error.message}`));
    }
  });
};

// Header validation helper
const validateHeaders = (headers) => {
  const required = ['equipment_number', 'description'];
  const optional = ['parent_equipment_number', 'commissioning_yn', 'subsystem', 'plu_field'];
  
  const missingRequired = required.filter(field => !headers.includes(field));
  const missingOptional = optional.filter(field => !headers.includes(field));
  
  return {
    hasRequiredFields: missingRequired.length === 0,
    missingFields: missingRequired,
    missingOptionalFields: missingOptional,
    availableFields: headers,
    score: ((required.length - missingRequired.length) + (optional.length - missingOptional.length)) / (required.length + optional.length)
  };
};

// File type detection
const detectFileType = (filename, content = '', fileBuffer = null) => {
  const extension = filename.split('.').pop().toLowerCase();
  
  if (extension === 'xlsx' || extension === 'xls') {
    return 'excel_equipment_list';
  }
  
  if (fileBuffer && extension === 'csv') {
    const uint8Array = new Uint8Array(fileBuffer.slice(0, 4));
    const header = Array.from(uint8Array).map(b => String.fromCharCode(b)).join('');
    
    if (header === 'PK\x03\x04') {
      return 'excel_equipment_list';
    }
  }
  
  if (extension === 'xer') {
    return 'xer';
  }
  
  if (extension === 'csv') {
    const lines = content.split('\n').slice(0, 5);
    const headers = lines[0].toLowerCase();
    
    if (headers.includes('wbs_code') && headers.includes('parent_wbs_code')) {
      return 'existing_project';
    } else if (headers.includes('equipment') || headers.includes('description')) {
      return 'equipment_list';
    }
  }
  
  return 'unknown';
};

// Main parser dispatcher
export const parseFile = async (file) => {
  try {
    const fileBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(file);
    });

    const fileType = detectFileType(file.name, '', fileBuffer);
    
    if (fileType === 'excel_equipment_list') {
      return {
        type: 'equipment_list',
        ...(await parseExcelFile(fileBuffer, file.name))
      };
    }

    const content = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });

    const textFileType = detectFileType(file.name, content);
    
    switch (textFileType) {
      case 'equipment_list':
        return {
          type: 'equipment_list',
          ...(await parseCSVEquipmentList(content))
        };
        
      case 'xer':
        return {
          type: 'xer',
          hasData: false,
          data: [],
          dataLength: 0,
          originalHeaders: []
        };
        
      case 'existing_project':
        return {
          type: 'existing_project',
          hasData: false,
          data: [],
          dataLength: 0,
          originalHeaders: []
        };
        
      default:
        throw new Error(`Unsupported file type: ${textFileType}. Supported formats: CSV, Excel (.xlsx), XER`);
    }

  } catch (error) {
    throw new Error(`File parsing failed: ${error.message}`);
  }
};

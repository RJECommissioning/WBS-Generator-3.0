import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { stringHelpers, validationHelpers } from '../utils';

/**
 * File Parser - CRITICAL FIX for Column Mapping Bug
 * ISSUE: parent_equipment_number getting equipment_number data
 * FIX: Correct Excel array-to-object conversion with proper column indexing
 */

// Excel Equipment List Parser - FIXED COLUMN MAPPING
export const parseExcelFile = (fileBuffer, filename) => {
  return new Promise((resolve, reject) => {
    try {
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
        header: 1, // Use arrays instead of objects
        defval: '', // Default value for empty cells
        raw: false // Convert to strings
      });

      console.log('Raw data rows:', rawData.length);
      console.log('First row (headers):', rawData[0]);

      // Clean up headers (remove empty columns at the end)
      let headers = rawData[0] || [];
      
      // Find the last meaningful column
      let lastMeaningfulColumn = -1;
      for (let i = headers.length - 1; i >= 0; i--) {
        if (headers[i] && headers[i].toString().trim() !== '') {
          lastMeaningfulColumn = i;
          break;
        }
      }
      
      // Trim headers to meaningful columns only
      headers = headers.slice(0, lastMeaningfulColumn + 1);
      
      console.log('Cleaned headers count:', headers.length);
      console.log('Cleaned headers:', headers);

      // 🔍 CRITICAL DEBUG: Show exact column positions
      console.log('🔍 COLUMN MAPPING DEBUG:');
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

      // 🔍 CRITICAL FIX: Proper array-to-object conversion with CORRECT column indexing
      const dataRows = rawData.slice(1);
      const equipment = dataRows
        .filter(row => row && row.length > 0) // Filter empty rows
        .map((row, rowIndex) => {
          const item = {};
          
          // 🔍 CRITICAL DEBUG: Log first 3 rows with exact column mapping
          if (rowIndex < 3) {
            console.log(`🔍 ROW ${rowIndex + 1} MAPPING:`);
            console.log(`   Column 4 (Parent Equipment Number): "${row[4]}"`);
            console.log(`   Column 5 (Equipment Number): "${row[5]}"`);
            console.log(`   Column 6 (Description): "${row[6]}"`);
            console.log(`   Column 13 (Commissioning): "${row[13]}"`);
          }
          
          // Map each column to normalized header names
          normalizedHeaders.forEach((header, index) => {
            // Only include columns that have meaningful headers
            if (header && header.trim() !== '' && row[index] !== undefined) {
              item[header] = row[index] || '';
              
              // 🔍 DEBUG: Log parent equipment number assignments for first 3 rows
              if (rowIndex < 3 && header === 'parent_equipment_number') {
                console.log(`     MAPPED: ${header} = "${row[index]}" (from column ${index})`);
              }
            }
          });
          
          return item;
        })
        .filter(item => {
          // Filter out completely empty items
          return Object.values(item).some(value => 
            value && value.toString().trim() !== ''
          );
        });

      console.log('Processed equipment count:', equipment.length);
      
      // 🔍 CRITICAL DEBUG: Show sample processed items with parent data
      console.log('🔍 SAMPLE PROCESSED ITEMS:');
      equipment.slice(0, 3).forEach((item, index) => {
        console.log(`   Item ${index + 1}:`, {
          equipment_number: item.equipment_number,
          parent_equipment_number: item.parent_equipment_number,
          commissioning_yn: item.commissioning_yn
        });
      });

      // Log equipment codes for debugging
      const equipmentCodes = equipment
        .map(item => {
          // Find potential equipment code fields
          const codeFields = ['equipment_number', 'equipment_no', 'equipment_code', 'code', 'equipment', 'tag', 'id'];
          for (const field of codeFields) {
            if (item[field] && item[field].toString().trim() !== '') {
              return item[field].toString().trim();
            }
          }
          return null;
        })
        .filter(code => code)
        .slice(0, 10); // First 10 for debugging

      console.log('Sample equipment codes:', equipmentCodes);

      // Check for parent-child relationships
      const parentFields = equipment.map(item => {
        const parentFields = ['parent_equipment_number', 'parent_equipment_code', 'parent_equipment', 'parent_code', 'parent_tag', 'parent'];
        for (const field of parentFields) {
          if (item[field] && item[field].toString().trim() !== '') {
            return field;
          }
        }
        return null;
      }).filter(field => field);

      console.log('Parent relationship fields found:', [...new Set(parentFields)]);

      // Now process using the same logic as CSV parser
      processEquipmentData(equipment, normalizedHeaders)
        .then(result => {
          console.log('Equipment processing complete:', {
            totalProcessed: result.totalItems,
            validationErrors: result.validation?.errors?.length || 0,
            originalHeaders: result.originalHeaders
          });
          
          // CRITICAL FIX: Ensure proper structure for StartNewProject
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
export const parseEquipmentList = (csvContent) => {
  return new Promise((resolve, reject) => {
    try {
      // Parse CSV with robust settings
      Papa.parse(csvContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimitersToGuess: [',', '\t', '|', ';'],
        transformHeader: (header) => {
          // Clean and normalize headers
          return header.trim().toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
        },
        transform: (value, header) => {
          // Clean data values
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
            
            // Remove empty rows
            equipment = equipment.filter(item => {
              return Object.values(item).some(value => 
                value && value.toString().trim() !== ''
              );
            });

            processEquipmentData(equipment, results.meta.fields || [])
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

// FIXED: Shared equipment data processing logic with CONSISTENT field names
const processEquipmentData = (equipment, originalHeaders) => {
  return new Promise((resolve, reject) => {
    try {
      // Remove empty rows
      equipment = equipment.filter(item => {
        // Look for any field that might be an equipment identifier
        const possibleIds = ['equipment_number', 'equipment_no', 'equipment_code', 'code', 'equipment', 'tag', 'id'];
        return possibleIds.some(field => 
          item[field] && item[field].toString().trim() !== ''
        );
      });

      // 🔍 CRITICAL DEBUG: Show equipment data BEFORE column normalization
      console.log('🔍 EQUIPMENT DATA BEFORE NORMALIZATION:');
      equipment.slice(0, 3).forEach((item, index) => {
        console.log(`   Pre-Norm ${index + 1}:`, {
          equipment_number: item.equipment_number,
          parent_equipment_number: item.parent_equipment_number,
          commissioning_yn: item.commissioning_yn
        });
      });

      // FIXED: Normalize column names with CONSISTENT mapping - NO OVERWRITES
      equipment = equipment.map((item, itemIndex) => {
        const normalized = {};
        
        // 🔍 CRITICAL DEBUG: Log raw item data for first 3 items
        if (itemIndex < 3) {
          console.log(`🔍 NORMALIZING ITEM ${itemIndex + 1}:`);
          console.log(`   Raw item keys:`, Object.keys(item));
          console.log(`   Raw equipment_number: "${item.equipment_number}"`);
          console.log(`   Raw parent_equipment_number: "${item.parent_equipment_number}"`);
        }
        
        // CRITICAL FIX: Map common column variations to CONSISTENT standard names
        const columnMappings = {
          'equipment_number': ['equipment_number', 'equipment_no', 'equipment_code', 'code', 'equipment', 'tag', 'id', 'asset_number', 'tag_number'],
          'description': ['description', 'desc', 'equipment_description', 'name', 'title', 'equipment_name', 'asset_description'],
          'plu_field': ['plu_field', 'plu', 'secondary_code', 'alt_code', 'alternative_code'],
          'commissioning_yn': ['commissioning_yn', 'commissioning_status', 'status', 'commissioning', 'comm_status', 'commission_status', 'included'],
          'parent_equipment_number': ['parent_equipment_number', 'parent_equipment_code', 'parent_equipment', 'parent_code', 'parent_tag', 'parent'],
          'subsystem': ['subsystem', 'sub_system', 'system', 'sys'],
          'location': ['location', 'area', 'zone'],
          'category': ['category', 'cat', 'type', 'class'],
          'manufacturer': ['manufacturer', 'make', 'vendor', 'supplier'],
          'model': ['model', 'model_number', 'part_number'],
          'voltage': ['voltage', 'volt', 'kv', 'rated_voltage'],
          'power': ['power', 'kw', 'mw', 'rating', 'capacity']
        };

        // Find matching columns for each standard field
        for (const [standardField, variations] of Object.entries(columnMappings)) {
          const matchingKey = Object.keys(item).find(key => 
            variations.includes(key) || 
            variations.some(variation => key.includes(variation))
          );
          
          if (matchingKey && item[matchingKey] !== undefined) {
            normalized[standardField] = item[matchingKey];
            
            // 🔍 CRITICAL DEBUG: Log parent equipment number mapping for first 3 items
            if (itemIndex < 3 && standardField === 'parent_equipment_number') {
              console.log(`     COLUMN MAPPING: ${standardField} = "${item[matchingKey]}" (from key: "${matchingKey}")`);
            }
          }
        }

        // Add any unmapped fields as-is (but don't overwrite the mapped ones)
        for (const [key, value] of Object.entries(item)) {
          if (!Object.values(columnMappings).flat().includes(key) && !normalized[key]) {
            normalized[key] = value;
          }
        }

        // 🔍 CRITICAL DEBUG: Log final normalized item for first 3 items
        if (itemIndex < 3) {
          console.log(`   Final normalized item:`, {
            equipment_number: normalized.equipment_number,
            parent_equipment_number: normalized.parent_equipment_number,
            commissioning_yn: normalized.commissioning_yn
          });
          console.log(`   ───────────────────────────────────────`);
        }

        return normalized;
      });

      // 🔍 FINAL VERIFICATION: Check if parent data is correct after normalization
      console.log('🔍 FINAL EQUIPMENT SAMPLE (after normalization):');
      equipment.slice(0, 5).forEach((item, index) => {
        console.log(`   Final ${index + 1}:`, {
          equipment_number: item.equipment_number,
          parent_equipment_number: item.parent_equipment_number,
          commissioning_yn: item.commissioning_yn
        });
      });

      // Now process using the same logic as CSV parser
      processEquipmentData(equipment, normalizedHeaders)
        .then(result => {
          console.log('Equipment processing complete:', {
            totalProcessed: result.totalItems,
            validationErrors: result.validation?.errors?.length || 0,
            originalHeaders: result.originalHeaders
          });
          
          // CRITICAL FIX: Ensure proper structure for StartNewProject
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
export const parseEquipmentList = (csvContent) => {
  return new Promise((resolve, reject) => {
    try {
      // Parse CSV with robust settings
      Papa.parse(csvContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimitersToGuess: [',', '\t', '|', ';'],
        transformHeader: (header) => {
          // Clean and normalize headers
          return header.trim().toLowerCase()
            .replace(/\s+/g, '_')
            .replace(/[^a-z0-9_]/g, '');
        },
        transform: (value, header) => {
          // Clean data values
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
            
            // Remove empty rows
            equipment = equipment.filter(item => {
              return Object.values(item).some(value => 
                value && value.toString().trim() !== ''
              );
            });

            processEquipmentData(equipment, results.meta.fields || [])
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

// FIXED: Shared equipment data processing logic with CONSISTENT field names  
const processEquipmentData = (equipment, originalHeaders) => {
  return new Promise((resolve, reject) => {
    try {
      // Remove empty rows
      equipment = equipment.filter(item => {
        // Look for any field that might be an equipment identifier
        const possibleIds = ['equipment_number', 'equipment_no', 'equipment_code', 'code', 'equipment', 'tag', 'id'];
        return possibleIds.some(field => 
          item[field] && item[field].toString().trim() !== ''
        );
      });

      // 🔍 CRITICAL DEBUG: Verify data integrity before sending to equipment processor
      console.log('🔍 DATA INTEGRITY CHECK (processEquipmentData):');
      equipment.slice(0, 5).forEach((item, index) => {
        console.log(`   Integrity ${index + 1}:`, {
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

      // Return processed data
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

// File type detection helper
const detectFileType = (filename, content = '', fileBuffer = null) => {
  const extension = filename.split('.').pop().toLowerCase();
  
  // Check for Excel files
  if (extension === 'xlsx' || extension === 'xls') {
    return 'excel_equipment_list';
  }
  
  // Check if it's actually an Excel file disguised as CSV
  if (fileBuffer && extension === 'csv') {
    // Check for Excel file signatures
    const uint8Array = new Uint8Array(fileBuffer.slice(0, 4));
    const header = Array.from(uint8Array).map(b => String.fromCharCode(b)).join('');
    
    if (header === 'PK\x03\x04') {
      // This is a ZIP file (Excel format)
      return 'excel_equipment_list';
    }
  }
  
  if (extension === 'xer') {
    return 'xer';
  }
  
  if (extension === 'csv') {
    // Try to detect if it's an equipment list or existing project
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
    // First, try to detect if this is an Excel file
    const fileBuffer = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsArrayBuffer(file);
    });

    // Detect file type using both filename and binary content
    const fileType = detectFileType(file.name, '', fileBuffer);
    
    // Handle Excel files
    if (fileType === 'excel_equipment_list') {
      return {
        type: 'equipment_list',
        ...(await parseExcelFile(fileBuffer, file.name))
      };
    }

    // For other files, read as text
    const content = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });

    // Re-detect file type with text content
    const textFileType = detectFileType(file.name, content);
    
    // Parse based on type
    switch (textFileType) {
      case 'equipment_list':
        return {
          type: 'equipment_list',
          ...(await parseEquipmentList(content))
        };
        
      case 'xer':
        return {
          type: 'xer',
          ...(await parseXERFile(content))
        };
        
      case 'existing_project':
        return {
          type: 'existing_project',
          ...(await parseExistingProject(content))
        };
        
      default:
        throw new Error(`Unsupported file type: ${textFileType}. Supported formats: CSV, Excel (.xlsx), XER`);
    }

  } catch (error) {
    throw new Error(`File parsing failed: ${error.message}`);
  }
};

// Placeholder parsers for missing functionality
const parseXERFile = (content) => {
  return new Promise((resolve) => {
    resolve({
      hasData: false,
      data: [],
      dataLength: 0,
      originalHeaders: [],
      type: 'xer'
    });
  });
};

const parseExistingProject = (content) => {
  return new Promise((resolve) => {
    resolve({
      hasData: false,
      data: [],
      dataLength: 0,
      originalHeaders: [],
      type: 'existing_project'
    });
  });
};

import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { stringHelpers, validationHelpers } from '../utils';

/**
 * File Parser - Handles CSV, Excel (.xlsx), and XER file parsing
 * CRITICAL FIX: Name-based column mapping with CONSISTENT field names
 * - parent_equipment_number (NOT parent_equipment_code)
 * - commissioning_yn (for "Commissioning (Y/N)" column)
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

      // Normalize header names
      const normalizedHeaders = headers.map(header => 
        header.toString().trim().toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '')
      );

      console.log('Normalized headers:', normalizedHeaders);

      // Convert data rows to objects with normalized headers
      const dataRows = rawData.slice(1);
      const equipment = dataRows
        .filter(row => row && row.length > 0) // Filter empty rows
        .map(row => {
          const item = {};
          normalizedHeaders.forEach((header, index) => {
            // Only include columns that have meaningful headers
            if (header && header.trim() !== '' && row[index] !== undefined) {
              item[header] = row[index] || '';
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
      console.log('Sample equipment item:', equipment[0]);

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

      // FIXED: Normalize column names with CONSISTENT mapping
      equipment = equipment.map(item => {
        const normalized = {};
        
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
          }
        }

        // Add any unmapped fields as-is
        for (const [key, value] of Object.entries(item)) {
          if (!Object.values(columnMappings).flat().includes(key)) {
            normalized[key] = value;
          }
        }

        return normalized;
      });

      // Clean equipment numbers and set defaults
      equipment = equipment.map(item => ({
        ...item,
        equipment_number: stringHelpers.cleanEquipmentCode(item.equipment_number || ''),
        description: item.description || '',
        commissioning_yn: item.commissioning_yn || 'Y' // FIXED: Use commissioning_yn consistently
      }));

      // Filter out items without equipment numbers
      equipment = equipment.filter(item => 
        item.equipment_number && item.equipment_number.trim() !== ''
      );

      // Validate results
      const validation = validationHelpers.validateEquipmentList(equipment);
      
      // CRITICAL FIX: Add missing hasData and dataLength fields
      resolve({
        hasData: equipment.length > 0,
        data: equipment,
        dataLength: equipment.length,
        originalHeaders: originalHeaders,
        totalItems: equipment.length,
        validation: validation
      });

    } catch (error) {
      reject(new Error(`Processing equipment data failed: ${error.message}`));
    }
  });
};

// XER File Parser (for Continue Project feature)
export const parseXERFile = (xerContent) => {
  return new Promise((resolve, reject) => {
    try {
      // Parse XER file format
      Papa.parse(xerContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimitersToGuess: [',', '\t', '|', ';'],
        transformHeader: (header) => {
          return header.trim().toLowerCase().replace(/\s+/g, '_');
        },
        complete: (results) => {
          try {
            let xerData = results.data;
            
            // Filter valid rows
            xerData = xerData.filter(item => 
              item.wbs_code && item.wbs_name
            );

            // Normalize WBS structure for consistency
            const cleanedWBSItems = xerData.map(item => ({
              wbs_code: item.wbs_code ? item.wbs_code.toString().trim() : '',
              parent_wbs_code: item.parent_wbs_code ? item.parent_wbs_code.toString().trim() : null,
              wbs_name: item.wbs_name || '',
              level: stringHelpers.getWBSLevel(item.wbs_code)
            }));

            // Find the highest WBS code for continuation
            const lastWBSCode = findHighestWBSCode(cleanedWBSItems);
            
            // Extract project information
            const projectInfo = extractProjectInfo(cleanedWBSItems);

            // Build hierarchical structure
            const hierarchicalStructure = buildWBSHierarchy(cleanedWBSItems);

            resolve({
              wbs_items: cleanedWBSItems,
              hierarchical_structure: hierarchicalStructure,
              last_wbs_code: lastWBSCode,
              project_info: projectInfo,
              total_items: cleanedWBSItems.length,
              original_headers: results.meta.fields || []
            });

          } catch (processingError) {
            reject(new Error(`Error processing XER data: ${processingError.message}`));
          }
        },
        error: (error) => {
          reject(new Error(`XER parsing failed: ${error.message}`));
        }
      });

    } catch (error) {
      reject(new Error(`Failed to parse XER file: ${error.message}`));
    }
  });
};

// Existing Project Parser (for Missing Equipment feature)
export const parseExistingProject = (csvContent) => {
  return new Promise((resolve, reject) => {
    try {
      // Parse existing WBS structure (should be in standard format)
      Papa.parse(csvContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimitersToGuess: [',', '\t', '|', ';'],
        transformHeader: (header) => {
          return header.trim().toLowerCase().replace(/\s+/g, '_');
        },
        complete: (results) => {
          try {
            let existingProject = results.data;
            
            // Filter valid rows
            existingProject = existingProject.filter(item => 
              item.wbs_code && item.wbs_name
            );

            // Normalize structure
            const normalizedProject = existingProject.map(item => ({
              wbs_code: item.wbs_code.toString().trim(),
              parent_wbs_code: item.parent_wbs_code ? item.parent_wbs_code.toString().trim() : null,
              wbs_name: item.wbs_name || '',
              level: stringHelpers.getWBSLevel(item.wbs_code)
            }));

            resolve({
              wbs_items: normalizedProject,
              total_items: normalizedProject.length,
              original_headers: results.meta.fields || []
            });

          } catch (processingError) {
            reject(new Error(`Error processing existing project data: ${processingError.message}`));
          }
        },
        error: (error) => {
          reject(new Error(`Existing project parsing failed: ${error.message}`));
        }
      });

    } catch (error) {
      reject(new Error(`Failed to parse existing project file: ${error.message}`));
    }
  });
};

// Helper functions for XER and project processing
const findHighestWBSCode = (wbsItems) => {
  if (wbsItems.length === 0) return '1';
  
  const sortedCodes = wbsItems
    .map(item => item.wbs_code)
    .filter(code => code && code.trim() !== '')
    .sort((a, b) => {
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);
      
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        
        if (aVal !== bVal) {
          return aVal - bVal;
        }
      }
      return 0;
    });
  
  return sortedCodes.length > 0 ? sortedCodes[sortedCodes.length - 1] : '1';
};

const extractProjectInfo = (wbsItems) => {
  // Extract project information from WBS items
  const projectInfo = {
    project_name: 'Imported Project',
    total_wbs_levels: 0,
    subsystems: [],
    categories: []
  };

  if (wbsItems.length > 0) {
    // Find max level
    projectInfo.total_wbs_levels = Math.max(...wbsItems.map(item => item.level || 0));
    
    // Find subsystems (usually level 2 items with "S" or "Z" patterns)
    projectInfo.subsystems = wbsItems
      .filter(item => 
        item.level === 2 && 
        (item.wbs_name.includes('S1') || item.wbs_name.includes('Z'))
      )
      .map(item => ({
        code: item.wbs_code,
        name: item.wbs_name
      }));

    // Find categories (usually level 3 items with numbered patterns)
    projectInfo.categories = wbsItems
      .filter(item => 
        item.level === 3 && 
        /\d{2}\s*\|/.test(item.wbs_name)
      )
      .map(item => ({
        code: item.wbs_code,
        name: item.wbs_name,
        category_number: item.wbs_name.match(/(\d{2})/)?.[1]
      }));
  }

  return projectInfo;
};

const buildWBSHierarchy = (wbsItems) => {
  // Build parent-child relationships
  const itemMap = {};
  const tree = [];

  // Create lookup map
  wbsItems.forEach(item => {
    itemMap[item.wbs_code] = {
      ...item,
      children: []
    };
  });

  // Build hierarchy
  wbsItems.forEach(item => {
    if (item.parent_wbs_code && itemMap[item.parent_wbs_code]) {
      itemMap[item.parent_wbs_code].children.push(itemMap[item.wbs_code]);
    } else {
      tree.push(itemMap[item.wbs_code]);
    }
  });

  return tree;
};

// Improved file type detector
export const detectFileType = (filename, content, fileBuffer = null) => {
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

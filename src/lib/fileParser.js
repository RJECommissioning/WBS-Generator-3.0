import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { stringHelpers, validationHelpers } from '../utils';

/**
 * File Parser - Handles CSV, Excel (.xlsx), and XER file parsing
 */

// Excel Equipment List Parser
export const parseExcelFile = (fileBuffer, filename) => {
  return new Promise((resolve, reject) => {
    try {
      // Parse Excel workbook
      const workbook = XLSX.read(fileBuffer, {
        cellStyles: true,
        cellFormulas: true,
        cellDates: true,
        cellNF: true,
        sheetStubs: true
      });

      // Get first sheet (or find equipment sheet)
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON with headers
      const rawData = XLSX.utils.sheet_to_json(worksheet, { 
        header: 1,
        defval: '',
        blankrows: false
      });

      if (rawData.length === 0) {
        reject(new Error('Excel file appears to be empty'));
        return;
      }

      // Get headers from first row and clean them
      const headers = rawData[0].map(header => 
        header.toString().trim().toLowerCase()
          .replace(/\s+/g, '_')
          .replace(/[^a-z0-9_]/g, '')
      );

      // Convert to object format
      const equipment = rawData.slice(1)
        .filter(row => row.some(cell => cell !== null && cell !== undefined && cell.toString().trim() !== ''))
        .map(row => {
          const item = {};
          headers.forEach((header, index) => {
            item[header] = row[index] || '';
          });
          return item;
        });

      // Filter out completely empty rows
      const filteredEquipment = equipment.filter(item => {
        return Object.values(item).some(value => 
          value && value.toString().trim() !== ''
        );
      });

      // Now process using the same logic as CSV parser
      processEquipmentData(filteredEquipment, headers)
        .then(resolve)
        .catch(reject);

    } catch (error) {
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
              .then(resolve)
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

// Shared equipment data processing logic
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

      // Normalize column names (handle variations)
      equipment = equipment.map(item => {
        const normalized = {};
        
        // Map common column variations to standard names
        const columnMappings = {
         const columnMappings = {
           
        // Map common column variations to standard names
      const columnMappings = {
        'equipment_number': ['equipment_number', 'equipment_no', 'equipment_code', 'code', 'equipment', 'tag', 'id', 'asset_number', 'tag_number'],
        'description': ['description', 'desc', 'equipment_description', 'name', 'title', 'equipment_name', 'asset_description'],
        'plu_field': ['plu_field', 'plu', 'secondary_code', 'alt_code', 'alternative_code'],
        'commissioning_status': ['commissioning_status', 'status', 'commissioning', 'comm_status', 'commission_status', 'included'],
        'parent_equipment_code': ['parent_equipment_code', 'parent_equipment', 'parent_code', 'parent_tag', 'parent', 'parent_equipment_number'],
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
        commissioning_status: item.commissioning_status || 'Y'
      }));

      // Filter out items without equipment numbers
      equipment = equipment.filter(item => 
        item.equipment_number && item.equipment_number.trim() !== ''
      );

      // Validate results
      const validation = validationHelpers.validateEquipmentList(equipment);
      
      resolve({
        data: equipment,
        validation: validation,
        totalItems: equipment.length,
        originalHeaders: originalHeaders,
        errors: []
      });

    } catch (processingError) {
      reject(new Error(`Error processing equipment data: ${processingError.message}`));
    }
  });
};

// XER File Parser (P6 Export)
export const parseXERFile = (xerContent) => {
  return new Promise((resolve, reject) => {
    try {
      // XER files are tab-delimited, but we'll handle various formats
      Papa.parse(xerContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimitersToGuess: ['\t', ',', '|', ';'],
        transformHeader: (header) => {
          // Clean headers but preserve original case for XER compatibility
          return header.trim().replace(/\s+/g, '_');
        },
        complete: (results) => {
          try {
            if (results.errors.length > 0) {
              console.warn('XER parsing warnings:', results.errors);
            }

            let xerData = results.data;
            
            // Filter out empty rows
            xerData = xerData.filter(item => {
              return (item.wbs_code || item.WBS_Code || item.wbs_short_code) && 
                     (item.wbs_name || item.WBS_Name || item.wbs_name);
            });

            // Normalize XER column names (P6 exports can vary)
            const wbsItems = xerData.map(item => {
              const normalized = {};
              
              // Map XER column variations
              const xerMappings = {
                'wbs_code': ['wbs_code', 'WBS_Code', 'wbs_short_code', 'WBS_Short_Code'],
                'parent_wbs_code': ['parent_wbs_code', 'Parent_WBS_Code', 'wbs_parent_code', 'WBS_Parent_Code'],
                'wbs_name': ['wbs_name', 'WBS_Name', 'wbs_title', 'WBS_Title'],
                'project_id': ['project_id', 'Project_ID', 'proj_id', 'PROJ_ID'],
                'activity_id': ['activity_id', 'Activity_ID', 'act_id', 'ACT_ID'],
                'activity_name': ['activity_name', 'Activity_Name', 'act_name', 'ACT_NAME']
              };

              // Find matching columns
              for (const [standardField, variations] of Object.entries(xerMappings)) {
                const matchingKey = Object.keys(item).find(key => 
                  variations.includes(key)
                );
                
                if (matchingKey && item[matchingKey] !== undefined) {
                  normalized[standardField] = item[matchingKey];
                }
              }

              // Add unmapped fields
              for (const [key, value] of Object.entries(item)) {
                if (!Object.values(xerMappings).flat().includes(key)) {
                  normalized[key] = value;
                }
              }

              return normalized;
            });

            // Clean and validate WBS codes
            const cleanedWBSItems = wbsItems.map(item => ({
              ...item,
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
              equipment_number: item.equipment_number || '',
              description: item.description || '',
              commissioning_status: item.commissioning_status || 'Y',
              level: stringHelpers.getWBSLevel(item.wbs_code)
            }));

            // Extract equipment list from WBS structure
            const equipmentList = normalizedProject
              .filter(item => item.equipment_number && item.equipment_number.trim() !== '')
              .map(item => ({
                equipment_number: stringHelpers.cleanEquipmentCode(item.equipment_number),
                description: item.description,
                commissioning_status: item.commissioning_status,
                wbs_code: item.wbs_code
              }));

            resolve({
              wbs_structure: normalizedProject,
              equipment_list: equipmentList,
              total_wbs_items: normalizedProject.length,
              total_equipment: equipmentList.length
            });

          } catch (processingError) {
            reject(new Error(`Error processing existing project: ${processingError.message}`));
          }
        },
        error: (error) => {
          reject(new Error(`Existing project parsing failed: ${error.message}`));
        }
      });

    } catch (error) {
      reject(new Error(`Failed to parse existing project: ${error.message}`));
    }
  });
};

// Helper Functions
const findHighestWBSCode = (wbsItems) => {
  if (!wbsItems || wbsItems.length === 0) return '1';
  
  // Sort WBS codes numerically
  const sortedCodes = wbsItems
    .map(item => item.wbs_code)
    .filter(code => code && code.trim() !== '')
    .sort((a, b) => {
      // Split codes and compare numerically
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

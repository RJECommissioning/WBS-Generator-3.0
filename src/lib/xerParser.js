/**
 * XER Parser - Extract WBS Structure from P6 XER Files
 * 
 * Purpose: Parse XER text files exported from Primavera P6 to extract
 * existing WBS structure for Missing Equipment functionality.
 * 
 * Input: Raw XER text content (exactly as exported from P6)
 * Output: Clean WBS structure in standard 3-column format
 * 
 * Integration: Called by fileParser.js when XER file is detected
 */

// Main XER parsing function
export const parseXERFile = (xerContent) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('STARTING XER FILE PARSING');
      console.log(`XER content length: ${xerContent.length} characters`);

      // Step 1: Validate XER format
      validateXERFormat(xerContent);

      // Step 2: Extract PROJWBS table
      const projwbsData = extractPROJWBSTable(xerContent);
      console.log(`Extracted PROJWBS records: ${projwbsData.records.length}`);

      // Step 3: Build WBS lookup table
      const wbsLookup = buildWBSLookupTable(projwbsData.records, projwbsData.fieldMap);
      console.log(`Built WBS lookup: ${Object.keys(wbsLookup).length} entries`);

      // Step 4: Convert to standard format
      const wbsStructure = convertToWBSStructure(projwbsData.records, projwbsData.fieldMap, wbsLookup);
      console.log(`Converted WBS structure: ${wbsStructure.length} items`);

      // Step 5: Validate and sort results
      const finalStructure = validateAndSortWBS(wbsStructure);
      console.log(`Final WBS structure: ${finalStructure.length} items`);

      resolve({
        type: 'xer',
        hasData: finalStructure.length > 0,
        data: finalStructure,
        dataLength: finalStructure.length,
        originalHeaders: ['wbs_code', 'parent_wbs_code', 'wbs_name'],
        projectInfo: extractProjectInfo(xerContent),
        validation: {
          isValid: true,
          errors: [],
          warnings: [],
          totalRecords: finalStructure.length
        }
      });

    } catch (error) {
      console.error('XER parsing failed:', error);
      reject(new Error(`XER parsing failed: ${error.message}`));
    }
  });
};

// Validate XER file format
const validateXERFormat = (content) => {
  console.log('VALIDATING XER FORMAT');
  
  if (!content || typeof content !== 'string') {
    throw new Error('Invalid XER content: Empty or non-string content');
  }

  if (content.length < 100) {
    throw new Error('Invalid XER content: File too small to be valid XER');
  }

  if (!content.includes('%T PROJWBS')) {
    throw new Error('Invalid XER content: Missing PROJWBS table - this may not be a valid P6 export');
  }

  if (!content.includes('%F') || !content.includes('%R')) {
    throw new Error('Invalid XER content: Missing field definitions or data records');
  }

  console.log('XER format validation passed');
};

// Extract PROJWBS table from XER content
const extractPROJWBSTable = (content) => {
  console.log('EXTRACTING PROJWBS TABLE');
  
  const lines = content.split('\n').map(line => line.trim());
  
  // Find PROJWBS table start
  const tableStartIndex = lines.findIndex(line => line === '%T PROJWBS');
  if (tableStartIndex === -1) {
    throw new Error('PROJWBS table not found in XER file');
  }

  // Find field definition line
  const fieldLineIndex = tableStartIndex + 1;
  if (fieldLineIndex >= lines.length || !lines[fieldLineIndex].startsWith('%F')) {
    throw new Error('PROJWBS field definition not found');
  }

  const fieldLine = lines[fieldLineIndex];
  const fields = fieldLine.substring(2).split('\t').map(field => field.trim());
  console.log(`Found PROJWBS fields: ${fields.length} fields`);
  console.log('Field names:', fields.slice(0, 10)); // Log first 10 fields

  // Create field mapping
  const fieldMap = {};
  fields.forEach((field, index) => {
    fieldMap[field] = index;
  });

  // Validate required fields
  const requiredFields = ['wbs_id', 'wbs_short_name', 'wbs_name', 'parent_wbs_id'];
  const missingFields = requiredFields.filter(field => !(field in fieldMap));
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required PROJWBS fields: ${missingFields.join(', ')}`);
  }

  console.log('Required fields found:', requiredFields);

  // Extract data records
  const records = [];
  let currentIndex = fieldLineIndex + 1;
  
  while (currentIndex < lines.length) {
    const line = lines[currentIndex];
    
    // Stop at next table or end of file
    if (line.startsWith('%T') && line !== '%T PROJWBS') {
      break;
    }
    
    // Process data records
    if (line.startsWith('%R')) {
      const dataLine = line.substring(2); // Remove %R prefix
      const values = parseDataLine(dataLine);
      
      if (values.length >= fields.length - 2) { // Allow some tolerance
        records.push(values);
      } else {
        console.warn(`Skipping malformed PROJWBS record: ${values.length} values vs ${fields.length} fields`);
      }
    }
    
    currentIndex++;
  }

  console.log(`Extracted ${records.length} PROJWBS records`);
  
  if (records.length === 0) {
    throw new Error('No PROJWBS data records found');
  }

  return {
    fields: fields,
    fieldMap: fieldMap,
    records: records
  };
};

// Parse tab-separated data line with proper escaping
const parseDataLine = (dataLine) => {
  const values = [];
  let currentValue = '';
  let inQuotes = false;
  let i = 0;

  while (i < dataLine.length) {
    const char = dataLine[i];
    
    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      inQuotes = false;
    } else if (char === '\t' && !inQuotes) {
      values.push(currentValue.trim());
      currentValue = '';
    } else {
      currentValue += char;
    }
    
    i++;
  }
  
  // Add the last value
  if (currentValue !== '' || dataLine.endsWith('\t')) {
    values.push(currentValue.trim());
  }

  return values;
};

// Build lookup table for WBS ID to WBS code mapping
const buildWBSLookupTable = (records, fieldMap) => {
  console.log('BUILDING WBS LOOKUP TABLE');
  
  const lookup = {};
  
  records.forEach((record, index) => {
    try {
      const wbsId = record[fieldMap.wbs_id];
      const wbsShortName = record[fieldMap.wbs_short_name];
      
      if (wbsId && wbsShortName) {
        lookup[wbsId] = wbsShortName;
      } else {
        console.warn(`Record ${index}: Missing wbs_id or wbs_short_name`);
      }
    } catch (error) {
      console.warn(`Error processing record ${index}:`, error.message);
    }
  });

  console.log(`Lookup table built with ${Object.keys(lookup).length} entries`);
  return lookup;
};

// Convert XER records to standard WBS structure
const convertToWBSStructure = (records, fieldMap, wbsLookup) => {
  console.log('CONVERTING TO WBS STRUCTURE');
  
  const wbsStructure = [];
  
  records.forEach((record, index) => {
    try {
      const wbsId = record[fieldMap.wbs_id];
      const wbsShortName = record[fieldMap.wbs_short_name];
      const wbsName = record[fieldMap.wbs_name];
      const parentWbsId = record[fieldMap.parent_wbs_id];

      // Skip records with missing essential data
      if (!wbsShortName || !wbsName) {
        console.warn(`Skipping record ${index}: Missing wbs_short_name or wbs_name`);
        return;
      }

      // Clean the WBS name (remove quotes if present)
      const cleanWbsName = wbsName.replace(/^["']|["']$/g, '').trim();
      
      // Find parent WBS code
      let parentWbsCode = null;
      if (parentWbsId && parentWbsId !== '' && parentWbsId !== wbsId) {
        parentWbsCode = wbsLookup[parentWbsId] || null;
        
        if (parentWbsId && !parentWbsCode) {
          console.warn(`Record ${index}: Parent WBS ID ${parentWbsId} not found in lookup`);
        }
      }

      // Create WBS structure item
      const wbsItem = {
        wbs_code: wbsShortName.trim(),
        parent_wbs_code: parentWbsCode,
        wbs_name: cleanWbsName,
        // Additional metadata for debugging
        _original_wbs_id: wbsId,
        _original_parent_id: parentWbsId,
        _record_index: index
      };

      wbsStructure.push(wbsItem);

    } catch (error) {
      console.warn(`Error converting record ${index}:`, error.message);
    }
  });

  console.log(`Converted ${wbsStructure.length} WBS items`);
  return wbsStructure;
};

// Validate and sort WBS structure
const validateAndSortWBS = (wbsStructure) => {
  console.log('VALIDATING AND SORTING WBS STRUCTURE');
  
  // Remove duplicates based on wbs_code
  const seen = new Set();
  const uniqueStructure = wbsStructure.filter(item => {
    if (seen.has(item.wbs_code)) {
      console.warn(`Removing duplicate WBS code: ${item.wbs_code}`);
      return false;
    }
    seen.add(item.wbs_code);
    return true;
  });

  console.log(`After duplicate removal: ${uniqueStructure.length} items`);

  // Sort hierarchically by WBS code
  const sortedStructure = uniqueStructure.sort((a, b) => {
    const aParts = a.wbs_code.split('.').map(part => parseInt(part) || 0);
    const bParts = b.wbs_code.split('.').map(part => parseInt(part) || 0);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      
      if (aVal !== bVal) {
        return aVal - bVal;
      }
    }
    
    return 0;
  });

  // Remove metadata fields for final output
  const cleanedStructure = sortedStructure.map(item => ({
    wbs_code: item.wbs_code,
    parent_wbs_code: item.parent_wbs_code,
    wbs_name: item.wbs_name
  }));

  // Final validation
  validateWBSHierarchy(cleanedStructure);

  console.log(`Final sorted structure: ${cleanedStructure.length} items`);
  console.log('Sample WBS items:', cleanedStructure.slice(0, 5));

  return cleanedStructure;
};

// Validate WBS hierarchy for orphaned records
const validateWBSHierarchy = (wbsStructure) => {
  console.log('VALIDATING WBS HIERARCHY');
  
  const wbsCodes = new Set(wbsStructure.map(item => item.wbs_code));
  const orphanedItems = [];
  
  wbsStructure.forEach(item => {
    if (item.parent_wbs_code && !wbsCodes.has(item.parent_wbs_code)) {
      orphanedItems.push(`${item.wbs_code} → ${item.parent_wbs_code}`);
    }
  });

  if (orphanedItems.length > 0) {
    console.warn('Found orphaned WBS items:', orphanedItems.slice(0, 10));
    console.warn(`Total orphaned items: ${orphanedItems.length}`);
  } else {
    console.log('WBS hierarchy validation passed - no orphaned items');
  }

  const rootItems = wbsStructure.filter(item => !item.parent_wbs_code);
  console.log(`Root items found: ${rootItems.length}`);
};

// Extract basic project information
const extractProjectInfo = (content) => {
  console.log('EXTRACTING PROJECT INFO');
  
  try {
    const lines = content.split('\n');
    
    // Look for PROJECT table
    const projectTableIndex = lines.findIndex(line => line.trim() === '%T PROJECT');
    
    if (projectTableIndex === -1) {
      console.warn('PROJECT table not found in XER file');
      return { projectName: 'Unknown Project', extractedAt: new Date().toISOString() };
    }

    // Find field definition
    const fieldLineIndex = projectTableIndex + 1;
    if (fieldLineIndex < lines.length && lines[fieldLineIndex].startsWith('%F')) {
      const fields = lines[fieldLineIndex].substring(2).split('\t');
      const projNameIndex = fields.findIndex(field => field.includes('proj_short_name') || field.includes('proj_name'));
      
      // Find data record
      const dataLineIndex = projectTableIndex + 2;
      if (dataLineIndex < lines.length && lines[dataLineIndex].startsWith('%R')) {
        const values = parseDataLine(lines[dataLineIndex].substring(2));
        
        if (projNameIndex >= 0 && values[projNameIndex]) {
          const projectName = values[projNameIndex].replace(/^["']|["']$/g, '').trim();
          console.log(`Extracted project name: ${projectName}`);
          
          return {
            projectName: projectName,
            extractedAt: new Date().toISOString(),
            totalWBSItems: 0 // Will be filled later
          };
        }
      }
    }

    console.warn('Could not extract project name from XER file');
    return { 
      projectName: 'Unknown Project', 
      extractedAt: new Date().toISOString() 
    };

  } catch (error) {
    console.warn('Error extracting project info:', error.message);
    return { 
      projectName: 'Unknown Project', 
      extractedAt: new Date().toISOString() 
    };
  }
};

// Utility function to get equipment codes from WBS structure
export const extractEquipmentCodesFromWBS = (wbsStructure) => {
  console.log('EXTRACTING EQUIPMENT CODES FROM WBS');
  
  const equipmentCodes = wbsStructure
    .filter(item => item.wbs_name && item.wbs_name.includes('|'))
    .map(item => {
      const parts = item.wbs_name.split('|');
      if (parts.length >= 2) {
        return parts[0].trim();
      }
      return null;
    })
    .filter(code => code !== null);

  console.log(`Extracted ${equipmentCodes.length} equipment codes from WBS`);
  console.log('Sample equipment codes:', equipmentCodes.slice(0, 10));
  
  return equipmentCodes;
};

// Export additional utility functions
export { 
  validateXERFormat, 
  extractPROJWBSTable, 
  buildWBSLookupTable,
  convertToWBSStructure 
};

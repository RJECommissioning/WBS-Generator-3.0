/**
 * Enhanced XER Parser with Comprehensive Debug Logging
 * 
 * Purpose: Parse XER text files exported from Primavera P6 to extract
 * existing WBS structure for Missing Equipment functionality.
 * 
 * FIXED: Now supports both TAB and SPACE format for PROJWBS table detection
 */

// Main XER parsing function with enhanced debugging
export const parseXERFile = (xerContent) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('=== STARTING XER FILE PARSING ===');
      console.log(`XER content length: ${xerContent.length} characters`);
      console.log('First 200 characters:', xerContent.substring(0, 200));

      // Step 1: Enhanced validation with detailed logging
      console.log('\n=== STEP 1: VALIDATING XER FORMAT ===');
      validateXERFormat(xerContent);
      console.log('✅ XER format validation PASSED');

      // Step 2: Extract PROJWBS table with detailed logging
      console.log('\n=== STEP 2: EXTRACTING PROJWBS TABLE ===');
      const projwbsData = extractPROJWBSTable(xerContent);
      console.log(`✅ Extracted PROJWBS records: ${projwbsData.records.length}`);
      console.log('Field map keys:', Object.keys(projwbsData.fieldMap));

      // Step 3: Build WBS lookup table with logging
      console.log('\n=== STEP 3: BUILDING WBS LOOKUP TABLE ===');
      const wbsLookup = buildWBSLookupTable(projwbsData.records, projwbsData.fieldMap);
      console.log(`✅ Built WBS lookup: ${Object.keys(wbsLookup).length} entries`);
      console.log('Sample lookup entries:', Object.entries(wbsLookup).slice(0, 3));

      // Step 4: Convert to standard format with logging
      console.log('\n=== STEP 4: CONVERTING TO WBS STRUCTURE ===');
      const wbsStructure = convertToWBSStructure(projwbsData.records, projwbsData.fieldMap, wbsLookup);
      console.log(`✅ Converted WBS structure: ${wbsStructure.length} items`);

      // Step 5: Validate and sort results with logging
      console.log('\n=== STEP 5: VALIDATING AND SORTING ===');
      const finalStructure = validateAndSortWBS(wbsStructure);
      console.log(`✅ Final WBS structure: ${finalStructure.length} items`);

      // Step 6: Extract project info with logging
      console.log('\n=== STEP 6: EXTRACTING PROJECT INFO ===');
      const projectInfo = extractProjectInfo(xerContent);
      console.log('✅ Project info:', projectInfo);

      // Step 7: Build final result with logging
      console.log('\n=== STEP 7: BUILDING FINAL RESULT ===');
      const result = {
        type: 'xer',
        hasData: finalStructure.length > 0,
        data: finalStructure,
        dataLength: finalStructure.length,
        originalHeaders: ['wbs_code', 'parent_wbs_code', 'wbs_name'],
        projectInfo: projectInfo,
        validation: {
          isValid: true,
          errors: [],
          warnings: [],
          totalRecords: finalStructure.length
        }
      };

      console.log('✅ XER PARSING COMPLETED SUCCESSFULLY');
      console.log('Final result summary:', {
        type: result.type,
        hasData: result.hasData,
        dataLength: result.dataLength,
        projectName: result.projectInfo?.projectName
      });

      resolve(result);

    } catch (error) {
      console.error('❌ XER PARSING FAILED');
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        contentLength: xerContent?.length || 0
      });
      
      reject(new Error(`XER parsing failed: ${error.message}`));
    }
  });
};

// Enhanced validation with detailed logging - FIXED FOR BOTH TAB AND SPACE
const validateXERFormat = (content) => {
  console.log('Validating XER format...');
  
  if (!content || typeof content !== 'string') {
    console.error('❌ Invalid content type:', typeof content);
    throw new Error('Invalid XER content: Empty or non-string content');
  }

  console.log(`Content length: ${content.length} characters`);
  
  if (content.length < 100) {
    console.error('❌ Content too small:', content.length);
    throw new Error('Invalid XER content: File too small to be valid XER');
  }

  // FIXED: Check for PROJWBS table with both TAB and SPACE format
  const hasProjWBSTab = content.includes('%T\tPROJWBS');
  const hasProjWBSSpace = content.includes('%T PROJWBS');
  const hasProjWBS = hasProjWBSTab || hasProjWBSSpace;
  
  console.log('Has PROJWBS table (TAB format):', hasProjWBSTab);
  console.log('Has PROJWBS table (SPACE format):', hasProjWBSSpace);
  console.log('Has PROJWBS table (either format):', hasProjWBS);
  
  if (!hasProjWBS) {
    console.error('❌ Missing PROJWBS table');
    console.log('Looking for alternative table indicators...');
    
    // Log what tables ARE present
    const tableMatches = content.match(/%T[\s\t]+\w+/g);
    if (tableMatches) {
      console.log('Available tables:', tableMatches.slice(0, 10));
    }
    
    throw new Error('Invalid XER content: Missing PROJWBS table - this may not be a valid P6 export');
  }

  // Check for field definitions and records
  const hasFields = content.includes('%F');
  const hasRecords = content.includes('%R');
  console.log('Has field definitions (%F):', hasFields);
  console.log('Has data records (%R):', hasRecords);

  if (!hasFields || !hasRecords) {
    console.error('❌ Missing field definitions or data records');
    throw new Error('Invalid XER content: Missing field definitions or data records');
  }

  console.log('✅ XER format validation passed');
};

// Enhanced PROJWBS extraction with detailed logging - FIXED FOR BOTH TAB AND SPACE
const extractPROJWBSTable = (content) => {
  console.log('Extracting PROJWBS table...');
  
  const lines = content.split('\n').map(line => line.trim());
  console.log(`Total lines in file: ${lines.length}`);
  
  // FIXED: Find PROJWBS table start - support both TAB and SPACE format
  const tableStartIndex = lines.findIndex(line => 
    line === '%T\tPROJWBS' || line === '%T PROJWBS'
  );
  console.log('PROJWBS table start index:', tableStartIndex);
  
  if (tableStartIndex === -1) {
    console.error('❌ PROJWBS table not found');
    // Show some context of what we did find
    const sampleLines = lines.slice(0, 20).filter(line => line.startsWith('%T'));
    console.log('Available tables:', sampleLines);
    throw new Error('PROJWBS table not found in XER file');
  }

  // Find field definition line
  const fieldLineIndex = tableStartIndex + 1;
  console.log('Field line index:', fieldLineIndex);
  
  if (fieldLineIndex >= lines.length || !lines[fieldLineIndex].startsWith('%F')) {
    console.error('❌ Field definition not found');
    console.log('Line at field index:', lines[fieldLineIndex]);
    throw new Error('PROJWBS field definition not found');
  }

  const fieldLine = lines[fieldLineIndex];
  console.log('Raw field line:', fieldLine.substring(0, 200));
  
  const fields = fieldLine.substring(2).split('\t').map(field => field.trim());
  console.log(`Found ${fields.length} fields:`, fields.slice(0, 10), fields.length > 10 ? '...' : '');

  // Create field mapping with logging
  const fieldMap = {};
  fields.forEach((field, index) => {
    fieldMap[field] = index;
  });
  console.log('Field mapping created for', Object.keys(fieldMap).length, 'fields');

  // Validate required fields with detailed logging
  const requiredFields = ['wbs_id', 'wbs_short_name', 'wbs_name', 'parent_wbs_id'];
  const missingFields = requiredFields.filter(field => !(field in fieldMap));
  
  console.log('Required fields check:');
  requiredFields.forEach(field => {
    const exists = field in fieldMap;
    console.log(`  ${field}: ${exists ? '✅' : '❌'} (index: ${fieldMap[field] || 'N/A'})`);
  });
  
  if (missingFields.length > 0) {
    console.error('❌ Missing required fields:', missingFields);
    console.log('Available fields:', Object.keys(fieldMap));
    throw new Error(`Missing required PROJWBS fields: ${missingFields.join(', ')}`);
  }

  // Extract data records with detailed logging
  console.log('Extracting data records...');
  const records = [];
  let currentIndex = fieldLineIndex + 1;
  let recordCount = 0;
  let skippedCount = 0;
  
  while (currentIndex < lines.length) {
    const line = lines[currentIndex];
    
    // Stop at next table or end of file
    if (line.startsWith('%T') && line !== '%T\tPROJWBS' && line !== '%T PROJWBS') {
      console.log(`Stopped at next table: ${line}`);
      break;
    }
    
    // Process data records
    if (line.startsWith('%R')) {
      recordCount++;
      const dataLine = line.substring(2); // Remove %R prefix
      const values = parseDataLine(dataLine);
      
      if (values.length >= fields.length - 2) { // Allow some tolerance
        records.push(values);
      } else {
        skippedCount++;
        if (skippedCount <= 3) { // Log first few skipped records
          console.warn(`Skipped malformed record ${recordCount}: ${values.length} values vs ${fields.length} fields`);
        }
      }
    }
    
    currentIndex++;
  }

  console.log(`Processing complete:`);
  console.log(`  Records processed: ${recordCount}`);
  console.log(`  Valid records: ${records.length}`);
  console.log(`  Skipped records: ${skippedCount}`);
  
  if (records.length === 0) {
    console.error('❌ No valid PROJWBS data records found');
    throw new Error('No PROJWBS data records found');
  }

  console.log('✅ PROJWBS extraction successful');
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
  console.log('Building WBS lookup table...');
  
  const lookup = {};
  
  records.forEach((record, index) => {
    try {
      const wbsId = record[fieldMap.wbs_id];
      const wbsShortName = record[fieldMap.wbs_short_name];
      
      if (wbsId && wbsShortName) {
        lookup[wbsId] = wbsShortName;
      } else {
        if (index < 5) { // Only log first few
          console.warn(`Record ${index}: Missing wbs_id or wbs_short_name`);
        }
      }
    } catch (error) {
      console.warn(`Error processing record ${index}:`, error.message);
    }
  });

  console.log(`✅ Lookup table built with ${Object.keys(lookup).length} entries`);
  return lookup;
};

// Convert XER records to standard WBS structure
const convertToWBSStructure = (records, fieldMap, wbsLookup) => {
  console.log('Converting to WBS structure...');
  
  const wbsStructure = [];
  
  records.forEach((record, index) => {
    try {
      const wbsId = record[fieldMap.wbs_id];
      const wbsShortName = record[fieldMap.wbs_short_name];
      const wbsName = record[fieldMap.wbs_name];
      const parentWbsId = record[fieldMap.parent_wbs_id];

      // Skip records with missing essential data
      if (!wbsShortName || !wbsName) {
        if (index < 5) { // Only log first few
          console.warn(`Skipping record ${index}: Missing wbs_short_name or wbs_name`);
        }
        return;
      }

      // Clean the WBS name (remove quotes if present)
      const cleanedWbsName = wbsName.replace(/^["']|["']$/g, '').trim();

      // Determine parent WBS code
      let parentWbsCode = '';
      if (parentWbsId && wbsLookup[parentWbsId]) {
        parentWbsCode = wbsLookup[parentWbsId];
      }

      // Create WBS item
      const wbsItem = {
        wbs_code: wbsShortName,
        parent_wbs_code: parentWbsCode,
        wbs_name: cleanedWbsName,
        // Metadata for processing
        _wbs_id: wbsId,
        _parent_wbs_id: parentWbsId || '',
        _level: wbsShortName.split('.').length
      };

      wbsStructure.push(wbsItem);

    } catch (error) {
      console.warn(`Error converting record ${index}:`, error.message);
    }
  });

  console.log(`✅ Converted ${wbsStructure.length} WBS items`);
  console.log('Sample converted items:', wbsStructure.slice(0, 3).map(item => 
    `${item.wbs_code} | ${item.wbs_name.substring(0, 30)}...`
  ));

  return wbsStructure;
};

// Validate and sort WBS structure
const validateAndSortWBS = (wbsStructure) => {
  console.log('Validating and sorting WBS structure...');
  
  // Sort by WBS code hierarchy
  const sortedStructure = wbsStructure.sort((a, b) => {
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

  console.log(`✅ Final sorted structure: ${cleanedStructure.length} items`);
  console.log('Sample WBS items:', cleanedStructure.slice(0, 5));

  return cleanedStructure;
};

// Validate WBS hierarchy for orphaned records
const validateWBSHierarchy = (wbsStructure) => {
  console.log('Validating WBS hierarchy...');
  
  const wbsCodes = new Set(wbsStructure.map(item => item.wbs_code));
  const orphanedItems = [];
  
  wbsStructure.forEach(item => {
    if (item.parent_wbs_code && !wbsCodes.has(item.parent_wbs_code)) {
      orphanedItems.push(`${item.wbs_code} → ${item.parent_wbs_code}`);
    }
  });

  if (orphanedItems.length > 0) {
    console.warn('Found orphaned WBS items:');
    orphanedItems.slice(0, 10).forEach(item => {
      console.warn(`  ${item}`);
    });
    console.warn(`Total orphaned items: ${orphanedItems.length}`);
  } else {
    console.log('✅ WBS hierarchy validation passed - no orphaned items');
  }

  const rootItems = wbsStructure.filter(item => !item.parent_wbs_code);
  console.log(`Root items found: ${rootItems.length}`);
  
  if (rootItems.length > 0) {
    console.log('Root items:');
    rootItems.slice(0, 3).forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.wbs_code} | ${item.wbs_name.substring(0, 40)}...`);
    });
  }
};

// Enhanced project info extraction with detailed logging
const extractProjectInfo = (content) => {
  console.log('Extracting project info...');
  
  try {
    const lines = content.split('\n');
    
    // Look for PROJECT table
    const projectTableIndex = lines.findIndex(line => line.trim() === '%T\tPROJECT' || line.trim() === '%T PROJECT');
    console.log('PROJECT table index:', projectTableIndex);
    
    if (projectTableIndex === -1) {
      console.warn('PROJECT table not found in XER file');
      return { 
        projectName: 'Unknown Project', 
        extractedAt: new Date().toISOString() 
      };
    }

    // Find field definition
    const fieldLineIndex = projectTableIndex + 1;
    if (fieldLineIndex < lines.length && lines[fieldLineIndex].startsWith('%F')) {
      const fields = lines[fieldLineIndex].substring(2).split('\t');
      console.log('PROJECT table fields found:', fields.length);
      
      const projNameIndex = fields.findIndex(field => 
        field.includes('proj_short_name') || field.includes('proj_name')
      );
      console.log('Project name field index:', projNameIndex);
      
      // Find data record
      const dataLineIndex = projectTableIndex + 2;
      if (dataLineIndex < lines.length && lines[dataLineIndex].startsWith('%R')) {
        const values = parseDataLine(lines[dataLineIndex].substring(2));
        console.log('PROJECT table data values:', values.length);
        
        if (projNameIndex >= 0 && values[projNameIndex]) {
          const projectName = values[projNameIndex].replace(/^["']|["']$/g, '').trim();
          console.log(`✅ Extracted project name: "${projectName}"`);
          
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
  console.log('Extracting equipment codes from WBS...');
  console.log(`Processing ${wbsStructure.length} WBS items`);
  
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

  console.log(`✅ Extracted ${equipmentCodes.length} equipment codes from WBS`);
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

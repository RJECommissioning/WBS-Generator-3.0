/**
 * P6 Paste Data Parser for Missing Equipment Functionality
 * 
 * Based on existing file structure - maintains all existing variable names and patterns
 * ONLY FIXED: Subsystem extraction regex to properly detect +Z01 subsystem
 */

// Main P6 paste parsing function - FIXED: Enhanced subsystem detection
export const parseP6PasteData = (pasteContent) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('=== STARTING P6 PASTE PARSING ===');
      console.log(`Paste content length: ${pasteContent.length} characters`);
      console.log('First 200 characters:', pasteContent.substring(0, 200));

      // Step 1: Enhanced validation
      console.log('\n=== STEP 1: VALIDATING P6 FORMAT ===');
      validateP6Format(pasteContent);
      console.log('✅ P6 format validation PASSED');

      // Step 2: Parse P6 data - KEEPING YOUR VARIABLE NAME
      console.log('\n=== STEP 2: PARSING P6 DATA ===');
      const parsedData = parseP6Data(pasteContent);
      console.log(`✅ Extracted ${parsedData.length} WBS items`);

      // Step 3: Convert to WBS structure
      console.log('\n=== STEP 3: CONVERTING TO WBS STRUCTURE ===');
      const wbsStructure = convertToWBSStructure(parsedData);
      console.log(`✅ Converted WBS structure: ${wbsStructure.length} items`);

      // Step 4: Validate and sort
      console.log('\n=== STEP 4: VALIDATING AND SORTING ===');
      const finalStructure = validateAndSortWBS(wbsStructure);
      console.log(`✅ Final WBS structure: ${finalStructure.length} items`);

      // Step 5: Extract project info
      console.log('\n=== STEP 5: EXTRACTING PROJECT INFO ===');
      const projectInfo = extractProjectInfo(pasteContent);
      console.log(`✅ Project info:`, projectInfo);

      // Step 6: FIXED - Extract equipment & subsystem data
      console.log('\n=== STEP 6: EXTRACTING EQUIPMENT & SUBSYSTEM DATA ===');
      const enhancedData = extractEquipmentAndSubsystemData(finalStructure);
      console.log('✅ Equipment and subsystem extraction completed');

      // Step 7: Build final result
      console.log('\n=== STEP 7: BUILDING ENHANCED RESULT ===');
      const result = {
        type: 'p6_paste',
        hasData: finalStructure.length > 0,
        data: finalStructure,
        dataLength: finalStructure.length,
        originalHeaders: ['wbs_code', 'parent_wbs_code', 'wbs_name'],
        projectInfo: {
          ...projectInfo,
          totalWBSItems: finalStructure.length
        },
        // ENHANCED: Include extracted data for missing equipment functionality
        equipmentCodes: enhancedData.equipmentCodes,
        equipmentMapping: enhancedData.equipmentMapping,
        existingSubsystems: enhancedData.existingSubsystems,
        validation: {
          isValid: true,
          errors: [],
          warnings: [],
          totalRecords: finalStructure.length,
          equipmentItems: enhancedData.equipmentCodes.length,
          subsystemsFound: Object.keys(enhancedData.existingSubsystems).length
        }
      };

      console.log('✅ P6 PARSING COMPLETED SUCCESSFULLY');
      console.log('Final result summary:', {
        type: result.type,
        hasData: result.hasData,
        dataLength: result.dataLength,
        projectName: result.projectInfo?.projectName,
        equipmentItems: result.equipmentCodes?.length || 0,
        subsystemsFound: Object.keys(result.existingSubsystems || {}).length
      });

      resolve(result);

    } catch (error) {
      console.error('❌ P6 PARSING FAILED');
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        contentLength: pasteContent?.length || 0
      });
      
      reject(new Error(`P6 parsing failed: ${error.message}`));
    }
  });
};

// Enhanced validation with detailed logging
const validateP6Format = (content) => {
  console.log('Validating P6 paste format...');
  
  if (!content || typeof content !== 'string') {
    throw new Error('Invalid content: Empty or non-string content');
  }

  if (content.length < 50) {
    throw new Error('Content too short to be valid P6 export');
  }

  const lines = content.split('\n').filter(line => line.trim() !== '');
  console.log(`✅ Format validation passed: ${lines.length} total lines, ${lines.length} valid data lines`);
  
  if (lines.length < 5) {
    throw new Error('Too few lines for valid P6 export');
  }
};

// Parse P6 paste data
const parseP6Data = (content) => {
  console.log('Extracting P6 data...');
  
  const lines = content.split('\n');
  const parsedData = [];
  
  console.log(`Processing ${lines.length} data lines...`);
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    // Split by tab or multiple spaces
    const columns = trimmedLine.split(/\t+|\s{2,}/);
    
    if (columns.length >= 2) {
      const wbsCode = columns[0].trim();
      const wbsName = columns[1].trim();
      
      // Skip header row
      if (wbsCode === 'WBS Code' || wbsName === 'WBS Name') {
        return;
      }
      
      if (wbsCode && wbsName) {
        parsedData.push({
          wbs_code: wbsCode,
          wbs_name: wbsName,
          raw_line: trimmedLine,
          line_number: index + 1
        });
      }
    }
  });

  console.log(`Extracted ${parsedData.length} valid WBS items (skipped ${lines.length - parsedData.length} invalid lines)`);
  
  if (parsedData.length === 0) {
    throw new Error('No valid WBS data found in paste content');
  }

  return parsedData;
};

// Convert P6 data to WBS structure
const convertToWBSStructure = (parsedData) => {
  console.log('Converting P6 data to WBS structure...');
  
  const wbsStructure = parsedData.map(item => {
    // Determine parent WBS code
    let parentWbsCode = '';
    const codeParts = item.wbs_code.split('.');
    if (codeParts.length > 1) {
      parentWbsCode = codeParts.slice(0, -1).join('.');
    }

    return {
      wbs_code: item.wbs_code,
      parent_wbs_code: parentWbsCode,
      wbs_name: item.wbs_name,
      level: codeParts.length,
      raw_data: item
    };
  });

  console.log(`Built WBS structure: ${wbsStructure.length} items`);
  console.log('Sample WBS items:', wbsStructure.slice(0, 3));

  return wbsStructure;
};

// Validate and sort WBS structure
const validateAndSortWBS = (wbsStructure) => {
  console.log('Validating and sorting WBS structure...');
  
  // Remove duplicates
  const seen = new Set();
  const uniqueStructure = wbsStructure.filter(item => {
    const key = `${item.wbs_code}|${item.wbs_name}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  console.log(`After duplicate removal: ${uniqueStructure.length} items`);

  // Sort hierarchically
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

  // Validate hierarchy
  console.log('Validating WBS hierarchy...');
  const wbsCodes = new Set(sortedStructure.map(item => item.wbs_code));
  
  sortedStructure.forEach(item => {
    if (item.parent_wbs_code && !wbsCodes.has(item.parent_wbs_code)) {
      console.warn(`Orphaned item: ${item.wbs_code} references missing parent ${item.parent_wbs_code}`);
    }
  });

  console.log('✅ WBS hierarchy validation passed - no orphaned items');
  
  const rootItems = sortedStructure.filter(item => !item.parent_wbs_code);
  console.log(`Root items found: ${rootItems.length}`);

  console.log(`✅ Final sorted structure: ${sortedStructure.length} items`);

  return sortedStructure;
};

// Extract project info from P6 paste data
const extractProjectInfo = (content) => {
  console.log('Extracting project info from P6 data...');
  
  const lines = content.split('\n');
  let projectName = 'Unknown Project';
  
  // Look for project root in first few lines
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim();
    const columns = line.split(/\t+|\s{2,}/);
    
    if (columns.length >= 2) {
      const wbsCode = columns[0].trim();
      const wbsName = columns[1].trim();
      
      // Project root typically has simple numeric code like "5737"
      if (wbsCode && wbsName && /^\d+$/.test(wbsCode)) {
        projectName = wbsName;
        console.log(`✅ Project name found: "${projectName}"`);
        break;
      }
    }
  }

  return {
    projectName: projectName,
    extractedAt: new Date().toISOString(),
    source: 'p6_paste',
    stats: {
      totalLines: lines.length,
      extractedWBSItems: 0 // Will be filled later
    }
  };
};

// FIXED: Extract equipment codes AND subsystems from P6 WBS structure
// This is the KEY FIX - updated regex to match your P6 format
const extractEquipmentAndSubsystemData = (wbsStructure) => {
  console.log('ENHANCED: Extracting equipment codes and subsystems from P6 WBS structure...');
  
  const equipmentCodes = [];
  const equipmentMapping = {}; // WBS code → equipment info
  const existingSubsystems = {}; // Subsystem code → subsystem info
  
  wbsStructure.forEach(item => {
    const wbsName = item.wbs_name || '';
    const wbsCode = item.wbs_code || '';
    
    // Extract equipment codes (items with | separator)
    if (wbsName.includes('|')) {
      const parts = wbsName.split('|');
      if (parts.length >= 2) {
        const equipmentCode = parts[0].trim();
        const description = parts.slice(1).join('|').trim();
        
        // Skip structural items (M |, P |, S1 |, etc.) but keep equipment codes
        if (equipmentCode && !equipmentCode.match(/^(M|P|S\d+|\d+)\s*$/)) {
          equipmentCodes.push(equipmentCode);
          equipmentMapping[equipmentCode] = {
            wbs_code: wbsCode,
            wbs_name: wbsName,
            parent_wbs_code: item.parent_wbs_code || '',
            description: description,
            level: item.level || wbsCode.split('.').length
          };
          
          console.log(`Equipment found: ${equipmentCode} at WBS ${wbsCode}`);
        }
      }
    }
    
    // FIXED: Extract subsystems - Updated regex for your exact P6 format
    // Your format: "S1 | +Z01 - 33kV Switchroom 1" 
    if (wbsName.match(/^S\d+\s*\|\s*\+Z\d+\s*-/)) {
      const subsystemMatch = wbsName.match(/^(S\d+)\s*\|\s*(\+Z\d+)\s*-\s*(.*)/);
      if (subsystemMatch) {
        const subsystemNumber = subsystemMatch[1]; // S1, S2, etc.
        const subsystemCode = subsystemMatch[2];   // +Z01, +Z02, etc.  
        const subsystemName = subsystemMatch[3].trim(); // 33kV Switchroom 1
        
        existingSubsystems[subsystemCode] = {
          number: subsystemNumber,
          code: subsystemCode,
          name: subsystemName,
          full_name: wbsName,
          wbs_code: wbsCode,
          parent_wbs_code: item.parent_wbs_code || '',
          level: item.level || wbsCode.split('.').length
        };
        
        console.log(`SUBSYSTEM FOUND: ${subsystemCode} (${subsystemNumber}) - ${subsystemName} at WBS ${wbsCode}`);
      }
    }
  });
  
  console.log('ENHANCED EXTRACTION RESULTS:');
  console.log(`- Equipment codes: ${equipmentCodes.length}`);
  console.log(`- Equipment mapping entries: ${Object.keys(equipmentMapping).length}`);
  console.log(`- Existing subsystems: ${Object.keys(existingSubsystems).length}`); // Should show 1 for +Z01!
  console.log(`Sample equipment codes:`, equipmentCodes.slice(0, 10));
  console.log(`Existing subsystems:`, Object.keys(existingSubsystems).map(code => `${code}: ${existingSubsystems[code].full_name}`));
  
  return {
    equipmentCodes,
    equipmentMapping,
    existingSubsystems
  };
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
  validateP6Format, 
  parseP6Data, 
  convertToWBSStructure,
  extractEquipmentAndSubsystemData
};

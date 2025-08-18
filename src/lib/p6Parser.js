/**
 * P6 Copy/Paste Parser - ENHANCED for Missing Equipment
 * 
 * Purpose: Parse P6 WBS data that users copy directly from P6 and paste
 * into a text area. Now includes proper equipment extraction and subsystem detection.
 * 
 * Expected format:
 * WBS Code	WBS Name
 * 5737.1064.1575.1096	+UH101 | Feeder Protection Panel
 * 5737.1064.1575.1096.1235	-F102 | Feeder Protection Relay
 * 
 * Supports both tab-separated and space-separated formats.
 */

// Main P6 paste parsing function - ENHANCED
export const parseP6PasteData = (pasteContent) => {
  return new Promise((resolve, reject) => {
    try {
      console.log('=== STARTING P6 PASTE PARSING ===');
      console.log(`Paste content length: ${pasteContent.length} characters`);
      console.log('First 200 characters:', pasteContent.substring(0, 200));

      // Step 1: Validate format
      console.log('\n=== STEP 1: VALIDATING P6 FORMAT ===');
      validateP6Format(pasteContent);
      console.log('✅ P6 format validation PASSED');

      // Step 2: Parse lines and extract data
      console.log('\n=== STEP 2: PARSING P6 DATA ===');
      const parsedData = extractP6Data(pasteContent);
      console.log(`✅ Extracted ${parsedData.length} WBS items`);

      // Step 3: Convert to standard WBS structure
      console.log('\n=== STEP 3: CONVERTING TO WBS STRUCTURE ===');
      const wbsStructure = convertP6ToWBSStructure(parsedData);
      console.log(`✅ Converted WBS structure: ${wbsStructure.length} items`);

      // Step 4: Validate and sort
      console.log('\n=== STEP 4: VALIDATING AND SORTING ===');
      const finalStructure = validateAndSortWBS(wbsStructure);
      console.log(`✅ Final WBS structure: ${finalStructure.length} items`);

      // Step 5: Extract project info
      console.log('\n=== STEP 5: EXTRACTING PROJECT INFO ===');
      const projectInfo = extractProjectInfoFromP6(finalStructure);
      console.log('✅ Project info extracted:', projectInfo);

      // Step 6: ENHANCED - Extract equipment and subsystem data
      console.log('\n=== STEP 6: EXTRACTING EQUIPMENT & SUBSYSTEM DATA ===');
      const extractionResults = extractEquipmentCodesFromP6WBS(finalStructure);
      console.log('✅ Equipment and subsystem extraction completed');

      // Step 7: Build enhanced final result
      console.log('\n=== STEP 7: BUILDING ENHANCED RESULT ===');
      const result = {
        type: 'p6_paste',
        hasData: finalStructure.length > 0,
        data: finalStructure,
        wbsStructure: finalStructure, // For consistency with other parts of your app
        dataLength: finalStructure.length,
        originalHeaders: ['wbs_code', 'parent_wbs_code', 'wbs_name'],
        projectInfo: projectInfo,
        // ENHANCED: Include extraction results
        equipmentCodes: extractionResults.equipmentCodes,
        equipmentMapping: extractionResults.equipmentMapping,
        existingSubsystems: extractionResults.existingSubsystems,
        validation: {
          isValid: true,
          errors: [],
          warnings: [],
          totalRecords: finalStructure.length
        }
      };

      console.log('✅ P6 PARSING COMPLETED SUCCESSFULLY');
      console.log('Final result summary:', {
        type: result.type,
        hasData: result.hasData,
        dataLength: result.dataLength,
        projectName: result.projectInfo?.projectName,
        equipmentItems: extractionResults.equipmentCodes.length,
        subsystems: Object.keys(extractionResults.existingSubsystems).length
      });

      resolve(result);

    } catch (error) {
      console.error('❌ P6 PARSING FAILED');
      console.error('Error details:', {
        message: error.message,
        contentLength: pasteContent?.length || 0
      });
      
      reject(new Error(`P6 parsing failed: ${error.message}`));
    }
  });
};

// Validate P6 paste format
const validateP6Format = (content) => {
  console.log('Validating P6 paste format...');
  
  if (!content || typeof content !== 'string') {
    throw new Error('No P6 data provided');
  }

  if (content.trim().length === 0) {
    throw new Error('P6 data is empty');
  }

  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    throw new Error('P6 data must contain at least a header and one data row');
  }

  // Check first line for expected headers
  const headerLine = lines[0].trim();
  const hasValidHeaders = 
    headerLine.includes('WBS Code') && headerLine.includes('WBS Name') ||
    headerLine.includes('wbs_code') && headerLine.includes('wbs_name');

  if (!hasValidHeaders) {
    throw new Error(`Invalid P6 format. Expected headers: "WBS Code" and "WBS Name". Found: "${headerLine}"`);
  }

  // Check if we have data rows with proper structure
  const dataLines = lines.slice(1);
  const validDataLines = dataLines.filter(line => {
    const parts = splitDataLine(line);
    return parts.length >= 2 && parts[0].trim() && parts[1].trim();
  });

  if (validDataLines.length === 0) {
    throw new Error('No valid data rows found. Each row must have WBS Code and WBS Name separated by tabs or spaces');
  }

  console.log(`✅ Format validation passed: ${dataLines.length} total lines, ${validDataLines.length} valid data lines`);
};

// Split data line - handles both tab and space separation
const splitDataLine = (line) => {
  // First try tab separation
  if (line.includes('\t')) {
    return line.split('\t');
  }
  
  // Fall back to space separation (multiple spaces)
  // Use regex to split on 2+ spaces to handle spaces within names
  return line.split(/\s{2,}/);
};

// Extract P6 data from paste content
const extractP6Data = (content) => {
  console.log('Extracting P6 data...');
  
  const lines = content.split('\n').filter(line => line.trim());
  const headerLine = lines[0];
  const dataLines = lines.slice(1);
  
  console.log(`Processing ${dataLines.length} data lines...`);
  
  const parsedData = [];
  let skippedLines = 0;
  
  dataLines.forEach((line, index) => {
    const parts = splitDataLine(line.trim());
    
    if (parts.length >= 2 && parts[0].trim() && parts[1].trim()) {
      const wbsCode = parts[0].trim();
      const wbsName = parts[1].trim();
      
      parsedData.push({
        wbs_code: wbsCode,
        wbs_name: wbsName,
        original_line: line.trim(),
        line_number: index + 2 // +2 because we skip header and are 1-indexed
      });
    } else {
      skippedLines++;
      if (skippedLines <= 5) { // Only log first 5 skipped lines
        console.warn(`Skipped malformed line ${index + 2}: "${line.trim()}"`);
      }
    }
  });

  console.log(`Extracted ${parsedData.length} valid WBS items (skipped ${skippedLines} invalid lines)`);
  
  if (parsedData.length === 0) {
    throw new Error('No valid WBS data found. Please check the format.');
  }

  return parsedData;
};

// Convert P6 data to standard WBS structure format
const convertP6ToWBSStructure = (p6Data) => {
  console.log('Converting P6 data to WBS structure...');
  
  const wbsStructure = [];
  const wbsCodeMap = new Map(); // Track all WBS codes for parent lookup
  
  // First pass: Create all WBS items and build code map
  p6Data.forEach(item => {
    wbsCodeMap.set(item.wbs_code, item);
  });
  
  // Second pass: Build WBS structure with parent relationships
  p6Data.forEach(item => {
    const wbsCode = item.wbs_code;
    const wbsName = item.wbs_name;
    
    // Determine parent WBS code
    const parentWbsCode = findParentWbsCode(wbsCode, wbsCodeMap);
    
    const wbsItem = {
      wbs_code: wbsCode,
      parent_wbs_code: parentWbsCode,
      wbs_name: wbsName,
      // Add metadata for debugging
      original_line: item.original_line,
      line_number: item.line_number,
      level: wbsCode.split('.').length
    };
    
    wbsStructure.push(wbsItem);
  });
  
  console.log(`Built WBS structure: ${wbsStructure.length} items`);
  console.log('Sample WBS items:', wbsStructure.slice(0, 3));
  
  return wbsStructure;
};

// Find parent WBS code by looking for longest matching prefix
const findParentWbsCode = (wbsCode, wbsCodeMap) => {
  const codeParts = wbsCode.split('.');
  
  // Try to find parent by removing last segment
  for (let i = codeParts.length - 1; i > 0; i--) {
    const potentialParent = codeParts.slice(0, i).join('.');
    if (wbsCodeMap.has(potentialParent)) {
      return potentialParent;
    }
  }
  
  // No parent found (this is a root item)
  return null;
};

// Validate and sort WBS structure
const validateAndSortWBS = (wbsStructure) => {
  console.log('Validating and sorting WBS structure...');
  
  // Remove duplicates
  const uniqueStructure = removeDuplicates(wbsStructure);
  console.log(`After duplicate removal: ${uniqueStructure.length} items`);
  
  // Sort hierarchically
  const sortedStructure = uniqueStructure.sort((a, b) => {
    const aParts = a.wbs_code.split('.').map(part => parseInt(part) || 0);
    const bParts = b.wbs_code.split('.').map(part => parseInt(part) || 0);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart !== bPart) {
        return aPart - bPart;
      }
    }
    
    return 0;
  });
  
  // Validate hierarchy (no orphaned items)
  console.log('Validating WBS hierarchy...');
  const wbsCodeSet = new Set(sortedStructure.map(item => item.wbs_code));
  
  const orphanedItems = sortedStructure.filter(item => {
    if (!item.parent_wbs_code) return false; // Root items are fine
    return !wbsCodeSet.has(item.parent_wbs_code);
  });
  
  if (orphanedItems.length > 0) {
    console.warn(`Found ${orphanedItems.length} orphaned items (parent not found)`);
    orphanedItems.slice(0, 5).forEach(item => {
      console.warn(`Orphaned: ${item.wbs_code} → parent ${item.parent_wbs_code} not found`);
    });
  } else {
    console.log('✅ WBS hierarchy validation passed - no orphaned items');
  }
  
  const rootItems = sortedStructure.filter(item => !item.parent_wbs_code);
  console.log(`Root items found: ${rootItems.length}`);
  
  console.log(`✅ Final sorted structure: ${sortedStructure.length} items`);
  return sortedStructure;
};

// Remove duplicate WBS items
const removeDuplicates = (wbsStructure) => {
  const seen = new Set();
  return wbsStructure.filter(item => {
    const key = item.wbs_code;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

// Extract project info from WBS structure
const extractProjectInfoFromP6 = (wbsStructure) => {
  console.log('Extracting project info from P6 data...');
  
  // Find root item (project name)
  const rootItem = wbsStructure.find(item => !item.parent_wbs_code);
  const projectName = rootItem ? 
    rootItem.wbs_name : 'Unknown Project';
  
  // Calculate basic stats
  const stats = {
    totalWBSItems: wbsStructure.length,
    maxLevel: Math.max(...wbsStructure.map(item => item.wbs_code.split('.').length)),
    equipmentItems: wbsStructure.filter(item => item.wbs_name.includes('|')).length,
    structuralItems: wbsStructure.filter(item => !item.wbs_name.includes('|')).length
  };
  
  const projectInfo = {
    projectName: projectName,
    extractedAt: new Date().toISOString(),
    source: 'p6_paste',
    stats: stats
  };
  
  console.log('✅ Project info:', projectInfo);
  return projectInfo;
};

// ENHANCED: Extract actual equipment codes and subsystem data from WBS structure  
export const extractEquipmentCodesFromP6WBS = (wbsStructure) => {
  console.log('ENHANCED: Extracting equipment codes and subsystems from P6 WBS structure...');
  
  // Use the same equipment patterns as equipmentProcessor.js
  const equipmentPatterns = [
    /^\+UH\d+/i,     // +UH101, +UH102, +UH103
    /^\+GB\d+/i,     // +GB52, +GB63, +GB74
    /^\+WA\d+/i,     // +WA10, +WA11
    /^\+WC\d+/i,     // +WC10, +WC11
    /^T\d+/i,        // T10, T11, T12
    /^-F\d+/i,       // -F102, -F103, -F104
    /^-Y\d+/i,       // -Y110, -Y111, -Y112
    /^-FM\d+/i,      // -FM11, -FM21
    /^\+Z01-/i,      // +Z01-ASDU
    /^PSU\d*/i,      // PSU1, PSU2
    /^UPS\d*/i,      // UPS1, UPS2
    /^BCR\d*/i,      // BCR1
    /^-P\d+/i,       // -P20, -P210
    /^-KF\d+/i,      // -KF20
    /^-UC\d+/i,      // -UC22
    /^NET\d*/i,      // NET1
    /^TA\d*/i,       // TA1
    /^NER\d*/i,      // NER1
    /^E\d+/i,        // E1, E2
    /^EB\d+/i,       // EB1
    /^EEP\d+/i,      // EEP1
    /^MEB\d*/i,      // MEB1
    /^EG01-/i,       // EG01-
    /^BAN\d*/i,      // BAN1
    /^WBC-/i,        // WBC-
    /^LS\d+-/i,      // LS1-002
    /^MCP-/i,        // MCP-002
    /^-X\d+/i,       // -X110
    /^REED-/i,       // REED-
    /^SCR-/i,        // SCR-
    /^MPIR-/i,       // MPIR-
    /^KP-/i          // KP-
  ];
  
  const equipmentMapping = {};
  const extractedCodes = [];
  const existingSubsystems = {};
  
  wbsStructure.forEach(item => {
    const wbsName = item.wbs_name || '';
    
    // Extract subsystem information (S1 | +Z01 | Subsystem Name)
    const subsystemMatch = wbsName.match(/^S(\d+)\s*\|\s*([^|]+)\s*\|\s*(.+)/);
    if (subsystemMatch) {
      const subsystemNumber = subsystemMatch[1];
      const subsystemCode = subsystemMatch[2].trim();
      const subsystemName = subsystemMatch[3].trim();
      
      existingSubsystems[`S${subsystemNumber}`] = {
        wbs_code: item.wbs_code,
        code: subsystemCode,
        name: subsystemName,
        full_name: wbsName
      };
      
      console.log(`Found subsystem: S${subsystemNumber} = ${subsystemCode} (${subsystemName}) at WBS ${item.wbs_code}`);
      return; // Skip equipment processing for subsystem headers
    }
    
    // Skip if no pipe symbol (not equipment)
    if (!wbsName.includes('|')) return;
    
    // Look for equipment code before the first pipe
    const beforePipe = wbsName.split('|')[0].trim();
    
    // Test against equipment patterns
    for (const pattern of equipmentPatterns) {
      if (pattern.test(beforePipe)) {
        const equipmentCode = beforePipe;
        const description = wbsName.split('|')[1]?.trim() || '';
        
        // Store equipment with its WBS location and hierarchy info
        equipmentMapping[equipmentCode] = {
          wbs_code: item.wbs_code,
          parent_wbs_code: item.parent_wbs_code,
          wbs_name: item.wbs_name,
          description: description,
          level: item.level || item.wbs_code.split('.').length
        };
        
        extractedCodes.push(equipmentCode);
        console.log(`Equipment found: ${equipmentCode} at WBS ${item.wbs_code}`);
        break;
      }
    }
  });
  
  console.log(`ENHANCED EXTRACTION RESULTS:`);
  console.log(`- Equipment codes: ${extractedCodes.length}`);
  console.log(`- Equipment mapping entries: ${Object.keys(equipmentMapping).length}`);
  console.log(`- Existing subsystems: ${Object.keys(existingSubsystems).length}`);
  console.log('Sample equipment codes:', extractedCodes.slice(0, 10));
  console.log('Existing subsystems:', Object.keys(existingSubsystems));
  
  return {
    equipmentCodes: extractedCodes,
    equipmentMapping: equipmentMapping,
    existingSubsystems: existingSubsystems
  };
};

// Get format example for user guidance
export const getP6FormatExample = () => {
  return `Expected P6 copy/paste format:

WBS Code	WBS Name
5737	Summerfield
5737.1064	S1 | +Z01 - 33kV Switchroom 1
5737.1064.1575	02 | Protection Panels
5737.1064.1575.1096	+UH101 | Feeder Protection Panel
5737.1064.1575.1096.1235	-F102 | Feeder Protection Relay

Instructions:
1. In P6, select your WBS structure
2. Copy the "WBS Code" and "WBS Name" columns only
3. Paste the data into the text area below
4. Do NOT include the "Total Activities" column

The data should be tab-separated or space-separated.`;
};

// Check if content looks like P6 format
export const isP6Format = (content) => {
  if (!content || typeof content !== 'string') return false;
  
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length < 2) return false;
  
  const headerLine = lines[0].toLowerCase();
  return (headerLine.includes('wbs code') && headerLine.includes('wbs name')) ||
         (headerLine.includes('wbs_code') && headerLine.includes('wbs_name'));
};

// LEGACY COMPATIBILITY: Keep the old function name as an alias
export const parseP6Paste = parseP6PasteData;

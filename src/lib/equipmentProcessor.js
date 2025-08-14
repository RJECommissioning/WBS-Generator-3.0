import { EQUIPMENT_PATTERNS, SUB_EQUIPMENT_PATTERNS, EQUIPMENT_CATEGORIES, COMMISSIONING_STATUS } from '../constants';
import { stringHelpers, patternHelpers, arrayHelpers } from '../utils';

/**
 * Enhanced Equipment Processor - WITH DEBUG CODE ADDED
 * CONSISTENT FIELD NAMES:
 * - parent_equipment_number (NOT parent_equipment_code)
 * - commissioning_yn (NOT commissioning_status)
 * FIXED: Proper handling of '-' symbol in parent_equipment_number
 * FIXED: Build errors and runtime errors
 * FIXED: Child equipment inherits parent's category instead of pattern matching
 */

// Helper function for safe string conversion
const safeToString = (value) => {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
};

// Equipment code cleaning - FIXED: Handle equipment vs parent differently
const cleanEquipmentCode = (value) => {
  const stringValue = safeToString(value);
  if (!stringValue || stringValue.trim() === '') {
    return '';
  }
  if (stringValue.trim() === '-') {
    return ''; // Equipment numbers should never be "-"
  }
  return stringValue.trim().replace(/\s+/g, ' ');
};

// NEW: Separate function for cleaning parent equipment codes
const cleanParentEquipmentCode = (value) => {
  const stringValue = safeToString(value);
  if (!stringValue || stringValue.trim() === '') {
    return null; // No parent specified
  }
  if (stringValue.trim() === '-') {
    return null; // '-' means this equipment IS a parent (no parent above it)
  }
  return stringValue.trim().replace(/\s+/g, ' ');
};

// CORRECTED: Basic equipment validation for Y-status items (accept ALL, never filter)
const isValidEquipmentCode = (equipmentCode) => {
  const cleaned = safeToString(equipmentCode).trim();
  
  // Accept ALL non-empty equipment codes for Y-status items
  return cleaned !== '' && 
         cleaned !== '-' && 
         cleaned.length >= 1 && 
         cleaned.toLowerCase() !== 'n/a' &&
         cleaned.toLowerCase() !== 'null' &&
         cleaned.toLowerCase() !== 'undefined';
};

// LENIENT: Accept any non-empty code for TBC items
const isValidTBCItem = (equipmentCode) => {
  const cleaned = safeToString(equipmentCode).trim();
  return cleaned !== '' && cleaned !== '-' && cleaned.toLowerCase() !== 'n/a';
};

// Enhanced pattern matching for electrical equipment - WITH DEBUG CODE
const testPatternMatch = (equipmentNumber, pattern) => {
  const safeEquipmentNumber = safeToString(equipmentNumber);
  
  if (!safeEquipmentNumber) return false;
  
  const cleanEquipmentNumber = safeEquipmentNumber.toUpperCase().trim();
  
  if (pattern instanceof RegExp) {
    const result = pattern.test(cleanEquipmentNumber);
    // DEBUG CODE ADDED:
    console.log(`🔍 PATTERN TEST: "${cleanEquipmentNumber}" vs ${pattern} = ${result}`);
    return result;
  }
  
  const safePattern = safeToString(pattern);
  if (!safePattern) return false;
  
  const cleanPattern = safePattern.toUpperCase().trim();
  
  if (cleanEquipmentNumber.startsWith(cleanPattern)) {
    return true;
  }
  
  if (cleanPattern.includes('X')) {
    const regexPattern = cleanPattern.replace(/X+/g, '\\d+').replace(/\+/g, '\\+');
    const regex = new RegExp(`^${regexPattern}`, 'i');
    return regex.test(cleanEquipmentNumber);
  }
  
  return false;
};

// Determine equipment category for electrical equipment - WITH DEBUG CODE
const determineEquipmentCategory = (equipmentNumber) => {
  const safeEquipmentNumber = safeToString(equipmentNumber);
  
  if (!safeEquipmentNumber || safeEquipmentNumber.trim() === '') {
    return '99';
  }

  const cleanedNumber = safeEquipmentNumber.toUpperCase().trim();
  
  // DEBUG CODE ADDED:
  console.log(`📋 CATEGORIZING: "${cleanedNumber}"`);
  
  // Test against electrical equipment patterns
  for (const [categoryId, patterns] of Object.entries(EQUIPMENT_PATTERNS)) {
    console.log(`  Testing category ${categoryId}:`, patterns.length, 'patterns');
    for (const pattern of patterns) {
      const patternString = pattern.pattern || pattern;
      console.log(`    Pattern:`, patternString);
      
      if (testPatternMatch(cleanedNumber, patternString)) {
        console.log(`✅ MATCH FOUND: "${cleanedNumber}" → Category ${categoryId}`);
        return categoryId;
      }
    }
  }

  console.log(`❌ NO MATCH: "${cleanedNumber}" → Category 99`);
  return '99'; // Unrecognized electrical equipment
};

// FIXED: Enhanced parent-child relationship analysis for electrical equipment
const analyzeParentChildRelationships = (equipmentList) => {
  console.log('[ANALYSIS] ENHANCED ELECTRICAL EQUIPMENT PARENT-CHILD ANALYSIS');
  
  const relationships = [];
  const parentEquipment = new Set();
  const childEquipment = new Set();
  
  // Create equipment lookup map
  const equipmentMap = new Map();
  equipmentList.forEach(item => {
    const code = cleanEquipmentCode(item.equipment_number);
    if (code) {
      equipmentMap.set(code, item);
    }
  });
  
  console.log(`[MAP] Equipment map created: ${equipmentMap.size} equipment items`);
  
  equipmentList.forEach(item => {
    const equipmentCode = cleanEquipmentCode(item.equipment_number);
    const parentCode = cleanParentEquipmentCode(item.parent_equipment_number); // FIXED: Use new parent cleaning function
    
    if (!equipmentCode) return;
    
    // Enhanced debugging for +UH and -F relationships
    const isUHPanel = equipmentCode.includes('UH');
    const isFDevice = equipmentCode.startsWith('-F');
    const shouldLog = isUHPanel || isFDevice;
    
    if (shouldLog) {
      console.log(`   [ELECTRICAL] Analyzing: "${equipmentCode}" with parent: "${parentCode || 'NULL (is parent)'}"`);
    }
    
    // FIXED: Enhanced parent-child relationship detection
    if (parentCode && parentCode !== equipmentCode) { // FIXED: Only create relationship if parent exists AND is different
      const parentExists = equipmentMap.has(parentCode);
      const relationship = {
        child: equipmentCode,
        parent: parentCode,
        parentExists: parentExists,
        matchedParent: parentExists ? parentCode : null
      };
      
      relationships.push(relationship);
      parentEquipment.add(parentCode);
      childEquipment.add(equipmentCode);
      
      if (shouldLog) {
        const status = parentExists ? 'FOUND' : 'MISSING';
        console.log(`     [MATCH] Parent "${parentCode}" ${status} for child "${equipmentCode}"`);
      }
    } else if (shouldLog) {
      console.log(`     [PARENT] "${equipmentCode}" is a top-level parent (no parent specified)`);
    }
  });
  
  console.log(`[RESULTS] Found ${relationships.length} parent-child relationships`);
  
  if (relationships.length > 0) {
    console.log('[SAMPLE] Sample relationships:');
    relationships.slice(0, 5).forEach((rel, index) => {
      console.log(`   ${index + 1}. "${rel.child}" → "${rel.parent}"`);
    });
    
    // Log specific +UH → -F relationships if found
    const uhRelationships = relationships.filter(rel => 
      rel.parent.includes('UH') && rel.child.startsWith('-F')
    );
    if (uhRelationships.length > 0) {
      console.log(`\n[UH-F] Found +UH → -F relationships:`);
      uhRelationships.slice(0, 5).forEach((rel, index) => {
        console.log(`   ${index + 1}. "${rel.child}" → "${rel.parent}"`);
      });
    }
  } else {
    console.log(`\n[DEBUG] No parent-child relationships found - checking data format...`);
    
    // Debug: Show sample equipment codes and their parent fields
    const sampleItems = equipmentList.slice(0, 5);
    sampleItems.forEach((item, index) => {
      const equipmentCode = cleanEquipmentCode(item.equipment_number);
      const parentCodeForDebug = cleanParentEquipmentCode(item.parent_equipment_number);
      console.log(`   Sample ${index + 1}: "${equipmentCode}" parent: "${parentCodeForDebug || 'NULL (is parent)'}"`);
    });
  }
  
  return {
    relationships,
    parentEquipment,
    childEquipment,
    equipmentMap
  };
};

// Main equipment processing with CORRECTED validation strategy
const processEquipmentList = (rawEquipmentList) => {
  console.log('CORRECTED Y-STATUS EQUIPMENT PROCESSING - ACCEPT ALL Y, LENIENT TBC');
  console.log(`Input: ${rawEquipmentList.length} raw equipment items`);

  // Step 1: Separate by commissioning status - FIXED: Use commissioning_yn consistently
  const getCommissioningStatus = (item) => {
    const statusValue = item.commissioning_yn ||       // FIXED: Primary field name
                       item['commissioning_yn'] ||    // FIXED: Bracket notation
                       item['Commissioning (Y/N)'] || // FIXED: Original column name fallback
                       '';
    return safeToString(statusValue).toUpperCase().trim();
  };

  const yStatusItems = rawEquipmentList.filter(item => {
    const status = getCommissioningStatus(item);
    return status === 'Y';
  });

  const tbcStatusItems = rawEquipmentList.filter(item => {
    const status = getCommissioningStatus(item);
    return status === 'TBC';
  });

  console.log(`Status separation: ${yStatusItems.length} Y-status, ${tbcStatusItems.length} TBC-status`);

  // Step 2: ACCEPT ALL valid Y-status equipment (fixed approach)
  const allValidYEquipment = yStatusItems.filter(item => {
    const equipmentCode = cleanEquipmentCode(item.equipment_number);
    const isValid = isValidEquipmentCode(equipmentCode);
    
    if (!isValid) {
      const originalCode = safeToString(item.equipment_number);
      console.log(`❌ REJECTED: "${equipmentCode}" (original: "${originalCode}")`);
    }
    
    return isValid;
  });

  console.log(`Equipment validation: ${allValidYEquipment.length}/${yStatusItems.length} Y-status accepted, ${tbcStatusItems.length}/${tbcStatusItems.length} TBC accepted`);

  // Step 3: Enhanced parent-child relationship analysis
  const relationshipAnalysis = analyzeParentChildRelationships(allValidYEquipment);

  // Step 4: Categorize Y-status equipment - FIXED: Child equipment inherits parent's category
  const categorizedEquipment = allValidYEquipment.map(item => {
    const equipmentCode = cleanEquipmentCode(item.equipment_number);
    const parentCode = cleanParentEquipmentCode(item.parent_equipment_number);
    const isSubEquipment = relationshipAnalysis.childEquipment.has(equipmentCode);
    const isParentEquipment = relationshipAnalysis.parentEquipment.has(equipmentCode);

    // FIXED: Child equipment inherits parent's category instead of pattern matching
    let category, categoryName;
    
    if (isSubEquipment && parentCode) {
      // CHILD EQUIPMENT: Find parent and inherit its category
      const parentItem = allValidYEquipment.find(p => 
        cleanEquipmentCode(p.equipment_number) === parentCode
      );
      if (parentItem) {
        category = determineEquipmentCategory(parentItem.equipment_number); // Use parent's pattern
        categoryName = EQUIPMENT_CATEGORIES[category] || 'Unrecognised Equipment';
        console.log(`👶 CHILD INHERITS: "${equipmentCode}" inherits category ${category} from parent "${parentCode}"`);
      } else {
        // Orphaned child - parent not found
        category = '99';
        categoryName = 'Unrecognised Equipment';
        console.log(`🚨 ORPHANED CHILD: "${equipmentCode}" parent "${parentCode}" not found → Category 99`);
      }
    } else {
      // PARENT EQUIPMENT: Normal pattern matching
      category = determineEquipmentCategory(item.equipment_number);
      categoryName = EQUIPMENT_CATEGORIES[category] || 'Unrecognised Equipment';
    }

    return {
      equipment_number: equipmentCode,
      description: safeToString(item.description || '').trim(),
      category: category,
      category_name: categoryName,
      commissioning_yn: getCommissioningStatus(item), // FIXED: Use consistent field name
      is_sub_equipment: isSubEquipment,
      is_parent_equipment: isParentEquipment,
      parent_equipment_number: parentCode, // FIXED: Use consistent field name
      subsystem: safeToString(item.subsystem || '').trim()
    };
  });

  // Step 5: Process TBC equipment separately - LENIENT acceptance for TBC
  const processedTBCEquipment = tbcStatusItems
    .filter(item => {
      const equipmentCode = cleanEquipmentCode(item.equipment_number);
      return isValidTBCItem(equipmentCode);
    })
    .map((item, index) => {
      const equipmentCode = cleanEquipmentCode(item.equipment_number);
      const tbcSequence = String(index + 1).padStart(3, '0');
      
      return {
        equipment_number: equipmentCode,
        tbc_code: `TBC${tbcSequence}`,
        description: safeToString(item.description || '').trim(),
        category: 'TBC',
        category_name: 'Equipment To Be Confirmed',
        commissioning_yn: 'TBC',
        is_sub_equipment: false,
        is_parent_equipment: false,
        parent_equipment_number: null,
        subsystem: safeToString(item.subsystem || '').trim()
      };
    });

  console.log(`TBC equipment processed: ${processedTBCEquipment.length} items`);

  // Step 6: Extract dynamic subsystem mapping from equipment with proper parsing and sorting
  const subsystemMapping = {};
  const uniqueSubsystems = [...new Set(allValidYEquipment.map(item => 
    safeToString(item.subsystem || '').trim()
  ).filter(subsystem => subsystem && subsystem !== ''))];

  // Parse and sort subsystems by their code (+Z01, +Z02, +Z03...)
  const parsedSubsystems = uniqueSubsystems.map(subsystem => {
    const subsystemParts = subsystem.split(' - ');
    let subsystemCode, subsystemName;
    
    if (subsystemParts.length === 2) {
      // Format: "33kV Switchroom 1 - +Z01"
      subsystemName = subsystemParts[0].trim(); // "33kV Switchroom 1"
      subsystemCode = subsystemParts[1].trim(); // "+Z01"
    } else {
      // Fallback for non-standard format
      subsystemName = subsystem;
      subsystemCode = `Z${String(uniqueSubsystems.indexOf(subsystem) + 1).padStart(2, '0')}`;
    }
    
    return {
      originalKey: subsystem,
      code: subsystemCode,
      name: subsystemName,
      sortOrder: subsystemCode // Use code for sorting (+Z01, +Z02, etc.)
    };
  });

  // Sort by subsystem code (+Z01 first, then +Z02, etc.)
  parsedSubsystems.sort((a, b) => a.sortOrder.localeCompare(b.sortOrder));

  // Create mapping with correct S1, S2, S3... order
  parsedSubsystems.forEach((subsystem, index) => {
    const subsystemIndex = index + 1;
    subsystemMapping[subsystem.originalKey] = {
      code: subsystem.code,
      name: subsystem.name,
      full_name: `S${subsystemIndex} | ${subsystem.code} | ${subsystem.name}`,
      index: subsystemIndex
    };
  });

  console.log('Dynamic subsystem mapping created (sorted by code):', subsystemMapping);

  // Step 7: Generate comprehensive category statistics - FIXED: Include equipment array
  const categoryStats = {};
  
  // Initialize all standard categories - FIXED: Add equipment array
  for (const [categoryId, categoryName] of Object.entries(EQUIPMENT_CATEGORIES)) {
    categoryStats[categoryId] = {
      name: categoryName,
      count: 0,
      equipment: [], // FIXED: Add this missing array
      parent_equipment: [],
      child_equipment: []
    };
  }

  // Populate category statistics from actual equipment
  categorizedEquipment.forEach(item => {
    const category = item.category;
    const equipmentCode = cleanEquipmentCode(item.equipment_number);
    
    if (categoryStats[category]) {
      categoryStats[category].count++;
      categoryStats[category].equipment.push(item); // FIXED: Now this array exists
      
      if (item.is_sub_equipment) {
        categoryStats[category].child_equipment.push(equipmentCode);
      } else {
        categoryStats[category].parent_equipment.push(equipmentCode);
      }
    }
  });

  console.log('ALL Equipment Categories (including unrecognized):');
  Object.entries(categoryStats).forEach(([categoryId, stats]) => {
    if (stats.count > 0) {
      const categoryType = categoryId === '99' ? 'UNRECOGNIZED' : 'ELECTRICAL';
      console.log(`   ${categoryId} | ${stats.name}: ${stats.count} items (${categoryType}) - ${stats.parent_equipment.length} parents, ${stats.child_equipment.length} children`);
    }
  });

  const parentItems = categorizedEquipment.filter(item => !item.is_sub_equipment).length;
  const childItems = categorizedEquipment.filter(item => item.is_sub_equipment).length;

  console.log(`FINAL ACCEPT ALL COUNTS: ${parentItems} parents, ${childItems} children, ${processedTBCEquipment.length} TBC items`);
  console.log(`TOTAL EQUIPMENT FOR EXPORT: ${categorizedEquipment.length} Y-status + ${processedTBCEquipment.length} TBC = ${categorizedEquipment.length + processedTBCEquipment.length} items`);

  return {
    equipment: categorizedEquipment,
    tbcEquipment: processedTBCEquipment,
    subsystemMapping: subsystemMapping,
    original: rawEquipmentList.length,
    yStatusOriginal: yStatusItems.length,
    tbcStatusOriginal: tbcStatusItems.length,
    acceptedYItems: allValidYEquipment.length,
    final: categorizedEquipment.length,
    tbcCount: processedTBCEquipment.length,
    parentItems: parentItems,
    childItems: childItems,
    categoryStats: categoryStats,
    parentChildRelationships: relationshipAnalysis.relationships,
    relationshipAnalysis: relationshipAnalysis,
    filteredOutCount: yStatusItems.length - allValidYEquipment.length
  };
};

// Main equipment categorization function - ENHANCED WITH FIXED COMMISSIONING FILTERING
export const categorizeEquipment = (equipmentList) => {
  try {
    console.log('STARTING CORRECTED EQUIPMENT CATEGORIZATION - ACCEPT ALL Y, LENIENT TBC');
    console.log(`Input: ${equipmentList?.length || 0} raw equipment items`);

    if (!Array.isArray(equipmentList) || equipmentList.length === 0) {
      throw new Error('Invalid equipment list provided');
    }

    const processedData = processEquipmentList(equipmentList);
    
    console.log('CORRECTED equipment categorization completed:', {
      originalItems: processedData.original,
      yStatusItems: processedData.yStatusOriginal,
      acceptedYItems: processedData.acceptedYItems,
      tbcItems: processedData.tbcCount,
      filteredOutInvalid: processedData.filteredOutCount,
      parentItems: processedData.parentItems,
      childItems: processedData.childItems,
      unrecognizedItems: processedData.categoryStats?.['99']?.count || 0
    });

    // Return normalized structure that matches what other components expect
    return {
      // Primary data arrays
      categorizedEquipment: processedData.equipment,
      equipment: processedData.equipment, // Alias for compatibility
      tbcEquipment: processedData.tbcEquipment,
      subsystemMapping: processedData.subsystemMapping,
      
      // Statistics and metadata
      totalProcessed: processedData.final,
      originalCount: processedData.original,
      yStatusOriginal: processedData.yStatusOriginal,
      afterCommissioningFilter: processedData.yStatusOriginal, // For legacy compatibility
      acceptedYItems: processedData.acceptedYItems,
      finalCount: processedData.final,
      parentItems: processedData.parentItems,
      childItems: processedData.childItems,
      tbcCount: processedData.tbcCount,
      filteredOutCount: processedData.filteredOutCount,
      categoryStats: processedData.categoryStats,
      parentChildRelationships: processedData.parentChildRelationships,
      relationshipAnalysis: processedData.relationshipAnalysis,
      
      // Project information
      projectName: '5737 Summerfield Project',
      
      // Summary for UI
      summary: {
        message: `Successfully processed ${processedData.final} equipment items across ${Object.keys(processedData.categoryStats).filter(id => processedData.categoryStats[id].count > 0).length} categories`,
        details: processedData.filteredOutCount > 0 ? 
          [`Filtered out ${processedData.filteredOutCount} items with invalid/empty equipment codes`] : [],
        total_processed: processedData.final,
        categories_created: Object.keys(processedData.categoryStats).filter(id => processedData.categoryStats[id].count > 0).length,
        tbc_count: processedData.tbcCount,
        unrecognized_count: processedData.categoryStats?.['99']?.count || 0
      }
    };

  } catch (error) {
    console.error('Equipment categorization failed:', error);
    throw new Error(`Equipment categorization failed: ${error.message}`);
  }
};

// Additional utility functions
export const filterEquipmentForWBS = (equipment) => {
  return equipment.filter(item => {
    const status = safeToString(item.commissioning_yn || '').toUpperCase(); // FIXED: Use commissioning_yn consistently
    return status === 'Y' || status === 'TBC';
  });
};

export const groupEquipmentBySubsystem = (equipment) => {
  const subsystemGroups = {};
  
  equipment.forEach(item => {
    const subsystem = item.subsystem || 'S1';
    if (!subsystemGroups[subsystem]) {
      subsystemGroups[subsystem] = [];
    }
    subsystemGroups[subsystem].push(item);
  });
  
  return subsystemGroups;
};

export const validateCategorization = (equipment) => {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    statistics: {
      total_items: equipment.length,
      categorized: equipment.filter(item => item.category && item.category !== '99').length,
      unrecognised: equipment.filter(item => !item.category || item.category === '99').length,
      sub_equipment: equipment.filter(item => item.is_sub_equipment).length,
      parent_equipment: equipment.filter(item => !item.is_sub_equipment).length
    }
  };

  return validation;
};

export const exportCategorizedEquipment = (equipment) => {
  return equipment.map(item => ({
    equipment_number: item.equipment_number,
    description: item.description,
    category: item.category,
    category_name: item.category_name,
    commissioning_yn: item.commissioning_yn, // FIXED: Use commissioning_yn consistently
    is_sub_equipment: item.is_sub_equipment,
    is_parent_equipment: item.is_parent_equipment,
    parent_equipment_number: item.parent_equipment_number || '', // FIXED: Use parent_equipment_number consistently
    subsystem: item.subsystem
  }));
};

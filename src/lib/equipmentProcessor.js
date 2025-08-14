import { EQUIPMENT_PATTERNS, SUB_EQUIPMENT_PATTERNS, EQUIPMENT_CATEGORIES, COMMISSIONING_STATUS } from '../constants';
import { stringHelpers, patternHelpers, arrayHelpers } from '../utils';

/**
 * Enhanced Equipment Processor - DEBUG VERSION WITH COMPREHENSIVE LOGGING
 * CRITICAL FIX: Identify exactly where parent_equipment_number becomes self-referencing
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

// NEW: Separate function for cleaning parent equipment codes with ENHANCED DEBUGGING
const cleanParentEquipmentCode = (value) => {
  const originalValue = value; // Store original for debugging
  const stringValue = safeToString(value);
  
  // 🔍 DEBUG: Log what this function receives and returns
  console.log(`🔍 cleanParentEquipmentCode called with:`, {
    original: originalValue,
    stringValue: stringValue,
    trimmed: stringValue.trim()
  });
  
  if (!stringValue || stringValue.trim() === '') {
    console.log(`   → Returning NULL (empty/null input)`);
    return null; // No parent specified
  }
  if (stringValue.trim() === '-') {
    console.log(`   → Returning NULL (dash means this IS a parent)`);
    return null; // '-' means this equipment IS a parent (no parent above it)
  }
  
  const cleaned = stringValue.trim().replace(/\s+/g, ' ');
  console.log(`   → Returning cleaned: "${cleaned}"`);
  return cleaned;
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

// Enhanced pattern matching for electrical equipment
const testPatternMatch = (equipmentNumber, pattern) => {
  if (!equipmentNumber || !pattern) return false;
  
  const cleanEquipmentNumber = cleanEquipmentCode(equipmentNumber);
  if (!cleanEquipmentNumber) return false;
  
  // CRITICAL FIX: Handle RegExp objects properly
  if (pattern instanceof RegExp) {
    return pattern.test(cleanEquipmentNumber);
  }
  
  // Handle string patterns as fallback
  if (typeof pattern === 'string') {
    try {
      const regexPattern = new RegExp(pattern, 'i');
      return regexPattern.test(cleanEquipmentNumber);
    } catch (error) {
      console.warn(`Invalid pattern: ${pattern}`, error);
      return false;
    }
  }
  
  return false;
};

// Enhanced equipment category determination
const determineEquipmentCategory = (equipmentNumber) => {
  if (!equipmentNumber) return '99';
  
  const cleanCode = cleanEquipmentCode(equipmentNumber);
  if (!cleanCode) return '99';
  
  // Test against all equipment patterns in order
  for (const [categoryId, patterns] of Object.entries(EQUIPMENT_PATTERNS)) {
    const categoryPatterns = Array.isArray(patterns) ? patterns : [patterns];
    
    for (const pattern of categoryPatterns) {
      if (testPatternMatch(cleanCode, pattern)) {
        return categoryId;
      }
    }
  }
  
  return '99'; // Unrecognised Equipment
};

// Enhanced parent-child relationship analysis with COMPREHENSIVE DEBUGGING
const analyzeParentChildRelationships = (equipmentList) => {
  console.log('[ANALYSIS] 🔍 ENHANCED ELECTRICAL EQUIPMENT PARENT-CHILD ANALYSIS WITH FULL DEBUG');
  
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
  
  // 🔍 DEBUG: Log first 3 raw items before any processing
  console.log(`🔍 RAW DATA SAMPLE (first 3 items):`);
  equipmentList.slice(0, 3).forEach((item, index) => {
    console.log(`   Raw Item ${index + 1}:`, {
      equipment_number: item.equipment_number,
      parent_equipment_number: item.parent_equipment_number,
      description: item.description?.slice(0, 30) + '...'
    });
  });
  
  equipmentList.forEach((item, itemIndex) => {
    const equipmentCode = cleanEquipmentCode(item.equipment_number);
    
    // 🔍 CRITICAL DEBUG: Log the original parent data before cleaning
    if (itemIndex < 10) { // Debug first 10 items
      console.log(`🔍 ITEM ${itemIndex + 1} RAW DATA:`, {
        equipment_number: item.equipment_number,
        parent_equipment_number: item.parent_equipment_number
      });
    }
    
    const parentCode = cleanParentEquipmentCode(item.parent_equipment_number);
    
    if (!equipmentCode) return;
    
    // Enhanced debugging for +UH and -F relationships
    const isUHPanel = equipmentCode.includes('UH');
    const isFDevice = equipmentCode.startsWith('-F');
    const shouldLog = isUHPanel || isFDevice || itemIndex < 10; // Log first 10 + electrical items
    
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
  console.log('🔍 STARTING DEBUG VERSION - Y-STATUS EQUIPMENT PROCESSING');
  console.log(`Input: ${rawEquipmentList.length} raw equipment items`);

  // 🔍 DEBUG: Log sample raw data BEFORE any processing
  console.log(`🔍 RAW INPUT SAMPLE (first 3 items):`);
  rawEquipmentList.slice(0, 3).forEach((item, index) => {
    console.log(`   Raw ${index + 1}:`, {
      equipment_number: item.equipment_number,
      parent_equipment_number: item.parent_equipment_number,
      commissioning_yn: item.commissioning_yn
    });
  });

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

  // 🔍 DEBUG: Log sample Y-status data AFTER filtering
  console.log(`🔍 Y-STATUS SAMPLE (first 3 items):`);
  yStatusItems.slice(0, 3).forEach((item, index) => {
    console.log(`   Y-Status ${index + 1}:`, {
      equipment_number: item.equipment_number,
      parent_equipment_number: item.parent_equipment_number,
      commissioning_yn: item.commissioning_yn
    });
  });

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

  // 🔍 DEBUG: Log sample validated data AFTER validation
  console.log(`🔍 VALIDATED SAMPLE (first 3 items):`);
  allValidYEquipment.slice(0, 3).forEach((item, index) => {
    console.log(`   Validated ${index + 1}:`, {
      equipment_number: item.equipment_number,
      parent_equipment_number: item.parent_equipment_number,
      commissioning_yn: item.commissioning_yn
    });
  });

  // Step 3: Enhanced parent-child relationship analysis
  const relationshipAnalysis = analyzeParentChildRelationships(allValidYEquipment);

  // Step 4: Categorize Y-status equipment with ENHANCED DEBUGGING
  console.log(`🔍 STEP 4: Starting categorization of ${allValidYEquipment.length} items...`);
  
  const categorizedEquipment = allValidYEquipment.map((item, itemIndex) => {
    const category = determineEquipmentCategory(item.equipment_number);
    const categoryName = EQUIPMENT_CATEGORIES[category] || 'Unrecognised Equipment';
    
    // FIXED: Check if this is sub-equipment based on parent relationship
    const equipmentCode = cleanEquipmentCode(item.equipment_number);
    const isSubEquipment = relationshipAnalysis.childEquipment.has(equipmentCode);
    
    // 🔍 CRITICAL DEBUG: Log transformation for first 5 items
    if (itemIndex < 5) {
      console.log(`🔍 CATEGORIZATION DEBUG - Item ${itemIndex + 1}:`);
      console.log(`   Input equipment_number: "${item.equipment_number}"`);
      console.log(`   Input parent_equipment_number: "${item.parent_equipment_number}"`);
      console.log(`   Calling cleanParentEquipmentCode("${item.parent_equipment_number}")...`);
    }
    
    const cleanedParentCode = cleanParentEquipmentCode(item.parent_equipment_number);
    
    if (itemIndex < 5) {
      console.log(`   Result from cleanParentEquipmentCode: "${cleanedParentCode}"`);
    }
    
    const processedItem = {
      ...item,
      category,
      category_name: categoryName,
      is_sub_equipment: isSubEquipment,
      parent_equipment_number: cleanedParentCode, // This should NOT be self-referencing
      commissioning_yn: item.commissioning_yn
    };
    
    // 🔍 FINAL DEBUG: Log the output
    if (itemIndex < 5) {
      console.log(`   Final processed item:`, {
        equipment_number: processedItem.equipment_number,
        parent_equipment_number: processedItem.parent_equipment_number,
        is_sub_equipment: processedItem.is_sub_equipment
      });
      console.log(`   ───────────────────────────────────────`);
    }
    
    return processedItem;
  });

  // 🔍 VERIFICATION: Check if self-referencing still exists
  const selfReferencingItems = categorizedEquipment.filter(item => 
    item.equipment_number === item.parent_equipment_number
  );
  
  console.log(`🔍 SELF-REFERENCING CHECK: Found ${selfReferencingItems.length} self-referencing items`);
  if (selfReferencingItems.length > 0) {
    console.log(`   Examples:`, selfReferencingItems.slice(0, 3).map(item => ({
      equipment: item.equipment_number,
      parent: item.parent_equipment_number
    })));
  }

  // Step 5: Process TBC equipment with lenient validation
  const processedTBCEquipment = tbcStatusItems
    .filter(item => {
      const equipmentCode = cleanEquipmentCode(item.equipment_number);
      return isValidTBCItem(equipmentCode);
    })
    .map((item, index) => ({
      ...item,
      tbc_code: `TBC${String(index + 1).padStart(3, '0')}`,
      category: '99',
      category_name: 'TBC - Equipment To Be Confirmed',
      is_sub_equipment: false,
      parent_equipment_number: cleanParentEquipmentCode(item.parent_equipment_number),
      commissioning_yn: item.commissioning_yn
    }));

  // Step 6: Extract dynamic subsystem mapping from processed equipment
  const subsystemMapping = {};
  let subsystemIndex = 1;

  allValidYEquipment.forEach(item => {
    const subsystem = item.subsystem;
    if (subsystem && !subsystemMapping[subsystem]) {
      subsystemMapping[subsystem] = {
        code: `S${subsystemIndex}`,
        name: subsystem,
        z_code: `Z${String(subsystemIndex).padStart(2, '0')}`,
        full_name: `S${subsystemIndex} | Z${String(subsystemIndex).padStart(2, '0')} | ${subsystem}`
      };
      subsystemIndex++;
    }
  });

  console.log('Dynamic subsystem mapping created:', subsystemMapping);

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
    console.log('🔍 STARTING DEBUG VERSION - EQUIPMENT CATEGORIZATION');
    console.log(`Input: ${equipmentList?.length || 0} raw equipment items`);

    if (!Array.isArray(equipmentList) || equipmentList.length === 0) {
      throw new Error('Invalid equipment list provided');
    }

    const processedData = processEquipmentList(equipmentList);
    
    console.log('🔍 CORRECTED equipment categorization completed:', {
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
    const status = safeToString(item.commissioning_yn || '').toUpperCase();
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
    commissioning_yn: item.commissioning_yn,
    is_sub_equipment: item.is_sub_equipment,
    is_parent_equipment: item.is_parent_equipment,
    parent_equipment_number: item.parent_equipment_number || '',
    subsystem: item.subsystem
  }));
};

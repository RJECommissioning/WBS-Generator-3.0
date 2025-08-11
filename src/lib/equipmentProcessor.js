import { EQUIPMENT_PATTERNS, SUB_EQUIPMENT_PATTERNS, EQUIPMENT_CATEGORIES, COMMISSIONING_STATUS } from '../constants';
import { stringHelpers, patternHelpers, arrayHelpers } from '../utils';

/**
 * Equipment Processor - COMPREHENSIVELY FIXED
 * - CRITICAL FIX: Equipment codes being read as "-" instead of actual codes
 * - CRITICAL FIX: Self-referencing parent logic corrected
 * - CRITICAL FIX: Proper filtering to keep valid "-F01/X" style equipment
 * - Enhanced debugging to track data corruption
 * - Cross-validation with equipment code patterns
 */

// Helper function for safe string conversion
const safeToString = (value) => {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
};

// Safe equipment code cleaning with debugging
const safeCleanEquipmentCode = (value, context = '') => {
  const stringValue = safeToString(value);
  
  // Debug equipment code conversion
  if (context && (stringValue === '-' || stringValue === '')) {
    console.log(`🔍 Equipment code debug [${context}]: Original="${value}" → Cleaned="${stringValue}"`);
  }
  
  if (stringHelpers && stringHelpers.cleanEquipmentCode) {
    return stringHelpers.cleanEquipmentCode(stringValue);
  }
  return stringValue.trim().toUpperCase();
};

// CRITICAL HELPER: Determine if equipment is a parent (FIXED)
const isParentEquipment = (parentCode, equipmentNumber) => {
  const cleanParentCode = safeToString(parentCode).trim();
  const cleanEquipmentNumber = safeToString(equipmentNumber).trim();
  
  // No parent code or "-" = parent
  if (!cleanParentCode || cleanParentCode === '-' || cleanParentCode === '') {
    return true;
  }
  
  // CRITICAL FIX: Self-referencing = parent (T10 parent of T10 = T10 IS parent)
  if (cleanParentCode === cleanEquipmentNumber) {
    return true;
  }
  
  return false;
};

// ENHANCED: Cross-validate subsystem assignment (CORRECTED PATTERNS)
const validateSubsystemAssignment = (equipmentNumber, excelSubsystem) => {
  const cleanCode = safeToString(equipmentNumber).toUpperCase().trim();
  
  // CORRECTED: Equipment code subsystem patterns (for validation/edge cases)
  const codePatterns = {
    'Z01': /^(\+UH1\d+|\+WC1\d+|\+GB[2-3]\d+)/i,  // Switchroom 1
    'Z02': /^(\+UH2\d+|\+WC2\d+|\+GB[4-5]\d+)/i,  // Switchroom 2  
    'Z06': /^(\+UH13\d+)/i,                        // Auxiliary Power Unit
    'BESS': /^(FWT\d+|EG01-6000-\d+|\+WC\d+)/i,   // BESS BoP
    'Z03': /^(-Y\d+|-BR\d+|-BT\d+)/i              // Reactive Plant
  };
  
  // Check if equipment code suggests different subsystem (just log, don't change)
  for (const [locationCode, pattern] of Object.entries(codePatterns)) {
    if (pattern.test(cleanCode)) {
      const expectedInSubsystem = excelSubsystem?.includes(locationCode);
      if (!expectedInSubsystem && excelSubsystem) {
        console.log(`⚠️ Subsystem validation: ${cleanCode} pattern suggests ${locationCode} but Excel subsystem is "${excelSubsystem}"`);
      }
      break;
    }
  }
  
  return excelSubsystem; // Always trust Excel subsystem column
};

// Enhanced Pattern Matching Function - handles RegExp objects correctly
const testPatternMatch = (equipmentNumber, pattern) => {
  const safeEquipmentNumber = safeToString(equipmentNumber);
  
  if (!safeEquipmentNumber) {
    return false;
  }
  
  const cleanEquipmentNumber = safeEquipmentNumber.toUpperCase().trim();
  
  // CRITICAL FIX: Handle RegExp objects directly
  if (pattern instanceof RegExp) {
    return pattern.test(cleanEquipmentNumber);
  }
  
  // Handle string patterns (fallback)
  const safePattern = safeToString(pattern);
  if (!safePattern) {
    return false;
  }
  
  const cleanPattern = safePattern.toUpperCase().trim();
  
  // Direct prefix match (most common)
  if (cleanEquipmentNumber.startsWith(cleanPattern)) {
    return true;
  }
  
  // Pattern matching with wildcards
  if (cleanPattern.includes('X')) {
    const regexPattern = cleanPattern.replace(/X+/g, '\\d+').replace(/\+/g, '\\+');
    const regex = new RegExp(`^${regexPattern}`, 'i');
    return regex.test(cleanEquipmentNumber);
  }
  
  return false;
};

// Enhanced Equipment Categorization Function with type safety
const determineEquipmentCategory = (equipmentNumber) => {
  const safeEquipmentNumber = safeToString(equipmentNumber);
  
  if (!safeEquipmentNumber || safeEquipmentNumber.trim() === '') {
    return '99';
  }

  const cleanedNumber = safeEquipmentNumber.toUpperCase().trim();
  
  // Test against all equipment patterns
  for (const [categoryId, patterns] of Object.entries(EQUIPMENT_PATTERNS)) {
    for (const pattern of patterns) {
      const patternString = pattern.pattern || pattern;
      
      if (testPatternMatch(cleanedNumber, patternString)) {
        console.log(`Pattern match: ${cleanedNumber} matches ${patternString} → Category ${categoryId}`);
        return categoryId;
      }
    }
  }

  console.log(`No pattern match for: ${cleanedNumber}`);
  return '99'; // Unrecognized equipment
};

// Enhanced Equipment Processing with Comprehensive Filtering
const processEquipmentList = (rawEquipmentList) => {
  console.log('ENHANCED EQUIPMENT PROCESSING WITH COMPREHENSIVE DEBUGGING');
  console.log(`Input: ${rawEquipmentList.length} raw equipment items`);

  // Step 1: Separate TBC equipment FIRST
  console.log('STEP 1: TBC Equipment Separation');
  const tbcEquipment = rawEquipmentList.filter(item => {
    const status = safeToString(item.commissioning_yn || 'Y').toUpperCase().trim();
    return status === 'TBC';
  });

  const regularEquipment = rawEquipmentList.filter(item => {
    const status = safeToString(item.commissioning_yn || 'Y').toUpperCase().trim();
    return status === 'Y';
  });

  const excludedEquipment = rawEquipmentList.filter(item => {
    const status = safeToString(item.commissioning_yn || 'Y').toUpperCase().trim();
    return status === 'N';
  });

  console.log(`Equipment separation: ${regularEquipment.length} regular, ${tbcEquipment.length} TBC, ${excludedEquipment.length} excluded`);

  // Step 2: Extract subsystems from regular equipment
  console.log('STEP 2: Subsystem Extraction');
  const subsystemMapping = {};
  const subsystemNames = [...new Set(regularEquipment.map(item => item.subsystem).filter(Boolean))];
  
  subsystemNames.forEach((subsystem, index) => {
    const subsystemKey = `S${index + 1} | Z${String(index + 1).padStart(2, '0')}`;
    subsystemMapping[subsystem] = subsystemKey;
    console.log(`   Mapped: "${subsystem}" → ${subsystemKey}`);
  });

  console.log(`Found ${subsystemNames.length} subsystems:`, subsystemNames);

  // Step 3: DEBUG EQUIPMENT CODES BEFORE PROCESSING
  console.log('STEP 3: Equipment Code Analysis (First 10 items)');
  regularEquipment.slice(0, 10).forEach((item, index) => {
    const originalCode = item.equipment_number || item.equipment_code;
    const cleanedCode = safeCleanEquipmentCode(originalCode, `item-${index}`);
    console.log(`   ${index + 1}. Original: "${originalCode}" → Cleaned: "${cleanedCode}" | Parent: "${item.parent_equipment_code}"`);
  });

  // Step 4: Process regular equipment with CORRECTED filtering
  console.log('STEP 4: Regular Equipment Validation with CORRECTED Filtering');
  const cleanedEquipment = regularEquipment
    .map(item => ({
      ...item,
      equipment_number: safeCleanEquipmentCode(item.equipment_number || item.equipment_code || '', 'processing'),
      parent_equipment_code: item.parent_equipment_code 
        ? safeCleanEquipmentCode(item.parent_equipment_code, 'parent') 
        : null,
      subsystem_info: subsystemMapping[item.subsystem] || { code: 'S1', name: 'Main Subsystem' }
    }))
    .filter(item => {
      // CRITICAL FIX: Only filter out EMPTY or EXACTLY "-" equipment codes
      // Keep valid equipment like "-F01/X", "-FM11", "+UH104"
      const equipmentCode = item.equipment_number?.trim() || '';
      
      const isValidEquipment = equipmentCode !== '' && 
                              equipmentCode !== '-' && 
                              equipmentCode.length > 0;
      
      // Debug filtering decisions for first 20 items
      if (!isValidEquipment) {
        console.log(`🚫 FILTERED OUT: Equipment code="${equipmentCode}" (length: ${equipmentCode.length})`);
      }
      
      return isValidEquipment;
    });

  console.log(`After CORRECTED validation: ${cleanedEquipment.length} regular equipment items (was ${regularEquipment.length})`);
  console.log(`Equipment lost in filtering: ${regularEquipment.length - cleanedEquipment.length}`);

  // Step 5: Process TBC equipment with CORRECTED filtering
  console.log('STEP 5: TBC Equipment Processing with CORRECTED Filtering');
  const processedTBCEquipment = tbcEquipment
    .map((item, index) => {
      const cleanCode = safeCleanEquipmentCode(item.equipment_number || item.equipment_code || '', 'tbc');
      
      // CRITICAL FIX: Only filter out EMPTY or EXACTLY "-" equipment codes
      if (!cleanCode || cleanCode.trim() === '' || cleanCode.trim() === '-') {
        console.log(`🚫 TBC FILTERED OUT: Equipment code="${cleanCode}"`);
        return null;
      }
      
      return {
        ...item,
        equipment_number: cleanCode,
        description: safeToString(item.description || ''),
        commissioning_status: 'TBC',
        subsystem_info: subsystemMapping[item.subsystem] || { code: 'S1', name: 'Main Subsystem' },
        tbc_sequence: `TBC${(index + 1).toString().padStart(3, '0')}`
      };
    })
    .filter(item => item !== null);

  console.log(`Processed ${processedTBCEquipment.length} TBC equipment items (filtered out ${tbcEquipment.length - processedTBCEquipment.length} items with empty codes)`);

  // Step 6: Enhanced categorization with CORRECTED parent-child logic
  console.log('STEP 6: Enhanced Equipment Categorization with FIXED Parent-Child Logic');
  const categorizedEquipment = cleanedEquipment.map((item, index) => {
    const category = determineEquipmentCategory(item.equipment_number);
    const categoryInfo = EQUIPMENT_CATEGORIES[category] || 'Unrecognised Equipment';
    
    // CRITICAL FIX: Use updated isParentEquipment with self-referencing check
    const itemIsParent = isParentEquipment(item.parent_equipment_code, item.equipment_number);
    
    // ENHANCED: Cross-validate subsystem assignment with corrected patterns
    const validatedSubsystem = validateSubsystemAssignment(item.equipment_number, item.subsystem);
    
    const processedItem = {
      ...item,
      category: category,
      category_name: categoryInfo,
      // FIXED: Correct parent-child determination
      is_sub_equipment: !itemIsParent,
      parent_equipment: itemIsParent ? null : item.parent_equipment_code,
      level: itemIsParent ? 'parent' : 'child',
      commissioning_status: safeToString(item.commissioning_yn || 'Y').toUpperCase().trim(),
      description: safeToString(item.description || ''),
      plu_field: safeToString(item.plu_field || ''),
      subsystem: validatedSubsystem,
      processing_notes: []
    };

    // Add processing notes
    if (!itemIsParent) {
      processedItem.processing_notes.push(`Sub-equipment of ${item.parent_equipment_code}`);
    } else {
      processedItem.processing_notes.push('Parent equipment');
    }

    if (category === '99') {
      processedItem.processing_notes.push('No pattern match found - categorized as Unrecognised');
    }

    // Enhanced debugging for first 30 items
    if (index < 30) {
      const parentChildInfo = itemIsParent ? '[PARENT]' : `[CHILD of: ${item.parent_equipment_code}]`;
      console.log(`   ${index + 1}. "${item.equipment_number}" → Category: ${category} (${categoryInfo}) ${parentChildInfo}`);
    }

    return processedItem;
  });

  // Step 7: Build parent-child relationships
  console.log('STEP 7: Building Parent-Child Relationships');
  const equipmentMap = new Map();
  const parentChildRelationships = [];

  // Create equipment lookup map
  categorizedEquipment.forEach(item => {
    equipmentMap.set(item.equipment_number, item);
    
    // FIXED: Only add to relationships if it's actually a child (not parent or self-referencing)
    if (item.is_sub_equipment && item.parent_equipment) {
      parentChildRelationships.push({
        child: item.equipment_number,
        parent: item.parent_equipment,
        child_category: item.category,
        child_item: item
      });
    }
  });

  console.log(`Found ${parentChildRelationships.length} parent-child relationships:`);
  parentChildRelationships.slice(0, 10).forEach(rel => {
    const parentExists = equipmentMap.has(rel.parent);
    console.log(`   ${rel.child} → ${rel.parent} ${parentExists ? 'EXISTS' : 'MISSING'}`);
  });

  // Step 8: Generate category statistics with FIXED parent-child counting
  console.log('STEP 8: Category Statistics (All Standard Categories)');
  const categoryStats = {};
  
  // Initialize ALL standard categories (including empty ones)
  Object.entries(EQUIPMENT_CATEGORIES).forEach(([categoryId, categoryName]) => {
    categoryStats[categoryId] = {
      name: categoryName,
      count: 0,
      equipment: [],
      parent_equipment: [],
      child_equipment: []
    };
  });

  // Populate category statistics with CORRECTED logic
  categorizedEquipment.forEach(item => {
    const category = item.category || '99';
    if (categoryStats[category]) {
      categoryStats[category].count++;
      categoryStats[category].equipment.push(item);
      
      // FIXED: Use the corrected is_sub_equipment flag
      if (item.is_sub_equipment) {
        categoryStats[category].child_equipment.push(item);
      } else {
        categoryStats[category].parent_equipment.push(item);
      }
    }
  });

  console.log('Category Statistics Summary (All Categories Including Empty):');
  Object.entries(categoryStats).forEach(([categoryId, stats]) => {
    console.log(`   ${categoryId} | ${stats.name}: ${stats.count} items (${stats.parent_equipment.length} parents, ${stats.child_equipment.length} children)`);
  });

  // FIXED: Correct parent/child counting
  const parentItems = categorizedEquipment.filter(item => !item.is_sub_equipment).length;
  const childItems = categorizedEquipment.filter(item => item.is_sub_equipment).length;

  console.log(`CORRECTED COUNTS: ${parentItems} parents, ${childItems} children (Total: ${parentItems + childItems})`);

  // Step 9: Identify potential data corruption issues
  console.log('STEP 9: Data Quality Analysis');
  const emptyEquipmentCodes = categorizedEquipment.filter(item => !item.equipment_number || item.equipment_number.trim() === '');
  const dashEquipmentCodes = categorizedEquipment.filter(item => item.equipment_number === '-');
  const validEquipmentCodes = categorizedEquipment.filter(item => item.equipment_number && item.equipment_number.trim() !== '' && item.equipment_number.trim() !== '-');
  
  console.log(`Data quality: ${validEquipmentCodes.length} valid codes, ${emptyEquipmentCodes.length} empty codes, ${dashEquipmentCodes.length} dash codes`);

  if (emptyEquipmentCodes.length > 0) {
    console.log('⚠️ Found equipment with empty codes - data parsing issue?');
    emptyEquipmentCodes.slice(0, 5).forEach((item, index) => {
      console.log(`   Empty code ${index + 1}: Description="${item.description}"`);
    });
  }

  return {
    equipment: categorizedEquipment,
    tbcEquipment: processedTBCEquipment,
    subsystemMapping: subsystemMapping,
    original: rawEquipmentList.length,
    afterCommissioningFilter: regularEquipment.length + tbcEquipment.length,
    final: categorizedEquipment.length,
    tbcCount: processedTBCEquipment.length,
    parentItems: parentItems,
    childItems: childItems,
    categoryStats: categoryStats,
    parentChildRelationships: parentChildRelationships,
    // DEBUGGING DATA
    dataQuality: {
      validCodes: validEquipmentCodes.length,
      emptyCodes: emptyEquipmentCodes.length,
      dashCodes: dashEquipmentCodes.length,
      filteredOut: regularEquipment.length - categorizedEquipment.length
    }
  };
};

// Generate enhanced processing summary
const generateProcessingSummary = (processedData) => {
  return {
    processing_warnings: [],
    total_processed: processedData.final,
    categories_created: Object.keys(processedData.categoryStats).length,
    tbc_count: processedData.tbcCount,
    excluded_count: processedData.original - processedData.afterCommissioningFilter,
    data_quality: processedData.dataQuality
  };
};

// Main equipment categorization function - Enhanced with comprehensive filtering
export const categorizeEquipment = (equipmentList) => {
  try {
    console.log('STARTING COMPREHENSIVE EQUIPMENT CATEGORIZATION WITH DEBUGGING');
    console.log(`Input: ${equipmentList?.length || 0} raw equipment items`);

    if (!Array.isArray(equipmentList) || equipmentList.length === 0) {
      throw new Error('Invalid equipment list provided');
    }

    // Debug first few raw items
    console.log('RAW INPUT DEBUGGING (First 5 items):');
    equipmentList.slice(0, 5).forEach((item, index) => {
      const equipmentCode = item.equipment_number || item.equipment_code;
      const parentCode = item.parent_equipment_number || item.parent_equipment_code;
      console.log(`   Raw ${index + 1}: Equipment="${equipmentCode}" | Parent="${parentCode}" | Status="${item.commissioning_yn}"`);
    });

    // PHASE 1: Enhanced Equipment Processing with Proper Filtering
    const processedData = processEquipmentList(equipmentList);
    
    console.log('Equipment categorization completed:', {
      original: processedData.original,
      afterCommissioningFilter: processedData.afterCommissioningFilter,
      final: processedData.final,
      tbcCount: processedData.tbcCount,
      parentItems: processedData.parentItems,
      childItems: processedData.childItems,
      categories: Object.keys(processedData.categoryStats || {}).length,
      subsystems: Object.keys(processedData.subsystemMapping || {}).length,
      dataQuality: processedData.dataQuality
    });

    // Build enhanced grouped structure for compatibility
    const groupedByCategory = {};
    Object.entries(processedData.categoryStats || {}).forEach(([categoryId, stats]) => {
      groupedByCategory[categoryId] = stats.equipment;
    });

    // Generate enhanced processing summary
    const summary = generateProcessingSummary(processedData);

    return {
      // CRITICAL: Map to the exact field names StartNewProject.jsx expects
      totalProcessed: processedData.final,
      originalCount: processedData.original,
      afterCommissioningFilter: processedData.afterCommissioningFilter,
      finalCount: processedData.final,
      parentItems: processedData.parentItems || 0,
      childItems: processedData.childItems || 0,
      tbcCount: processedData.tbcCount || 0,
      categoryStats: processedData.categoryStats,
      
      // MOST CRITICAL: The actual categorized equipment data  
      categorizedEquipment: processedData.equipment,
      tbcEquipment: processedData.tbcEquipment,
      subsystemMapping: processedData.subsystemMapping,
      projectName: '5737 Summerfield Project',
      
      // Additional data
      parentChildRelationships: processedData.parentChildRelationships,
      dataQuality: processedData.dataQuality,
      
      // Keep your existing fields for backward compatibility
      equipment: processedData.equipment,
      grouped: groupedByCategory,
      summary: summary,
      totals: {
        original: processedData.original,
        final: processedData.final,
        afterCommissioningFilter: processedData.afterCommissioningFilter
      }
    };

  } catch (error) {
    console.error('Equipment categorization failed:', error);
    throw new Error(`Equipment categorization failed: ${error.message}`);
  }
};

// Filter equipment for WBS inclusion - Enhanced
export const filterEquipmentForWBS = (equipment) => {
  return equipment.filter(item => {
    const status = safeToString(item.commissioning_yn || 'Y').toUpperCase();
    return status === 'Y' || status === 'TBC';
  });
};

// Group equipment by subsystem - Enhanced
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

// Validate equipment categorization - Enhanced
export const validateCategorization = (equipment) => {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    statistics: {
      total_items: equipment.length,
      categorized: equipment.filter(item => item.category && item.category !== '99').length,
      unrecognised: equipment.filter(item => !item.category || item.category === '99').length,
      sub_equipment: equipment.filter(item => item.is_sub_equipment).length
    }
  };

  return validation;
};

// Export equipment for debugging - Enhanced
export const exportCategorizedEquipment = (equipment) => {
  return equipment.map(item => ({
    equipment_number: item.equipment_number,
    description: item.description,
    category: item.category,
    category_name: item.category_name,
    commissioning_status: item.commissioning_status,
    is_sub_equipment: item.is_sub_equipment,
    parent_equipment: item.parent_equipment || '',
    processing_notes: item.processing_notes ? item.processing_notes.join('; ') : ''
  }));
};

import { EQUIPMENT_PATTERNS, SUB_EQUIPMENT_PATTERNS, EQUIPMENT_CATEGORIES, COMMISSIONING_STATUS } from '../constants';
import { stringHelpers, patternHelpers, arrayHelpers } from '../utils';

/**
 * Equipment Processor - Enhanced with comprehensive fixes
 * - Proper commissioning status filtering (N status completely excluded)
 * - Enhanced parent-child relationship handling
 * - All standard categories created (even empty ones)
 * - Improved pattern matching and categorization
 * - FIXED: Type checking for string operations
 */

// Main equipment categorization function - Enhanced with comprehensive filtering
export const categorizeEquipment = (equipmentList) => {
  try {
    console.log('STARTING ENHANCED EQUIPMENT CATEGORIZATION');
    console.log(`Input: ${equipmentList?.length || 0} raw equipment items`);

    if (!Array.isArray(equipmentList) || equipmentList.length === 0) {
      throw new Error('Invalid equipment list provided');
    }

    // PHASE 1: Enhanced Equipment Processing with Proper Filtering
    const processedData = processEquipmentList(equipmentList);

    console.log('Equipment categorization completed:', {
      original: processedData.totals.original,
      afterCommissioningFilter: processedData.totals.afterCommissioningFilter,
      final: processedData.totals.final,
      parentItems: processedData.totals.parentItems,
      childItems: processedData.totals.childItems,
      categories: Object.keys(processedData.categoryStats).length
    });

    // Build enhanced grouped structure for compatibility
    const groupedByCategory = {};
    Object.entries(processedData.categoryStats).forEach(([categoryId, stats]) => {
      groupedByCategory[categoryId] = stats.equipment;
    });

    // Generate enhanced processing summary
    const summary = generateProcessingSummary(processedData);

    return {
      equipment: processedData.equipment,
      grouped: groupedByCategory,
      summary: summary,
      total_processed: processedData.totals.final,
      categoryStats: processedData.categoryStats,
      parentChildRelationships: processedData.parentChildRelationships,
      totals: processedData.totals
    };

  } catch (error) {
    console.error('Equipment categorization failed:', error);
    throw new Error(`Equipment categorization failed: ${error.message}`);
  }
};

// Enhanced Equipment Processing with Comprehensive Filtering
const processEquipmentList = (rawEquipmentList) => {
  console.log('ENHANCED EQUIPMENT PROCESSING');
  console.log(`Input: ${rawEquipmentList.length} raw equipment items`);

  // Step 1: Filter by commissioning status FIRST - CRITICAL FIX
  console.log('STEP 1: Commissioning Status Filtering');
  const filteredByCommissioning = rawEquipmentList.filter(item => {
    const status = safeToString(item.commissioning_yn || 'Y').toUpperCase().trim();
    const shouldInclude = status === 'Y' || status === 'TBC';
    
    if (!shouldInclude && status === 'N') {
      console.log(`Filtering out: ${safeToString(item.equipment_number || item.equipment_code || 'NO_CODE')} (Status: ${status})`);
    }
    
    return shouldInclude;
  });

  console.log(`After commissioning filter: ${filteredByCommissioning.length} items (filtered out ${rawEquipmentList.length - filteredByCommissioning.length} items with status N)`);

  // Step 2: Clean and validate equipment numbers
  console.log('STEP 2: Equipment Number Validation');
  const cleanedEquipment = filteredByCommissioning
    .map(item => ({
      ...item,
      equipment_number: safeCleanEquipmentCode(item.equipment_number || item.equipment_code || ''),
      parent_equipment_code: item.parent_equipment_code 
        ? safeCleanEquipmentCode(item.parent_equipment_code) 
        : null
    }))
    .filter(item => {
      const hasValidEquipmentNumber = item.equipment_number && item.equipment_number.trim() !== '';
      if (!hasValidEquipmentNumber) {
        console.log(`Filtering out item with invalid equipment number:`, item);
      }
      return hasValidEquipmentNumber;
    });

  console.log(`After validation: ${cleanedEquipment.length} items with valid equipment numbers`);

  // Step 3: Enhanced categorization with pattern matching
  console.log('STEP 3: Enhanced Equipment Categorization');
  const categorizedEquipment = cleanedEquipment.map((item, index) => {
    const category = determineEquipmentCategory(item.equipment_number);
    const categoryInfo = EQUIPMENT_CATEGORIES[category] || 'Unrecognised Equipment';
    
    const processedItem = {
      ...item,
      category: category,
      category_name: categoryInfo,
      is_sub_equipment: !!item.parent_equipment_code,
      parent_equipment: item.parent_equipment_code,
      level: item.parent_equipment_code ? 'child' : 'parent',
      commissioning_status: safeToString(item.commissioning_yn || 'Y').toUpperCase().trim(),
      description: safeToString(item.description || ''),
      plu_field: safeToString(item.plu_field || ''),
      processing_notes: [],
      debug_info: {
        original_index: index,
        pattern_matched: category !== '99',
        has_parent: !!item.parent_equipment_code,
        category_source: category
      }
    };

    // Add processing notes
    if (processedItem.is_sub_equipment) {
      processedItem.processing_notes.push(`Sub-equipment of ${item.parent_equipment_code}`);
    }
    
    if (processedItem.commissioning_status === 'TBC') {
      processedItem.processing_notes.push('To Be Confirmed - will be placed in TBC section');
    }

    if (category === '99') {
      processedItem.processing_notes.push('No pattern match found - categorized as Unrecognised');
    }

    if (index < 20) { // Log first 20 for debugging
      console.log(`   ${index + 1}. ${item.equipment_number} → Category: ${category} (${categoryInfo}) ${item.parent_equipment_code ? `[Child of: ${item.parent_equipment_code}]` : '[Parent]'}`);
    }

    return processedItem;
  });

  // Step 4: Build parent-child relationships
  console.log('STEP 4: Building Parent-Child Relationships');
  const equipmentMap = new Map();
  const parentChildRelationships = [];

  // Create equipment lookup map
  categorizedEquipment.forEach(item => {
    equipmentMap.set(item.equipment_number, item);
    
    if (item.parent_equipment_code) {
      parentChildRelationships.push({
        child: item.equipment_number,
        parent: item.parent_equipment_code,
        child_category: item.category,
        child_item: item
      });
    }
  });

  console.log(`Found ${parentChildRelationships.length} parent-child relationships:`);
  parentChildRelationships.slice(0, 10).forEach(rel => {
    const parentExists = equipmentMap.has(rel.parent);
    console.log(`   ${rel.child} → ${rel.parent} ${parentExists ? 'EXISTS' : 'MISSING (parent not found)'}`);
  });

  // Step 5: Generate category statistics - INCLUDES ALL STANDARD CATEGORIES
  console.log('STEP 5: Category Statistics (All Standard Categories)');
  const categoryStats = {};
  
  // Initialize ALL standard categories (including empty ones) - CRITICAL FIX
  Object.entries(EQUIPMENT_CATEGORIES).forEach(([categoryId, categoryName]) => {
    categoryStats[categoryId] = {
      name: categoryName,
      count: 0,
      equipment: [],
      parent_equipment: [],
      child_equipment: []
    };
  });

  // Populate category statistics
  categorizedEquipment.forEach(item => {
    const category = item.category || '99';
    if (categoryStats[category]) {
      categoryStats[category].count++;
      categoryStats[category].equipment.push(item);
      
      if (item.parent_equipment_code) {
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

  return {
    equipment: categorizedEquipment,
    categoryStats: categoryStats,
    parentChildRelationships: parentChildRelationships,
    equipmentMap: equipmentMap,
    totals: {
      original: rawEquipmentList.length,
      afterCommissioningFilter: filteredByCommissioning.length,
      afterValidation: cleanedEquipment.length,
      final: categorizedEquipment.length,
      parentItems: categorizedEquipment.filter(item => !item.parent_equipment_code).length,
      childItems: categorizedEquipment.filter(item => item.parent_equipment_code).length
    }
  };
};

// FIXED: Safe string conversion helper
const safeToString = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

// FIXED: Safe equipment code cleaning
const safeCleanEquipmentCode = (value) => {
  const stringValue = safeToString(value);
  if (stringHelpers && stringHelpers.cleanEquipmentCode) {
    return stringHelpers.cleanEquipmentCode(stringValue);
  }
  return stringValue.trim().toUpperCase();
};

// FIXED: Enhanced Equipment Categorization Function with type safety
const determineEquipmentCategory = (equipmentNumber) => {
  // CRITICAL FIX: Ensure equipmentNumber is a string
  const safeEquipmentNumber = safeToString(equipmentNumber);
  
  if (!safeEquipmentNumber || safeEquipmentNumber.trim() === '') {
    return '99';
  }

  const cleanedNumber = safeEquipmentNumber.toUpperCase().trim();
  
  // Test against all equipment patterns with enhanced matching
  for (const [categoryId, patterns] of Object.entries(EQUIPMENT_PATTERNS)) {
    for (const pattern of patterns) {
      const patternString = pattern.pattern || pattern;
      
      // Enhanced pattern matching
      if (testPatternMatch(cleanedNumber, patternString)) {
        console.log(`Pattern match: ${cleanedNumber} matches ${patternString} → Category ${categoryId}`);
        return categoryId;
      }
    }
  }

  console.log(`No pattern match for: ${cleanedNumber}`);
  return '99'; // Unrecognized equipment
};

// FIXED: Enhanced Pattern Matching Function with type safety
const testPatternMatch = (equipmentNumber, pattern) => {
  // CRITICAL FIX: Ensure both parameters are strings
  const safeEquipmentNumber = safeToString(equipmentNumber);
  const safePattern = safeToString(pattern);
  
  if (!safeEquipmentNumber || !safePattern) {
    return false;
  }
  
  const cleanPattern = safePattern.toUpperCase().trim();
  const cleanEquipmentNumber = safeEquipmentNumber.toUpperCase().trim();
  
  // Direct prefix match (most common)
  if (cleanEquipmentNumber.startsWith(cleanPattern)) {
    return true;
  }
  
  // Exact match
  if (cleanEquipmentNumber === cleanPattern) {
    return true;
  }
  
  // Pattern matching using existing pattern helpers - FIXED: Create RegExp for utils function
  if (patternHelpers && patternHelpers.matchesPattern) {
    // Convert string pattern to RegExp for the utils function
    try {
      let regexPattern = cleanPattern.replace(/X+/g, '\\d+').replace(/\+/g, '\\+');
      const regex = new RegExp(`^${regexPattern}import { EQUIPMENT_PATTERNS, SUB_EQUIPMENT_PATTERNS, EQUIPMENT_CATEGORIES, COMMISSIONING_STATUS } from '../constants';
import { stringHelpers, patternHelpers, arrayHelpers } from '../utils';

/**
 * Equipment Processor - Enhanced with comprehensive fixes
 * - Proper commissioning status filtering (N status completely excluded)
 * - Enhanced parent-child relationship handling
 * - All standard categories created (even empty ones)
 * - Improved pattern matching and categorization
 * - FIXED: Type checking for string operations
 */

// Main equipment categorization function - Enhanced with comprehensive filtering
export const categorizeEquipment = (equipmentList) => {
  try {
    console.log('🔍 STARTING ENHANCED EQUIPMENT CATEGORIZATION');
    console.log(`📊 Input: ${equipmentList?.length || 0} raw equipment items`);

    if (!Array.isArray(equipmentList) || equipmentList.length === 0) {
      throw new Error('Invalid equipment list provided');
    }

    // PHASE 1: Enhanced Equipment Processing with Proper Filtering
    const processedData = processEquipmentList(equipmentList);

    console.log('✅ Equipment categorization completed:', {
      original: processedData.totals.original,
      afterCommissioningFilter: processedData.totals.afterCommissioningFilter,
      final: processedData.totals.final,
      parentItems: processedData.totals.parentItems,
      childItems: processedData.totals.childItems,
      categories: Object.keys(processedData.categoryStats).length
    });

    // Build enhanced grouped structure for compatibility
    const groupedByCategory = {};
    Object.entries(processedData.categoryStats).forEach(([categoryId, stats]) => {
      groupedByCategory[categoryId] = stats.equipment;
    });

    // Generate enhanced processing summary
    const summary = generateProcessingSummary(processedData);

    return {
      equipment: processedData.equipment,
      grouped: groupedByCategory,
      summary: summary,
      total_processed: processedData.totals.final,
      categoryStats: processedData.categoryStats,
      parentChildRelationships: processedData.parentChildRelationships,
      totals: processedData.totals
    };

  } catch (error) {
    console.error('❌ Equipment categorization failed:', error);
    throw new Error(`Equipment categorization failed: ${error.message}`);
  }
};

// Enhanced Equipment Processing with Comprehensive Filtering
const processEquipmentList = (rawEquipmentList) => {
  console.log('🔍 ENHANCED EQUIPMENT PROCESSING');
  console.log(`📊 Input: ${rawEquipmentList.length} raw equipment items`);

  // Step 1: Filter by commissioning status FIRST - CRITICAL FIX
  console.log('⚡ STEP 1: Commissioning Status Filtering');
  const filteredByCommissioning = rawEquipmentList.filter(item => {
    const status = safeToString(item.commissioning_yn || 'Y').toUpperCase().trim();
    const shouldInclude = status === 'Y' || status === 'TBC';
    
    if (!shouldInclude && status === 'N') {
      console.log(`❌ Filtering out: ${safeToString(item.equipment_number || item.equipment_code || 'NO_CODE')} (Status: ${status})`);
    }
    
    return shouldInclude;
  });

  console.log(`📊 After commissioning filter: ${filteredByCommissioning.length} items (filtered out ${rawEquipmentList.length - filteredByCommissioning.length} items with status N)`);

  // Step 2: Clean and validate equipment numbers
  console.log('🧹 STEP 2: Equipment Number Validation');
  const cleanedEquipment = filteredByCommissioning
    .map(item => ({
      ...item,
      equipment_number: safeCleanEquipmentCode(item.equipment_number || item.equipment_code || ''),
      parent_equipment_code: item.parent_equipment_code 
        ? safeCleanEquipmentCode(item.parent_equipment_code) 
        : null
    }))
    .filter(item => {
      const hasValidEquipmentNumber = item.equipment_number && item.equipment_number.trim() !== '';
      if (!hasValidEquipmentNumber) {
        console.log(`⚠️ Filtering out item with invalid equipment number:`, item);
      }
      return hasValidEquipmentNumber;
    });

  console.log(`📊 After validation: ${cleanedEquipment.length} items with valid equipment numbers`);

  // Step 3: Enhanced categorization with pattern matching
  console.log('🏷️ STEP 3: Enhanced Equipment Categorization');
  const categorizedEquipment = cleanedEquipment.map((item, index) => {
    const category = determineEquipmentCategory(item.equipment_number);
    const categoryInfo = EQUIPMENT_CATEGORIES[category] || 'Unrecognised Equipment';
    
    const processedItem = {
      ...item,
      category: category,
      category_name: categoryInfo,
      is_sub_equipment: !!item.parent_equipment_code,
      parent_equipment: item.parent_equipment_code,
      level: item.parent_equipment_code ? 'child' : 'parent',
      commissioning_status: safeToString(item.commissioning_yn || 'Y').toUpperCase().trim(),
      description: safeToString(item.description || ''),
      plu_field: safeToString(item.plu_field || ''),
      processing_notes: [],
      debug_info: {
        original_index: index,
        pattern_matched: category !== '99',
        has_parent: !!item.parent_equipment_code,
        category_source: category
      }
    };

    // Add processing notes
    if (processedItem.is_sub_equipment) {
      processedItem.processing_notes.push(`Sub-equipment of ${item.parent_equipment_code}`);
    }
    
    if (processedItem.commissioning_status === 'TBC') {
      processedItem.processing_notes.push('To Be Confirmed - will be placed in TBC section');
    }

    if (category === '99') {
      processedItem.processing_notes.push('No pattern match found - categorized as Unrecognised');
    }

    if (index < 20) { // Log first 20 for debugging
      console.log(`   ${index + 1}. ${item.equipment_number} → Category: ${category} (${categoryInfo}) ${item.parent_equipment_code ? `[Child of: ${item.parent_equipment_code}]` : '[Parent]'}`);
    }

    return processedItem;
  });

  // Step 4: Build parent-child relationships
  console.log('👨‍👦 STEP 4: Building Parent-Child Relationships');
  const equipmentMap = new Map();
  const parentChildRelationships = [];

  // Create equipment lookup map
  categorizedEquipment.forEach(item => {
    equipmentMap.set(item.equipment_number, item);
    
    if (item.parent_equipment_code) {
      parentChildRelationships.push({
        child: item.equipment_number,
        parent: item.parent_equipment_code,
        child_category: item.category,
        child_item: item
      });
    }
  });

  console.log(`🔗 Found ${parentChildRelationships.length} parent-child relationships:`);
  parentChildRelationships.slice(0, 10).forEach(rel => {
    const parentExists = equipmentMap.has(rel.parent);
    console.log(`   ${rel.child} → ${rel.parent} ${parentExists ? '✅' : '❌ (parent not found)'}`);
  });

  // Step 5: Generate category statistics - INCLUDES ALL STANDARD CATEGORIES
  console.log('📊 STEP 5: Category Statistics (All Standard Categories)');
  const categoryStats = {};
  
  // Initialize ALL standard categories (including empty ones) - CRITICAL FIX
  Object.entries(EQUIPMENT_CATEGORIES).forEach(([categoryId, categoryName]) => {
    categoryStats[categoryId] = {
      name: categoryName,
      count: 0,
      equipment: [],
      parent_equipment: [],
      child_equipment: []
    };
  });

  // Populate category statistics
  categorizedEquipment.forEach(item => {
    const category = item.category || '99';
    if (categoryStats[category]) {
      categoryStats[category].count++;
      categoryStats[category].equipment.push(item);
      
      if (item.parent_equipment_code) {
        categoryStats[category].child_equipment.push(item);
      } else {
        categoryStats[category].parent_equipment.push(item);
      }
    }
  });

  console.log('📈 Category Statistics Summary (All Categories Including Empty):');
  Object.entries(categoryStats).forEach(([categoryId, stats]) => {
    console.log(`   ${categoryId} | ${stats.name}: ${stats.count} items (${stats.parent_equipment.length} parents, ${stats.child_equipment.length} children)`);
  });

  return {
    equipment: categorizedEquipment,
    categoryStats: categoryStats,
    parentChildRelationships: parentChildRelationships,
    equipmentMap: equipmentMap,
    totals: {
      original: rawEquipmentList.length,
      afterCommissioningFilter: filteredByCommissioning.length,
      afterValidation: cleanedEquipment.length,
      final: categorizedEquipment.length,
      parentItems: categorizedEquipment.filter(item => !item.parent_equipment_code).length,
      childItems: categorizedEquipment.filter(item => item.parent_equipment_code).length
    }
  };
};

// FIXED: Safe string conversion helper
const safeToString = (value) => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

// FIXED: Safe equipment code cleaning
const safeCleanEquipmentCode = (value) => {
  const stringValue = safeToString(value);
  if (stringHelpers && stringHelpers.cleanEquipmentCode) {
    return stringHelpers.cleanEquipmentCode(stringValue);
  }
  return stringValue.trim().toUpperCase();
};

// FIXED: Enhanced Equipment Categorization Function with type safety
const determineEquipmentCategory = (equipmentNumber) => {
  // CRITICAL FIX: Ensure equipmentNumber is a string
  const safeEquipmentNumber = safeToString(equipmentNumber);
  
  if (!safeEquipmentNumber || safeEquipmentNumber.trim() === '') {
    return '99';
  }

  const cleanedNumber = safeEquipmentNumber.toUpperCase().trim();
  
  // Test against all equipment patterns with enhanced matching
  for (const [categoryId, patterns] of Object.entries(EQUIPMENT_PATTERNS)) {
    for (const pattern of patterns) {
      const patternString = pattern.pattern || pattern;
      
      // Enhanced pattern matching
      if (testPatternMatch(cleanedNumber, patternString)) {
        console.log(`🎯 Pattern match: ${cleanedNumber} matches ${patternString} → Category ${categoryId}`);
        return categoryId;
      }
    }
  }

  console.log(`❌ No pattern match for: ${cleanedNumber}`);
  return '99'; // Unrecognized equipment
};

, 'i');
      return patternHelpers.matchesPattern(cleanEquipmentNumber, regex);
    } catch (error) {
      console.warn(`Pattern matching error for ${cleanPattern}:`, error);
    }
  }
  
  // Fallback pattern matching
  if (cleanPattern.includes('X')) {
    const regexPattern = cleanPattern.replace(/X+/g, '\\d+').replace(/\+/g, '\\+');
    const regex = new RegExp(`^${regexPattern}`, 'i');
    return regex.test(cleanEquipmentNumber);
  }
  
  return false;
};

// Process individual equipment item - Enhanced version
const processEquipmentItem = (item) => {
  try {
    // Clean and normalize equipment code with type safety
    const cleanCode = safeCleanEquipmentCode(item.equipment_number || item.equipment_code);
    const description = safeToString(item.description || '');
    const pluField = safeToString(item.plu_field || '');
    
    // Get parent equipment code from the actual column (KEY FIX!)
    const parentEquipmentCode = item.parent_equipment_code || item.parent_equipment || null;
    const cleanParentCode = parentEquipmentCode ? safeCleanEquipmentCode(parentEquipmentCode) : null;
    
    // Check commissioning status
    let commissioningStatus = safeToString(item.commissioning_yn || 'Y').toUpperCase();
    if (!['Y', 'N', 'TBC'].includes(commissioningStatus)) {
      commissioningStatus = 'Y'; // Default to Yes if invalid
    }

    // Skip items marked as 'N' (No commissioning) - CRITICAL FIX
    if (commissioningStatus === 'N') {
      return null; // Return null to filter out completely
    }

    // Determine if this is sub-equipment based on parent column (not pattern matching!)
    const isSubEquipment = !!cleanParentCode;
    const subEquipmentType = isSubEquipment ? patternHelpers.getSubEquipmentType(cleanCode) : null;

    // Primary categorization - use the equipment code itself for pattern matching
    let category = null;
    let categoryName = '';
    let matchedPattern = null;

    // Try to match against main equipment patterns
    for (const [categoryCode, patterns] of Object.entries(EQUIPMENT_PATTERNS)) {
      const matchingPattern = patterns.find(pattern => 
        patternHelpers.matchesPattern(cleanCode, pattern.pattern || pattern)
      );

      if (matchingPattern) {
        category = categoryCode;
        categoryName = EQUIPMENT_CATEGORIES[categoryCode];
        matchedPattern = matchingPattern;
        break;
      }
    }

    // If no direct match and this is sub-equipment, try to match parent's pattern
    if (!category && isSubEquipment && cleanParentCode) {
      for (const [categoryCode, patterns] of Object.entries(EQUIPMENT_PATTERNS)) {
        const matchingPattern = patterns.find(pattern => 
          patternHelpers.matchesPattern(cleanParentCode, pattern.pattern || pattern)
        );

        if (matchingPattern) {
          category = categoryCode;
          categoryName = EQUIPMENT_CATEGORIES[categoryCode];
          matchedPattern = matchingPattern;
          break;
        }
      }
    }

    // Try PLU field if no match found
    if (!category && pluField) {
      const cleanPLU = safeCleanEquipmentCode(pluField);
      for (const [categoryCode, patterns] of Object.entries(EQUIPMENT_PATTERNS)) {
        const matchingPattern = patterns.find(pattern => 
          patternHelpers.matchesPattern(cleanPLU, pattern.pattern || pattern)
        );

        if (matchingPattern) {
          category = categoryCode;
          categoryName = EQUIPMENT_CATEGORIES[categoryCode];
          matchedPattern = matchingPattern;
          break;
        }
      }
    }

    // Handle special cases and preparations
    if (!category) {
      category = handleSpecialCases(cleanCode, description);
      categoryName = EQUIPMENT_CATEGORIES[category] || 'Unrecognised Equipment';
    }

    // Build processed item
    const processedItem = {
      ...item,
      equipment_number: cleanCode,
      description: description,
      plu_field: pluField,
      commissioning_status: commissioningStatus,
      category: category,
      category_name: categoryName,
      is_sub_equipment: isSubEquipment,
      sub_equipment_type: subEquipmentType,
      parent_equipment: cleanParentCode, // Use actual parent from column
      matched_pattern: matchedPattern ? (matchedPattern.name || matchedPattern.pattern) : null,
      processing_notes: []
    };

    // Add processing notes
    if (isSubEquipment) {
      processedItem.processing_notes.push(`Sub-equipment of ${cleanParentCode}`);
    }
    
    if (commissioningStatus === 'TBC') {
      processedItem.processing_notes.push('To Be Confirmed - will be placed in TBC section');
    }

    if (!matchedPattern) {
      processedItem.processing_notes.push('No pattern match found - categorized as Unrecognised');
    }

    return processedItem;

  } catch (error) {
    return {
      ...item,
      equipment_number: safeCleanEquipmentCode(item.equipment_number || item.equipment_code || ''),
      category: '99',
      category_name: 'Unrecognised Equipment',
      is_sub_equipment: false,
      parent_equipment: null,
      processing_notes: [`Error processing: ${error.message}`]
    };
  }
};

// Handle special cases (Test bay, Panel Shop, Pad, etc.)
const handleSpecialCases = (equipmentCode, description) => {
  const lowerDesc = safeToString(description).toLowerCase();
  const lowerCode = safeToString(equipmentCode).toLowerCase();

  // Preparations and set-up (01)
  if (lowerDesc.includes('test bay') || lowerCode.includes('testbay') ||
      lowerDesc.includes('panel shop') || lowerCode.includes('panelshop') ||
      lowerDesc.includes('pad') || lowerCode === 'pad') {
    return '01';
  }

  // Interface Testing (09)
  if (lowerDesc.includes('phase 1') || lowerDesc.includes('phase 2') ||
      lowerDesc.includes('interface') || lowerDesc.includes('testing')) {
    return '09';
  }

  // Building Services (08) - catch common patterns not in main rules
  if (lowerDesc.includes('fire') || lowerDesc.includes('security') ||
      lowerDesc.includes('hvac') || lowerDesc.includes('lighting') ||
      lowerDesc.includes('building')) {
    return '08';
  }

  // Default to unrecognised
  return '99';
};

// Build parent-child relationships for sub-equipment - Enhanced
const buildEquipmentRelationships = (equipmentList) => {
  // Create lookup map for parent equipment
  const equipmentMap = {};
  equipmentList.forEach(item => {
    equipmentMap[item.equipment_number] = item;
  });

  // Process sub-equipment and link to parents
  return equipmentList.map(item => {
    if (item.is_sub_equipment && item.parent_equipment) {
      const parent = equipmentMap[item.parent_equipment];
      if (parent) {
        // Inherit category from parent if not already categorized
        if (!item.category || item.category === '99') {
          item.category = parent.category;
          item.category_name = parent.category_name;
          item.processing_notes.push(`Inherited category from parent ${parent.equipment_number}`);
        }
        
        // Validate parent-child relationship
        if (item.category !== parent.category) {
          item.processing_notes.push(`Warning: Category mismatch with parent`);
        }
      } else {
        item.processing_notes.push(`Warning: Parent equipment ${item.parent_equipment} not found`);
      }
    }
    return item;
  });
};

// Generate enhanced processing summary
const generateProcessingSummary = (processedData) => {
  const summary = {
    total_equipment: processedData.totals.final,
    by_category: {},
    by_commissioning_status: {},
    sub_equipment_count: processedData.totals.childItems,
    parent_equipment_count: processedData.totals.parentItems,
    unrecognised_count: 0,
    tbc_count: 0,
    excluded_count: processedData.totals.original - processedData.totals.afterCommissioningFilter,
    processing_warnings: [],
    totals: processedData.totals
  };

  // Process category statistics
  Object.entries(processedData.categoryStats).forEach(([categoryId, stats]) => {
    summary.by_category[categoryId] = {
      count: stats.count,
      category_name: stats.name,
      items: stats.equipment.map(item => item.equipment_number)
    };

    if (categoryId === '99') {
      summary.unrecognised_count = stats.count;
    }
  });

  // Process commissioning status
  processedData.equipment.forEach(item => {
    const status = item.commissioning_status || 'Unknown';
    summary.by_commissioning_status[status] = (summary.by_commissioning_status[status] || 0) + 1;

    if (item.commissioning_status === 'TBC') {
      summary.tbc_count++;
    }

    // Collect warnings
    if (item.processing_notes && item.processing_notes.length > 0) {
      const warnings = item.processing_notes.filter(note => 
        note.includes('Warning') || note.includes('Error')
      );
      if (warnings.length > 0) {
        summary.processing_warnings.push({
          equipment: item.equipment_number,
          warnings: warnings
        });
      }
    }
  });

  return summary;
};

// Filter equipment for WBS inclusion - Enhanced
export const filterEquipmentForWBS = (equipment) => {
  // Include only equipment with commissioning status Y or TBC
  // Exclude equipment marked as N (this should already be filtered out)
  return equipment.filter(item => {
    const status = safeToString(item.commissioning_yn || 'Y').toUpperCase();
    return status === 'Y' || status === 'TBC';
  });
};

// Group equipment by subsystem - Enhanced
export const groupEquipmentBySubsystem = (equipment) => {
  // Extract subsystem information from equipment codes or descriptions
  const subsystemGroups = arrayHelpers.groupBy(equipment, item => {
    // Look for subsystem patterns (Z01, Z02, etc.)
    const description = safeToString(item.description);
    const equipmentNumber = safeToString(item.equipment_number);
    
    const subsystemMatch = description.match(/Z(\d{2})/i) || 
                          equipmentNumber.match(/Z(\d{2})/i);
    
    if (subsystemMatch) {
      return `Z${subsystemMatch[1]}`;
    }
    
    return 'S1'; // Default subsystem
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
      categorized: 0,
      unrecognised: 0,
      sub_equipment: 0,
      orphaned_sub_equipment: 0
    }
  };

  // Create parent lookup for validation
  const parentEquipment = new Set(
    equipment.filter(item => !item.is_sub_equipment)
             .map(item => item.equipment_number)
  );

  equipment.forEach((item, index) => {
    // Count statistics
    if (item.category && item.category !== '99') {
      validation.statistics.categorized++;
    } else {
      validation.statistics.unrecognised++;
    }

    if (item.is_sub_equipment) {
      validation.statistics.sub_equipment++;
      
      // Check for orphaned sub-equipment
      if (item.parent_equipment && !parentEquipment.has(item.parent_equipment)) {
        validation.statistics.orphaned_sub_equipment++;
        validation.warnings.push(
          `Row ${index + 1}: Sub-equipment ${item.equipment_number} references missing parent ${item.parent_equipment}`
        );
      }
    }

    // Validate required fields
    if (!item.equipment_number || item.equipment_number.trim() === '') {
      validation.errors.push(`Row ${index + 1}: Missing equipment number`);
      validation.isValid = false;
    }

    // Validate commissioning status
    if (item.commissioning_yn && 
        !['Y', 'N', 'TBC'].includes(item.commissioning_yn.toUpperCase())) {
      validation.warnings.push(
        `Row ${index + 1}: Invalid commissioning status "${item.commissioning_yn}" for ${item.equipment_number}`
      );
    }
  });

  // Overall validation
  if (validation.statistics.unrecognised > validation.statistics.total_items * 0.5) {
    validation.warnings.push(
      `High number of unrecognised equipment (${validation.statistics.unrecognised}/${validation.statistics.total_items}). Please review equipment patterns.`
    );
  }

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
    matched_pattern: item.matched_pattern || '',
    processing_notes: item.processing_notes ? item.processing_notes.join('; ') : ''
  }));
};

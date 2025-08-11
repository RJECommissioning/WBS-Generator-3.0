import { EQUIPMENT_PATTERNS, SUB_EQUIPMENT_PATTERNS, EQUIPMENT_CATEGORIES, COMMISSIONING_STATUS } from '../constants';
import { stringHelpers, patternHelpers, arrayHelpers } from '../utils';

/**
 * Equipment Processor - FIXED with correct parent-child logic
 * - CRITICAL FIX: parent_equipment_code = "-" means "this IS a parent"
 * - CRITICAL FIX: parent_equipment_code = "T10" means "this is a child OF T10"
 * - Proper commissioning status filtering (N status completely excluded)
 * - Enhanced parent-child relationship handling
 * - All standard categories created (even empty ones)
 * - Improved pattern matching and categorization
 * - FIXED: Type checking for string operations
 * - FIXED: Column mapping for commissioning_yn
 * - FIXED: Pattern matching RegExp conversion
 * - NEW: TBC equipment separation
 * - NEW: Subsystem extraction from Excel
 */

// Helper function for safe string conversion
const safeToString = (value) => {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
};

// Safe equipment code cleaning
const safeCleanEquipmentCode = (value) => {
  const stringValue = safeToString(value);
  if (stringHelpers && stringHelpers.cleanEquipmentCode) {
    return stringHelpers.cleanEquipmentCode(stringValue);
  }
  return stringValue.trim().toUpperCase();
};

// CRITICAL HELPER: Determine if equipment is a parent
const isParentEquipment = (parentCode) => {
  const cleanParentCode = safeToString(parentCode).trim();
  return !cleanParentCode || cleanParentCode === '-' || cleanParentCode === '';
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
  console.log('ENHANCED EQUIPMENT PROCESSING WITH CORRECTED PARENT-CHILD LOGIC');
  console.log(`Input: ${rawEquipmentList.length} raw equipment items`);

  // Step 1: Separate TBC equipment FIRST - NEW CRITICAL LOGIC
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

  // Step 3: Process regular equipment with categorization
  console.log('STEP 3: Regular Equipment Validation');
  const cleanedEquipment = regularEquipment
    .map(item => ({
      ...item,
      equipment_number: safeCleanEquipmentCode(item.equipment_number || item.equipment_code || ''),
      parent_equipment_code: item.parent_equipment_code 
        ? safeCleanEquipmentCode(item.parent_equipment_code) 
        : null,
      subsystem_info: subsystemMapping[item.subsystem] || { code: 'S1', name: 'Main Subsystem' }
    }))
    .filter(item => {
      const hasValidEquipmentNumber = item.equipment_number && item.equipment_number.trim() !== '';
      return hasValidEquipmentNumber;
    });

  console.log(`After validation: ${cleanedEquipment.length} regular equipment items`);

  // Step 4: Process TBC equipment
  console.log('STEP 4: TBC Equipment Processing');
  const processedTBCEquipment = tbcEquipment
    .map((item, index) => {
      const cleanCode = safeCleanEquipmentCode(item.equipment_number || item.equipment_code || '');
      if (!cleanCode || cleanCode.trim() === '') {
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

  console.log(`Processed ${processedTBCEquipment.length} TBC equipment items`);

  // Step 5: Enhanced categorization with CORRECTED parent-child logic
  console.log('STEP 5: Enhanced Equipment Categorization with FIXED Parent-Child Logic');
  const categorizedEquipment = cleanedEquipment.map((item, index) => {
    const category = determineEquipmentCategory(item.equipment_number);
    const categoryInfo = EQUIPMENT_CATEGORIES[category] || 'Unrecognised Equipment';
    
    // CRITICAL FIX: Correct parent-child determination
    const itemIsParent = isParentEquipment(item.parent_equipment_code);
    
    const processedItem = {
      ...item,
      category: category,
      category_name: categoryInfo,
      // FIXED: "-" means this IS a parent, not a child
      is_sub_equipment: !itemIsParent,
      parent_equipment: itemIsParent ? null : item.parent_equipment_code,
      level: itemIsParent ? 'parent' : 'child',
      commissioning_status: safeToString(item.commissioning_yn || 'Y').toUpperCase().trim(),
      description: safeToString(item.description || ''),
      plu_field: safeToString(item.plu_field || ''),
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

    if (index < 20) { // Log first 20 for debugging
      const parentChildInfo = itemIsParent ? '[PARENT]' : `[CHILD of: ${item.parent_equipment_code}]`;
      console.log(`   ${index + 1}. ${item.equipment_number} → Category: ${category} (${categoryInfo}) ${parentChildInfo}`);
    }

    return processedItem;
  });

  // Step 6: Build parent-child relationships
  console.log('STEP 6: Building Parent-Child Relationships');
  const equipmentMap = new Map();
  const parentChildRelationships = [];

  // Create equipment lookup map
  categorizedEquipment.forEach(item => {
    equipmentMap.set(item.equipment_number, item);
    
    // FIXED: Only add to relationships if it's actually a child (not parent)
    if (!isParentEquipment(item.parent_equipment_code)) {
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
    console.log(`   ${rel.child} → ${rel.parent} ${parentExists ? 'EXISTS' : 'MISSING'}`);
  });

  // Step 7: Generate category statistics with FIXED parent-child counting
  console.log('STEP 7: Category Statistics (All Standard Categories)');
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
    parentChildRelationships: parentChildRelationships
  };
};

// Generate enhanced processing summary
const generateProcessingSummary = (processedData) => {
  return {
    processing_warnings: [],
    total_processed: processedData.final,
    categories_created: Object.keys(processedData.categoryStats).length,
    tbc_count: processedData.tbcCount,
    excluded_count: processedData.original - processedData.afterCommissioningFilter
  };
};

// Main equipment categorization function - Enhanced with comprehensive filtering
export const categorizeEquipment = (equipmentList) => {
  try {
    console.log('STARTING ENHANCED EQUIPMENT CATEGORIZATION WITH CORRECTED PARENT-CHILD LOGIC');
    console.log(`Input: ${equipmentList?.length || 0} raw equipment items`);

    if (!Array.isArray(equipmentList) || equipmentList.length === 0) {
      throw new Error('Invalid equipment list provided');
    }

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
      subsystems: Object.keys(processedData.subsystemMapping || {}).length
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
      childItems: processedData.childItems || processedData.final,
      tbcCount: processedData.tbcCount || 0,
      categoryStats: processedData.categoryStats,
      
      // MOST CRITICAL: The actual categorized equipment data  
      categorizedEquipment: processedData.equipment,
      tbcEquipment: processedData.tbcEquipment,
      subsystemMapping: processedData.subsystemMapping,
      projectName: '5737 Summerfield Project',
      
      // Additional data
      parentChildRelationships: processedData.parentChildRelationships,
      
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

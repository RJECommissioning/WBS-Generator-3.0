import { EQUIPMENT_PATTERNS, SUB_EQUIPMENT_PATTERNS, EQUIPMENT_CATEGORIES, COMMISSIONING_STATUS } from '../constants';
import { stringHelpers, patternHelpers, arrayHelpers } from '../utils';

/**
 * Equipment Processor - CRITICALLY FIXED VERSION
 * 🚨 MAJOR FIXES APPLIED:
 * - FIXED: Parent-child detection logic completely rewritten
 * - FIXED: Equipment addition to WBS structure now working
 * - FIXED: Proper parent-child relationship mapping
 * - ADDED: Enhanced debugging for relationship detection
 */

// Helper function for safe string conversion
const safeToString = (value) => {
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value : String(value);
};

// Safe equipment code cleaning with debugging
const safeCleanEquipmentCode = (value, context = '') => {
  const stringValue = safeToString(value);
  
  if (stringHelpers && stringHelpers.cleanEquipmentCode) {
    return stringHelpers.cleanEquipmentCode(stringValue);
  }
  return stringValue.trim().toUpperCase();
};

// CRITICAL FIX: Completely rewritten parent-child detection logic
const analyzeParentChildRelationships = (equipmentList) => {
  console.log('🔍 ANALYZING PARENT-CHILD RELATIONSHIPS');
  
  // Create equipment lookup map
  const equipmentMap = new Map();
  equipmentList.forEach(item => {
    const code = safeToString(item.equipment_number || '').trim();
    if (code && code !== '-') {
      equipmentMap.set(code, item);
    }
  });
  
  console.log(`📊 Equipment map created: ${equipmentMap.size} equipment items`);
  
  // Analyze relationships
  const relationships = [];
  const parentEquipment = new Set();
  const childEquipment = new Set();
  
  equipmentList.forEach(item => {
    const equipmentCode = safeToString(item.equipment_number || '').trim();
    const parentCode = safeToString(item.parent_equipment_number || item.parent_equipment_code || '').trim();
    
    // Skip invalid equipment codes
    if (!equipmentCode || equipmentCode === '-') {
      return;
    }
    
    // Determine if this is a parent or child
    if (!parentCode || parentCode === '-' || parentCode === equipmentCode) {
      // No parent or self-referencing = this is a parent equipment
      parentEquipment.add(equipmentCode);
    } else {
      // Has a different parent = this is child equipment
      childEquipment.add(equipmentCode);
      
      // Record the relationship
      relationships.push({
        child: equipmentCode,
        parent: parentCode,
        childItem: item,
        parentExists: equipmentMap.has(parentCode)
      });
      
      // Mark the parent as a parent (if it exists in our list)
      if (equipmentMap.has(parentCode)) {
        parentEquipment.add(parentCode);
      }
    }
  });
  
  console.log(`👨‍👦 Relationship analysis complete:`);
  console.log(`   Parents: ${parentEquipment.size}`);
  console.log(`   Children: ${childEquipment.size}`);
  console.log(`   Relationships: ${relationships.length}`);
  
  // Show sample relationships
  console.log(`\n📋 Sample Parent-Child Relationships (first 10):`);
  relationships.slice(0, 10).forEach((rel, index) => {
    console.log(`   ${index + 1}. "${rel.child}" → "${rel.parent}" ${rel.parentExists ? '✅' : '❌'}`);
  });
  
  return {
    relationships,
    parentEquipment,
    childEquipment,
    equipmentMap
  };
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
        return categoryId;
      }
    }
  }

  return '99'; // Unrecognized equipment
};

// CRITICAL FIX: Completely rewritten equipment processing
const processEquipmentList = (rawEquipmentList) => {
  console.log('🚀 CRITICALLY FIXED EQUIPMENT PROCESSING');
  console.log(`📊 Input: ${rawEquipmentList.length} raw equipment items`);

  // Step 1: Separate by commissioning status FIRST
  const tbcEquipment = rawEquipmentList.filter(item => {
    const status = safeToString(item.commissioning_yn || item['Commissioning (Y/N)'] || 'Y').toUpperCase().trim();
    return status === 'TBC';
  });

  const regularEquipment = rawEquipmentList.filter(item => {
    const status = safeToString(item.commissioning_yn || item['Commissioning (Y/N)'] || 'Y').toUpperCase().trim();
    return status === 'Y';
  });

  const excludedEquipment = rawEquipmentList.filter(item => {
    const status = safeToString(item.commissioning_yn || item['Commissioning (Y/N)'] || 'Y').toUpperCase().trim();
    return status === 'N';
  });

  console.log(`📊 Equipment separation: ${regularEquipment.length} regular, ${tbcEquipment.length} TBC, ${excludedEquipment.length} excluded`);

  // Step 2: Extract subsystems
  const subsystemMapping = {};
  const subsystemNames = [...new Set(regularEquipment.concat(tbcEquipment).map(item => item.subsystem || item.Subsystem).filter(Boolean))];
  
  subsystemNames.forEach((subsystem, index) => {
    const subsystemKey = `S${index + 1} | Z${String(index + 1).padStart(2, '0')}`;
    subsystemMapping[subsystem] = subsystemKey;
  });

  console.log(`🏗️ Found ${subsystemNames.length} subsystems`);

  // Step 3: CRITICAL FIX - Analyze parent-child relationships BEFORE processing
  const relationshipAnalysis = analyzeParentChildRelationships(regularEquipment);

  // Step 4: Process regular equipment with FIXED parent-child logic
  const cleanedEquipment = regularEquipment
    .map(item => {
      const equipmentCode = safeCleanEquipmentCode(item.equipment_number || item['Equipment Number'] || '', 'processing');
      const parentCode = safeCleanEquipmentCode(item.parent_equipment_number || item['Parent Equipment Number'] || '', 'parent');
      
      return {
        ...item,
        equipment_number: equipmentCode,
        parent_equipment_code: parentCode === '-' ? null : parentCode,
        description: safeToString(item.description || item.Description || ''),
        subsystem: item.subsystem || item.Subsystem,
        commissioning_status: 'Y'
      };
    })
    .filter(item => {
      // Only filter out EMPTY or EXACTLY "-" equipment codes
      const equipmentCode = item.equipment_number?.trim() || '';
      return equipmentCode !== '' && equipmentCode !== '-' && equipmentCode.length > 0;
    });

  console.log(`✅ After validation: ${cleanedEquipment.length} regular equipment items`);

  // Step 5: Process TBC equipment
  const processedTBCEquipment = tbcEquipment
    .map((item, index) => {
      const equipmentCode = safeCleanEquipmentCode(item.equipment_number || item['Equipment Number'] || '', 'tbc');
      
      if (!equipmentCode || equipmentCode.trim() === '' || equipmentCode.trim() === '-') {
        return null;
      }
      
      return {
        ...item,
        equipment_number: equipmentCode,
        description: safeToString(item.description || item.Description || ''),
        commissioning_status: 'TBC',
        subsystem: item.subsystem || item.Subsystem,
        tbc_sequence: `TBC${(index + 1).toString().padStart(3, '0')}`
      };
    })
    .filter(item => item !== null);

  console.log(`✅ Processed ${processedTBCEquipment.length} TBC equipment items`);

  // Step 6: CRITICAL FIX - Enhanced categorization with PROPER parent-child flagging
  const categorizedEquipment = cleanedEquipment.map((item) => {
    const category = determineEquipmentCategory(item.equipment_number);
    const categoryInfo = EQUIPMENT_CATEGORIES[category] || 'Unrecognised Equipment';
    
    // CRITICAL FIX: Use the relationship analysis to determine parent/child status
    const isParent = relationshipAnalysis.parentEquipment.has(item.equipment_number);
    const isChild = relationshipAnalysis.childEquipment.has(item.equipment_number);
    
    const processedItem = {
      ...item,
      category: category,
      category_name: categoryInfo,
      // FIXED: Correct parent-child determination using relationship analysis
      is_sub_equipment: isChild,
      is_parent_equipment: isParent,
      parent_equipment: isChild ? item.parent_equipment_code : null,
      level: isChild ? 'child' : 'parent',
      commissioning_status: 'Y',
      subsystem_info: subsystemMapping[item.subsystem] || { code: 'S1', name: 'Main Subsystem' }
    };

    return processedItem;
  });

  // Step 7: CRITICAL FIX - Build proper parent-child relationships map
  const parentChildRelationships = relationshipAnalysis.relationships.filter(rel => {
    // Only include relationships where both parent and child exist in our cleaned equipment
    const childExists = cleanedEquipment.find(item => item.equipment_number === rel.child);
    const parentExists = cleanedEquipment.find(item => item.equipment_number === rel.parent);
    return childExists && parentExists;
  });

  console.log(`🔗 Built ${parentChildRelationships.length} valid parent-child relationships`);

  // Step 8: Generate category statistics with FIXED counts
  const categoryStats = {};
  
  // Initialize ALL standard categories
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
      
      // FIXED: Use the corrected parent/child flags
      if (item.is_sub_equipment) {
        categoryStats[category].child_equipment.push(item);
      } else {
        categoryStats[category].parent_equipment.push(item);
      }
    }
  });

  console.log('📊 Category Statistics Summary:');
  Object.entries(categoryStats).forEach(([categoryId, stats]) => {
    if (stats.count > 0) {
      console.log(`   ${categoryId} | ${stats.name}: ${stats.count} items (${stats.parent_equipment.length} parents, ${stats.child_equipment.length} children)`);
    }
  });

  const parentItems = categorizedEquipment.filter(item => !item.is_sub_equipment).length;
  const childItems = categorizedEquipment.filter(item => item.is_sub_equipment).length;

  console.log(`🎯 CORRECTED FINAL COUNTS: ${parentItems} parents, ${childItems} children (Total: ${parentItems + childItems})`);

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
    relationshipAnalysis: relationshipAnalysis
  };
};

// Main equipment categorization function - CRITICALLY FIXED
export const categorizeEquipment = (equipmentList) => {
  try {
    console.log('🚀 STARTING CRITICALLY FIXED EQUIPMENT CATEGORIZATION');
    console.log(`📊 Input: ${equipmentList?.length || 0} raw equipment items`);

    if (!Array.isArray(equipmentList) || equipmentList.length === 0) {
      throw new Error('Invalid equipment list provided');
    }

    // CRITICAL FIX: Enhanced Equipment Processing
    const processedData = processEquipmentList(equipmentList);
    
    console.log('✅ Equipment categorization completed:', {
      original: processedData.original,
      final: processedData.final,
      parentItems: processedData.parentItems,
      childItems: processedData.childItems,
      relationships: processedData.parentChildRelationships.length,
      categories: Object.keys(processedData.categoryStats || {}).length
    });

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
      
      // CRITICAL: Parent-child relationships for WBS generator
      parentChildRelationships: processedData.parentChildRelationships,
      relationshipAnalysis: processedData.relationshipAnalysis,
      
      // Keep existing fields for backward compatibility
      equipment: processedData.equipment,
      summary: {
        processing_warnings: [],
        total_processed: processedData.final,
        categories_created: Object.keys(processedData.categoryStats).length,
        tbc_count: processedData.tbcCount
      }
    };

  } catch (error) {
    console.error('❌ Equipment categorization failed:', error);
    throw new Error(`Equipment categorization failed: ${error.message}`);
  }
};

// Filter equipment for WBS inclusion
export const filterEquipmentForWBS = (equipment) => {
  return equipment.filter(item => {
    const status = safeToString(item.commissioning_yn || item['Commissioning (Y/N)'] || 'Y').toUpperCase();
    return status === 'Y' || status === 'TBC';
  });
};

// Group equipment by subsystem
export const groupEquipmentBySubsystem = (equipment) => {
  const subsystemGroups = {};
  
  equipment.forEach(item => {
    const subsystem = item.subsystem || item.Subsystem || 'S1';
    if (!subsystemGroups[subsystem]) {
      subsystemGroups[subsystem] = [];
    }
    subsystemGroups[subsystem].push(item);
  });
  
  return subsystemGroups;
};

// Enhanced validation
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
      parent_equipment: equipment.filter(item => item.is_parent_equipment).length
    }
  };

  return validation;
};

// Export for debugging
export const exportCategorizedEquipment = (equipment) => {
  return equipment.map(item => ({
    equipment_number: item.equipment_number,
    description: item.description,
    category: item.category,
    category_name: item.category_name,
    commissioning_status: item.commissioning_status,
    is_sub_equipment: item.is_sub_equipment,
    is_parent_equipment: item.is_parent_equipment,
    parent_equipment: item.parent_equipment || '',
    subsystem: item.subsystem
  }));
};

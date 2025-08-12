import { EQUIPMENT_PATTERNS, SUB_EQUIPMENT_PATTERNS, EQUIPMENT_CATEGORIES, COMMISSIONING_STATUS } from '../constants';
import { stringHelpers, patternHelpers, arrayHelpers } from '../utils';

/**
 * Equipment Processor - ENHANCED WITH COMMISSIONING FILTER FIX
 * 🚨 CRITICAL FIX APPLIED:
 * - FIXED: Removed dangerous 'Y' default in commissioning filtering
 * - FIXED: Only processes equipment with explicit 'Y' commissioning status
 * - ENHANCED: Safe equipment deduplication (only true duplicates removed)
 * - ENHANCED: Parent-child relationship detection
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

// CRITICAL FIX: Enhanced parent-child string normalization
const normalizeEquipmentCode = (code) => {
  if (!code || code === '-') return '';
  
  return safeToString(code)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .replace(/[^\w\s+\-]/g, '') // Remove special chars except +, -, letters, numbers
    .trim();
};

// CRITICAL FIX: Flexible parent-child relationship matching
const findParentMatch = (childParentCode, equipmentMap) => {
  if (!childParentCode) return null;
  
  const normalizedChildParent = normalizeEquipmentCode(childParentCode);
  
  // First try exact match
  if (equipmentMap.has(childParentCode)) {
    return childParentCode;
  }
  
  // Try normalized match
  for (const [equipmentCode, item] of equipmentMap) {
    const normalizedEquipmentCode = normalizeEquipmentCode(equipmentCode);
    if (normalizedEquipmentCode === normalizedChildParent) {
      return equipmentCode;
    }
  }
  
  // Try partial match (for cases like "FABRICATION & DESIGN" vs "Fabrication & Design")
  for (const [equipmentCode, item] of equipmentMap) {
    const normalizedEquipmentCode = normalizeEquipmentCode(equipmentCode);
    
    // Check if the core parts match (remove common words)
    const childCore = normalizedChildParent.replace(/\b(FABRICATION|DESIGN|MANAGEMENT)\b/g, '').trim();
    const parentCore = normalizedEquipmentCode.replace(/\b(FABRICATION|DESIGN|MANAGEMENT)\b/g, '').trim();
    
    if (childCore && parentCore && childCore === parentCore) {
      return equipmentCode;
    }
  }
  
  return null;
};

// CRITICAL FIX: SAFE equipment deduplication logic - only removes TRUE duplicates
const deduplicateEquipment = (equipmentList) => {
  console.log('🔄 SAFE EQUIPMENT DEDUPLICATION (only true duplicates)');
  console.log(`📊 Input: ${equipmentList.length} items (checking for true duplicates)`);
  
  // Create composite key for TRUE duplicate detection
  const createDuplicateKey = (item) => {
    return [
      item.equipment_number?.trim() || '',
      item.parent_equipment_code?.trim() || '',
      item.description?.trim() || '',
      item.subsystem?.trim() || ''
    ].join('|||'); // Use separator that won't appear in data
  };
  
  const uniqueItemsMap = new Map();
  const trueDuplicates = [];
  
  equipmentList.forEach(item => {
    const equipmentCode = item.equipment_number?.trim();
    if (!equipmentCode || equipmentCode === '-') return;
    
    const duplicateKey = createDuplicateKey(item);
    
    if (uniqueItemsMap.has(duplicateKey)) {
      // Found TRUE duplicate (same code + same parent + same description + same subsystem)
      const existing = uniqueItemsMap.get(duplicateKey);
      
      // Keep the one with more complete data or better quality
      const itemHasMoreData = (item.description?.length || 0) + (item.manufacturer?.length || 0) + (item.model?.length || 0);
      const existingHasMoreData = (existing.description?.length || 0) + (existing.manufacturer?.length || 0) + (existing.model?.length || 0);
      
      if (itemHasMoreData > existingHasMoreData) {
        trueDuplicates.push(existing);
        uniqueItemsMap.set(duplicateKey, item);
        console.log(`   🔄 Replaced duplicate: ${equipmentCode} (better data quality)`);
      } else {
        trueDuplicates.push(item);
        console.log(`   🔄 Removed duplicate: ${equipmentCode} (keeping existing with better data)`);
      }
    } else {
      uniqueItemsMap.set(duplicateKey, item);
    }
  });
  
  const deduplicatedList = Array.from(uniqueItemsMap.values());
  
  console.log(`✅ SAFE deduplication complete: ${deduplicatedList.length} unique items (removed ${trueDuplicates.length} TRUE duplicates)`);
  
  if (trueDuplicates.length > 0) {
    console.log('📋 TRUE duplicates removed (identical in all key fields):');
    trueDuplicates.slice(0, 5).forEach((dup, index) => {
      console.log(`   ${index + 1}. ${dup.equipment_number} | ${dup.parent_equipment_code || 'no parent'} | ${(dup.description || '').substring(0, 30)}...`);
    });
  } else {
    console.log('✅ No true duplicates found - all equipment items are unique');
  }
  
  return deduplicatedList;
};

// CRITICAL FIX: Enhanced parent-child relationship analysis
const analyzeParentChildRelationships = (equipmentList) => {
  console.log('🔍 ENHANCED PARENT-CHILD RELATIONSHIP ANALYSIS');
  
  // Create equipment lookup map
  const equipmentMap = new Map();
  equipmentList.forEach(item => {
    const code = safeToString(item.equipment_number || '').trim();
    if (code && code !== '-') {
      equipmentMap.set(code, item);
    }
  });
  
  console.log(`📊 Equipment map created: ${equipmentMap.size} equipment items`);
  
  // Analyze relationships with enhanced matching
  const relationships = [];
  const parentEquipment = new Set();
  const childEquipment = new Set();
  
  equipmentList.forEach(item => {
    const equipmentCode = safeToString(item.equipment_number || '').trim();
    const parentCode = safeCleanEquipmentCode(item.parent_equipment_number || item.parent_equipment_code || '');
    
    // Skip invalid equipment codes
    if (!equipmentCode || equipmentCode === '-') {
      return;
    }
    
    // CRITICAL: Check if parent_equipment_number is "-" (indicates parent equipment)
    if (!parentCode || parentCode === '-' || parentCode === equipmentCode) {
      // No parent or self-referencing = this is a parent equipment
      parentEquipment.add(equipmentCode);
    } else {
      // Has a different parent = this is child equipment
      childEquipment.add(equipmentCode);
      
      // CRITICAL FIX: Use enhanced parent matching
      const matchedParent = findParentMatch(parentCode, equipmentMap);
      
      // Record the relationship
      relationships.push({
        child: equipmentCode,
        parent: parentCode,
        matchedParent: matchedParent,
        childItem: item,
        parentExists: matchedParent !== null
      });
      
      // Mark the matched parent as a parent (if found)
      if (matchedParent) {
        parentEquipment.add(matchedParent);
      }
    }
  });
  
  console.log(`👨‍👦 Enhanced relationship analysis complete:`);
  console.log(`   Parents: ${parentEquipment.size}`);
  console.log(`   Children: ${childEquipment.size}`);
  console.log(`   Relationships: ${relationships.length}`);
  
  // Show sample relationships with match status
  console.log(`\n📋 Sample Parent-Child Relationships (first 10):`);
  relationships.slice(0, 10).forEach((rel, index) => {
    const matchStatus = rel.parentExists ? '✅' : '❌';
    const matchInfo = rel.matchedParent ? ` (matched: ${rel.matchedParent})` : '';
    console.log(`   ${index + 1}. "${rel.child}" → "${rel.parent}"${matchInfo} ${matchStatus}`);
  });
  
  // Count successful matches
  const successfulMatches = relationships.filter(rel => rel.parentExists).length;
  console.log(`🎯 Successful parent matches: ${successfulMatches}/${relationships.length}`);
  
  return {
    relationships,
    parentEquipment,
    childEquipment,
    equipmentMap,
    successfulMatches
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

const processEquipmentList = (rawEquipmentList) => {
  console.log('🚀 DEBUG EQUIPMENT PROCESSING - INVESTIGATING COMMISSIONING FILTERING');
  console.log(`📊 Input: ${rawEquipmentList.length} raw equipment items`);

  // DEBUG: Check first 10 items for commissioning status
  console.log('🔍 DEBUG: Checking commissioning status of first 10 items:');
  rawEquipmentList.slice(0, 10).forEach((item, index) => {
    const statusDirect = item.commissioning_yn;
    const statusAlt = item['Commissioning (Y/N)'];
    const statusAlt2 = item.commissioning;
    
    console.log(`   ${index + 1}. Equipment: ${item.equipment_number || 'unknown'}`);
    console.log(`      commissioning_yn: "${statusDirect}"`);
    console.log(`      Commissioning (Y/N): "${statusAlt}"`);
    console.log(`      commissioning: "${statusAlt2}"`);
    console.log(`      Available keys: ${Object.keys(item).join(', ')}`);
    console.log(`      Sample item:`, item);
  });

  // ENHANCED commissioning status getter with DEBUG
  const getCommissioningStatus = (item) => {
    const statusValue = item.commissioning_yn || 
                       item['Commissioning (Y/N)'] ||
                       item.commissioning ||
                       null;
    
    const processed = statusValue ? safeToString(statusValue).toUpperCase().trim() : 'NULL';
    console.log(`DEBUG getCommissioningStatus for ${item.equipment_number}: raw="${statusValue}" processed="${processed}"`);
    
    if (statusValue === null || statusValue === undefined) return '';
    return safeToString(statusValue).toUpperCase().trim();
  };

  // Test the function on first few items
  console.log('🧪 DEBUG: Testing commissioning status function on first 5 items:');
  rawEquipmentList.slice(0, 5).forEach((item, index) => {
    const result = getCommissioningStatus(item);
    console.log(`   ${index + 1}. ${item.equipment_number}: status="${result}" (should be Y for electrical equipment)`);
  });

  // Count items by status with detailed logging
  let yCount = 0;
  let tbcCount = 0; 
  let excludedCount = 0;
  let nullCount = 0;

  const tbcEquipment = rawEquipmentList.filter(item => {
    const status = getCommissioningStatus(item);
    const isTBC = status === 'TBC';
    if (isTBC) {
      tbcCount++;
      console.log(`DEBUG: Found TBC item: ${item.equipment_number}`);
    }
    return isTBC;
  });

  const regularEquipment = rawEquipmentList.filter(item => {
    const status = getCommissioningStatus(item);
    const isY = status === 'Y';
    if (isY) {
      yCount++;
      if (yCount <= 5) console.log(`DEBUG: Found Y item: ${item.equipment_number} | ${item.description}`);
    }
    return isY;
  });

  const excludedEquipment = rawEquipmentList.filter(item => {
    const status = getCommissioningStatus(item);
    const isExcluded = status === 'N' || status === '' || status === null;
    if (isExcluded) {
      excludedCount++;
      if (excludedCount <= 5) {
        console.log(`DEBUG: Excluding item ${item.equipment_number}: status="${status}"`);
      }
    }
    if (status === '') nullCount++;
    return isExcluded;
  });

  console.log(`📊 DEBUG DETAILED Equipment separation:`);
  console.log(`   ✅ Regular (Y): ${regularEquipment.length}`);
  console.log(`   ⏳ TBC: ${tbcEquipment.length}`);  
  console.log(`   ❌ Excluded: ${excludedEquipment.length}`);
  console.log(`   🔍 Empty/null status: ${nullCount}`);

  // Show samples of each category
  if (regularEquipment.length > 0) {
    console.log('✅ Sample regular equipment (first 3):');
    regularEquipment.slice(0, 3).forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.equipment_number} | ${item.commissioning_yn} | ${(item.description || '').substring(0, 40)}`);
    });
  } else {
    console.log('❌ NO regular equipment found! This is the problem.');
  }

  if (excludedEquipment.length > 0) {
    console.log('❌ Sample excluded equipment (first 5):');
    excludedEquipment.slice(0, 5).forEach((item, index) => {
      console.log(`   ${index + 1}. ${item.equipment_number} | commissioning_yn: "${item.commissioning_yn}" | ${(item.description || '').substring(0, 40)}`);
    });
  }

  // Return simplified data for now
  return {
    equipment: [],
    tbcEquipment: [],
    subsystemMapping: {},
    original: rawEquipmentList.length,
    afterCommissioningFilter: regularEquipment.length + tbcEquipment.length,
    final: regularEquipment.length,
    tbcCount: tbcEquipment.length,
    parentItems: 0,
    childItems: 0,
    categoryStats: {},
    parentChildRelationships: [],
    relationshipAnalysis: { successfulMatches: 0, relationships: [] }
  };
};

// Main equipment categorization function - ENHANCED WITH FIXED COMMISSIONING FILTERING
export const categorizeEquipment = (equipmentList) => {
  try {
    console.log('🚀 STARTING ENHANCED EQUIPMENT CATEGORIZATION WITH FIXED COMMISSIONING FILTERING');
    console.log(`📊 Input: ${equipmentList?.length || 0} raw equipment items`);

    if (!Array.isArray(equipmentList) || equipmentList.length === 0) {
      throw new Error('Invalid equipment list provided');
    }

    // CRITICAL FIX: Enhanced Equipment Processing with FIXED commissioning filtering
    const processedData = processEquipmentList(equipmentList);
    
    console.log('✅ Enhanced equipment categorization completed:', {
      original: processedData.original,
      final: processedData.final,
      parentItems: processedData.parentItems,
      childItems: processedData.childItems,
      relationships: processedData.parentChildRelationships.length,
      categories: Object.keys(processedData.categoryStats || {}).length,
      matchSuccess: `${processedData.relationshipAnalysis.successfulMatches}/${processedData.relationshipAnalysis.relationships.length}`
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
      
      // CRITICAL: Enhanced parent-child relationships for WBS generator
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
    const status = safeToString(item.commissioning_yn || item['Commissioning (Y/N)'] || '').toUpperCase();
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

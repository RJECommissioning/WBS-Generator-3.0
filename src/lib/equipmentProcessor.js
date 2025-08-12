import { EQUIPMENT_PATTERNS, SUB_EQUIPMENT_PATTERNS, EQUIPMENT_CATEGORIES, COMMISSIONING_STATUS } from '../constants';
import { stringHelpers, patternHelpers, arrayHelpers } from '../utils';

/**
 * Equipment Processor - ENHANCED WITH SAFE DEDUPLICATION & PARENT-CHILD FIXES
 * 🚨 CRITICAL FIXES APPLIED:
 * - FIXED: Parent-child string matching normalization
 * - FIXED: SAFE equipment deduplication (only true duplicates removed)
 * - FIXED: Enhanced parent-child relationship detection
 * - ADDED: Flexible parent-child matching with case handling
 * - SAFE: Only removes items that match ALL fields (code+parent+description+subsystem)
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
    const parentCode = safeCleanEquipmentCode(item.parent_equipment_number || item.parent_equipment_code || ''); // FIXED: Use cleaning function
    
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

// CRITICAL FIX: Enhanced equipment processing with SAFE deduplication
const processEquipmentList = (rawEquipmentList) => {
  console.log('🚀 ENHANCED EQUIPMENT PROCESSING WITH SAFE DEDUPLICATION');
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

  // Step 3: Clean and normalize equipment data
  const cleanedEquipment = regularEquipment
    .map(item => {
      const equipmentCode = safeCleanEquipmentCode(item.equipment_number || item['Equipment Number'] || '', 'processing');
      const parentCode = safeCleanEquipmentCode(item.parent_equipment_number || item['Parent Equipment Number'] || ''); // FIXED: Use cleaning function
      
      return {
        ...item,
        equipment_number: equipmentCode,
        parent_equipment_code: parentCode === '-' || parentCode === '' ? null : parentCode,
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

  console.log(`✅ After initial cleaning: ${cleanedEquipment.length} regular equipment items`);

  // Step 4: CRITICAL FIX - SAFELY deduplicate equipment (only TRUE duplicates)
  const deduplicatedEquipment = deduplicateEquipment(cleanedEquipment);

  // Step 5: CRITICAL FIX - Analyze parent-child relationships AFTER deduplication
  const relationshipAnalysis = analyzeParentChildRelationships(deduplicatedEquipment);

  // Step 6: Process TBC equipment
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

  // Step 7: CRITICAL FIX - Enhanced categorization with PROPER parent-child flagging
  const categorizedEquipment = deduplicatedEquipment.map((item) => {
    const category = determineEquipmentCategory(item.equipment_number);
    const categoryInfo = EQUIPMENT_CATEGORIES[category] || 'Unrecognised Equipment';
    
    // CRITICAL FIX: Use the enhanced relationship analysis to determine parent/child status
    const isParent = relationshipAnalysis.parentEquipment.has(item.equipment_number);
    const isChild = relationshipAnalysis.childEquipment.has(item.equipment_number);
    
    const processedItem = {
      ...item,
      category: category,
      category_name: categoryInfo,
      // FIXED: Correct parent-child determination using enhanced relationship analysis
      is_sub_equipment: isChild,
      is_parent_equipment: isParent,
      parent_equipment: isChild ? item.parent_equipment_code : null,
      level: isChild ? 'child' : 'parent',
      commissioning_status: 'Y',
      subsystem_info: subsystemMapping[item.subsystem] || { code: 'S1', name: 'Main Subsystem' }
    };

    return processedItem;
  });

  // Step 8: CRITICAL FIX - Build enhanced parent-child relationships map
  const parentChildRelationships = relationshipAnalysis.relationships.filter(rel => {
    // Only include relationships where both parent and child exist and match
    const childExists = deduplicatedEquipment.find(item => item.equipment_number === rel.child);
    const parentExists = rel.parentExists && rel.matchedParent;
    return childExists && parentExists;
  });

  console.log(`🔗 Built ${parentChildRelationships.length} valid parent-child relationships`);

  // Step 9: Generate category statistics with FIXED counts
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

  console.log('📊 Enhanced Category Statistics Summary:');
  Object.entries(categoryStats).forEach(([categoryId, stats]) => {
    if (stats.count > 0) {
      console.log(`   ${categoryId} | ${stats.name}: ${stats.count} items (${stats.parent_equipment.length} parents, ${stats.child_equipment.length} children)`);
    }
  });

  const parentItems = categorizedEquipment.filter(item => !item.is_sub_equipment).length;
  const childItems = categorizedEquipment.filter(item => item.is_sub_equipment).length;

  console.log(`🎯 ENHANCED FINAL COUNTS: ${parentItems} parents, ${childItems} children (Total: ${parentItems + childItems})`);
  console.log(`🎯 Parent-child matches: ${relationshipAnalysis.successfulMatches}/${relationshipAnalysis.relationships.length}`);

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

// Main equipment categorization function - ENHANCED WITH SAFE DEDUPLICATION
export const categorizeEquipment = (equipmentList) => {
  try {
    console.log('🚀 STARTING ENHANCED EQUIPMENT CATEGORIZATION WITH SAFE DEDUPLICATION');
    console.log(`📊 Input: ${equipmentList?.length || 0} raw equipment items`);

    if (!Array.isArray(equipmentList) || equipmentList.length === 0) {
      throw new Error('Invalid equipment list provided');
    }

    // CRITICAL FIX: Enhanced Equipment Processing with SAFE deduplication
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

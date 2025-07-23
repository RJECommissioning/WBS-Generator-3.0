import { arrayHelpers, stringHelpers, wbsHelpers } from '../utils';
import { categorizeEquipment } from './equipmentProcessor';
import { generateWBSStructure } from './wbsGenerator';
import { WBS_LEVEL_COLORS, BRAND_COLORS } from '../constants';

/**
 * Project Comparer - Compares equipment lists to identify changes for Missing Equipment feature
 */

// Main comparison function
export const compareEquipmentLists = (existingProject, updatedEquipmentList) => {
  try {
    if (!existingProject || !updatedEquipmentList) {
      throw new Error('Both existing project and updated equipment list are required');
    }

    // Extract equipment from existing project
    const existingEquipment = extractEquipmentFromProject(existingProject);
    
    // Normalize both equipment lists for comparison
    const normalizedExisting = normalizeEquipmentForComparison(existingEquipment);
    const normalizedUpdated = normalizeEquipmentForComparison(updatedEquipmentList);

    // Perform detailed comparison
    const comparisonResult = performDetailedComparison(normalizedExisting, normalizedUpdated);
    
    // Process new equipment through categorization
    if (comparisonResult.added.length > 0) {
      const categorizedNewEquipment = categorizeEquipment(comparisonResult.added);
      comparisonResult.added = categorizedNewEquipment.equipment;
    }

    // Generate WBS codes for new equipment
    const wbsAssignment = assignWBSCodesToNewEquipment(
      comparisonResult.added,
      existingProject.wbs_structure
    );

    // Build integrated WBS structure
    const integratedStructure = buildIntegratedWBSStructure(
      existingProject.wbs_structure,
      wbsAssignment.new_wbs_items
    );

    // Generate comparison summary
    const summary = generateComparisonSummary(comparisonResult, wbsAssignment);

    return {
      comparison: comparisonResult,
      wbs_assignment: wbsAssignment,
      integrated_structure: integratedStructure,
      summary: summary,
      export_ready: prepareExportData(wbsAssignment.new_wbs_items)
    };

  } catch (error) {
    throw new Error(`Equipment comparison failed: ${error.message}`);
  }
};

// Extract equipment list from existing project structure
const extractEquipmentFromProject = (existingProject) => {
  if (existingProject.equipment_list && existingProject.equipment_list.length > 0) {
    // Direct equipment list available
    return existingProject.equipment_list;
  }
  
  if (existingProject.wbs_structure && existingProject.wbs_structure.length > 0) {
    // Extract from WBS structure
    return existingProject.wbs_structure
      .filter(item => item.is_equipment && item.equipment_number)
      .map(item => ({
        equipment_number: item.equipment_number,
        description: item.description || '',
        commissioning_status: item.commissioning_status || 'Y',
        wbs_code: item.wbs_code,
        category: extractCategoryFromWBS(item),
        existing_wbs_code: item.wbs_code
      }));
  }
  
  throw new Error('No equipment data found in existing project');
};

// Extract category from WBS structure
const extractCategoryFromWBS = (wbsItem) => {
  // Look for category pattern in WBS name (e.g., "02 | Protection Panels")
  const categoryMatch = wbsItem.wbs_name.match(/^(\d{2})\s*\|/);
  return categoryMatch ? categoryMatch[1] : '99';
};

// Normalize equipment for comparison
const normalizeEquipmentForComparison = (equipmentList) => {
  return equipmentList.map(item => ({
    equipment_number: stringHelpers.cleanEquipmentCode(item.equipment_number),
    description: (item.description || '').trim(),
    commissioning_status: (item.commissioning_status || 'Y').toUpperCase(),
    plu_field: stringHelpers.cleanEquipmentCode(item.plu_field || ''),
    category: item.category || null,
    wbs_code: item.wbs_code || item.existing_wbs_code || null,
    original_data: item // Keep reference to original
  }));
};

// Perform detailed equipment comparison
const performDetailedComparison = (existingEquipment, updatedEquipment) => {
  // Create lookup maps for efficient comparison
  const existingMap = new Map();
  const updatedMap = new Map();
  
  existingEquipment.forEach(item => {
    existingMap.set(item.equipment_number, item);
  });
  
  updatedEquipment.forEach(item => {
    updatedMap.set(item.equipment_number, item);
  });

  // Find differences
  const added = [];
  const removed = [];
  const existing = [];
  const modified = [];

  // Check for new equipment (in updated but not in existing)
  updatedEquipment.forEach(updatedItem => {
    if (!existingMap.has(updatedItem.equipment_number)) {
      added.push({
        ...updatedItem.original_data,
        equipment_number: updatedItem.equipment_number,
        is_new: true,
        change_type: 'added'
      });
    }
  });

  // Check for removed equipment (in existing but not in updated)
  existingEquipment.forEach(existingItem => {
    if (!updatedMap.has(existingItem.equipment_number)) {
      removed.push({
        ...existingItem.original_data,
        equipment_number: existingItem.equipment_number,
        change_type: 'removed'
      });
    }
  });

  // Check for existing and modified equipment
  existingEquipment.forEach(existingItem => {
    const updatedItem = updatedMap.get(existingItem.equipment_number);
    if (updatedItem) {
      // Equipment exists in both lists - check for modifications
      const changes = detectEquipmentChanges(existingItem, updatedItem);
      
      if (changes.length > 0) {
        modified.push({
          ...updatedItem.original_data,
          equipment_number: updatedItem.equipment_number,
          changes: changes,
          change_type: 'modified',
          existing_data: existingItem.original_data
        });
      } else {
        existing.push({
          ...existingItem.original_data,
          equipment_number: existingItem.equipment_number,
          change_type: 'unchanged'
        });
      }
    }
  });

  return {
    added,
    removed,
    existing,
    modified,
    total_existing_equipment: existingEquipment.length,
    total_updated_equipment: updatedEquipment.length
  };
};

// Detect changes between equipment items
const detectEquipmentChanges = (existingItem, updatedItem) => {
  const changes = [];

  // Check description changes
  if (existingItem.description !== updatedItem.description) {
    changes.push({
      field: 'description',
      old_value: existingItem.description,
      new_value: updatedItem.description
    });
  }

  // Check commissioning status changes
  if (existingItem.commissioning_status !== updatedItem.commissioning_status) {
    changes.push({
      field: 'commissioning_status',
      old_value: existingItem.commissioning_status,
      new_value: updatedItem.commissioning_status
    });
  }

  // Check PLU field changes
  if (existingItem.plu_field !== updatedItem.plu_field) {
    changes.push({
      field: 'plu_field',
      old_value: existingItem.plu_field,
      new_value: updatedItem.plu_field
    });
  }

  return changes;
};

// Assign WBS codes to new equipment
const assignWBSCodesToNewEquipment = (newEquipment, existingWBSStructure) => {
  if (!newEquipment || newEquipment.length === 0) {
    return {
      new_wbs_items: [],
      assignment_summary: {
        total_assigned: 0,
        by_category: {}
      }
    };
  }

  // Analyze existing WBS structure to understand patterns
  const wbsAnalysis = analyzeExistingWBSStructure(existingWBSStructure);
  
  // Group new equipment by category and subsystem
  const groupedNewEquipment = groupNewEquipmentForWBS(newEquipment);
  
  // Assign WBS codes based on existing patterns
  const newWBSItems = [];
  const assignmentSummary = {
    total_assigned: 0,
    by_category: {}
  };

  Object.entries(groupedNewEquipment).forEach(([categoryKey, categoryData]) => {
    const categoryEquipment = categoryData.equipment;
    
    // Find or create category in existing structure
    const categoryWBSCode = findOrCreateCategoryWBS(
      categoryKey,
      wbsAnalysis,
      existingWBSStructure
    );

    // Assign equipment within category
    const categoryAssignments = assignEquipmentToCategoryWBS(
      categoryEquipment,
      categoryWBSCode,
      existingWBSStructure
    );

    newWBSItems.push(...categoryAssignments);
    
    assignmentSummary.by_category[categoryKey] = {
      category_name: categoryData.category_name,
      equipment_count: categoryEquipment.length,
      wbs_items_created: categoryAssignments.length
    };
    
    assignmentSummary.total_assigned += categoryAssignments.length;
  });

  return {
    new_wbs_items: newWBSItems,
    assignment_summary: assignmentSummary,
    wbs_analysis: wbsAnalysis
  };
};

// Analyze existing WBS structure for patterns
const analyzeExistingWBSStructure = (wbsStructure) => {
  const analysis = {
    highest_codes_by_level: {},
    category_codes: {},
    subsystem_codes: {},
    equipment_codes: {},
    max_level: 0
  };

  wbsStructure.forEach(item => {
    const level = item.level || stringHelpers.getWBSLevel(item.wbs_code);
    
    // Track highest codes by level
    if (!analysis.highest_codes_by_level[level] || 
        compareWBSCodes(item.wbs_code, analysis.highest_codes_by_level[level]) > 0) {
      analysis.highest_codes_by_level[level] = item.wbs_code;
    }

    // Track max level
    if (level > analysis.max_level) {
      analysis.max_level = level;
    }

    // Track category codes (level 3, with category patterns)
    if (level === 3 && /\d{2}\s*\|/.test(item.wbs_name)) {
      const categoryMatch = item.wbs_name.match(/^(\d{2})/);
      if (categoryMatch) {
        analysis.category_codes[categoryMatch[1]] = item.wbs_code;
      }
    }

    // Track subsystem codes (level 2)
    if (level === 2) {
      analysis.subsystem_codes[item.wbs_code] = item.wbs_name;
    }

    // Track equipment codes (level 4+)
    if (level >= 4 && item.equipment_number) {
      analysis.equipment_codes[item.equipment_number] = item.wbs_code;
    }
  });

  return analysis;
};

// Compare WBS codes numerically
const compareWBSCodes = (code1, code2) => {
  const parts1 = code1.split('.').map(Number);
  const parts2 = code2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const val1 = parts1[i] || 0;
    const val2 = parts2[i] || 0;
    
    if (val1 !== val2) {
      return val1 - val2;
    }
  }
  return 0;
};

// Group new equipment for WBS assignment
const groupNewEquipmentForWBS = (newEquipment) => {
  return arrayHelpers.groupBy(newEquipment, item => {
    const category = item.category || '99';
    return category;
  });
};

// Find or create category in WBS structure
const findOrCreateCategoryWBS = (categoryCode, wbsAnalysis, existingWBS) => {
  // Check if category already exists
  if (wbsAnalysis.category_codes[categoryCode]) {
    return wbsAnalysis.category_codes[categoryCode];
  }

  // Need to create new category - find appropriate subsystem
  const subsystemCodes = Object.keys(wbsAnalysis.subsystem_codes);
  let targetSubsystemCode = subsystemCodes[0]; // Default to first subsystem
  
  // Try to find S1 subsystem if available
  const s1Subsystem = subsystemCodes.find(code => 
    wbsAnalysis.subsystem_codes[code].includes('S1')
  );
  if (s1Subsystem) {
    targetSubsystemCode = s1Subsystem;
  }

  // Generate next category code within subsystem
  const existingCategoriesInSubsystem = existingWBS
    .filter(item => 
      item.parent_wbs_code === targetSubsystemCode && 
      item.level === 3
    );

  const nextSequence = existingCategoriesInSubsystem.length + 1;
  return stringHelpers.generateWBSCode(targetSubsystemCode, nextSequence);
};

// Assign equipment to category WBS
const assignEquipmentToCategoryWBS = (equipment, categoryWBSCode, existingWBS) => {
  const wbsItems = [];

  // Find existing equipment count in this category
  const existingEquipmentInCategory = existingWBS.filter(item => 
    item.parent_wbs_code === categoryWBSCode && item.level >= 4
  );

  let equipmentSequence = existingEquipmentInCategory.length + 1;

  // Sort equipment for consistent assignment
  const sortedEquipment = arrayHelpers.sortBy(equipment, [
    { key: 'equipment_number', order: 'asc' }
  ]);

  sortedEquipment.forEach(item => {
    const equipmentWBSCode = stringHelpers.generateWBSCode(categoryWBSCode, equipmentSequence++);
    
    wbsItems.push({
      wbs_code: equipmentWBSCode,
      parent_wbs_code: categoryWBSCode,
      wbs_name: stringHelpers.formatEquipmentDescription(item.equipment_number, item.description),
      equipment_number: item.equipment_number,
      description: item.description,
      commissioning_status: item.commissioning_status,
      level: 4,
      color: WBS_LEVEL_COLORS[4],
      is_category: false,
      is_equipment: true,
      is_new: true,
      change_type: 'added'
    });
  });

  return wbsItems;
};

// Build integrated WBS structure (existing + new)
const buildIntegratedWBSStructure = (existingWBS, newWBSItems) => {
  // Combine existing and new items
  const combined = [
    ...existingWBS.map(item => ({ ...item, is_new: false })),
    ...newWBSItems
  ];

  // Sort by WBS code for proper hierarchy
  const sorted = arrayHelpers.sortBy(combined, [
    { key: 'wbs_code', order: 'asc' }
  ]);

  return sorted;
};

// Generate comparison summary
const generateComparisonSummary = (comparisonResult, wbsAssignment) => {
  const summary = {
    equipment_changes: {
      added: comparisonResult.added.length,
      removed: comparisonResult.removed.length,
      modified: comparisonResult.modified.length,
      unchanged: comparisonResult.existing.length
    },
    wbs_changes: {
      new_wbs_items: wbsAssignment.new_wbs_items.length,
      categories_affected: Object.keys(wbsAssignment.assignment_summary.by_category).length
    },
    significant_changes: comparisonResult.added.length > 0 || comparisonResult.removed.length > 0,
    change_percentage: calculateChangePercentage(comparisonResult),
    recommendations: generateRecommendations(comparisonResult, wbsAssignment)
  };

  return summary;
};

// Calculate change percentage
const calculateChangePercentage = (comparisonResult) => {
  const totalChanges = comparisonResult.added.length + 
                      comparisonResult.removed.length + 
                      comparisonResult.modified.length;
  
  const totalEquipment = comparisonResult.total_existing_equipment;
  
  return totalEquipment > 0 ? Math.round((totalChanges / totalEquipment) * 100) : 0;
};

// Generate recommendations
const generateRecommendations = (comparisonResult, wbsAssignment) => {
  const recommendations = [];

  if (comparisonResult.added.length > 0) {
    recommendations.push(
      `${comparisonResult.added.length} new equipment items require WBS codes and project integration`
    );
  }

  if (comparisonResult.removed.length > 0) {
    recommendations.push(
      `${comparisonResult.removed.length} equipment items have been removed - review project scope`
    );
  }

  if (comparisonResult.modified.length > 0) {
    recommendations.push(
      `${comparisonResult.modified.length} equipment items have been modified - review descriptions and commissioning status`
    );
  }

  if (wbsAssignment.new_wbs_items.length > 0) {
    recommendations.push(
      `Export ${wbsAssignment.new_wbs_items.length} new WBS items for P6 import`
    );
  }

  return recommendations;
};

// Prepare export data for P6
const prepareExportData = (newWBSItems) => {
  return newWBSItems.map(item => ({
    wbs_code: item.wbs_code,
    parent_wbs_code: item.parent_wbs_code,
    wbs_name: item.wbs_name,
    equipment_number: item.equipment_number || '',
    description: item.description || '',
    commissioning_status: item.commissioning_status || 'Y'
  }));
};

// Validate comparison results
export const validateComparisonResults = (comparisonResult) => {
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Check for data consistency
  if (!comparisonResult || typeof comparisonResult !== 'object') {
    validation.errors.push('Invalid comparison result structure');
    validation.isValid = false;
    return validation;
  }

  // Validate required arrays
  const requiredArrays = ['added', 'removed', 'existing', 'modified'];
  requiredArrays.forEach(arrayName => {
    if (!Array.isArray(comparisonResult[arrayName])) {
      validation.errors.push(`Missing or invalid ${arrayName} array`);
      validation.isValid = false;
    }
  });

  // Check for logical consistency
  const totalReported = comparisonResult.added.length + 
                       comparisonResult.removed.length + 
                       comparisonResult.existing.length;

  if (totalReported === 0) {
    validation.warnings.push('No equipment found in comparison - verify input data');
  }

  return validation;
};

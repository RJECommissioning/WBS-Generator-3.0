import { EQUIPMENT_PATTERNS, SUB_EQUIPMENT_PATTERNS, EQUIPMENT_CATEGORIES, COMMISSIONING_STATUS } from '../constants';
import { stringHelpers, patternHelpers, arrayHelpers } from '../utils';

/**
 * Equipment Processor - Categorizes equipment according to WBS patterns
 */

// Main equipment categorization function
export const categorizeEquipment = (equipmentList) => {
  try {
    if (!Array.isArray(equipmentList) || equipmentList.length === 0) {
      throw new Error('Invalid equipment list provided');
    }

    // Process each equipment item
    const categorizedEquipment = equipmentList.map(item => {
      const processedItem = processEquipmentItem(item);
      return processedItem;
    });

    // Group by category for analysis
    const groupedByCategory = arrayHelpers.groupBy(categorizedEquipment, 'category');
    
    // Build parent-child relationships for sub-equipment
    const equipmentWithRelationships = buildEquipmentRelationships(categorizedEquipment);

    // Generate processing summary
    const summary = generateProcessingSummary(equipmentWithRelationships);

    return {
      equipment: equipmentWithRelationships,
      grouped: groupedByCategory,
      summary: summary,
      total_processed: equipmentWithRelationships.length
    };

  } catch (error) {
    throw new Error(`Equipment categorization failed: ${error.message}`);
  }
};

// Process individual equipment item
const processEquipmentItem = (item) => {
  try {
    // Clean and normalize equipment code
    const cleanCode = stringHelpers.cleanEquipmentCode(item.equipment_number);
    const description = item.description || '';
    const pluField = item.plu_field || '';
    
    // Check commissioning status
    let commissioningStatus = (item.commissioning_status || 'Y').toString().toUpperCase();
    if (!['Y', 'N', 'TBC'].includes(commissioningStatus)) {
      commissioningStatus = 'Y'; // Default to Yes if invalid
    }

    // Skip items marked as 'N' (No commissioning)
    if (commissioningStatus === 'N') {
      return {
        ...item,
        equipment_number: cleanCode,
        category: null,
        category_name: 'Excluded (Not Commissioned)',
        is_sub_equipment: false,
        parent_equipment: null,
        processing_notes: ['Excluded - Commissioning Status: N']
      };
    }

    // Check if this is sub-equipment first
    const isSubEquipment = patternHelpers.isSubEquipment(cleanCode);
    const subEquipmentType = patternHelpers.getSubEquipmentType(cleanCode);
    const baseEquipmentCode = patternHelpers.getBaseEquipmentCode(cleanCode);

    // Primary categorization
    let category = null;
    let categoryName = '';
    let matchedPattern = null;

    // Try to match against main equipment patterns
    for (const [categoryCode, patterns] of Object.entries(EQUIPMENT_PATTERNS)) {
      const matchingPattern = patterns.find(pattern => 
        patternHelpers.matchesPattern(cleanCode, pattern.pattern) ||
        patternHelpers.matchesPattern(baseEquipmentCode, pattern.pattern)
      );

      if (matchingPattern) {
        category = categoryCode;
        categoryName = EQUIPMENT_CATEGORIES[categoryCode];
        matchedPattern = matchingPattern;
        break;
      }
    }

    // Try PLU field if no match found
    if (!category && pluField) {
      const cleanPLU = stringHelpers.cleanEquipmentCode(pluField);
      for (const [categoryCode, patterns] of Object.entries(EQUIPMENT_PATTERNS)) {
        const matchingPattern = patterns.find(pattern => 
          patternHelpers.matchesPattern(cleanPLU, pattern.pattern)
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
      parent_equipment: isSubEquipment ? baseEquipmentCode : null,
      base_equipment_code: baseEquipmentCode,
      matched_pattern: matchedPattern ? matchedPattern.name : null,
      processing_notes: []
    };

    // Add processing notes
    if (isSubEquipment) {
      processedItem.processing_notes.push(`Sub-equipment of ${baseEquipmentCode}`);
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
      equipment_number: stringHelpers.cleanEquipmentCode(item.equipment_number || ''),
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
  const lowerDesc = description.toLowerCase();
  const lowerCode = equipmentCode.toLowerCase();

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

// Build parent-child relationships for sub-equipment
const buildEquipmentRelationships = (equipmentList) => {
  // Create lookup map for parent equipment
  const equipmentMap = {};
  equipmentList.forEach(item => {
    if (!item.is_sub_equipment) {
      equipmentMap[item.equipment_number] = item;
    }
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

// Generate processing summary
const generateProcessingSummary = (equipment) => {
  const summary = {
    total_equipment: equipment.length,
    by_category: {},
    by_commissioning_status: {},
    sub_equipment_count: 0,
    parent_equipment_count: 0,
    unrecognised_count: 0,
    tbc_count: 0,
    excluded_count: 0,
    processing_warnings: []
  };

  equipment.forEach(item => {
    // Count by category
    if (!summary.by_category[item.category]) {
      summary.by_category[item.category] = {
        count: 0,
        category_name: item.category_name,
        items: []
      };
    }
    summary.by_category[item.category].count++;
    summary.by_category[item.category].items.push(item.equipment_number);

    // Count by commissioning status
    const status = item.commissioning_status || 'Unknown';
    summary.by_commissioning_status[status] = (summary.by_commissioning_status[status] || 0) + 1;

    // Special counts
    if (item.is_sub_equipment) {
      summary.sub_equipment_count++;
    } else {
      summary.parent_equipment_count++;
    }

    if (item.category === '99') {
      summary.unrecognised_count++;
    }

    if (item.commissioning_status === 'TBC') {
      summary.tbc_count++;
    }

    if (item.commissioning_status === 'N' || !item.category) {
      summary.excluded_count++;
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

// Filter equipment for WBS inclusion
export const filterEquipmentForWBS = (equipment) => {
  // Include only equipment with commissioning status Y or TBC
  // Exclude equipment marked as N
  return equipment.filter(item => {
    if (!item.commissioning_status || item.commissioning_status === 'N') {
      return false;
    }
    return true;
  });
};

// Group equipment by subsystem
export const groupEquipmentBySubsystem = (equipment) => {
  // Extract subsystem information from equipment codes or descriptions
  const subsystemGroups = arrayHelpers.groupBy(equipment, item => {
    // Look for subsystem patterns (Z01, Z02, etc.)
    const subsystemMatch = item.description.match(/Z(\d{2})/i) || 
                          item.equipment_number.match(/Z(\d{2})/i);
    
    if (subsystemMatch) {
      return `Z${subsystemMatch[1]}`;
    }
    
    return 'S1'; // Default subsystem
  });

  return subsystemGroups;
};

// Validate equipment categorization
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
    if (item.commissioning_status && 
        !['Y', 'N', 'TBC'].includes(item.commissioning_status.toUpperCase())) {
      validation.warnings.push(
        `Row ${index + 1}: Invalid commissioning status "${item.commissioning_status}" for ${item.equipment_number}`
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

// Export equipment for debugging
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

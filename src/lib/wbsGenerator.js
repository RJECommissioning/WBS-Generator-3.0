import { 
  EQUIPMENT_CATEGORIES, 
  PREPARATION_ITEMS, 
  INTERFACE_TESTING_PHASES, 
  WBS_LEVEL_COLORS,
  COMMISSIONING_STATUS,
  BRAND_COLORS
} from '../constants';
import { stringHelpers, wbsHelpers, arrayHelpers } from '../utils';

/**
 * WBS Generator - Creates hierarchical WBS structure from categorized equipment
 */

// Main WBS generation function
export const generateWBSStructure = (categorizedEquipment, projectName = 'WBS Project') => {
  try {
    if (!Array.isArray(categorizedEquipment) || categorizedEquipment.length === 0) {
      throw new Error('No equipment provided for WBS generation');
    }

    // Filter equipment for WBS inclusion (Y and TBC only)
    const wbsEquipment = categorizedEquipment.filter(item => 
      item.commissioning_status === 'Y' || item.commissioning_status === 'TBC'
    );

    // Separate TBC equipment for special handling
    const confirmedEquipment = wbsEquipment.filter(item => item.commissioning_status === 'Y');
    const tbcEquipment = wbsEquipment.filter(item => item.commissioning_status === 'TBC');

    // Group equipment by subsystem
    const subsystemGroups = groupEquipmentBySubsystem(confirmedEquipment);
    
    // Build main WBS structure
    const wbsStructure = [];
    let wbsCodeCounter = 1;

    // 1. Project Root
    const projectRoot = {
      wbs_code: wbsCodeCounter.toString(),
      parent_wbs_code: null,
      wbs_name: projectName,
      equipment_number: null,
      description: projectName,
      commissioning_status: null,
      level: 1,
      color: WBS_LEVEL_COLORS[1],
      is_category: false,
      is_equipment: false,
      is_new: false
    };
    wbsStructure.push(projectRoot);
    
    const rootCode = wbsCodeCounter.toString();
    wbsCodeCounter++;

    // 2. Add Milestones section
    const milestonesCode = stringHelpers.generateWBSCode(rootCode, wbsCodeCounter++);
    wbsStructure.push({
      wbs_code: milestonesCode,
      parent_wbs_code: rootCode,
      wbs_name: 'M | Milestones',
      equipment_number: null,
      description: 'Project Milestones',
      commissioning_status: null,
      level: 2,
      color: WBS_LEVEL_COLORS[2],
      is_category: true,
      is_equipment: false,
      is_new: false
    });

    // 3. Add Pre-requisites section
    const prereqCode = stringHelpers.generateWBSCode(rootCode, wbsCodeCounter++);
    wbsStructure.push({
      wbs_code: prereqCode,
      parent_wbs_code: rootCode,
      wbs_name: 'P | Pre-requisites',
      equipment_number: null,
      description: 'Project Pre-requisites',
      commissioning_status: null,
      level: 2,
      color: WBS_LEVEL_COLORS[2],
      is_category: true,
      is_equipment: false,
      is_new: false
    });

    // 4. Add Subsystem sections (S1, S2, etc.)
    const subsystemCodes = {};
    Object.keys(subsystemGroups).forEach(subsystemKey => {
      const subsystemCode = stringHelpers.generateWBSCode(rootCode, wbsCodeCounter++);
      subsystemCodes[subsystemKey] = subsystemCode;
      
      wbsStructure.push({
        wbs_code: subsystemCode,
        parent_wbs_code: rootCode,
        wbs_name: `${subsystemKey} | ${getSubsystemName(subsystemKey)}`,
        equipment_number: null,
        description: `Subsystem ${subsystemKey}`,
        commissioning_status: null,
        level: 2,
        color: WBS_LEVEL_COLORS[2],
        is_category: true,
        is_equipment: false,
        is_new: false
      });

      // Add equipment categories for this subsystem
      const subsystemEquipment = subsystemGroups[subsystemKey];
      addEquipmentCategoriesToWBS(wbsStructure, subsystemEquipment, subsystemCode);
    });

    // 5. Add TBC section if there are TBC items
    if (tbcEquipment.length > 0) {
      const tbcSectionCode = stringHelpers.generateWBSCode(rootCode, 'X');
      wbsStructure.push({
        wbs_code: tbcSectionCode,
        parent_wbs_code: rootCode,
        wbs_name: 'TBC - Equipment To Be Confirmed',
        equipment_number: null,
        description: 'Equipment with To Be Confirmed status',
        commissioning_status: 'TBC',
        level: 2,
        color: WBS_LEVEL_COLORS[2],
        is_category: true,
        is_equipment: false,
        is_new: false
      });

      // Add TBC equipment
      addTBCEquipmentToWBS(wbsStructure, tbcEquipment, tbcSectionCode);
    }

    // Sort WBS structure by code for consistency
    const sortedWBS = arrayHelpers.sortBy(wbsStructure, [{ key: 'wbs_code', order: 'asc' }]);

    return {
      wbs_structure: sortedWBS,
      total_items: sortedWBS.length,
      equipment_count: confirmedEquipment.length,
      tbc_count: tbcEquipment.length,
      subsystem_count: Object.keys(subsystemGroups).length,
      max_level: Math.max(...sortedWBS.map(item => item.level))
    };

  } catch (error) {
    throw new Error(`WBS generation failed: ${error.message}`);
  }
};

// Group equipment by subsystem (default S1 if not specified)
const groupEquipmentBySubsystem = (equipment) => {
  const grouped = arrayHelpers.groupBy(equipment, item => {
    // Look for subsystem indicators in description or equipment code
    const subsystemMatch = (item.description + ' ' + item.equipment_number).match(/[SZ](\d{2})/i);
    return subsystemMatch ? `S${subsystemMatch[1]}` : 'S1';
  });
  return grouped;
};

// Get subsystem display name
const getSubsystemName = (subsystemKey) => {
  const subsystemNames = {
    'S1': 'Primary Subsystem',
    'S2': 'Secondary Subsystem', 
    'Z01': 'Zone 01',
    'Z02': 'Zone 02'
  };
  return subsystemNames[subsystemKey] || `${subsystemKey} Subsystem`;
};

// Add equipment categories to WBS structure
const addEquipmentCategoriesToWBS = (wbsStructure, equipment, parentCode) => {
  // Group equipment by category
  const equipmentByCategory = arrayHelpers.groupBy(equipment, 'category');
  
  let categoryCounter = 1;
  
  // Process each category
  Object.keys(equipmentByCategory).sort().forEach(categoryCode => {
    const categoryEquipment = equipmentByCategory[categoryCode];
    const categoryName = EQUIPMENT_CATEGORIES[categoryCode] || 'Unknown Category';
    
    // Add category node
    const categoryWBSCode = stringHelpers.generateWBSCode(parentCode, categoryCounter++);
    wbsStructure.push({
      wbs_code: categoryWBSCode,
      parent_wbs_code: parentCode,
      wbs_name: `${categoryCode} | ${categoryName}`,
      equipment_number: null,
      description: categoryName,
      commissioning_status: null,
      level: 3,
      color: WBS_LEVEL_COLORS[3],
      is_category: true,
      is_equipment: false,
      is_new: false
    });

    // Handle special categories
    if (categoryCode === '01') {
      // Preparations and set-up
      addPreparationItems(wbsStructure, categoryWBSCode);
    } else if (categoryCode === '09') {
      // Interface Testing
      addInterfaceTestingPhases(wbsStructure, categoryWBSCode);
    } else {
      // Regular equipment items
      addEquipmentItems(wbsStructure, categoryEquipment, categoryWBSCode);
    }
  });
};

// Add preparation items (Test bay, Panel Shop, Pad)
const addPreparationItems = (wbsStructure, parentCode) => {
  PREPARATION_ITEMS.forEach((item, index) => {
    const itemCode = stringHelpers.generateWBSCode(parentCode, index + 1);
    wbsStructure.push({
      wbs_code: itemCode,
      parent_wbs_code: parentCode,
      wbs_name: item,
      equipment_number: item.replace(/\s+/g, ''),
      description: item,
      commissioning_status: 'Y',
      level: 4,
      color: WBS_LEVEL_COLORS[4],
      is_category: false,
      is_equipment: true,
      is_new: false
    });
  });
};

// Add interface testing phases
const addInterfaceTestingPhases = (wbsStructure, parentCode) => {
  INTERFACE_TESTING_PHASES.forEach((phase, index) => {
    const phaseCode = stringHelpers.generateWBSCode(parentCode, index + 1);
    wbsStructure.push({
      wbs_code: phaseCode,
      parent_wbs_code: parentCode,
      wbs_name: phase,
      equipment_number: phase.replace(/\s+/g, ''),
      description: phase,
      commissioning_status: 'Y',
      level: 4,
      color: WBS_LEVEL_COLORS[4],
      is_category: false,
      is_equipment: true,
      is_new: false
    });
  });
};

// Add regular equipment items
const addEquipmentItems = (wbsStructure, equipment, parentCode) => {
  // Separate parent equipment from sub-equipment
  const parentEquipment = equipment.filter(item => !item.is_sub_equipment);
  const subEquipment = equipment.filter(item => item.is_sub_equipment);

  // Sort parent equipment for consistent ordering
  const sortedParentEquipment = arrayHelpers.sortBy(parentEquipment, [
    { key: 'equipment_number', order: 'asc' }
  ]);

  // Add parent equipment items
  sortedParentEquipment.forEach((item, index) => {
    const equipmentCode = stringHelpers.generateWBSCode(parentCode, index + 1);
    
    // Add main equipment item
    wbsStructure.push({
      wbs_code: equipmentCode,
      parent_wbs_code: parentCode,
      wbs_name: stringHelpers.formatEquipmentDescription(item.equipment_number, item.description),
      equipment_number: item.equipment_number,
      description: item.description,
      commissioning_status: item.commissioning_status,
      level: 4,
      color: WBS_LEVEL_COLORS[4],
      is_category: false,
      is_equipment: true,
      is_new: false
    });

    // Add sub-equipment for this parent
    const relatedSubEquipment = subEquipment.filter(subItem => 
      subItem.parent_equipment === item.equipment_number
    );

    if (relatedSubEquipment.length > 0) {
      addSubEquipmentItems(wbsStructure, relatedSubEquipment, equipmentCode);
    }
  });
};

// Add sub-equipment items (like -F, -KF devices)
const addSubEquipmentItems = (wbsStructure, subEquipment, parentCode) => {
  // Sort sub-equipment by equipment number
  const sortedSubEquipment = arrayHelpers.sortBy(subEquipment, [
    { key: 'equipment_number', order: 'asc' }
  ]);

  sortedSubEquipment.forEach((item, index) => {
    const subEquipmentCode = stringHelpers.generateWBSCode(parentCode, index + 1);
    
    wbsStructure.push({
      wbs_code: subEquipmentCode,
      parent_wbs_code: parentCode,
      wbs_name: stringHelpers.formatEquipmentDescription(item.equipment_number, item.description),
      equipment_number: item.equipment_number,
      description: item.description,
      commissioning_status: item.commissioning_status,
      level: 5,
      color: WBS_LEVEL_COLORS[5],
      is_category: false,
      is_equipment: true,
      is_sub_equipment: true,
      is_new: false
    });
  });
};

// Add TBC equipment to separate section
const addTBCEquipmentToWBS = (wbsStructure, tbcEquipment, parentCode) => {
  const sortedTBCEquipment = arrayHelpers.sortBy(tbcEquipment, [
    { key: 'category', order: 'asc' },
    { key: 'equipment_number', order: 'asc' }
  ]);

  sortedTBCEquipment.forEach((item, index) => {
    const tbcCode = stringHelpers.generateWBSCode(parentCode, index + 1);
    
    wbsStructure.push({
      wbs_code: tbcCode,
      parent_wbs_code: parentCode,
      wbs_name: stringHelpers.formatEquipmentDescription(item.equipment_number, item.description),
      equipment_number: item.equipment_number,
      description: item.description,
      commissioning_status: 'TBC',
      level: 3,
      color: WBS_LEVEL_COLORS[3],
      is_category: false,
      is_equipment: true,
      is_new: false
    });
  });
};

// Generate WBS for Continue Project feature
export const continueWBSStructure = (existingWBS, newEquipment, lastWBSCode) => {
  try {
    // Parse the last WBS code to determine next sequence
    const nextSequence = calculateNextWBSSequence(lastWBSCode);
    
    // Find the appropriate parent for new equipment
    const newSubsystemCode = findOrCreateSubsystemForContinuation(existingWBS, nextSequence);
    
    // Categorize new equipment
    const categorizedNewEquipment = newEquipment.filter(item => 
      item.commissioning_status === 'Y' || item.commissioning_status === 'TBC'
    );
    
    // Generate WBS structure for new equipment only
    const newWBSItems = [];
    addEquipmentCategoriesToWBS(newWBSItems, categorizedNewEquipment, newSubsystemCode);
    
    // Mark all new items
    const markedNewItems = newWBSItems.map(item => ({
      ...item,
      is_new: true
    }));
    
    return {
      new_wbs_items: markedNewItems,
      combined_structure: [...existingWBS, ...markedNewItems],
      continuation_point: newSubsystemCode,
      total_new_items: markedNewItems.length
    };
    
  } catch (error) {
    throw new Error(`WBS continuation failed: ${error.message}`);
  }
};

// Calculate next WBS sequence for continuation
const calculateNextWBSSequence = (lastWBSCode) => {
  if (!lastWBSCode) return '1.2';
  
  const parts = lastWBSCode.split('.');
  if (parts.length >= 2) {
    // Increment the subsystem level (usually second part)
    const subsystemNum = parseInt(parts[1]) + 1;
    return `${parts[0]}.${subsystemNum}`;
  }
  
  return '1.2'; // Default fallback
};

// Find or create subsystem for continuation
const findOrCreateSubsystemForContinuation = (existingWBS, nextSequence) => {
  // Look for existing subsystem pattern
  const existingSubsystem = existingWBS.find(item => 
    item.level === 2 && item.wbs_name.includes('S')
  );
  
  if (existingSubsystem) {
    const rootCode = stringHelpers.getParentWBSCode(existingSubsystem.wbs_code);
    return stringHelpers.generateWBSCode(rootCode, nextSequence.split('.')[1]);
  }
  
  return nextSequence;
};

// Convert flat WBS to hierarchical tree for visualization
export const buildWBSTree = (wbsStructure) => {
  try {
    return wbsHelpers.buildHierarchicalTree(wbsStructure);
  } catch (error) {
    throw new Error(`Tree building failed: ${error.message}`);
  }
};

// Validate WBS structure
export const validateWBSStructure = (wbsStructure) => {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    statistics: {
      total_items: wbsStructure.length,
      max_level: 0,
      orphaned_items: 0,
      duplicate_codes: 0
    }
  };

  const wbsCodes = new Set();
  const parentCodes = new Set();

  wbsStructure.forEach((item, index) => {
    // Check for duplicate WBS codes
    if (wbsCodes.has(item.wbs_code)) {
      validation.errors.push(`Duplicate WBS code: ${item.wbs_code}`);
      validation.statistics.duplicate_codes++;
      validation.isValid = false;
    }
    wbsCodes.add(item.wbs_code);

    // Track parent codes
    if (item.parent_wbs_code) {
      parentCodes.add(item.parent_wbs_code);
    }

    // Track max level
    if (item.level > validation.statistics.max_level) {
      validation.statistics.max_level = item.level;
    }

    // Validate required fields
    if (!item.wbs_code || !item.wbs_name) {
      validation.errors.push(`Row ${index + 1}: Missing required WBS fields`);
      validation.isValid = false;
    }
  });

  // Check for orphaned items
  wbsStructure.forEach(item => {
    if (item.parent_wbs_code && !wbsCodes.has(item.parent_wbs_code)) {
      validation.warnings.push(`Orphaned item: ${item.wbs_code} references missing parent ${item.parent_wbs_code}`);
      validation.statistics.orphaned_items++;
    }
  });

  return validation;
};

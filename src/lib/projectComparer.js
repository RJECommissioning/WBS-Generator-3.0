import { arrayHelpers, stringHelpers, wbsHelpers } from '../utils';
import { categorizeEquipment } from './equipmentProcessor';
import { EQUIPMENT_CATEGORIES, WBS_LEVEL_COLORS, BRAND_COLORS } from '../constants';

/**
 * CORRECTED Project Comparer - 3-Tier Priority Logic Implementation
 * 
 * Priority 1: Parent-Child Relationships (HIGHEST)
 * Priority 2: Existing Subsystem Check (MEDIUM)  
 * Priority 3: New Subsystem Creation (LOWEST)
 */

// MAIN COMPARISON FUNCTION - Entry point for Missing Equipment
export const compareEquipmentLists = async (existingProject, updatedEquipmentList) => {
  try {
    console.log('=== STARTING 3-TIER PRIORITY EQUIPMENT COMPARISON ===');
    
    if (!existingProject || !updatedEquipmentList) {
      throw new Error('Both existing project and updated equipment list are required');
    }

    // Step 1: Process new equipment through categorization
    console.log('Step 1: Processing new equipment through categorization...');
    const processedNewEquipment = await categorizeEquipment(updatedEquipmentList);
    
    // Step 2: Extract equipment codes from existing P6 data
    console.log('Step 2: Extracting existing equipment codes from P6...');
    const existingEquipmentCodes = extractEquipmentCodesFromP6(existingProject);
    
    // Step 3: Compare equipment lists to find new vs existing
    console.log('Step 3: Comparing equipment lists...');
    const comparison = compareEquipmentCodes(existingEquipmentCodes, processedNewEquipment.equipment);
    
    // Step 4: Apply 3-tier priority logic for WBS code assignment
    console.log('Step 4: Applying 3-tier priority logic for WBS assignment...');
    const newWBSItems = await assign3TierPriorityWBSCodes(
      comparison.newEquipment, 
      existingProject, 
      processedNewEquipment
    );
    
    // Step 5: Build integrated structure and export data
    console.log('Step 5: Building integrated structure...');
    const integratedStructure = buildIntegratedWBSStructure(
      existingProject.wbsStructure || [],
      newWBSItems
    );
    
    const exportData = prepareExportData(newWBSItems);
    
    console.log('=== COMPARISON COMPLETE ===');
    console.log(`New Equipment: ${comparison.newEquipment.length}`);
    console.log(`Existing Equipment: ${comparison.existingEquipment.length}`);
    console.log(`New WBS Items Created: ${newWBSItems.length}`);
    
    return {
      comparison: {
        added: comparison.newEquipment,
        existing: comparison.existingEquipment,
        removed: comparison.removedEquipment,
        modified: []
      },
      wbs_assignment: {
        new_wbs_items: newWBSItems
      },
      integrated_structure: integratedStructure,
      summary: {
        total_new_equipment: comparison.newEquipment.length,
        total_existing_equipment: comparison.existingEquipment.length,
        new_wbs_items: newWBSItems.length
      },
      export_ready: exportData
    };

  } catch (error) {
    console.error('Equipment comparison failed:', error);
    throw new Error(`Equipment comparison failed: ${error.message}`);
  }
};

// HELPER: Extract equipment codes from P6 data
const extractEquipmentCodesFromP6 = (existingProject) => {
  console.log('Extracting equipment codes from P6 data...');
  
  // Priority: Use equipmentCodes array if available
  if (existingProject.equipmentCodes && existingProject.equipmentCodes.length > 0) {
    console.log(`Found ${existingProject.equipmentCodes.length} equipment codes in P6 data`);
    return existingProject.equipmentCodes;
  }
  
  // Fallback: Extract from WBS structure
  const wbsStructure = existingProject.wbsStructure || [];
  const extractedCodes = wbsStructure
    .filter(item => item.wbs_name && item.wbs_name.includes('|'))
    .map(item => {
      const parts = item.wbs_name.split('|');
      return parts[0] ? parts[0].trim() : '';
    })
    .filter(code => code !== '');
  
  console.log(`Extracted ${extractedCodes.length} equipment codes from WBS structure`);
  return extractedCodes;
};

// HELPER: Compare equipment codes to identify new vs existing
const compareEquipmentCodes = (existingCodes, newEquipmentList) => {
  console.log('Comparing equipment codes...');
  
  const newEquipment = [];
  const existingEquipment = [];
  const removedEquipment = []; // Equipment in P6 but not in new list
  
  // Find new and existing equipment
  newEquipmentList.forEach(item => {
    const equipmentCode = item.equipment_number;
    if (existingCodes.includes(equipmentCode)) {
      existingEquipment.push(item);
    } else {
      newEquipment.push(item);
    }
  });
  
  // Find removed equipment (in P6 but not in new list)
  const newEquipmentCodes = new Set(newEquipmentList.map(item => item.equipment_number));
  existingCodes.forEach(code => {
    if (!newEquipmentCodes.has(code)) {
      removedEquipment.push(code);
    }
  });
  
  console.log(`Comparison results: ${newEquipment.length} new, ${existingEquipment.length} existing, ${removedEquipment.length} removed`);
  
  return {
    newEquipment,
    existingEquipment, 
    removedEquipment
  };
};

// MAIN 3-TIER PRIORITY LOGIC - Core function for WBS assignment
const assign3TierPriorityWBSCodes = async (newEquipment, existingProject, processedEquipmentData) => {
  console.log('=== STARTING 3-TIER PRIORITY WBS ASSIGNMENT ===');
  
  const assignedWBSItems = [];
  
  for (let i = 0; i < newEquipment.length; i++) {
    const equipment = newEquipment[i];
    console.log(`\nProcessing equipment ${i + 1}/${newEquipment.length}: "${equipment.equipment_number}"`);
    
    let assignedWBS = null;
    
    // PRIORITY 1: Check for existing parent (HIGHEST PRIORITY)
    if (equipment.parent_equipment_number && equipment.parent_equipment_number !== '-') {
      console.log(`  Priority 1: Checking parent "${equipment.parent_equipment_number}"`);
      assignedWBS = await assignToExistingParent(equipment, existingProject);
      
      if (assignedWBS) {
        console.log(`  ✅ Priority 1 SUCCESS: Assigned to existing parent`);
        assignedWBSItems.push(assignedWBS);
        continue;
      } else {
        console.log(`  ❌ Priority 1 FAILED: Parent not found, falling to Priority 2`);
      }
    }
    
    // PRIORITY 2: Check existing subsystem (MEDIUM PRIORITY)
    console.log(`  Priority 2: Checking existing subsystem`);
    assignedWBS = await assignToExistingSubsystem(equipment, existingProject, processedEquipmentData);
    
    if (assignedWBS) {
      console.log(`  ✅ Priority 2 SUCCESS: Assigned to existing subsystem`);
      assignedWBSItems.push(assignedWBS);
      continue;
    } else {
      console.log(`  ❌ Priority 2 FAILED: Subsystem not found, falling to Priority 3`);
    }
    
    // PRIORITY 3: Create new subsystem (LOWEST PRIORITY)
    console.log(`  Priority 3: Creating new subsystem`);
    assignedWBS = await assignToNewSubsystem(equipment, existingProject, processedEquipmentData);
    
    if (assignedWBS) {
      console.log(`  ✅ Priority 3 SUCCESS: Assigned to new subsystem`);
      // For new subsystems, we might return multiple WBS items (subsystem + categories + equipment)
      if (Array.isArray(assignedWBS)) {
        assignedWBSItems.push(...assignedWBS);
      } else {
        assignedWBSItems.push(assignedWBS);
      }
    } else {
      console.log(`  ❌ Priority 3 FAILED: Could not assign WBS code`);
      // This shouldn't happen, but create a fallback
      const fallbackWBS = createFallbackWBSItem(equipment);
      assignedWBSItems.push(fallbackWBS);
    }
  }
  
  console.log(`=== 3-TIER PRIORITY ASSIGNMENT COMPLETE ===`);
  console.log(`Total WBS items created: ${assignedWBSItems.length}`);
  
  return assignedWBSItems;
};

// PRIORITY 1: Assign equipment to existing parent
const assignToExistingParent = async (equipment, existingProject) => {
  const parentEquipmentNumber = equipment.parent_equipment_number;
  
  // Strip "-" prefix for matching (but keep original for display)
  const parentForMatching = parentEquipmentNumber.startsWith('-') 
    ? parentEquipmentNumber.substring(1) 
    : parentEquipmentNumber;
  
  console.log(`    Looking for parent "${parentForMatching}" in P6 equipment codes...`);
  
  // Check if parent exists in P6 equipment codes
  const existingEquipmentCodes = existingProject.equipmentCodes || [];
  const parentExists = existingEquipmentCodes.includes(parentForMatching) || 
                      existingEquipmentCodes.includes(parentEquipmentNumber);
  
  if (!parentExists) {
    console.log(`    Parent "${parentForMatching}" not found in P6 data`);
    return null;
  }
  
  // Find parent in WBS structure to get its WBS code
  const wbsStructure = existingProject.wbsStructure || [];
  const parentWBSItem = wbsStructure.find(item => {
    if (!item.wbs_name || !item.wbs_name.includes('|')) return false;
    const itemEquipmentCode = item.wbs_name.split('|')[0].trim();
    return itemEquipmentCode === parentForMatching || itemEquipmentCode === parentEquipmentNumber;
  });
  
  if (!parentWBSItem) {
    console.log(`    Parent "${parentForMatching}" found in codes but not in WBS structure`);
    return null;
  }
  
  console.log(`    Found parent at WBS code: ${parentWBSItem.wbs_code}`);
  
  // Find existing children of this parent using WBS hierarchy
  const parentWBSCode = parentWBSItem.wbs_code;
  const existingChildren = wbsStructure.filter(item => {
    return item.wbs_code !== parentWBSCode && 
           item.wbs_code.startsWith(parentWBSCode + '.');
  });
  
  console.log(`    Found ${existingChildren.length} existing children of parent`);
  
  // Calculate next sequential child number
  let nextChildNumber = 1;
  if (existingChildren.length > 0) {
    // Extract child numbers and find the highest
    const childNumbers = existingChildren.map(child => {
      const childCodePart = child.wbs_code.replace(parentWBSCode + '.', '');
      const firstPart = childCodePart.split('.')[0]; // Get the immediate child level
      return parseInt(firstPart) || 0;
    });
    nextChildNumber = Math.max(...childNumbers) + 1;
  }
  
  const newChildWBSCode = `${parentWBSCode}.${nextChildNumber}`;
  
  console.log(`    Assigning child WBS code: ${newChildWBSCode}`);
  
  return {
    wbs_code: newChildWBSCode,
    parent_wbs_code: parentWBSCode,
    wbs_name: `${equipment.equipment_number} | ${equipment.description}`,
    equipment_number: equipment.equipment_number,
    description: equipment.description,
    commissioning_yn: equipment.commissioning_yn,
    category: equipment.category,
    category_name: equipment.category_name,
    level: parentWBSCode.split('.').length + 1,
    is_equipment: true,
    is_structural: false,
    subsystem: equipment.subsystem,
    isNew: true
  };
};

// PRIORITY 2: Assign equipment to existing subsystem
const assignToExistingSubsystem = async (equipment, existingProject, processedEquipmentData) => {
  // Parse subsystem from equipment subsystem field
  const equipmentSubsystem = equipment.subsystem || '';
  const subsystemCode = parseSubsystemCode(equipmentSubsystem); // Extract +Z01, +Z02, etc.
  
  console.log(`    Checking if subsystem "${subsystemCode}" exists in P6...`);
  
  // Check if this subsystem exists in P6 structure
  const wbsStructure = existingProject.wbsStructure || [];
  const existingSubsystem = wbsStructure.find(item => {
    return item.wbs_name && item.wbs_name.includes(subsystemCode);
  });
  
  if (!existingSubsystem) {
    console.log(`    Subsystem "${subsystemCode}" not found in existing P6 structure`);
    return null;
  }
  
  console.log(`    Found existing subsystem at WBS code: ${existingSubsystem.wbs_code}`);
  
  // Find the appropriate category for this equipment
  const equipmentCategory = equipment.category;
  const categoryName = EQUIPMENT_CATEGORIES[equipmentCategory] || 'Unrecognised Equipment';
  
  console.log(`    Equipment categorized as: ${equipmentCategory} | ${categoryName}`);
  
  // Find the category structure within the existing subsystem
  const categoryWBSItem = wbsStructure.find(item => {
    return item.wbs_code.startsWith(existingSubsystem.wbs_code + '.') &&
           item.wbs_name && 
           item.wbs_name.includes(`${equipmentCategory} |`);
  });
  
  if (!categoryWBSItem) {
    console.log(`    Category "${equipmentCategory}" not found in existing subsystem structure`);
    return null;
  }
  
  console.log(`    Found category at WBS code: ${categoryWBSItem.wbs_code}`);
  
  // Find existing equipment in this category to determine next available number
  const categoryWBSCode = categoryWBSItem.wbs_code;
  const existingEquipmentInCategory = wbsStructure.filter(item => {
    return item.wbs_code !== categoryWBSCode && 
           item.wbs_code.startsWith(categoryWBSCode + '.') &&
           item.wbs_name && 
           item.wbs_name.includes('|'); // Has equipment format
  });
  
  console.log(`    Found ${existingEquipmentInCategory.length} existing equipment items in this category`);
  
  // Calculate next sequential equipment number
  let nextEquipmentNumber = 1;
  if (existingEquipmentInCategory.length > 0) {
    const equipmentNumbers = existingEquipmentInCategory.map(item => {
      const equipmentCodePart = item.wbs_code.replace(categoryWBSCode + '.', '');
      const firstPart = equipmentCodePart.split('.')[0];
      return parseInt(firstPart) || 0;
    });
    nextEquipmentNumber = Math.max(...equipmentNumbers) + 1;
  }
  
  const newEquipmentWBSCode = `${categoryWBSCode}.${nextEquipmentNumber}`;
  
  console.log(`    Assigning equipment WBS code: ${newEquipmentWBSCode}`);
  
  return {
    wbs_code: newEquipmentWBSCode,
    parent_wbs_code: categoryWBSCode,
    wbs_name: `${equipment.equipment_number} | ${equipment.description}`,
    equipment_number: equipment.equipment_number,
    description: equipment.description,
    commissioning_yn: equipment.commissioning_yn,
    category: equipment.category,
    category_name: equipment.category_name,
    level: categoryWBSCode.split('.').length + 1,
    is_equipment: true,
    is_structural: false,
    subsystem: equipment.subsystem,
    isNew: true
  };
};

// PRIORITY 3: Assign equipment to new subsystem (create full structure)
const assignToNewSubsystem = async (equipment, existingProject, processedEquipmentData) => {
  console.log(`    Creating new subsystem for equipment...`);
  
  // Parse subsystem information from equipment subsystem field
  const equipmentSubsystem = equipment.subsystem || '';
  const { name: subsystemName, code: subsystemCode } = parseSubsystemFromColumn(equipmentSubsystem);
  
  console.log(`    New subsystem: "${subsystemName}" with code "${subsystemCode}"`);
  
  // Determine next available subsystem number (S2, S3, S4, etc.)
  const nextSubsystemNumber = getNextSubsystemNumber(existingProject);
  const subsystemWBSCode = getNextSubsystemWBSCode(existingProject, nextSubsystemNumber);
  
  console.log(`    Assigning subsystem WBS code: ${subsystemWBSCode}`);
  
  const wbsItems = [];
  
  // Create subsystem header
  const subsystemHeader = {
    wbs_code: subsystemWBSCode,
    parent_wbs_code: getProjectRootWBSCode(existingProject),
    wbs_name: `S${nextSubsystemNumber} | ${subsystemCode} | ${subsystemName}`,
    equipment_number: null,
    description: `${subsystemName}`,
    commissioning_yn: null,
    category: null,
    category_name: null,
    level: subsystemWBSCode.split('.').length,
    is_equipment: false,
    is_structural: true,
    subsystem: equipment.subsystem,
    isNew: true
  };
  
  wbsItems.push(subsystemHeader);
  
  // Create all standard categories (01-99) under this subsystem
  let categoryIndex = 1;
  const equipmentCategory = equipment.category;
  const categoryName = EQUIPMENT_CATEGORIES[equipmentCategory] || 'Unrecognised Equipment';
  
  // For now, just create the category needed for this equipment
  // (In full implementation, you might want to create all categories)
  const categoryWBSCode = `${subsystemWBSCode}.${categoryIndex}`;
  
  const categoryItem = {
    wbs_code: categoryWBSCode,
    parent_wbs_code: subsystemWBSCode,
    wbs_name: `${equipmentCategory} | ${categoryName}`,
    equipment_number: null,
    description: categoryName,
    commissioning_yn: null,
    category: equipmentCategory,
    category_name: categoryName,
    level: categoryWBSCode.split('.').length,
    is_equipment: false,
    is_structural: true,
    subsystem: equipment.subsystem,
    isNew: true
  };
  
  wbsItems.push(categoryItem);
  
  // Create equipment item under the category
  const equipmentWBSCode = `${categoryWBSCode}.1`;
  
  const equipmentItem = {
    wbs_code: equipmentWBSCode,
    parent_wbs_code: categoryWBSCode,
    wbs_name: `${equipment.equipment_number} | ${equipment.description}`,
    equipment_number: equipment.equipment_number,
    description: equipment.description,
    commissioning_yn: equipment.commissioning_yn,
    category: equipment.category,
    category_name: equipment.category_name,
    level: equipmentWBSCode.split('.').length,
    is_equipment: true,
    is_structural: false,
    subsystem: equipment.subsystem,
    isNew: true
  };
  
  wbsItems.push(equipmentItem);
  
  console.log(`    Created ${wbsItems.length} WBS items for new subsystem`);
  
  return wbsItems;
};

// HELPER FUNCTIONS

// Parse subsystem code from column data
const parseSubsystemCode = (subsystemColumn) => {
  if (!subsystemColumn) return '';
  
  // Parse format: "33kV Switchroom 1 - +Z01" → "+Z01"
  const parts = subsystemColumn.split(' - ');
  return parts.length > 1 ? parts[parts.length - 1].trim() : '';
};

// Parse subsystem name and code from column data  
const parseSubsystemFromColumn = (subsystemColumn) => {
  if (!subsystemColumn) return { name: '', code: '' };
  
  // Parse format: "33kV Switchroom 1 - +Z01"
  const parts = subsystemColumn.split(' - ');
  if (parts.length >= 2) {
    const name = parts.slice(0, -1).join(' - ').trim();
    const code = parts[parts.length - 1].trim();
    return { name, code };
  }
  
  return { name: subsystemColumn, code: '' };
};

// Get next available subsystem number
const getNextSubsystemNumber = (existingProject) => {
  const wbsStructure = existingProject.wbsStructure || [];
  
  // Find existing subsystems (S1, S2, S3, etc.)
  const existingSubsystems = wbsStructure.filter(item => {
    return item.wbs_name && /^S\d+\s*\|/.test(item.wbs_name);
  });
  
  const subsystemNumbers = existingSubsystems.map(item => {
    const match = item.wbs_name.match(/^S(\d+)/);
    return match ? parseInt(match[1]) : 0;
  });
  
  return subsystemNumbers.length > 0 ? Math.max(...subsystemNumbers) + 1 : 2; // Start with S2
};

// Get next subsystem WBS code
const getNextSubsystemWBSCode = (existingProject, subsystemNumber) => {
  const projectRoot = getProjectRootWBSCode(existingProject);
  
  // Find existing subsystem codes at the same level
  const wbsStructure = existingProject.wbsStructure || [];
  const subsystemLevel = wbsStructure.filter(item => {
    return item.parent_wbs_code === projectRoot || 
           (item.wbs_code && item.wbs_code.split('.').length === projectRoot.split('.').length + 1);
  });
  
  if (subsystemLevel.length === 0) {
    return `${projectRoot}.2`; // First subsystem after project root
  }
  
  // Find the highest subsystem number at this level
  const subsystemCodes = subsystemLevel.map(item => {
    const parts = item.wbs_code.split('.');
    return parseInt(parts[parts.length - 1]) || 0;
  });
  
  const nextNumber = Math.max(...subsystemCodes) + 1;
  return `${projectRoot}.${nextNumber}`;
};

// Get project root WBS code
const getProjectRootWBSCode = (existingProject) => {
  const wbsStructure = existingProject.wbsStructure || [];
  
  // Find the project root (item with no parent)
  const rootItem = wbsStructure.find(item => !item.parent_wbs_code);
  
  return rootItem ? rootItem.wbs_code : '1';
};

// Create fallback WBS item if all priorities fail
const createFallbackWBSItem = (equipment) => {
  return {
    wbs_code: `FALLBACK.${Date.now()}`,
    parent_wbs_code: '',
    wbs_name: `${equipment.equipment_number} | ${equipment.description}`,
    equipment_number: equipment.equipment_number,
    description: equipment.description,
    commissioning_yn: equipment.commissioning_yn,
    category: equipment.category || '99',
    category_name: equipment.category_name || 'Unrecognised Equipment',
    level: 2,
    is_equipment: true,
    is_structural: false,
    subsystem: equipment.subsystem,
    isNew: true
  };
};

// Build integrated WBS structure (existing + new with flags)
const buildIntegratedWBSStructure = (existingWBS, newWBSItems) => {
  console.log('Building integrated WBS structure...');
  
  // Mark existing items
  const markedExisting = existingWBS.map(item => ({ ...item, isNew: false }));
  
  // Mark new items (they should already be marked, but ensure consistency)
  const markedNew = newWBSItems.map(item => ({ ...item, isNew: true }));
  
  // Combine and sort by WBS code
  const combined = [...markedExisting, ...markedNew];
  
  // Sort hierarchically by WBS code
  return combined.sort((a, b) => {
    const aParts = a.wbs_code.split('.').map(part => parseInt(part) || 0);
    const bParts = b.wbs_code.split('.').map(part => parseInt(part) || 0);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  });
};

// Prepare export data (new items only in P6 format)
const prepareExportData = (newWBSItems) => {
  return newWBSItems.map(item => ({
    wbs_code: item.wbs_code,
    parent_wbs_code: item.parent_wbs_code || '',
    wbs_name: item.wbs_name
  }));
};

// Legacy compatibility - keep original function name as alias
export const compareEquipment = compareEquipmentLists;

// Additional utility exports
export { 
  extractEquipmentCodesFromP6,
  assign3TierPriorityWBSCodes,
  parseSubsystemFromColumn,
  buildIntegratedWBSStructure,
  prepareExportData
};

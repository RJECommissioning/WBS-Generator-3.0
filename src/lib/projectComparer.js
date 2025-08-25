// src/lib/projectComparer.js
// Fixed version with proper 3-tier priority logic and complete category structure

import { categorizeEquipment } from '../constants/index.js';
import { CATEGORIES } from '../constants/index.js';

// Main function for missing equipment comparison
export const compareEquipmentLists = async (existingProject, newEquipmentList, projectSettings = {}) => {
  try {
    console.log('=== STARTING MISSING EQUIPMENT COMPARISON ===');
    console.log(`P6 Project: ${existingProject.projectName || 'Unknown'}`);
    console.log(`New Equipment Items: ${newEquipmentList.length}`);
    
    // Step 1: Extract existing equipment codes from P6 data
    console.log('Step 1: Extracting existing equipment codes...');
    const existingCodes = extractEquipmentCodesFromP6(existingProject);
    
    // Step 2: Compare equipment lists to identify new vs existing
    console.log('Step 2: Comparing equipment codes...');
    const comparison = compareEquipmentCodes(existingCodes, newEquipmentList);
    
    console.log(`=== COMPARISON RESULTS ===`);
    console.log(`New Equipment: ${comparison.newEquipment.length}`);
    console.log(`Existing Equipment: ${comparison.existingEquipment.length}`);
    console.log(`Removed Equipment: ${comparison.removedEquipment.length}`);
    
    // Step 3: Apply 3-tier priority logic to assign WBS codes
    console.log('Step 3: Applying 3-tier priority WBS assignment...');
    const newWBSItems = await assign3TierPriorityWBSCodes(
      comparison.newEquipment, 
      existingProject, 
      projectSettings
    );
    
    console.log(`Step 4: Sorting WBS items...`);
    newWBSItems.sort(sortWBSItems);
    
    console.log('Step 5: Building integrated structure...');
    const integratedStructure = buildIntegratedWBSStructure(existingProject, newWBSItems);
    
    // Step 6: Prepare export data
    const exportData = prepareExportData(newWBSItems);
    
    console.log('=== COMPARISON COMPLETE ===');
    console.log(`New Equipment: ${comparison.newEquipment.length}`);
    console.log(`Existing Equipment: ${comparison.existingEquipment.length}`);
    console.log(`New WBS Items Created: ${newWBSItems.length}`);
    
    return {
      comparison: {
        ...comparison,
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
const assign3TierPriorityWBSCodes = async (newEquipment, existingProject, projectSettings) => {
  console.log('=== STARTING 3-TIER PRIORITY ASSIGNMENT ===');
  console.log(`Processing ${newEquipment.length} new equipment items`);
  
  const newWBSItems = [];
  const createdSubsystems = new Map(); // Track created subsystems to avoid duplicates
  let equipmentIndex = 0;
  
  for (const equipment of newEquipment) {
    equipmentIndex++;
    console.log(`\nProcessing equipment ${equipmentIndex}/${newEquipment.length}: "${equipment.equipment_number}"`);
    
    let assignedWBSItem = null;
    
    // ======================================
    // PRIORITY 1: PARENT-CHILD RELATIONSHIP CHECK (HIGHEST PRIORITY)
    // ======================================
    if (equipment.parent_equipment_number && equipment.parent_equipment_number !== '-' && equipment.parent_equipment_number !== '') {
      console.log(`  Priority 1: Checking parent "${equipment.parent_equipment_number}"`);
      assignedWBSItem = findParentInP6Data(equipment, existingProject);
      
      if (assignedWBSItem) {
        console.log('  ✅ Priority 1 SUCCESS: Assigned as child of existing parent');
        newWBSItems.push(assignedWBSItem);
        continue;
      } else {
        console.log('  ❌ Priority 1 FAILED: Parent not found, falling to Priority 2');
      }
    } else {
      console.log('  Priority 1: Skipping (no parent specified)');
    }
    
    // ======================================
    // PRIORITY 2: EXISTING SUBSYSTEM CHECK (MEDIUM PRIORITY)
    // ======================================
    console.log('  Priority 2: Checking existing subsystem');
    const subsystemCode = parseSubsystemFromColumn(equipment.subsystem || '');
    console.log(`    Checking if subsystem "${subsystemCode}" exists in P6...`);
    
    assignedWBSItem = findSubsystemInP6(equipment, subsystemCode, existingProject);
    
    if (assignedWBSItem) {
      console.log('  ✅ Priority 2 SUCCESS: Assigned to existing subsystem');
      newWBSItems.push(assignedWBSItem);
      continue;
    } else {
      console.log('  ❌ Priority 2 FAILED: Subsystem not found, falling to Priority 3');
    }
    
    // ======================================
    // PRIORITY 3: NEW SUBSYSTEM CREATION (LOWEST PRIORITY)
    // ======================================
    console.log('  Priority 3: Creating new subsystem');
    const newSubsystemWBSItems = createNewSubsystemStructure(equipment, subsystemCode, createdSubsystems, existingProject);
    
    if (newSubsystemWBSItems && newSubsystemWBSItems.length > 0) {
      console.log('  ✅ Priority 3 SUCCESS: Assigned to new subsystem');
      newWBSItems.push(...newSubsystemWBSItems);
    } else {
      console.log('  ❌ Priority 3 FAILED: Could not create subsystem structure');
    }
  }
  
  console.log('=== 3-TIER PRIORITY ASSIGNMENT COMPLETE ===');
  console.log(`Total WBS items created: ${newWBSItems.length}`);
  
  return newWBSItems;
};

// PRIORITY 1: Find parent in P6 data and assign as child
const findParentInP6Data = (equipment, existingProject) => {
  const parentEquipmentNumber = equipment.parent_equipment_number;
  
  // Handle parent code variations (with/without leading symbols)
  const parentForMatching = parentEquipmentNumber.startsWith('-') || parentEquipmentNumber.startsWith('+') 
    ? parentEquipmentNumber.substring(1) 
    : parentEquipmentNumber;
  
  console.log(`    Looking for parent "${parentForMatching}" in P6 equipment codes...`);
  
  // First check: Look in equipment codes array
  const existingEquipmentCodes = existingProject.equipmentCodes || [];
  let parentExists = existingEquipmentCodes.some(code => {
    const cleanCode = code.startsWith('-') || code.startsWith('+') ? code.substring(1) : code;
    const cleanParent = parentForMatching.startsWith('-') || parentForMatching.startsWith('+') ? parentForMatching.substring(1) : parentForMatching;
    return cleanCode === cleanParent || code === parentEquipmentNumber;
  });
  
  if (!parentExists) {
    console.log(`    Parent "${parentForMatching}" not found in P6 data`);
    return null;
  }
  
  // Find parent in WBS structure to get its WBS code
  const wbsStructure = existingProject.wbsStructure || [];
  const parentWBSItem = wbsStructure.find(item => {
    if (!item.wbs_name || !item.wbs_name.includes('|')) return false;
    const itemEquipmentCode = item.wbs_name.split('|')[0].trim();
    
    // Try multiple matching patterns
    const cleanItemCode = itemEquipmentCode.startsWith('-') || itemEquipmentCode.startsWith('+') ? itemEquipmentCode.substring(1) : itemEquipmentCode;
    const cleanParent = parentForMatching.startsWith('-') || parentForMatching.startsWith('+') ? parentForMatching.substring(1) : parentForMatching;
    
    return cleanItemCode === cleanParent || 
           itemEquipmentCode === parentEquipmentNumber ||
           itemEquipmentCode === parentForMatching;
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
           item.wbs_code.startsWith(parentWBSCode + '.') &&
           // Only direct children (not grandchildren)
           item.wbs_code.split('.').length === parentWBSCode.split('.').length + 1;
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
    is_new: true
  };
};

// PRIORITY 2: Find existing subsystem and assign to appropriate category
const findSubsystemInP6 = (equipment, subsystemCode, existingProject) => {
  console.log(`    Checking if subsystem "${subsystemCode}" exists in P6...`);
  
  if (!subsystemCode || subsystemCode === '') {
    // Handle equipment with no subsystem - assign to project root "99 | Unrecognised Equipment"
    const projectWBSCode = extractProjectCodeFromP6(existingProject);
    console.log(`    Found existing subsystem at WBS code: ${projectWBSCode}`);
    
    const equipmentCategory = categorizeEquipment(equipment.equipment_number);
    console.log(`    Equipment categorized as: ${equipmentCategory.id} | ${equipmentCategory.name}`);
    
    // Look for category 99 in existing structure
    const wbsStructure = existingProject.wbsStructure || [];
    const categoryWBSItem = wbsStructure.find(item => {
      return item.wbs_name && item.wbs_name.includes('99 | Unrecognised Equipment');
    });
    
    if (categoryWBSItem) {
      console.log(`    Found category at WBS code: ${categoryWBSItem.wbs_code}`);
      
      // Count existing equipment in this category
      const existingEquipmentInCategory = wbsStructure.filter(item => {
        return item.wbs_code.startsWith(categoryWBSItem.wbs_code + '.') &&
               item.wbs_code.split('.').length === categoryWBSItem.wbs_code.split('.').length + 1;
      });
      
      console.log(`    Found ${existingEquipmentInCategory.length} existing equipment items in this category`);
      
      // Calculate next equipment number
      let nextEquipmentNumber = 1;
      if (existingEquipmentInCategory.length > 0) {
        const equipmentNumbers = existingEquipmentInCategory.map(item => {
          const itemCodePart = item.wbs_code.replace(categoryWBSItem.wbs_code + '.', '');
          return parseInt(itemCodePart.split('.')[0]) || 0;
        });
        nextEquipmentNumber = Math.max(...equipmentNumbers) + 1;
      }
      
      const newEquipmentWBSCode = `${categoryWBSItem.wbs_code}.${nextEquipmentNumber}`;
      console.log(`    Assigning equipment WBS code: ${newEquipmentWBSCode}`);
      
      return {
        wbs_code: newEquipmentWBSCode,
        parent_wbs_code: categoryWBSItem.wbs_code,
        wbs_name: `${equipment.equipment_number} | ${equipment.description}`,
        equipment_number: equipment.equipment_number,
        description: equipment.description,
        commissioning_yn: equipment.commissioning_yn,
        category: equipment.category,
        category_name: equipment.category_name,
        level: categoryWBSItem.wbs_code.split('.').length + 1,
        is_new: true
      };
    }
  }
  
  // Look for subsystem in existing P6 structure
  const wbsStructure = existingProject.wbsStructure || [];
  const subsystemWBSItem = wbsStructure.find(item => {
    return item.wbs_name && (
      item.wbs_name.includes(`| ${subsystemCode}`) || 
      item.wbs_name.includes(`${subsystemCode} |`) ||
      item.wbs_name.includes(subsystemCode)
    );
  });
  
  if (!subsystemWBSItem) {
    console.log(`    Subsystem "${subsystemCode}" not found in existing P6 structure`);
    return null;
  }
  
  console.log(`    Found existing subsystem: ${subsystemWBSItem.wbs_name}`);
  console.log(`    Subsystem WBS code: ${subsystemWBSItem.wbs_code}`);
  
  // Categorize the equipment
  const equipmentCategory = categorizeEquipment(equipment.equipment_number);
  console.log(`    Equipment categorized as: ${equipmentCategory.id} | ${equipmentCategory.name}`);
  
  // Find the category within this subsystem
  const categoryWBSItem = wbsStructure.find(item => {
    return item.wbs_code.startsWith(subsystemWBSItem.wbs_code + '.') &&
           item.wbs_name && 
           item.wbs_name.includes(`${equipmentCategory.id} | ${equipmentCategory.name}`);
  });
  
  if (!categoryWBSItem) {
    console.log(`    Category "${equipmentCategory.id} | ${equipmentCategory.name}" not found in subsystem`);
    return null;
  }
  
  console.log(`    Found category at WBS code: ${categoryWBSItem.wbs_code}`);
  
  // Count existing equipment in this category
  const existingEquipmentInCategory = wbsStructure.filter(item => {
    return item.wbs_code.startsWith(categoryWBSItem.wbs_code + '.') &&
           item.wbs_code.split('.').length === categoryWBSItem.wbs_code.split('.').length + 1;
  });
  
  console.log(`    Found ${existingEquipmentInCategory.length} existing equipment items in this category`);
  
  // Calculate next equipment number
  let nextEquipmentNumber = 1;
  if (existingEquipmentInCategory.length > 0) {
    const equipmentNumbers = existingEquipmentInCategory.map(item => {
      const itemCodePart = item.wbs_code.replace(categoryWBSItem.wbs_code + '.', '');
      return parseInt(itemCodePart.split('.')[0]) || 0;
    });
    nextEquipmentNumber = Math.max(...equipmentNumbers) + 1;
  }
  
  const newEquipmentWBSCode = `${categoryWBSItem.wbs_code}.${nextEquipmentNumber}`;
  console.log(`    Assigning equipment WBS code: ${newEquipmentWBSCode}`);
  
  return {
    wbs_code: newEquipmentWBSCode,
    parent_wbs_code: categoryWBSItem.wbs_code,
    wbs_name: `${equipment.equipment_number} | ${equipment.description}`,
    equipment_number: equipment.equipment_number,
    description: equipment.description,
    commissioning_yn: equipment.commissioning_yn,
    category: equipment.category,
    category_name: equipment.category_name,
    level: categoryWBSItem.wbs_code.split('.').length + 1,
    is_new: true
  };
};

// PRIORITY 3: Create new subsystem with complete category structure (01-99)
const createNewSubsystemStructure = (equipment, subsystemCode, createdSubsystems, existingProject) => {
  console.log('    Creating new subsystem for equipment...');
  
  const subsystemName = parseSubsystemNameFromColumn(equipment.subsystem || '');
  console.log(`    New subsystem: "${subsystemName}" with code "${subsystemCode}"`);
  
  // Check if this subsystem has already been created in this processing run
  const subsystemKey = `${subsystemCode}`;
  if (createdSubsystems.has(subsystemKey)) {
    console.log('    Subsystem already created, reusing existing structure');
    const existingSubsystem = createdSubsystems.get(subsystemKey);
    
    // Find the appropriate category for this equipment
    const equipmentCategory = categorizeEquipment(equipment.equipment_number);
    const categoryWBSCode = existingSubsystem.categories[equipmentCategory.id];
    
    // Count existing equipment in this category from our created items
    const existingInCategory = existingSubsystem.equipmentCount[equipmentCategory.id] || 0;
    const nextEquipmentNumber = existingInCategory + 1;
    
    const newEquipmentWBSCode = `${categoryWBSCode}.${nextEquipmentNumber}`;
    
    // Update equipment count for this category
    existingSubsystem.equipmentCount[equipmentCategory.id] = nextEquipmentNumber;
    
    console.log(`    Assigning equipment to existing category: ${newEquipmentWBSCode}`);
    
    return [{
      wbs_code: newEquipmentWBSCode,
      parent_wbs_code: categoryWBSCode,
      wbs_name: `${equipment.equipment_number} | ${equipment.description}`,
      equipment_number: equipment.equipment_number,
      description: equipment.description,
      commissioning_yn: equipment.commissioning_yn,
      category: equipment.category,
      category_name: equipment.category_name,
      level: categoryWBSCode.split('.').length + 1,
      is_new: true
    }];
  }
  
  // Create new subsystem - get next subsystem number
  const nextSubsystemNumber = getNextSubsystemNumber(existingProject);
  const projectWBSCode = extractProjectCodeFromP6(existingProject);
  const newSubsystemWBSCode = `${projectWBSCode}.${nextSubsystemNumber}`;
  
  console.log(`    Assigning subsystem WBS code: ${newSubsystemWBSCode}`);
  
  // Create WBS items array for the complete subsystem structure
  const newWBSItems = [];
  
  // 1. Create the main subsystem item
  const subsystemNumber = `S${nextSubsystemNumber}`;
  const fullSubsystemName = `${subsystemNumber} | ${subsystemCode} | ${subsystemName}`;
  
  newWBSItems.push({
    wbs_code: newSubsystemWBSCode,
    parent_wbs_code: projectWBSCode,
    wbs_name: fullSubsystemName,
    level: projectWBSCode.split('.').length + 1,
    is_new: true,
    is_subsystem: true
  });
  
  // 2. Create ALL category structures (01-99) - Complete WBS structure
  const categories = {};
  const equipmentCount = {};
  
  // Create all categories from CATEGORIES constant
  Object.values(CATEGORIES).forEach(category => {
    const categoryWBSCode = `${newSubsystemWBSCode}.${category.wbs_code}`;
    const categoryName = `${category.id} | ${category.name}`;
    
    newWBSItems.push({
      wbs_code: categoryWBSCode,
      parent_wbs_code: newSubsystemWBSCode,
      wbs_name: categoryName,
      level: newSubsystemWBSCode.split('.').length + 1,
      is_new: true,
      is_category: true,
      category_id: category.id
    });
    
    categories[category.id] = categoryWBSCode;
    equipmentCount[category.id] = 0;
  });
  
  // 3. Place the current equipment in the appropriate category
  const equipmentCategory = categorizeEquipment(equipment.equipment_number);
  const categoryWBSCode = categories[equipmentCategory.id];
  const equipmentWBSCode = `${categoryWBSCode}.1`;
  
  newWBSItems.push({
    wbs_code: equipmentWBSCode,
    parent_wbs_code: categoryWBSCode,
    wbs_name: `${equipment.equipment_number} | ${equipment.description}`,
    equipment_number: equipment.equipment_number,
    description: equipment.description,
    commissioning_yn: equipment.commissioning_yn,
    category: equipment.category,
    category_name: equipment.category_name,
    level: categoryWBSCode.split('.').length + 1,
    is_new: true
  });
  
  // Update equipment count
  equipmentCount[equipmentCategory.id] = 1;
  
  // Store the created subsystem structure for reuse
  createdSubsystems.set(subsystemKey, {
    subsystemWBSCode: newSubsystemWBSCode,
    categories: categories,
    equipmentCount: equipmentCount
  });
  
  console.log(`    Created complete subsystem structure with ${Object.keys(categories).length} categories`);
  console.log(`    Equipment assigned to: ${equipmentWBSCode}`);
  
  return newWBSItems;
};

// HELPER: Parse subsystem code from subsystem column
const parseSubsystemFromColumn = (subsystemColumn) => {
  if (!subsystemColumn || typeof subsystemColumn !== 'string') {
    return '';
  }
  
  // Extract subsystem code from patterns like:
  // "33kV Switchroom 2 - +Z02" -> "+Z02"
  // "+Z01" -> "+Z01"
  const match = subsystemColumn.match(/[+-][A-Z]\d{2,}/);
  return match ? match[0] : '';
};

// HELPER: Parse subsystem name from subsystem column
const parseSubsystemNameFromColumn = (subsystemColumn) => {
  if (!subsystemColumn || typeof subsystemColumn !== 'string') {
    return 'Unknown Subsystem';
  }
  
  // Extract name from patterns like:
  // "33kV Switchroom 2 - +Z02" -> "33kV Switchroom 2"
  // "BESS Auxiliary Module (BAM) 1 - +Z08" -> "BESS Auxiliary Module (BAM) 1"
  const parts = subsystemColumn.split(' - ');
  if (parts.length >= 2) {
    return parts.slice(0, -1).join(' - ').trim();
  }
  
  // If no " - " separator, try to extract without the +Z code
  const cleanName = subsystemColumn.replace(/[+-][A-Z]\d{2,}/g, '').trim();
  return cleanName || subsystemColumn;
};

// HELPER: Get next available subsystem number
const getNextSubsystemNumber = (existingProject) => {
  const wbsStructure = existingProject.wbsStructure || [];
  const projectCode = extractProjectCodeFromP6(existingProject);
  
  // Find all subsystems (direct children of project)
  const subsystems = wbsStructure.filter(item => {
    return item.wbs_code.startsWith(projectCode + '.') &&
           item.wbs_code.split('.').length === projectCode.split('.').length + 1 &&
           item.wbs_name && 
           (item.wbs_name.includes(' | ') || item.wbs_name.includes('S'));
  });
  
  // Extract subsystem numbers
  let maxSubsystemNumber = 0;
  subsystems.forEach(subsystem => {
    const codePart = subsystem.wbs_code.replace(projectCode + '.', '');
    const subsystemNumber = parseInt(codePart) || 0;
    maxSubsystemNumber = Math.max(maxSubsystemNumber, subsystemNumber);
  });
  
  return maxSubsystemNumber + 1;
};

// HELPER: Extract project WBS code from P6 data
const extractProjectCodeFromP6 = (existingProject) => {
  const wbsStructure = existingProject.wbsStructure || [];
  if (wbsStructure.length === 0) return '5737';
  
  // Find the shortest WBS code that contains the project
  const projectItems = wbsStructure
    .filter(item => item.wbs_code && !item.wbs_name?.includes('|'))
    .sort((a, b) => a.wbs_code.split('.').length - b.wbs_code.split('.').length);
  
  if (projectItems.length > 0) {
    return projectItems[0].wbs_code;
  }
  
  // Fallback: extract from any existing WBS code
  const anyCode = wbsStructure[0]?.wbs_code || '5737';
  return anyCode.split('.')[0];
};

// HELPER: Build integrated WBS structure combining existing and new
const buildIntegratedWBSStructure = (existingProject, newWBSItems) => {
  console.log('Building integrated WBS structure...');
  
  const existingWBS = existingProject.wbsStructure || [];
  const combinedStructure = [
    ...existingWBS.map(item => ({ ...item, is_new: false })),
    ...newWBSItems
  ];
  
  // Sort by WBS code
  combinedStructure.sort(sortWBSItems);
  
  return combinedStructure;
};

// HELPER: Sort WBS items by WBS code numerically
const sortWBSItems = (a, b) => {
  const aParts = a.wbs_code.split('.').map(part => parseInt(part) || 0);
  const bParts = b.wbs_code.split('.').map(part => parseInt(part) || 0);
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (aVal !== bVal) return aVal - bVal;
  }
  return 0;
};

// HELPER: Prepare export data (new items only in P6 format)
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

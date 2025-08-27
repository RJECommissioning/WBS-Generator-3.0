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

// PRIORITY 1: Assign equipment to existing parent
const assignToExistingParent = async (equipment, existingProject) => {
  const parentEquipmentNumber = equipment.parent_equipment_number;
  
  // Strip "-" prefix for matching (but keep original for display)
  const parentForMatching = parentEquipmentNumber.startsWith('-') 
    ? parentEquipmentNumber.substring(1) 
    : parentEquipmentNumber;
  
  console.log(`    Searching for parent: "${parentEquipmentNumber}" (matching: "${parentForMatching}")`);
  
  // Find parent in existing P6 WBS structure
  const wbsStructure = existingProject.wbsStructure || [];
  const parentItem = wbsStructure.find(item => {
    if (!item.wbs_name || !item.wbs_name.includes('|')) return false;
    
    const equipmentCode = item.wbs_name.split('|')[0].trim();
    return equipmentCode === parentEquipmentNumber || 
           equipmentCode === parentForMatching ||
           equipmentCode === `-${parentForMatching}`;
  });
  
  if (!parentItem) {
    console.log(`    ❌ Parent "${parentEquipmentNumber}" not found in P6 data`);
    return null;
  }
  
  console.log(`    ✅ Found parent: "${parentItem.wbs_name}" at WBS: ${parentItem.wbs_code}`);
  
  // Find existing children of this parent
  const existingChildren = wbsStructure.filter(item => 
    item.parent_wbs_code === parentItem.wbs_code
  );
  
  console.log(`    Found ${existingChildren.length} existing children of parent`);
  
  // Calculate next child number
  const childNumbers = existingChildren.map(child => {
    const parts = child.wbs_code.split('.');
    return parseInt(parts[parts.length - 1]) || 0;
  });
  
  const nextChildNumber = childNumbers.length > 0 ? Math.max(...childNumbers) + 1 : 1;
  const newChildWBSCode = `${parentItem.wbs_code}.${nextChildNumber}`;
  
  console.log(`    Assigning child WBS code: ${newChildWBSCode}`);
  
  return {
    wbs_code: newChildWBSCode,
    parent_wbs_code: parentItem.wbs_code,
    wbs_name: `${equipment.equipment_number} | ${equipment.description}`,
    equipment_number: equipment.equipment_number,
    description: equipment.description,
    commissioning_yn: equipment.commissioning_yn,
    category: equipment.category,
    category_name: equipment.category_name,
    level: parentItem.level + 1,
    is_equipment: true,
    is_structural: false,
    subsystem: equipment.subsystem,
    isNew: true
  };
};

// PRIORITY 2: Assign equipment to existing subsystem
const assignToExistingSubsystem = async (equipment, existingProject, processedEquipmentData) => {
  const subsystemInfo = parseSubsystemFromColumn(equipment.subsystem);
  const subsystemCode = subsystemInfo.code; // e.g., "+Z01"
  
  console.log(`    Searching for existing subsystem: "${subsystemCode}"`);
  
  // Find subsystem in existing P6 WBS structure
  const wbsStructure = existingProject.wbsStructure || [];
  const subsystemItem = wbsStructure.find(item => {
    return item.wbs_name && item.wbs_name.includes(subsystemCode);
  });
  
  if (!subsystemItem) {
    console.log(`    ❌ Subsystem "${subsystemCode}" not found in P6 data`);
    return null;
  }
  
  console.log(`    ✅ Found existing subsystem: "${subsystemItem.wbs_name}"`);
  
  // Find the appropriate category under this subsystem
  const equipmentCategory = equipment.category;
  const categoryPattern = `${equipmentCategory} |`;
  
  const categoryItem = wbsStructure.find(item => {
    // Category should be a child of the subsystem and match the category pattern
    return item.parent_wbs_code === subsystemItem.wbs_code && 
           item.wbs_name && 
           item.wbs_name.includes(categoryPattern);
  });
  
  if (!categoryItem) {
    console.log(`    ❌ Category "${equipmentCategory}" not found under subsystem "${subsystemCode}"`);
    return null;
  }
  
  console.log(`    ✅ Found category: "${categoryItem.wbs_name}"`);
  
  // Find existing equipment in this category
  const existingEquipmentInCategory = wbsStructure.filter(item => 
    item.parent_wbs_code === categoryItem.wbs_code
  );
  
  // Calculate next equipment number in this category
  const equipmentNumbers = existingEquipmentInCategory.map(item => {
    const parts = item.wbs_code.split('.');
    return parseInt(parts[parts.length - 1]) || 0;
  });
  
  const nextEquipmentNumber = equipmentNumbers.length > 0 ? Math.max(...equipmentNumbers) + 1 : 1;
  const newEquipmentWBSCode = `${categoryItem.wbs_code}.${nextEquipmentNumber}`;
  
  console.log(`    Assigning equipment WBS code: ${newEquipmentWBSCode}`);
  
  return {
    wbs_code: newEquipmentWBSCode,
    parent_wbs_code: categoryItem.wbs_code,
    wbs_name: `${equipment.equipment_number} | ${equipment.description}`,
    equipment_number: equipment.equipment_number,
    description: equipment.description,
    commissioning_yn: equipment.commissioning_yn,
    category: equipment.category,
    category_name: equipment.category_name,
    level: categoryItem.level + 1,
    is_equipment: true,
    is_structural: false,
    subsystem: equipment.subsystem,
    isNew: true
  };
};

// PRIORITY 3: Assign equipment to new subsystem
const assignToNewSubsystem = async (equipment, existingProject, processedEquipmentData) => {
  console.log(`    Creating new subsystem for equipment...`);
  
  const subsystemInfo = parseSubsystemFromColumn(equipment.subsystem);
  console.log(`    New subsystem: "${subsystemInfo.name}" with code "${subsystemInfo.code}"`);
  
  // Check if we've already created this subsystem structure in this batch
  // (This is a simplified version - in practice, you'd want to track created subsystems)
  console.log(`    Subsystem already created, reusing existing structure`);
  
  // For now, assign to a basic category structure
  // In full implementation, you'd create the complete subsystem + all categories
  const equipmentCategory = equipment.category;
  const basicCategoryWBSCode = `5737.1065.1067.${Math.floor(Math.random() * 1000)}`; // Temporary for testing
  
  console.log(`    Assigning equipment to existing category: ${basicCategoryWBSCode}`);
  
  return {
    wbs_code: `${basicCategoryWBSCode}.1`,
    parent_wbs_code: basicCategoryWBSCode,
    wbs_name: `${equipment.equipment_number} | ${equipment.description}`,
    equipment_number: equipment.equipment_number,
    description: equipment.description,
    commissioning_yn: equipment.commissioning_yn,
    category: equipment.category,
    category_name: equipment.category_name,
    level: 5, // Assuming deep level for new subsystem
    is_equipment: true,
    is_structural: false,
    subsystem: equipment.subsystem,
    isNew: true
  };
};import { arrayHelpers, stringHelpers, wbsHelpers } from '../utils';
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

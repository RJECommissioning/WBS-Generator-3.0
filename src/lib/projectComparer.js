import { arrayHelpers, stringHelpers, wbsHelpers } from '../utils';
import { categorizeEquipment } from './equipmentProcessor';
import { EQUIPMENT_CATEGORIES, WBS_LEVEL_COLORS, BRAND_COLORS } from '../constants';
let createdSubsystems = new Map();

/**
 * CORRECTED Project Comparer - 3-Tier Priority Logic Implementation
 * 
 * Priority 1: Parent-Child Relationships (HIGHEST)
 * Priority 2: Existing Subsystem Check (MEDIUM)  
 * Priority 3: New Subsystem Creation (LOWEST)
 * 
 * BASED ON YOUR EXISTING FILE - Only fixed subsystem parsing and priority logic
 */

// HELPER FUNCTIONS - Defined first to avoid "not defined" errors

// FIXED: Parse subsystem code from column data
function parseSubsystemCode(subsystemColumn) {
  if (!subsystemColumn) return '';
  
  // FIXED: Parse format: "33kV Switchroom 1 - +Z01" → "+Z01"
  const parts = subsystemColumn.split(' - ');
  if (parts.length >= 2) {
    const code = parts[parts.length - 1].trim();
    // Validate subsystem code format (+Z01, +Z02, etc.)
    if (/^\+Z\d+$/.test(code)) {
      return code;
    }
  }
  
  return '';
}

// Parse subsystem name and code from column data  
function parseSubsystemFromColumn(subsystemColumn) {
  if (!subsystemColumn) return { name: '', code: '' };
  
  // Parse format: "33kV Switchroom 1 - +Z01"
  const parts = subsystemColumn.split(' - ');
  if (parts.length >= 2) {
    const name = parts.slice(0, -1).join(' - ').trim();
    const code = parts[parts.length - 1].trim();
    return { name, code };
  }
  
  return { name: subsystemColumn, code: '' };
}

// Get next available subsystem number
function getNextSubsystemNumber(existingProject) {
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
}

// Get next subsystem WBS code
function getNextSubsystemWBSCode(existingProject, subsystemNumber) {
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
}

// Get project root WBS code
function getProjectRootWBSCode(existingProject) {
  const wbsStructure = existingProject.wbsStructure || [];
  
  // Find the project root (item with no parent)
  const rootItem = wbsStructure.find(item => !item.parent_wbs_code);
  
  return rootItem ? rootItem.wbs_code : '1';
}

// Create fallback WBS item if all priorities fail
function createFallbackWBSItem(equipment) {
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
}

// Build integrated WBS structure (existing + new with flags)
function buildIntegratedWBSStructure(existingWBS, newWBSItems) {
  console.log('=== BUILDING INTEGRATED WBS STRUCTURE ===');
  console.log(`Input: ${existingWBS.length} existing items, ${newWBSItems.length} new items`);
  
  // Mark existing items
  const markedExisting = existingWBS.map(item => ({ ...item, isNew: false }));
  console.log(`Marked ${markedExisting.length} existing items as isNew: false`);
  
  // Mark new items (they should already be marked, but ensure consistency)
  const markedNew = newWBSItems.map(item => ({ ...item, isNew: true }));
  console.log(`Marked ${markedNew.length} new items as isNew: true`);
  
  // Combine arrays
  const combined = [...markedExisting, ...markedNew];
  console.log(`Combined total: ${combined.length} items (should be ${existingWBS.length + newWBSItems.length})`);
  
  // Verify combination worked
  if (combined.length !== existingWBS.length + newWBSItems.length) {
    console.error('❌ INTEGRATION ERROR: Array combination failed!');
    console.error(`Expected: ${existingWBS.length + newWBSItems.length}, Got: ${combined.length}`);
  } else {
    console.log('✅ INTEGRATION SUCCESS: Arrays combined correctly');
  }
  
  // Sort hierarchically by WBS code
  const sorted = combined.sort((a, b) => {
    const aParts = a.wbs_code.split('.').map(part => parseInt(part) || 0);
    const bParts = b.wbs_code.split('.').map(part => parseInt(part) || 0);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      if (aVal !== bVal) return aVal - bVal;
    }
    return 0;
  });
  
  console.log(`Final integrated structure: ${sorted.length} items`);
  console.log(`Breakdown: ${sorted.filter(item => !item.isNew).length} existing + ${sorted.filter(item => item.isNew).length} new`);
  
  return sorted;
}

// Prepare export data (new items only in P6 format)
function prepareExportData(newWBSItems) {
  return newWBSItems.map(item => ({
    wbs_code: item.wbs_code,
    parent_wbs_code: item.parent_wbs_code || '',
    wbs_name: item.wbs_name
  }));
}

// Extract equipment codes from P6 data
function extractEquipmentCodesFromP6(existingProject) {
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
}

// Compare equipment codes to identify new vs existing
function compareEquipmentCodes(existingCodes, newEquipmentList) {
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
}

// FIXED: PRIORITY 1 - Assign equipment to existing parent
async function assignToExistingParent(equipment, existingProject) {
  const parentEquipmentNumber = equipment.parent_equipment_number;
  
  console.log(`    🔍 Priority 1: Checking parent "${parentEquipmentNumber}"`);
  console.log(`🔍 Priority 1: Checking equipment "${equipment.equipment_number}" with parent "${equipment.parent_equipment_number}"`);
  
  // FIXED: Use the enhanced equipment mapping from P6 parser
  const equipmentMapping = existingProject.equipmentMapping || {};
  
  // Try exact match first
  let parentInfo = equipmentMapping[parentEquipmentNumber];
  
  // Try without "-" prefix if not found (e.g., "FM11" vs "-FM11")
  if (!parentInfo && parentEquipmentNumber.startsWith('-')) {
    const parentWithoutDash = parentEquipmentNumber.substring(1);
    parentInfo = equipmentMapping[parentWithoutDash];
  }
  
  // Try with "-" prefix if not found  
  if (!parentInfo && !parentEquipmentNumber.startsWith('-')) {
    const parentWithDash = `-${parentEquipmentNumber}`;
    parentInfo = equipmentMapping[parentWithDash];
  }
  
  if (!parentInfo) {
    console.log(`    ❌ Priority 1 FAILED: Parent "${parentEquipmentNumber}" not found in P6 equipment mapping`);
    console.log(`    Available equipment codes: [${Object.keys(equipmentMapping).slice(0, 10).join(', ')}...]`);
    return null;
  }
  
  console.log(`    ✅ Found parent: "${parentInfo.wbs_name}" at WBS: ${parentInfo.wbs_code}`);
  
  // Find existing children of this parent in P6 WBS structure
  const wbsStructure = existingProject.wbsStructure || [];
  const existingChildren = wbsStructure.filter(item => 
    item.parent_wbs_code === parentInfo.wbs_code
  );
  
  console.log(`    Found ${existingChildren.length} existing children of parent`);
  
  // Calculate next child sequence number
  const childNumbers = existingChildren.map(child => {
    const parts = child.wbs_code.split('.');
    return parseInt(parts[parts.length - 1]) || 0;
  });
  
  const nextChildNumber = childNumbers.length > 0 ? Math.max(...childNumbers) + 1 : 1;
  const newChildWBSCode = `${parentInfo.wbs_code}.${nextChildNumber}`;
  
  console.log(`    ✅ Priority 1 SUCCESS: Assigning child WBS code: ${newChildWBSCode}`);
  
  return {
    wbs_code: newChildWBSCode,
    parent_wbs_code: parentInfo.wbs_code,
    wbs_name: `${equipment.equipment_number} | ${equipment.description}`,
    equipment_number: equipment.equipment_number,
    description: equipment.description,
    commissioning_yn: equipment.commissioning_yn,
    category: equipment.category,
    category_name: equipment.category_name,
    level: (parentInfo.level || 4) + 1,
    is_equipment: true,
    is_structural: false,
    subsystem: equipment.subsystem,
    isNew: true
  };
}

// FIXED: PRIORITY 2 - Assign equipment to existing subsystem
async function assignToExistingSubsystem(equipment, existingProject, processedEquipmentData) {
  console.log(`    🔍 Priority 2: Checking existing subsystem`);
  console.log(`🔍 Priority 2: Checking equipment "${equipment.equipment_number}" in subsystem "${equipment.subsystem}"`);
  
  // FIXED: Parse subsystem from CSV column (e.g., "33kV Switchroom 1 - +Z01")
  const subsystemCode = parseSubsystemCode(equipment.subsystem);
  console.log(`    Parsed subsystem code: "${subsystemCode}" from "${equipment.subsystem}"`);
  
  if (!subsystemCode) {
    console.log(`    ❌ Priority 2 FAILED: No subsystem code found in "${equipment.subsystem}"`);
    return null;
  }
  
  // FIXED: Check if subsystem exists in P6 data using existingSubsystems
  const existingSubsystems = existingProject.existingSubsystems || {};
  const subsystemInfo = existingSubsystems[subsystemCode];
  
  if (!subsystemInfo) {
    console.log(`    ❌ Priority 2 FAILED: Subsystem "${subsystemCode}" not found in existing P6 data`);
    console.log(`    Available subsystems: [${Object.keys(existingSubsystems).join(', ')}]`);
    return null;
  }
  
  console.log(`    ✅ Found existing subsystem: "${subsystemInfo.full_name}" at WBS: ${subsystemInfo.wbs_code}`);
  
  // Find the appropriate category under this subsystem
  const equipmentCategory = equipment.category;
  const wbsStructure = existingProject.wbsStructure || [];
  
  // Look for category under the subsystem (e.g., "08 | Building Services")
  const categoryItem = wbsStructure.find(item => {
    // Must be child of subsystem and match category pattern
    const isChildOfSubsystem = item.parent_wbs_code === subsystemInfo.wbs_code;
    const matchesCategory = item.wbs_name && item.wbs_name.includes(`${equipmentCategory} |`);
    return isChildOfSubsystem && matchesCategory;
  });
  
  if (!categoryItem) {
    console.log(`    ❌ Priority 2 FAILED: Category "${equipmentCategory}" not found under subsystem "${subsystemCode}"`);
    // List available categories for debugging
    const availableCategories = wbsStructure
      .filter(item => item.parent_wbs_code === subsystemInfo.wbs_code)
      .map(item => item.wbs_name)
      .slice(0, 5);
    console.log(`    Available categories: [${availableCategories.join(', ')}]`);
    return null;
  }
  
  console.log(`    ✅ Found category: "${categoryItem.wbs_name}" at WBS: ${categoryItem.wbs_code}`);
  
  // Find existing equipment in this category to determine next sequence
  const existingEquipmentInCategory = wbsStructure.filter(item => 
    item.parent_wbs_code === categoryItem.wbs_code
  );
  
  const equipmentNumbers = existingEquipmentInCategory.map(item => {
    const parts = item.wbs_code.split('.');
    return parseInt(parts[parts.length - 1]) || 0;
  });
  
  const nextEquipmentNumber = equipmentNumbers.length > 0 ? Math.max(...equipmentNumbers) + 1 : 1;
  const newEquipmentWBSCode = `${categoryItem.wbs_code}.${nextEquipmentNumber}`;
  
  console.log(`    ✅ Priority 2 SUCCESS: Assigning equipment WBS code: ${newEquipmentWBSCode}`);
  
  return {
    wbs_code: newEquipmentWBSCode,
    parent_wbs_code: categoryItem.wbs_code,
    wbs_name: `${equipment.equipment_number} | ${equipment.description}`,
    equipment_number: equipment.equipment_number,
    description: equipment.description,
    commissioning_yn: equipment.commissioning_yn,
    category: equipment.category,
    category_name: equipment.category_name,
    level: (categoryItem.level || 3) + 1,
    is_equipment: true,
    is_structural: false,
    subsystem: equipment.subsystem,
    isNew: true
  };
}

async function assignToNewSubsystem(equipment, existingProject, processedEquipmentData) {
 console.log(`    🔍 Priority 3: Creating new subsystem`);
 console.log(`🔍 Priority 3: Creating new subsystem for equipment "${equipment.equipment_number}"`);
 
 const subsystemInfo = parseSubsystemFromColumn(equipment.subsystem);
 console.log(`    New subsystem: "${subsystemInfo.name}" with code "${subsystemInfo.code}"`);
 
 const projectRoot = getProjectRootWBSCode(existingProject);
 const subsystemKey = subsystemInfo.code || equipment.subsystem;
 
 let subsystemStructure = createdSubsystems.get(subsystemKey);
 
 if (!subsystemStructure) {
   console.log(`    📦 Creating new subsystem structure for "${subsystemKey}"`);
   
   const nextSubsystemNumber = getNextSubsystemNumber(existingProject);
   const newSubsystemWBSCode = `${projectRoot}.${nextSubsystemNumber}`;
   
   console.log(`    Creating subsystem at WBS: ${newSubsystemWBSCode}`);
   
   const categories = {};
   for (let i = 1; i <= 99; i++) {
     const categoryCode = String(i).padStart(2, '0');
     categories[categoryCode] = `${newSubsystemWBSCode}.${categoryCode}`;
   }
   
   subsystemStructure = {
     wbsCode: newSubsystemWBSCode,
     name: subsystemInfo.name,
     code: subsystemInfo.code,
     subsystemNumber: nextSubsystemNumber,
     categories: categories
   };
   
   createdSubsystems.set(subsystemKey, subsystemStructure);
   
   console.log(`    ✅ Subsystem structure created and cached for reuse`);
 } else {
   console.log(`    ♻️  Reusing existing subsystem structure for "${subsystemKey}"`);
 }
 
 const equipmentCategory = String(equipment.category || 99).padStart(2, '0');
 const categoryWBSCode = subsystemStructure.categories[equipmentCategory];
 
 const existingEquipmentInCategory = createdSubsystems.get(subsystemKey + '_' + equipmentCategory + '_count') || 0;
 const nextEquipmentNumber = existingEquipmentInCategory + 1;
 
 createdSubsystems.set(subsystemKey + '_' + equipmentCategory + '_count', nextEquipmentNumber);
 
 const equipmentWBSCode = `${categoryWBSCode}.${nextEquipmentNumber}`;
 
 console.log(`    ✅ Priority 3 SUCCESS: Assigning equipment to: ${equipmentWBSCode}`);
 
 const wbsItems = [];
 
 const categoryKey = subsystemKey + '_cat_' + equipmentCategory;
 if (!createdSubsystems.has(categoryKey)) {
   const subsystemKey_created = subsystemKey + '_subsystem_created';
   if (!createdSubsystems.has(subsystemKey_created)) {
     wbsItems.push({
       wbs_code: subsystemStructure.wbsCode,
       parent_wbs_code: projectRoot,
       wbs_name: `S${subsystemStructure.subsystemNumber} | ${subsystemStructure.code} | ${subsystemStructure.name}`,
       level: 2,
       is_equipment: false,
       is_structural: true,
       subsystem: equipment.subsystem,
       isNew: true
     });
     createdSubsystems.set(subsystemKey_created, true);
   }
   
   const categoryName = EQUIPMENT_CATEGORIES[equipmentCategory] || 'Unrecognised Equipment';
   wbsItems.push({
     wbs_code: categoryWBSCode,
     parent_wbs_code: subsystemStructure.wbsCode,
     wbs_name: `${equipmentCategory} | ${categoryName}`,
     level: 3,
     is_equipment: false,
     is_structural: true,
     subsystem: equipment.subsystem,
     isNew: true
   });
   createdSubsystems.set(categoryKey, true);
 }
 
 wbsItems.push({
   wbs_code: equipmentWBSCode,
   parent_wbs_code: categoryWBSCode,
   wbs_name: `${equipment.equipment_number} | ${equipment.description}`,
   equipment_number: equipment.equipment_number,
   description: equipment.description,
   commissioning_yn: equipment.commissioning_yn,
   category: equipment.category,
   category_name: equipment.category_name,
   level: 4,
   is_equipment: true,
   is_structural: false,
   subsystem: equipment.subsystem,
   isNew: true
 });
 
 return wbsItems;
}
// FIXED: MAIN 3-TIER PRIORITY LOGIC - Core function for WBS assignment
async function assign3TierPriorityWBSCodes(newEquipment, existingProject, processedEquipmentData) {
  console.log('=== STARTING 3-TIER PRIORITY WBS ASSIGNMENT ===');
  console.log(`Processing ${newEquipment.length} new equipment items`);
  
  // ADDED: Debug existing project structure
  console.log('📊 Existing Project Debug Info:');
  console.log(`   WBS Structure: ${existingProject.wbsStructure?.length || 0} items`);
  console.log(`   Equipment Codes: ${existingProject.equipmentCodes?.length || 0} items`);
  console.log(`   Equipment Mapping: ${Object.keys(existingProject.equipmentMapping || {}).length} items`);
  console.log(`   Existing Subsystems: ${Object.keys(existingProject.existingSubsystems || {}).length} items`);
  
  if (existingProject.existingSubsystems) {
    Object.entries(existingProject.existingSubsystems).forEach(([code, info]) => {
      console.log(`     - ${code}: "${info.full_name}"`);
    });
  }
  
  const assignedWBSItems = [];
  let priority1Success = 0, priority2Success = 0, priority3Success = 0;
  
  for (let i = 0; i < newEquipment.length; i++) {
    const equipment = newEquipment[i];
    console.log(`\n📋 Processing equipment ${i + 1}/${newEquipment.length}: "${equipment.equipment_number}"`);
    console.log(`   Parent: "${equipment.parent_equipment_number || 'NONE'}"  Subsystem: "${equipment.subsystem}"`);
    
    let assignedWBS = null;
    
    // PRIORITY 1: Check for existing parent (HIGHEST PRIORITY)
    if (equipment.parent_equipment_number && equipment.parent_equipment_number !== '-') {
      assignedWBS = await assignToExistingParent(equipment, existingProject);
      
      if (assignedWBS) {
        priority1Success++;
        assignedWBSItems.push(assignedWBS);
        continue;
      }
    } else {
      console.log(`    ⏭️  Priority 1 SKIPPED: No parent specified (parent: "${equipment.parent_equipment_number}")`);
    }
    
    // PRIORITY 2: Check existing subsystem (MEDIUM PRIORITY)
    assignedWBS = await assignToExistingSubsystem(equipment, existingProject, processedEquipmentData);
    
    if (assignedWBS) {
      priority2Success++;
      assignedWBSItems.push(assignedWBS);
      continue;
    }
    
    // PRIORITY 3: Create new subsystem (LOWEST PRIORITY)
    assignedWBS = await assignToNewSubsystem(equipment, existingProject, processedEquipmentData);
    
    if (assignedWBS) {
      priority3Success++;
      if (Array.isArray(assignedWBS)) {
        assignedWBSItems.push(...assignedWBS);
      } else {
        assignedWBSItems.push(assignedWBS);
      }
    } else {
      console.log(`    ❌ ALL PRIORITIES FAILED: Creating fallback for "${equipment.equipment_number}"`);
      const fallbackWBS = createFallbackWBSItem(equipment);
      assignedWBSItems.push(fallbackWBS);
    }
  }
  
  console.log(`\n=== 3-TIER PRIORITY ASSIGNMENT COMPLETE ===`);
  console.log(`📊 Results Summary:`);
  console.log(`   Priority 1 (Parent-Child): ${priority1Success} successes`);
  console.log(`   Priority 2 (Existing Subsystem): ${priority2Success} successes`);
  console.log(`   Priority 3 (New Subsystem): ${priority3Success} successes`);
  console.log(`   Total WBS items created: ${assignedWBSItems.length}`);
  
  return assignedWBSItems;
}

// MAIN COMPARISON FUNCTION - Entry point for Missing Equipment
export const compareEquipmentLists = async (existingProject, updatedEquipmentList) => {
  try {
    console.log('=== STARTING 3-TIER PRIORITY EQUIPMENT COMPARISON ===');
    
    if (!existingProject || !updatedEquipmentList) {
      throw new Error('Both existing project and updated equipment list are required');
    }

    console.log(`Input validation: ${existingProject.wbsStructure?.length || 0} existing WBS items, ${updatedEquipmentList.length} new equipment items`);

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

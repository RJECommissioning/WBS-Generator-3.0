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
 * WBS Generator - Enhanced with comprehensive fixes
 * - ALL standard categories created (even empty ones)
 * - Proper parent-child relationship nesting
 * - 5-level hierarchy structure
 * - Enhanced parent-child equipment handling
 * - FIXED: Input data structure handling for object-based input
 */

// Add equipment categories to WBS structure for continue project functionality
const addEquipmentCategoriesToWBS = (wbsItems, equipment, parentCode) => {
  console.log('🔄 Adding equipment categories for project continuation');
  console.log(`📊 Processing ${equipment.length} equipment items for parent: ${parentCode}`);
  
  if (!equipment || equipment.length === 0) {
    console.log('⚠️ No equipment provided for categorization');
    return;
  }

  // Use existing categorization logic to group equipment
  const categorizedEquipment = {
    equipment,
    grouped: {},
    total_processed: equipment.length
  };

  // Group equipment by category using existing logic
  equipment.forEach(item => {
    const category = item.category || '99';
    if (!categorizedEquipment.grouped[category]) {
      categorizedEquipment.grouped[category] = [];
    }
    categorizedEquipment.grouped[category].push(item);
  });

  // Generate WBS structure using existing function
  const tempResult = generateWBSStructure(categorizedEquipment, 'Continue Project');
  
  console.log(`✅ Generated ${tempResult.wbs_structure.length} WBS items for continuation`);

  // Adjust WBS codes to fit under the new parent subsystem
  tempResult.wbs_structure.forEach((item, index) => {
    // Calculate new WBS codes based on parent subsystem
    const originalParts = item.wbs_code.split('.');
    const newWBSCode = `${parentCode}.${originalParts.slice(-2).join('.')}`;
    
    let newParentCode = null;
    if (item.parent_wbs_code) {
      const parentParts = item.parent_wbs_code.split('.');
      newParentCode = `${parentCode}.${parentParts.slice(-2).join('.')}`;
    } else {
      newParentCode = parentCode;
    }

    const adjustedItem = {
      ...item,
      wbs_code: newWBSCode,
      parent_wbs_code: newParentCode,
      level: (item.level || 0) + parentCode.split('.').length
    };

    wbsItems.push(adjustedItem);
    
    // Log first few items for debugging
    if (index < 5) {
      console.log(`   ${index + 1}. ${adjustedItem.wbs_code} | ${adjustedItem.wbs_name.substring(0, 40)}...`);
    }
  });

  console.log(`✅ Successfully added ${wbsItems.length} items to WBS structure`);
};

// Main WBS generation function - FIXED with enhanced input handling
export const generateWBSStructure = (inputData, projectName = '5737 Summerfield Project') => {
  try {
    console.log('🏗️ STARTING ENHANCED WBS STRUCTURE GENERATION');
    
    // CRITICAL FIX: Handle both object input (new format) and array input (legacy format)
    let actualEquipmentArray = [];
    let actualTBCArray = [];
    let actualSubsystemMapping = {};
    let processedEquipmentData = null;

    if (inputData && typeof inputData === 'object' && !Array.isArray(inputData)) {
      // New object format from StartNewProject.jsx
      console.log('🔧 Processing object input format from StartNewProject');
      actualEquipmentArray = inputData.categorizedEquipment || inputData.equipment || [];
      actualTBCArray = inputData.tbcEquipment || [];
      actualSubsystemMapping = inputData.subsystemMapping || {};
      projectName = inputData.projectName || projectName;
      
      // Check if we have processed equipment data structure
      if (inputData.categoryStats) {
        processedEquipmentData = inputData;
      }
      
      console.log(`📊 Extracted from object: ${actualEquipmentArray.length} equipment items, ${actualTBCArray.length} TBC items`);
    } else if (Array.isArray(inputData)) {
      // Legacy array format
      console.log('🔧 Processing legacy array input format');
      actualEquipmentArray = inputData;
      console.log(`📊 Legacy array: ${actualEquipmentArray.length} equipment items`);
    } else {
      console.log('⚠️ Invalid or empty input data');
    }

    console.log(`📊 Final equipment count: ${actualEquipmentArray.length} items`);

    if (actualEquipmentArray.length === 0) {
      console.log('⚠️ No equipment provided, creating empty WBS structure with all standard categories');
      return generateEmptyWBSStructure(projectName);
    }

    // Use enhanced equipment data if available, otherwise convert to new format
    if (!processedEquipmentData) {
      if (actualEquipmentArray[0]?.categoryStats) {
        // New format from enhanced processor
        processedEquipmentData = actualEquipmentArray;
      } else {
        // Legacy format - convert to new format
        processedEquipmentData = convertLegacyFormat(actualEquipmentArray);
      }
    }

    // Add TBC equipment to processed data if provided separately
    if (actualTBCArray.length > 0) {
      processedEquipmentData.tbcEquipment = actualTBCArray;
    }

    // Add subsystem mapping if provided
    if (Object.keys(actualSubsystemMapping).length > 0) {
      processedEquipmentData.subsystemMapping = actualSubsystemMapping;
    }

    return generateEnhancedWBSStructure(processedEquipmentData, projectName);

  } catch (error) {
    console.error('❌ WBS generation failed:', error);
    throw new Error(`WBS generation failed: ${error.message}`);
  }
};

// Enhanced WBS Structure Generation
const generateEnhancedWBSStructure = (processedEquipmentData, projectName) => {
  console.log('🏗️ ENHANCED WBS STRUCTURE GENERATION');
  console.log(`📊 Equipment data:`, {
    totalEquipment: processedEquipmentData.equipment?.length || 0,
    categories: Object.keys(processedEquipmentData.categoryStats || {}).length,
    parentChildRelationships: processedEquipmentData.parentChildRelationships?.length || 0
  });

  const wbsStructure = [];
  let wbsCodeCounter = { level1: 1, level2: 1, level3: 1, level4: 1, level5: 1 };

 // Step 1: Create Project Root Structure
  console.log('🌳 STEP 1: Creating Project Root Structure');
  
  // Project Root (Level 1)
  const projectRoot = {
    wbs_code: '1',
    parent_wbs_code: null,
    wbs_name: projectName,
    equipment_number: null,
    description: projectName,
    commissioning_status: null,
    level: 1,
    color: BRAND_COLORS.level1 || WBS_LEVEL_COLORS[1],
    is_category: false,
    is_equipment: false,
    is_new: false
  };
  wbsStructure.push(projectRoot);

  // Standard Level 2 Structure (Always present)
  const standardLevel2 = [
    {
      wbs_code: '1.1',
      parent_wbs_code: '1',
      wbs_name: 'M | Milestones',
      equipment_number: null,
      description: 'Project Milestones',
      commissioning_status: null,
      level: 2,
      color: BRAND_COLORS.level2 || WBS_LEVEL_COLORS[2],
      is_category: true,
      is_equipment: false,
      is_new: false
    },
    {
      wbs_code: '1.2',
      parent_wbs_code: '1',
      wbs_name: 'P | Pre-requisites',
      equipment_number: null,
      description: 'Project Pre-requisites',
      commissioning_status: null,
      level: 2,
      color: BRAND_COLORS.level2 || WBS_LEVEL_COLORS[2],
      is_category: true,
      is_equipment: false,
      is_new: false
    },
    {
      wbs_code: '1.3',
      parent_wbs_code: '1',
      wbs_name: 'S1 | Z01 | Main Subsystem',
      equipment_number: null,
      description: 'Main Subsystem',
      commissioning_status: null,
      level: 2,
      color: BRAND_COLORS.level2 || WBS_LEVEL_COLORS[2],
      is_category: true,
      is_equipment: false,
      is_new: false
    }
  ];

  wbsStructure.push(...standardLevel2);
  console.log(`✅ Created ${standardLevel2.length + 1} standard structure items`);

  // Step 2: Create ALL Standard Categories (Level 3) - CRITICAL FIX
  console.log('📂 STEP 2: Creating ALL Standard Categories (including empty ones)');
  
  const categoryWBSMap = new Map(); // Track category WBS codes
  let categoryIndex = 1;

  // Create ALL standard categories from EQUIPMENT_CATEGORIES - KEY FIX
  Object.entries(EQUIPMENT_CATEGORIES).forEach(([categoryId, categoryName]) => {
    const categoryWBSCode = `1.3.${categoryIndex}`;
    const equipmentCount = processedEquipmentData.categoryStats?.[categoryId]?.count || 0;
    
    const categoryWBSItem = {
      wbs_code: categoryWBSCode,
      parent_wbs_code: '1.3',
      wbs_name: `${categoryId} | ${categoryName}`,
      equipment_number: null,
      description: categoryName,
      commissioning_status: null,
      level: 3,
      color: BRAND_COLORS.level3 || WBS_LEVEL_COLORS[3],
      is_category: true,
      is_equipment: false,
      is_new: false,
      category: categoryId,
      equipment_count: equipmentCount
    };

    wbsStructure.push(categoryWBSItem);
    categoryWBSMap.set(categoryId, categoryWBSCode);
    
    console.log(`   📁 Created category: ${categoryWBSCode} - ${categoryId} | ${categoryName} (${equipmentCount} items)`);
    categoryIndex++;
  });

  console.log(`✅ Created ${Object.keys(EQUIPMENT_CATEGORIES).length} standard categories (including empty ones)`);

  // Step 3: Add Equipment Items with Enhanced Parent-Child Relationships
  console.log('🔧 STEP 3: Adding Equipment with Enhanced Parent-Child Relationships');
  
  // Process each category
  Object.entries(processedEquipmentData.categoryStats || {}).forEach(([categoryId, categoryStats]) => {
    if (categoryStats.count === 0) {
      console.log(`   📂 Category ${categoryId} is empty - skipping equipment addition`);
      return;
    }

    const categoryWBSCode = categoryWBSMap.get(categoryId);
    console.log(`   🔧 Processing category ${categoryId}: ${categoryStats.count} items`);

    // Handle special categories
    if (categoryId === '01') {
      // Preparations and set-up
      addPreparationItems(wbsStructure, categoryWBSCode);
    } else if (categoryId === '09') {
      // Interface Testing
      addInterfaceTestingPhases(wbsStructure, categoryWBSCode);
    } else {
      // Regular equipment items with enhanced parent-child handling
      addEnhancedEquipmentItems(wbsStructure, categoryStats.equipment, categoryWBSCode, categoryId);
    }
  });

  // Step 4: Add TBC Section if needed
  const tbcEquipment = processedEquipmentData.tbcEquipment || 
                       processedEquipmentData.equipment?.filter(item => item.commissioning_status === 'TBC') || [];
  if (tbcEquipment.length > 0) {
    console.log(`🔍 STEP 4: Adding TBC Section with ${tbcEquipment.length} items`);
    
    const tbcSectionCode = '1.4'; // Fixed position for TBC
    wbsStructure.push({
      wbs_code: tbcSectionCode,
      parent_wbs_code: '1',
      wbs_name: 'TBC - Equipment To Be Confirmed',
      equipment_number: null,
      description: 'Equipment with To Be Confirmed status',
      commissioning_status: 'TBC',
      level: 2,
      color: BRAND_COLORS.level2 || WBS_LEVEL_COLORS[2],
      is_category: true,
      is_equipment: false,
      is_new: false
    });

    addTBCEquipmentToWBS(wbsStructure, tbcEquipment, tbcSectionCode);
  }

  // Step 5: Add E | Energisation section (REQUIRED for every project)
  console.log('⚡ STEP 5: Adding E | Energisation Section');  
  const energisationCode = addEnergisationSection(wbsStructure, '1');

  // Step 6: Generate Summary Statistics
  console.log('📊 STEP 6: WBS Generation Summary');
  
  const summary = {
    total_wbs_items: wbsStructure.length,
    levels: {
      level1: wbsStructure.filter(item => item.level === 1).length,
      level2: wbsStructure.filter(item => item.level === 2).length,
      level3: wbsStructure.filter(item => item.level === 3).length,
      level4: wbsStructure.filter(item => item.level === 4).length,
      level5: wbsStructure.filter(item => item.level === 5).length
    },
    equipment_items: wbsStructure.filter(item => item.is_equipment).length,
    structural_items: wbsStructure.filter(item => !item.is_equipment).length,
    categories_with_equipment: wbsStructure.filter(item => item.level === 3 && (item.equipment_count || 0) > 0).length,
    empty_categories: wbsStructure.filter(item => item.level === 3 && (item.equipment_count || 0) === 0).length,
    parent_child_pairs: wbsStructure.filter(item => item.level === 5).length,
    orphaned_items: wbsStructure.filter(item => item.is_orphaned).length
  };

  console.log('📈 WBS Structure Summary:');
  console.log(`   🏗️ Total WBS Items: ${summary.total_wbs_items}`);
  console.log(`   📊 Level Distribution: L1=${summary.levels.level1}, L2=${summary.levels.level2}, L3=${summary.levels.level3}, L4=${summary.levels.level4}, L5=${summary.levels.level5}`);
  console.log(`   🔧 Equipment Items: ${summary.equipment_items}`);
  console.log(`   🏢 Structural Items: ${summary.structural_items}`);
  console.log(`   📂 Categories with Equipment: ${summary.categories_with_equipment}`);
  console.log(`   📁 Empty Categories: ${summary.empty_categories}`);
  console.log(`   👨‍👦 Parent-Child Pairs: ${summary.parent_child_pairs}`);

  // Step 7: Sort and validate WBS structure
  const sortedWBS = sortWBSStructure(wbsStructure);
  const validation = validateWBSStructure(sortedWBS);

  if (validation.errors.length > 0) {
    console.warn('⚠️ WBS validation warnings:', validation.errors.slice(0, 3));
  }

  return {
    wbsStructure: sortedWBS,
    wbs_structure: sortedWBS, // Compatibility alias
    total_items: sortedWBS.length,
    equipment_count: processedEquipmentData.totals?.final || processedEquipmentData.equipment?.length || 0,
    tbc_count: tbcEquipment.length,
    subsystem_count: 1,
    max_level: Math.max(...sortedWBS.map(item => item.level)),
    summary: summary,
    stats: summary, // Compatibility alias
    validation: validation,
    categoryWBSMap: Object.fromEntries(categoryWBSMap)
  };
};

// Enhanced Equipment Items Addition with Proper Parent-Child Nesting
const addEnhancedEquipmentItems = (wbsStructure, equipment, parentCode, categoryId) => {
  console.log(`     🔧 Adding enhanced equipment for category ${categoryId}: ${equipment.length} items`);

  // Separate parent equipment from sub-equipment
  const parentEquipment = equipment.filter(item => {
  const parentCode = item.parent_equipment_code;
  return !item.is_sub_equipment && (!parentCode || parentCode === '-' || parentCode === '');
});

const subEquipment = equipment.filter(item => {
  const parentCode = item.parent_equipment_code;
  return item.is_sub_equipment && parentCode && parentCode !== '-' && parentCode !== '';
});

  console.log(`     👨‍👦 Category ${categoryId}: ${parentEquipment.length} parents, ${subEquipment.length} children`);

  // Sort parent equipment for consistent ordering
  const sortedParentEquipment = arrayHelpers.sortBy(parentEquipment, [
    { key: 'equipment_number', order: 'asc' }
  ]);

  // Add parent equipment items (Level 4)
  let equipmentIndex = 1;
  const equipmentWBSMap = new Map(); // Track equipment WBS codes for parent-child linking

  sortedParentEquipment.forEach(parentItem => {
    const equipmentWBSCode = `${parentCode}.${equipmentIndex}`;
    
    // Add main equipment item
    const equipmentWBSItem = {
      wbs_code: equipmentWBSCode,
      parent_wbs_code: parentCode,
      wbs_name: stringHelpers.formatEquipmentDescription ? 
        stringHelpers.formatEquipmentDescription(parentItem.equipment_number, parentItem.description) :
        `${parentItem.equipment_number} | ${parentItem.description || 'Equipment Description'}`,
      equipment_number: parentItem.equipment_number,
      description: parentItem.description,
      commissioning_status: parentItem.commissioning_status,
      level: 4,
      color: BRAND_COLORS.level4 || WBS_LEVEL_COLORS[4],
      is_category: false,
      is_equipment: true,
      is_new: false,
      parent_equipment_code: null,
      has_children: subEquipment.some(child => child.parent_equipment_code === parentItem.equipment_number)
    };

    wbsStructure.push(equipmentWBSItem);
    equipmentWBSMap.set(parentItem.equipment_number, equipmentWBSCode);
    
    console.log(`       🔧 Added parent: ${equipmentWBSCode} - ${parentItem.equipment_number}`);
    equipmentIndex++;
  });

  // Add child equipment under their parents (Level 5) - CRITICAL FIX for nesting
  const processedChildren = new Set();
  
  sortedParentEquipment.forEach(parentItem => {
    const parentWBSCode = equipmentWBSMap.get(parentItem.equipment_number);
    const children = subEquipment.filter(child => child.parent_equipment_code === parentItem.equipment_number);
    
    if (children.length > 0) {
      console.log(`       👶 Adding ${children.length} children for parent: ${parentItem.equipment_number}`);
      
      let childIndex = 1;
      children.forEach(childItem => {
        const childWBSCode = `${parentWBSCode}.${childIndex}`;
        const childWBSItem = {
          wbs_code: childWBSCode,
          parent_wbs_code: parentWBSCode, // This creates proper parent-child nesting
          wbs_name: stringHelpers.formatEquipmentDescription ? 
            stringHelpers.formatEquipmentDescription(childItem.equipment_number, childItem.description) :
            `${childItem.equipment_number} | ${childItem.description || 'Sub-Equipment Description'}`,
          equipment_number: childItem.equipment_number,
          description: childItem.description,
          commissioning_status: childItem.commissioning_status,
          level: 5, // One level deeper than parent equipment
          color: BRAND_COLORS.level5 || WBS_LEVEL_COLORS[5],
          is_category: false,
          is_equipment: true,
          is_sub_equipment: true,
          is_new: false,
          parent_equipment_code: childItem.parent_equipment_code,
          has_children: false
        };

        wbsStructure.push(childWBSItem);
        processedChildren.add(childItem.equipment_number);
        
        console.log(`         🔗 Added child: ${childWBSCode} - ${childItem.equipment_number} → parent: ${parentItem.equipment_number}`);
        childIndex++;
      });
    }
  });
  
  // Handle orphaned children (children whose parents don't exist in the equipment list)
  const orphanedChildren = subEquipment.filter(child => !processedChildren.has(child.equipment_number));
  if (orphanedChildren.length > 0) {
    console.log(`       ⚠️ Found ${orphanedChildren.length} orphaned children in category ${categoryId}`);
    
    orphanedChildren.forEach(orphanChild => {
      const orphanWBSCode = `${parentCode}.${equipmentIndex}`;
      const orphanWBSItem = {
        wbs_code: orphanWBSCode,
        parent_wbs_code: parentCode,
        wbs_name: stringHelpers.formatEquipmentDescription ? 
          stringHelpers.formatEquipmentDescription(orphanChild.equipment_number, orphanChild.description) :
          `${orphanChild.equipment_number} | ${orphanChild.description || 'Orphaned Equipment'} [ORPHANED]`,
        equipment_number: orphanChild.equipment_number,
        description: orphanChild.description,
        commissioning_status: orphanChild.commissioning_status,
        level: 4,
        color: BRAND_COLORS.level4 || WBS_LEVEL_COLORS[4],
        is_category: false,
        is_equipment: true,
        is_sub_equipment: true,
        is_new: false,
        parent_equipment_code: orphanChild.parent_equipment_code,
        has_children: false,
        is_orphaned: true,
        processing_notes: [`Orphaned: Parent ${orphanChild.parent_equipment_code} not found in same category`]
      };

      wbsStructure.push(orphanWBSItem);
      console.log(`         ⚠️ Added orphaned child: ${orphanWBSCode} - ${orphanChild.equipment_number} (missing parent: ${orphanChild.parent_equipment_code})`);
      equipmentIndex++;
    });
  }

  console.log(`✅ Successfully added equipment to category ${categoryId}`);
};

// Add preparation items (Test bay, Panel Shop, Pad)
const addPreparationItems = (wbsStructure, parentCode) => {
  console.log(`     🔧 Adding preparation items to ${parentCode}`);
  
  PREPARATION_ITEMS.forEach((item, index) => {
    const itemCode = `${parentCode}.${index + 1}`;
    wbsStructure.push({
      wbs_code: itemCode,
      parent_wbs_code: parentCode,
      wbs_name: item,
      equipment_number: item.replace(/\s+/g, ''),
      description: item,
      commissioning_status: 'Y',
      level: 4,
      color: BRAND_COLORS.level4 || WBS_LEVEL_COLORS[4],
      is_category: false,
      is_equipment: true,
      is_new: false
    });
    console.log(`       📋 Added preparation item: ${itemCode} - ${item}`);
  });
};

// Add interface testing phases
const addInterfaceTestingPhases = (wbsStructure, parentCode) => {
  console.log(`     🔧 Adding interface testing phases to ${parentCode}`);
  
  INTERFACE_TESTING_PHASES.forEach((phase, index) => {
    const phaseCode = `${parentCode}.${index + 1}`;
    wbsStructure.push({
      wbs_code: phaseCode,
      parent_wbs_code: parentCode,
      wbs_name: phase,
      equipment_number: phase.replace(/\s+/g, ''),
      description: phase,
      commissioning_status: 'Y',
      level: 4,
      color: BRAND_COLORS.level4 || WBS_LEVEL_COLORS[4],
      is_category: false,
      is_equipment: true,
      is_new: false
    });
    console.log(`       🧪 Added testing phase: ${phaseCode} - ${phase}`);
  });
};

// Add TBC equipment to separate section
const addTBCEquipmentToWBS = (wbsStructure, tbcEquipment, parentCode) => {
  console.log(`     🔧 Adding ${tbcEquipment.length} TBC equipment items to ${parentCode}`);
  
  const sortedTBCEquipment = arrayHelpers.sortBy(tbcEquipment, [
    { key: 'category', order: 'asc' },
    { key: 'equipment_number', order: 'asc' }
  ]);

  sortedTBCEquipment.forEach((item, index) => {
    const tbcCode = `${parentCode}.${index + 1}`;
    
    wbsStructure.push({
      wbs_code: tbcCode,
      parent_wbs_code: parentCode,
      wbs_name: stringHelpers.formatEquipmentDescription ? 
        stringHelpers.formatEquipmentDescription(item.equipment_number, item.description) :
        `${item.equipment_number} | ${item.description || 'To Be Confirmed'}`,
      equipment_number: item.equipment_number,
      description: item.description,
      commissioning_status: 'TBC',
      level: 3,
      color: BRAND_COLORS.level3 || WBS_LEVEL_COLORS[3],
      is_category: false,
      is_equipment: true,
      is_new: false
    });
    console.log(`       ⏳ Added TBC item: ${tbcCode} - ${item.equipment_number}`);
  });
};
// Add E | Energisation section (MISSING from current code)  
const addEnergisationSection = (wbsStructure, parentCode) => {
  console.log(`⚡ ADDING E | ENERGISATION SECTION to ${parentCode}`);
  
  // Calculate next sequence number
  const siblingCount = wbsStructure.filter(item => item.parent_wbs_code === parentCode).length;
  const energisationCode = `${parentCode}.${siblingCount + 1}`;
  
  // Main Energisation section (Level 2)
  wbsStructure.push({
    wbs_code: energisationCode,
    parent_wbs_code: parentCode,
    wbs_name: "E | Energisation",
    equipment_number: null,
    description: "Project Energisation Activities",
    commissioning_status: null,
    level: 2,
    color: BRAND_COLORS.level2 || WBS_LEVEL_COLORS[2],
    is_category: true,
    is_equipment: false,
    is_new: false
  });
  
  // System subsection (Level 3)  
  const systemCode = `${energisationCode}.1`;
  wbsStructure.push({
    wbs_code: systemCode,
    parent_wbs_code: energisationCode,
    wbs_name: "System",
    level: 3,
    color: BRAND_COLORS.level3 || WBS_LEVEL_COLORS[3],
    is_category: true,
    is_equipment: false,
    is_new: false
  });
  
  // Energisation phases (Level 4)
  ['Energisation', 'Pre-Energisation', 'Post Energisation'].forEach((phase, index) => {
    wbsStructure.push({
      wbs_code: `${systemCode}.${index + 1}`,
      parent_wbs_code: systemCode,
      wbs_name: phase,
      equipment_number: phase.replace(/\s+/g, ''),
      level: 4,
      color: BRAND_COLORS.level4 || WBS_LEVEL_COLORS[4],
      is_category: false,
      is_equipment: true,
      is_new: false
    });
  });
  
  console.log(`   ⚡ Added Energisation section: ${energisationCode}`);
  return energisationCode;
};

// Convert legacy format to new format for compatibility
const convertLegacyFormat = (categorizedEquipment) => {
  console.log('🔄 Converting legacy equipment format');
  
  // Group equipment by category
  const groupedEquipment = arrayHelpers.groupBy(categorizedEquipment, item => item.category || '99');
  
  // Create category stats
  const categoryStats = {};
  Object.entries(EQUIPMENT_CATEGORIES).forEach(([categoryId, categoryName]) => {
    const equipmentInCategory = groupedEquipment[categoryId] || [];
    categoryStats[categoryId] = {
      name: categoryName,
      count: equipmentInCategory.length,
      equipment: equipmentInCategory,
      parent_equipment: equipmentInCategory.filter(item => !item.is_sub_equipment),
      child_equipment: equipmentInCategory.filter(item => item.is_sub_equipment)
    };
  });
  
  // Create parent-child relationships
  const parentChildRelationships = [];
  categorizedEquipment.forEach(item => {
    if (item.parent_equipment || item.parent_equipment_code) {
      parentChildRelationships.push({
        child: item.equipment_number,
        parent: item.parent_equipment || item.parent_equipment_code,
        child_category: item.category,
        child_item: item
      });
    }
  });

  return {
    equipment: categorizedEquipment,
    categoryStats: categoryStats,
    parentChildRelationships: parentChildRelationships,
    totals: {
      original: categorizedEquipment.length,
      afterCommissioningFilter: categorizedEquipment.filter(item => (item.commissioning_status || 'Y') !== 'N').length,
      final: categorizedEquipment.length,
      parentItems: categorizedEquipment.filter(item => !item.is_sub_equipment).length,
      childItems: categorizedEquipment.filter(item => item.is_sub_equipment).length
    }
  };
};

// Generate empty WBS structure with all categories - FIXED to include E | Energisation
const generateEmptyWBSStructure = (projectName) => {
  console.log('📄 Generating empty WBS structure with all standard categories');
  
  const wbsStructure = [];
  
  // Project root
  wbsStructure.push({
    wbs_code: '1',
    parent_wbs_code: null,
    wbs_name: projectName,
    level: 1,
    color: BRAND_COLORS.level1 || WBS_LEVEL_COLORS[1],
    is_equipment: false,
    is_category: false
  });

  // Standard level 2 items
  wbsStructure.push(
    {
      wbs_code: '1.1',
      parent_wbs_code: '1',
      wbs_name: 'M | Milestones',
      level: 2,
      color: BRAND_COLORS.level2 || WBS_LEVEL_COLORS[2],
      is_equipment: false,
      is_category: true
    },
    {
      wbs_code: '1.2',
      parent_wbs_code: '1',
      wbs_name: 'P | Pre-requisites',
      level: 2,
      color: BRAND_COLORS.level2 || WBS_LEVEL_COLORS[2],
      is_equipment: false,
      is_category: true
    },
    {
      wbs_code: '1.3',
      parent_wbs_code: '1',
      wbs_name: 'S1 | Z01 | Main Subsystem',
      level: 2,
      color: BRAND_COLORS.level2 || WBS_LEVEL_COLORS[2],
      is_equipment: false,
      is_category: true
    }
  );

  // All standard categories (level 3) - even if empty
  let categoryIndex = 1;
  Object.entries(EQUIPMENT_CATEGORIES).forEach(([categoryId, categoryName]) => {
    wbsStructure.push({
      wbs_code: `1.3.${categoryIndex}`,
      parent_wbs_code: '1.3',
      wbs_name: `${categoryId} | ${categoryName}`,
      level: 3,
      color: BRAND_COLORS.level3 || WBS_LEVEL_COLORS[3],
      is_equipment: false,
      is_category: true,
      category: categoryId,
      equipment_count: 0
    });
    categoryIndex++;
  });

  // CRITICAL FIX: Add E | Energisation section (MANDATORY for every project)
  console.log('⚡ Adding E | Energisation to empty WBS structure');
  
  wbsStructure.push({
    wbs_code: '1.4',
    parent_wbs_code: '1',
    wbs_name: 'E | Energisation',
    level: 2,
    color: BRAND_COLORS.level2 || WBS_LEVEL_COLORS[2],
    is_equipment: false,
    is_category: true
  });

  // System subsection
  wbsStructure.push({
    wbs_code: '1.4.1',
    parent_wbs_code: '1.4',
    wbs_name: 'System',
    level: 3,
    color: BRAND_COLORS.level3 || WBS_LEVEL_COLORS[3],
    is_equipment: false,
    is_category: true
  });

  // Energisation phases
  ['Energisation', 'Pre-Energisation', 'Post Energisation'].forEach((phase, index) => {
    wbsStructure.push({
      wbs_code: `1.4.1.${index + 1}`,
      parent_wbs_code: '1.4.1',
      wbs_name: phase,
      equipment_number: phase.replace(/\s+/g, ''),
      level: 4,
      color: BRAND_COLORS.level4 || WBS_LEVEL_COLORS[4],
      is_equipment: true,
      is_category: false
    });
  });

  console.log(`✅ Created empty WBS with E | Energisation: ${wbsStructure.length} total items`);

  return {
    wbsStructure: wbsStructure,
    wbs_structure: wbsStructure, // Compatibility alias
    total_items: wbsStructure.length,
    equipment_count: 0,
    tbc_count: 0,
    subsystem_count: 1,
    max_level: 4 // Updated since we now go to level 4
  };
};

// Sort WBS structure for proper hierarchy
const sortWBSStructure = (wbsStructure) => {
  return arrayHelpers.sortBy(wbsStructure, [
    { key: 'wbs_code', order: 'asc', compareFn: compareWBSCodes }
  ]);
};

// Custom WBS code comparison function
const compareWBSCodes = (a, b) => {
  const aParts = a.split('.').map(part => parseInt(part) || 0);
  const bParts = b.split('.').map(part => parseInt(part) || 0);
  
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    
    if (aVal !== bVal) {
      return aVal - bVal;
    }
  }
  
  return 0;
};

// Group equipment by subsystem (enhanced)
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
    const rootCode = stringHelpers.getParentWBSCode ? stringHelpers.getParentWBSCode(existingSubsystem.wbs_code) : '1';
    return stringHelpers.generateWBSCode ? stringHelpers.generateWBSCode(rootCode, nextSequence.split('.')[1]) : nextSequence;
  }
  
  return nextSequence;
};

// Convert flat WBS to hierarchical tree for visualization
export const buildWBSTree = (wbsStructure) => {
  try {
    return wbsHelpers.buildHierarchicalTree ? wbsHelpers.buildHierarchicalTree(wbsStructure) : wbsStructure;
  } catch (error) {
    throw new Error(`Tree building failed: ${error.message}`);
  }
};

// Enhanced WBS structure validation
export const validateWBSStructure = (wbsStructure) => {
  console.log('✅ VALIDATING WBS STRUCTURE');
  
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    statistics: {
      total_items: wbsStructure.length,
      max_level: 0,
      orphaned_items: 0,
      duplicate_codes: 0,
      unique_wbs_codes: new Set(wbsStructure.map(item => item.wbs_code)).size,
      records_with_parents: wbsStructure.filter(item => item.parent_wbs_code && item.parent_wbs_code !== '').length,
      root_records: wbsStructure.filter(item => !item.parent_wbs_code || item.parent_wbs_code === '').length
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

  // Check for required standard categories
  const requiredCategories = Object.keys(EQUIPMENT_CATEGORIES);
  const presentCategories = wbsStructure
    .filter(item => item.level === 3 && item.category)
    .map(item => item.category);
  
  requiredCategories.forEach(categoryId => {
    if (!presentCategories.includes(categoryId)) {
      validation.errors.push(`Missing required category: ${categoryId}`);
    }
  });

  console.log('📊 WBS Validation Results:');
  console.log(`   🆔 Unique WBS Codes: ${validation.statistics.unique_wbs_codes}/${validation.statistics.total_items}`);
  console.log(`   📏 Max Level: ${validation.statistics.max_level}`);
  console.log(`   🔗 Root Records: ${validation.statistics.root_records}`);
  console.log(`   👨‍👦 Records with Parents: ${validation.statistics.records_with_parents}`);
  console.log(`   ❌ Errors: ${validation.errors.length}`);
  console.log(`   ⚠️ Warnings: ${validation.warnings.length}`);

  if (validation.errors.length > 0) {
    console.log('❌ WBS Validation Errors:');
    validation.errors.slice(0, 5).forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }

  return validation;
};

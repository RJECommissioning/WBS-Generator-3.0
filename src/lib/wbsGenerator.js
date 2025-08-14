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
 * Enhanced WBS Generator - MULTIPLE SUBSYSTEMS with ALL CATEGORIES
 * CONSISTENT FIELD NAMES:
 * - parent_equipment_number (NOT parent_equipment_code)
 * - commissioning_yn (NOT commissioning_status)
 * UPDATED: Creates multiple subsystems (S1, S2, S3...) each with ALL standard categories
 */

// Enhanced WBS Structure Generation
export const generateWBSStructure = (inputData, projectName = '5737 Summerfield Project') => {
  try {
    console.log('ENHANCED WBS GENERATION - MULTIPLE SUBSYSTEMS WITH ALL CATEGORIES');
    
    // Handle input data format
    let actualEquipmentArray = [];
    let actualTBCArray = [];
    let actualSubsystemMapping = {};
    let processedEquipmentData = null;

    if (inputData && typeof inputData === 'object' && !Array.isArray(inputData)) {
      // Object format from enhanced processor
      actualEquipmentArray = inputData.categorizedEquipment || inputData.equipment || [];
      actualTBCArray = inputData.tbcEquipment || [];
      actualSubsystemMapping = inputData.subsystemMapping || {};
      projectName = inputData.projectName || projectName;
      processedEquipmentData = inputData;
      
      console.log(`Processing: ${actualEquipmentArray.length} electrical items, ${actualTBCArray.length} TBC items`);
      console.log('Subsystem mapping:', actualSubsystemMapping);
    } else if (Array.isArray(inputData)) {
      // Legacy array format
      actualEquipmentArray = inputData;
      console.log(`Legacy array: ${actualEquipmentArray.length} items`);
    }

    if (actualEquipmentArray.length === 0 && actualTBCArray.length === 0) {
      console.log('No equipment provided, creating empty WBS structure');
      return generateEmptyWBSStructure(projectName);
    }

    return generateEnhancedWBSStructure(processedEquipmentData || { equipment: actualEquipmentArray, tbcEquipment: actualTBCArray, subsystemMapping: actualSubsystemMapping }, projectName);

  } catch (error) {
    console.error('WBS generation failed:', error);
    throw new Error(`WBS generation failed: ${error.message}`);
  }
};

// Enhanced WBS Structure Generation with Multiple Subsystems
const generateEnhancedWBSStructure = (processedEquipmentData, projectName) => {
  console.log('CREATING MULTIPLE SUBSYSTEMS - EACH WITH ALL CATEGORIES');
  console.log(`Equipment data:`, {
    allYEquipment: processedEquipmentData.equipment?.length || 0,
    tbcEquipment: processedEquipmentData.tbcEquipment?.length || 0,
    subsystems: Object.keys(processedEquipmentData.subsystemMapping || {}).length,
    categories: Object.keys(processedEquipmentData.categoryStats || {}).length,
    unrecognizedCount: processedEquipmentData.categoryStats?.['99']?.count || 0
  });

  const wbsStructure = [];
  let wbsCodeCounter = { level1: 1, level2: 1, level3: 1, level4: 1, level5: 1 };

  // Step 1: Create Project Root Structure
  console.log('STEP 1: Creating Project Root Structure');
  
  // Project Root (Level 1)
  const projectRoot = {
    wbs_code: '1',
    parent_wbs_code: null,
    wbs_name: projectName,
    equipment_number: null,
    description: projectName,
    commissioning_yn: null,
    category: null,
    category_name: null,
    level: 1,
    is_equipment: false,
    is_structural: true,
    subsystem: null
  };
  
  wbsStructure.push(projectRoot);
  console.log(`Added project root: 1 - ${projectName}`);

  // Step 2: Create Standard Structure (M | Milestones, P | Pre-requisites)
  console.log('STEP 2: Creating Standard Structure');
  
  const milestoneStructure = {
    wbs_code: '1.1',
    parent_wbs_code: '1',
    wbs_name: 'M | Milestones',
    equipment_number: null,
    description: 'Project Milestones',
    commissioning_yn: null,
    category: null,
    category_name: null,
    level: 2,
    is_equipment: false,
    is_structural: true,
    subsystem: null
  };
  
  wbsStructure.push(milestoneStructure);
  console.log(`Added milestones: 1.1 - M | Milestones`);

  const prerequisiteStructure = {
    wbs_code: '1.2',
    parent_wbs_code: '1',
    wbs_name: 'P | Pre-requisites',
    equipment_number: null,
    description: 'Project Prerequisites',
    commissioning_yn: null,
    category: null,
    category_name: null,
    level: 2,
    is_equipment: false,
    is_structural: true,
    subsystem: null
  };
  
  wbsStructure.push(prerequisiteStructure);
  console.log(`Added prerequisites: 1.2 - P | Pre-requisites`);

  // Step 3: Create Multiple Subsystems - Each with ALL Categories
  console.log('STEP 3: Creating Multiple Subsystems with ALL Categories');
  
  const subsystemMapping = processedEquipmentData.subsystemMapping || {};
  const subsystemEntries = Object.entries(subsystemMapping);
  
  if (subsystemEntries.length === 0) {
    console.log('No subsystems found, creating default S1 subsystem');
    // Create default subsystem
    subsystemEntries.push(['Default', { 
      full_name: 'S1 | Z01 | Main Subsystem',
      index: 1 
    }]);
  }

  console.log(`Creating ${subsystemEntries.length} subsystems`);

  // Group equipment by subsystem for distribution
  const equipmentBySubsystem = {};
  processedEquipmentData.equipment?.forEach(item => {
    const subsystemKey = item.subsystem || 'Default';
    if (!equipmentBySubsystem[subsystemKey]) {
      equipmentBySubsystem[subsystemKey] = [];
    }
    equipmentBySubsystem[subsystemKey].push(item);
  });

  subsystemEntries.forEach(([subsystemKey, subsystemData], subsystemIndex) => {
    const subsystemWBSCode = `1.${subsystemIndex + 3}`; // 1.3, 1.4, 1.5, etc.
    
    // Create subsystem header
    const subsystemStructure = {
      wbs_code: subsystemWBSCode,
      parent_wbs_code: '1',
      wbs_name: subsystemData.full_name,
      equipment_number: null,
      description: subsystemData.full_name,
      commissioning_yn: null,
      category: null,
      category_name: null,
      level: 2,
      is_equipment: false,
      is_structural: true,
      subsystem: subsystemKey
    };
    
    wbsStructure.push(subsystemStructure);
    console.log(`Added subsystem: ${subsystemWBSCode} - ${subsystemData.full_name}`);

    // Create ALL standard categories under this subsystem (even empty ones)
    Object.entries(EQUIPMENT_CATEGORIES).forEach(([categoryId, categoryName], categoryIndex) => {
      const categoryWBSCode = `${subsystemWBSCode}.${categoryIndex + 1}`;
      
      const categoryStructure = {
        wbs_code: categoryWBSCode,
        parent_wbs_code: subsystemWBSCode,
        wbs_name: `${categoryId} | ${categoryName}`,
        equipment_number: null,
        description: categoryName,
        commissioning_yn: null,
        category: categoryId,
        category_name: categoryName,
        level: 3,
        is_equipment: false,
        is_structural: true,
        subsystem: subsystemKey
      };
      
      wbsStructure.push(categoryStructure);
      
      // Add equipment for this subsystem + category combination
      const equipmentForThisSubsystem = equipmentBySubsystem[subsystemKey] || [];
      const equipmentForThisCategory = equipmentForThisSubsystem.filter(item => item.category === categoryId);
      
      if (equipmentForThisCategory.length > 0) {
        console.log(`   Category ${categoryId}: ${equipmentForThisCategory.length} equipment items`);
        addEquipmentToCategory(wbsStructure, categoryWBSCode, equipmentForThisCategory, processedEquipmentData);
      } else {
        console.log(`   Category ${categoryId}: 0 equipment items (empty but created)`);
      }
    });
  });

  // Step 4: Calculate Final Statistics
  console.log('STEP 4: Calculating Final Statistics');
  
  let equipmentItems = 0;
  let structuralItems = 0;
  let parentChildPairs = 0;
  let categoriesWithEquipment = 0;
  let emptyCategories = 0;
  
  const levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  wbsStructure.forEach(item => {
    if (item.is_equipment) {
      equipmentItems++;
    } else {
      structuralItems++;
    }
    
    if (item.level && levelCounts[item.level] !== undefined) {
      levelCounts[item.level]++;
    }
    
    if (item.is_equipment && item.parent_equipment_number) {
      parentChildPairs++;
    }
  });

  // Count categories with/without equipment
  Object.keys(EQUIPMENT_CATEGORIES).forEach(categoryId => {
    if (processedEquipmentData.categoryStats) {
      const hasEquipment = processedEquipmentData.categoryStats[categoryId]?.count > 0;
      if (hasEquipment) {
        categoriesWithEquipment++;
      } else {
        emptyCategories++;
      }
    }
  });

  console.log(`FINAL WBS STRUCTURE STATISTICS:`);
  console.log(`   Total WBS Items: ${wbsStructure.length}`);
  console.log(`   Equipment Items: ${equipmentItems}`);
  console.log(`   Structural Items: ${structuralItems}`);
  console.log(`   Categories with Equipment: ${categoriesWithEquipment}`);
  console.log(`   Empty Categories: ${emptyCategories}`);
  console.log(`   Parent-Child Pairs: ${parentChildPairs}`);

  // Sort WBS structure hierarchically
  const sortedWBSStructure = sortWBSStructureHierarchically(wbsStructure);

  // Validate WBS structure
  const validation = validateWBSStructure(sortedWBSStructure);
  console.log('WBS validation completed - validation passed:', validation.isValid);

  return {
    wbsStructure: sortedWBSStructure,
    totalWBSItems: sortedWBSStructure.length,
    equipmentItems: equipmentItems,
    structuralItems: structuralItems,
    categoriesWithEquipment: categoriesWithEquipment,
    emptyCategories: emptyCategories,
    parentChildPairs: parentChildPairs,
    levelDistribution: levelCounts,
    validation: validation,
    metadata: {
      projectName: projectName,
      generatedAt: new Date().toISOString(),
      totalEquipment: processedEquipmentData.equipment?.length || 0,
      tbcEquipment: processedEquipmentData.tbcEquipment?.length || 0,
      categoryStats: processedEquipmentData.categoryStats || {}
    }
  };
};

// Enhanced equipment addition for categories with proper parent-child handling
const addEquipmentToCategory = (wbsStructure, categoryWBSCode, equipmentList, processedEquipmentData) => {
  console.log(`Adding equipment to category ${categoryWBSCode}: ${equipmentList.length} items`);
  
  // Separate parent and child equipment
  const parentEquipment = equipmentList.filter(item => !item.is_sub_equipment);
  const childEquipment = equipmentList.filter(item => item.is_sub_equipment);
  
  console.log(`   Parents: ${parentEquipment.length}, Children: ${childEquipment.length}`);
  
  // Add parent equipment first
  let equipmentCounter = 1;
  parentEquipment.forEach(equipment => {
    const equipmentWBSCode = `${categoryWBSCode}.${equipmentCounter}`;
    
    const equipmentStructure = {
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
      is_sub_equipment: false,
      parent_equipment_number: equipment.parent_equipment_number
    };
    
    wbsStructure.push(equipmentStructure);
    
    // Add child equipment under this parent
    const childrenForThisParent = childEquipment.filter(child => 
      child.parent_equipment_number === equipment.equipment_number
    );
    
    if (childrenForThisParent.length > 0) {
      console.log(`   Adding ${childrenForThisParent.length} children for parent ${equipment.equipment_number}`);
      
      childrenForThisParent.forEach((child, childIndex) => {
        const childWBSCode = `${equipmentWBSCode}.${childIndex + 1}`;
        
        const childStructure = {
          wbs_code: childWBSCode,
          parent_wbs_code: equipmentWBSCode,
          wbs_name: `${child.equipment_number} | ${child.description}`,
          equipment_number: child.equipment_number,
          description: child.description,
          commissioning_yn: child.commissioning_yn,
          category: child.category,
          category_name: child.category_name,
          level: 5,
          is_equipment: true,
          is_structural: false,
          subsystem: child.subsystem,
          is_sub_equipment: true,
          parent_equipment_number: child.parent_equipment_number
        };
        
        wbsStructure.push(childStructure);
        console.log(`     Added child: ${childWBSCode} - ${child.equipment_number}`);
      });
    }
    
    equipmentCounter++;
  });
  
  console.log(`   Finished adding ${parentEquipment.length} parent equipment items to ${categoryWBSCode}`);
};

// Enhanced energisation section generation
const addEnergisationSection = (wbsStructure, parentCode) => {
  console.log(`Adding E | Energisation section under parent: ${parentCode}`);
  
  // Split the parent code and increment for energisation
  const parentParts = parentCode.split('.');
  const energisationNumber = parseInt(parentParts[parentParts.length - 1]) + 1;
  const energisationCode = parentParts.slice(0, -1).concat([energisationNumber]).join('.');
  
  const energisationSection = {
    wbs_code: energisationCode,
    parent_wbs_code: parentCode,
    wbs_name: 'E | Energisation',
    equipment_number: null,
    description: 'Project Energisation',
    commissioning_yn: null,
    category: null,
    category_name: null,
    level: parentParts.length,
    is_equipment: false,
    is_structural: true,
    subsystem: null
  };
  
  wbsStructure.push(energisationSection);
  console.log(`Added energisation: ${energisationCode} - E | Energisation`);
  
  return energisationCode;
};

// Enhanced empty WBS structure generation for fallback
const generateEmptyWBSStructure = (projectName) => {
  console.log('GENERATING EMPTY WBS STRUCTURE');
  
  const wbsStructure = [];

  // Project Root
  wbsStructure.push({
    wbs_code: '1',
    parent_wbs_code: null,
    wbs_name: projectName,
    level: 1,
    is_equipment: false,
    is_structural: true
  });

  // Standard sections
  ['M | Milestones', 'P | Pre-requisites', 'S1 | Z01 | Main Subsystem'].forEach((name, index) => {
    wbsStructure.push({
      wbs_code: `1.${index + 1}`,
      parent_wbs_code: '1',
      wbs_name: name,
      level: 2,
      is_equipment: false,
      is_structural: true
    });
  });

  // All standard categories under main subsystem
  Object.entries(EQUIPMENT_CATEGORIES).forEach(([categoryId, categoryName], index) => {
    wbsStructure.push({
      wbs_code: `1.3.${index + 1}`,
      parent_wbs_code: '1.3',
      wbs_name: `${categoryId} | ${categoryName}`,
      level: 3,
      is_equipment: false,
      is_structural: true,
      category: categoryId,
      category_name: categoryName
    });
  });

  // Add E | Energisation
  addEnergisationSection(wbsStructure, '1');

  return {
    wbsStructure: wbsStructure,
    totalWBSItems: wbsStructure.length,
    equipmentItems: 0,
    structuralItems: wbsStructure.length,
    categoriesWithEquipment: 0,
    emptyCategories: Object.keys(EQUIPMENT_CATEGORIES).length,
    parentChildPairs: 0,
    validation: { isValid: true, errors: [], warnings: [] }
  };
};

// Enhanced WBS code conversion to legacy format for compatibility
const convertToLegacyWBSFormat = (enhancedWBSStructure) => {
  return enhancedWBSStructure.map(item => ({
    wbs_code: item.wbs_code,
    parent_wbs_code: item.parent_wbs_code || '',
    wbs_name: item.wbs_name
  }));
};

// Enhanced hierarchical sorting
const sortWBSStructureHierarchically = (wbsStructure) => {
  return wbsStructure.sort((a, b) => {
    const aParts = a.wbs_code.split('.').map(part => parseInt(part) || 0);
    const bParts = b.wbs_code.split('.').map(part => parseInt(part) || 0);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      
      if (aVal !== bVal) {
        return aVal - bVal;
      }
    }
    
    return 0;
  });
};

// Enhanced WBS structure validation
export const validateWBSStructure = (wbsStructure) => {
  console.log('VALIDATING WBS STRUCTURE');
  
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    statistics: {
      total_items: wbsStructure.length,
      max_level: 0,
      unique_wbs_codes: new Set(wbsStructure.map(item => item.wbs_code)).size,
      records_with_parents: wbsStructure.filter(item => item.parent_wbs_code && item.parent_wbs_code !== '').length,
      root_records: wbsStructure.filter(item => !item.parent_wbs_code || item.parent_wbs_code === '').length
    }
  };

  const wbsCodes = new Set();

  wbsStructure.forEach((item, index) => {
    // Check for duplicate WBS codes
    if (wbsCodes.has(item.wbs_code)) {
      validation.errors.push(`Duplicate WBS code: ${item.wbs_code}`);
      validation.isValid = false;
    }
    wbsCodes.add(item.wbs_code);

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
    if (item.parent_wbs_code && item.parent_wbs_code !== '' && !wbsCodes.has(item.parent_wbs_code)) {
      validation.warnings.push(`Orphaned item: ${item.wbs_code} references missing parent ${item.parent_wbs_code}`);
    }
  });

  console.log('WBS Validation Results:');
  console.log(`   Unique WBS Codes: ${validation.statistics.unique_wbs_codes}/${validation.statistics.total_items}`);
  console.log(`   Max Level: ${validation.statistics.max_level}`);
  console.log(`   Root Records: ${validation.statistics.root_records}`);
  console.log(`   Records with Parents: ${validation.statistics.records_with_parents}`);
  console.log(`   Errors: ${validation.errors.length}`);
  console.log(`   Warnings: ${validation.warnings.length}`);

  return validation;
};

// Additional utility functions for backward compatibility
export const continueWBSStructure = (existingWBS, newEquipment, lastWBSCode) => {
  // Implementation for continue project functionality
  throw new Error('Continue WBS Structure functionality not yet implemented in enhanced version');
};

export const buildWBSTree = (wbsStructure) => {
  // Convert flat WBS to hierarchical tree for visualization
  const itemMap = {};
  const tree = [];

  // Create lookup map
  wbsStructure.forEach(item => {
    itemMap[item.wbs_code] = {
      ...item,
      children: []
    };
  });

  // Build hierarchy
  wbsStructure.forEach(item => {
    if (item.parent_wbs_code && item.parent_wbs_code !== '' && itemMap[item.parent_wbs_code]) {
      itemMap[item.parent_wbs_code].children.push(itemMap[item.wbs_code]);
    } else {
      tree.push(itemMap[item.wbs_code]);
    }
  });

  return tree;
};

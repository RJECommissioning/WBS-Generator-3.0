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
 * Enhanced WBS Generator - CORRECTED for All Y-Status Equipment
 * CORRECT APPROACH:
 * - Handle ALL Y-status equipment (electrical patterns → 01-10, others → 99)
 * - ALL standard categories created (even empty ones)
 * - Proper parent-child nesting for all equipment types
 * - TBC section for all TBC items
 * - Energisation section for every project
 * - Category 99 may contain many items (non-electrical Y-status equipment)
 */

// Enhanced WBS Structure Generation
export const generateWBSStructure = (inputData, projectName = '5737 Summerfield Project') => {
  try {
    console.log('ENHANCED WBS GENERATION - ELECTRICAL EQUIPMENT FOCUSED');
    
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
    } else if (Array.isArray(inputData)) {
      // Legacy array format
      actualEquipmentArray = inputData;
      console.log(`Legacy array: ${actualEquipmentArray.length} items`);
    }

    if (actualEquipmentArray.length === 0 && actualTBCArray.length === 0) {
      console.log('No equipment provided, creating empty WBS structure');
      return generateEmptyWBSStructure(projectName);
    }

    return generateEnhancedWBSStructure(processedEquipmentData || { equipment: actualEquipmentArray, tbcEquipment: actualTBCArray }, projectName);

  } catch (error) {
    console.error('WBS generation failed:', error);
    throw new Error(`WBS generation failed: ${error.message}`);
  }
};

// Enhanced WBS Structure Generation
const generateEnhancedWBSStructure = (processedEquipmentData, projectName) => {
  console.log('CORRECTED WBS GENERATION - ALL Y-STATUS EQUIPMENT');
  console.log(`Equipment data:`, {
    allYEquipment: processedEquipmentData.equipment?.length || 0,
    tbcEquipment: processedEquipmentData.tbcEquipment?.length || 0,
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
    commissioning_status: null,
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
    commissioning_status: null,
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
    commissioning_status: null,
    category: null,
    category_name: null,
    level: 2,
    is_equipment: false,
    is_structural: true,
    subsystem: null
  };
  
  wbsStructure.push(prerequisiteStructure);
  console.log(`Added prerequisites: 1.2 - P | Pre-requisites`);

  // Step 3: Create Main Subsystem Structure with ALL Categories (including empty ones)
  console.log('STEP 3: Creating ALL Standard Categories (even empty ones)');
  
  const mainSubsystemCode = '1.3';
  const mainSubsystemStructure = {
    wbs_code: mainSubsystemCode,
    parent_wbs_code: '1',
    wbs_name: 'S1 | Z01 | Main Subsystem',
    equipment_number: null,
    description: 'Main Electrical Subsystem',
    commissioning_status: null,
    category: null,
    category_name: null,
    level: 2,
    is_equipment: false,
    is_structural: true,
    subsystem: 'S1'
  };
  
  wbsStructure.push(mainSubsystemStructure);
  console.log(`Added main subsystem: ${mainSubsystemCode} - S1 | Z01 | Main Subsystem`);

  // Create ALL standard categories (01-10, 99) even if empty
  const orderedCategories = Object.entries(EQUIPMENT_CATEGORIES).sort(([a], [b]) => {
    // Sort numerically: 01, 02, 03, ..., 10, 99
    if (a === '99') return 1;
    if (b === '99') return -1;
    return parseInt(a) - parseInt(b);
  });

  orderedCategories.forEach(([categoryId, categoryName]) => {
    const categoryEquipment = processedEquipmentData.categoryStats?.[categoryId]?.equipment || [];
    const categoryCode = `${mainSubsystemCode}.${Object.keys(EQUIPMENT_CATEGORIES).indexOf(categoryId) + 1}`;
    
    console.log(`Processing category ${categoryId}: ${categoryEquipment.length} items`);
    
    // Create category even if empty
    const categoryStructure = {
      wbs_code: categoryCode,
      parent_wbs_code: mainSubsystemCode,
      wbs_name: `${categoryId} | ${categoryName}`,
      equipment_number: null,
      description: categoryName,
      commissioning_status: null,
      category: categoryId,
      category_name: categoryName,
      level: 3,
      is_equipment: false,
      is_structural: true,
      subsystem: 'S1'
    };
    
    wbsStructure.push(categoryStructure);
    console.log(`Added category: ${categoryCode} - ${categoryId} | ${categoryName}`);

    if (categoryEquipment.length === 0) {
      console.log(`Category ${categoryId} is empty - skipping equipment addition`);
    } else {
      console.log(`Adding equipment for category ${categoryId}: ${categoryEquipment.length} items`);
      
      // Add enhanced equipment for category
      addEnhancedEquipmentForCategory(wbsStructure, categoryCode, categoryEquipment, categoryId);
      console.log(`Successfully added equipment to category ${categoryId}`);
    }
  });

  // Step 4: Add TBC Section with all TBC items
  console.log('STEP 4: Adding TBC Section with', processedEquipmentData.tbcEquipment?.length || 0, 'items');
  
  if (processedEquipmentData.tbcEquipment && processedEquipmentData.tbcEquipment.length > 0) {
    const tbcSectionCode = '1.4';
    const tbcStructure = {
      wbs_code: tbcSectionCode,
      parent_wbs_code: '1',
      wbs_name: 'TBC - Equipment To Be Confirmed',
      equipment_number: null,
      description: 'Equipment requiring confirmation',
      commissioning_status: 'TBC',
      category: 'TBC',
      category_name: 'To Be Confirmed',
      level: 2,
      is_equipment: false,
      is_structural: true,
      subsystem: null
    };
    
    wbsStructure.push(tbcStructure);
    
    // Add TBC equipment items
    console.log(`Adding ${processedEquipmentData.tbcEquipment.length} TBC equipment items to ${tbcSectionCode}`);
    
    processedEquipmentData.tbcEquipment.forEach((equipment, index) => {
      const equipmentCode = `${tbcSectionCode}.${index + 1}`;
      const equipmentStructure = {
        wbs_code: equipmentCode,
        parent_wbs_code: tbcSectionCode,
        wbs_name: `${equipment.equipment_number} | ${equipment.description}`,
        equipment_number: equipment.equipment_number,
        description: equipment.description,
        commissioning_status: 'TBC',
        category: 'TBC',
        category_name: 'To Be Confirmed',
        level: 3,
        is_equipment: true,
        is_structural: false,
        subsystem: equipment.subsystem || null,
        parent_equipment_code: equipment.parent_equipment_number || null
      };
      
      wbsStructure.push(equipmentStructure);
      console.log(`Added TBC item: ${equipmentCode} - ${equipment.equipment_number}`);
    });
  }

  // Step 5: Add E | Energisation Section
  console.log('STEP 5: Adding E | Energisation Section');
  addEnergisationSection(wbsStructure, '1');

  // Step 6: WBS Generation Summary
  console.log('STEP 6: WBS Generation Summary');
  const structuralItems = wbsStructure.filter(item => !item.is_equipment).length;
  const equipmentItems = wbsStructure.filter(item => item.is_equipment).length;
  const levelCounts = {};
  
  for (let i = 1; i <= 5; i++) {
    levelCounts[`level${i}`] = wbsStructure.filter(item => item.level === i).length;
  }
  
  const categoriesWithEquipment = Object.values(processedEquipmentData.categoryStats || {})
    .filter(stats => stats.count > 0).length;
  const emptyCategories = Object.keys(EQUIPMENT_CATEGORIES).length - categoriesWithEquipment;
  const parentChildPairs = processedEquipmentData.relationshipAnalysis?.successfulMatches || 0;

  console.log('WBS Structure Summary:');
  console.log(`   Total WBS Items: ${wbsStructure.length}`);
  console.log(`   Level Distribution: L1=${levelCounts.level1}, L2=${levelCounts.level2}, L3=${levelCounts.level3}, L4=${levelCounts.level4}, L5=${levelCounts.level5}`);
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

// Enhanced equipment addition for categories with proper parent-child nesting
const addEnhancedEquipmentForCategory = (wbsStructure, categoryCode, categoryEquipment, categoryId) => {
  console.log(`Adding enhanced equipment for category ${categoryId}: ${categoryEquipment.length} items`);
  
  // Separate parent and child equipment
  const parentEquipment = categoryEquipment.filter(item => !item.is_sub_equipment);
  const childEquipment = categoryEquipment.filter(item => item.is_sub_equipment);
  
  console.log(`Category ${categoryId}: ${parentEquipment.length} parents, ${childEquipment.length} children`);

  // Add parent equipment first
  let equipmentIndex = 1;
  
  console.log(`STARTING to add ${parentEquipment.length} parent equipment items...`);
  
  parentEquipment.forEach((equipment, index) => {
    const equipmentCode = `${categoryCode}.${equipmentIndex}`;
    const equipmentStructure = {
      wbs_code: equipmentCode,
      parent_wbs_code: categoryCode,
      wbs_name: `${equipment.equipment_number} | ${equipment.description}`,
      equipment_number: equipment.equipment_number,
      description: equipment.description,
      commissioning_status: equipment.commissioning_status,
      category: categoryId,
      category_name: equipment.category_name,
      level: 4,
      is_equipment: true,
      is_structural: false,
      subsystem: equipment.subsystem || 'S1',
      parent_equipment_code: equipment.parent_equipment_number || null
    };
    
    wbsStructure.push(equipmentStructure);
    
    // Find and add child equipment for this parent
    const childrenForThisParent = childEquipment.filter(child => 
      child.parent_equipment_number === equipment.equipment_number
    );
    
    if (childrenForThisParent.length > 0) {
      console.log(`Adding ${childrenForThisParent.length} children for parent ${equipment.equipment_number}`);
      
      childrenForThisParent.forEach((childEquipment, childIndex) => {
        const childCode = `${equipmentCode}.${childIndex + 1}`;
        const childStructure = {
          wbs_code: childCode,
          parent_wbs_code: equipmentCode,
          wbs_name: `${childEquipment.equipment_number} | ${childEquipment.description}`,
          equipment_number: childEquipment.equipment_number,
          description: childEquipment.description,
          commissioning_status: childEquipment.commissioning_status,
          category: categoryId,
          category_name: childEquipment.category_name,
          level: 5,
          is_equipment: true,
          is_structural: false,
          subsystem: childEquipment.subsystem || 'S1',
          parent_equipment_code: childEquipment.parent_equipment_number
        };
        
        wbsStructure.push(childStructure);
        console.log(`Added child: ${childCode} - ${childEquipment.equipment_number}`);
      });
    }
    
    equipmentIndex++;
    
    if (index % 10 === 0 && index > 0) {
      console.log(`Progress: Added ${index + 1}/${parentEquipment.length} parent equipment items`);
    }
  });
  
  console.log(`FINISHED adding parent equipment. Total WBS items now: ${wbsStructure.length}`);

  // Add any orphaned child equipment (children without parents in the same category)
  const orphanedChildren = childEquipment.filter(child => 
    !parentEquipment.some(parent => parent.equipment_number === child.parent_equipment_number)
  );
  
  if (orphanedChildren.length > 0) {
    console.log(`Adding ${orphanedChildren.length} orphaned child equipment items...`);
    
    orphanedChildren.forEach((equipment, index) => {
      const equipmentCode = `${categoryCode}.${equipmentIndex}`;
      const equipmentStructure = {
        wbs_code: equipmentCode,
        parent_wbs_code: categoryCode,
        wbs_name: `${equipment.equipment_number} | ${equipment.description}`,
        equipment_number: equipment.equipment_number,
        description: equipment.description,
        commissioning_status: equipment.commissioning_status,
        category: categoryId,
        category_name: equipment.category_name,
        level: 4,
        is_equipment: true,
        is_structural: false,
        subsystem: equipment.subsystem || 'S1',
        parent_equipment_code: equipment.parent_equipment_number,
        orphaned_child: true
      };
      
      wbsStructure.push(equipmentStructure);
      console.log(`Added orphaned child: ${equipmentCode} - ${equipment.equipment_number}`);
      equipmentIndex++;
    });
  }
};

// Add E | Energisation section to every project
const addEnergisationSection = (wbsStructure, parentCode) => {
  console.log('ADDING E | ENERGISATION SECTION to', parentCode);
  
  const energisationCode = '1.5';
  const energisationStructure = {
    wbs_code: energisationCode,
    parent_wbs_code: parentCode,
    wbs_name: 'E | Energisation',
    equipment_number: null,
    description: 'Energisation and Testing',
    commissioning_status: null,
    category: null,
    category_name: null,
    level: 2,
    is_equipment: false,
    is_structural: true,
    subsystem: null
  };
  
  wbsStructure.push(energisationStructure);

  // Add energisation sub-sections
  const energisationSubSections = [
    { name: 'System', description: 'System Testing' },
    { name: 'Energisation', description: 'Energisation Process' },
    { name: 'Pre-Energisation', description: 'Pre-Energisation Activities' },
    { name: 'Post Energisation', description: 'Post Energisation Activities' }
  ];
  
  energisationSubSections.forEach((section, index) => {
    const sectionCode = `${energisationCode}.${index + 1}`;
    const sectionStructure = {
      wbs_code: sectionCode,
      parent_wbs_code: energisationCode,
      wbs_name: section.name,
      equipment_number: null,
      description: section.description,
      commissioning_status: null,
      category: null,
      category_name: null,
      level: 3,
      is_equipment: false,
      is_structural: true,
      subsystem: null
    };
    
    wbsStructure.push(sectionStructure);
  });
  
  console.log(`Added Energisation section: ${energisationCode}`);
};

// Generate empty WBS structure when no equipment provided
const generateEmptyWBSStructure = (projectName) => {
  console.log('Generating empty WBS structure with standard categories');
  
  const wbsStructure = [];
  
  // Project root
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

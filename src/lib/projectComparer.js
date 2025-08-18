import { arrayHelpers, stringHelpers, wbsHelpers } from '../utils';
import { categorizeEquipment } from './equipmentProcessor';
import { generateWBSStructure } from './wbsGenerator';
import { WBS_LEVEL_COLORS, BRAND_COLORS } from '../constants';

/**
 * Project Comparer - COMPLETE MISSING EQUIPMENT IMPLEMENTATION
 * Compares equipment lists to identify changes and handles multiple subsystems
 */

// ENHANCED: Complete comparison function with subsystem support
export const compareEquipmentWithSubsystems = (existingP6Data, newEquipmentData) => {
  console.log('=== ENHANCED EQUIPMENT & SUBSYSTEM COMPARISON ===');
  
  const { equipmentCodes: existingEquipment, existingSubsystems } = existingP6Data;
  const { equipment: newEquipmentList, subsystemMapping: newSubsystems } = newEquipmentData;
  
  console.log('Existing P6 equipment:', existingEquipment.length);
  console.log('Existing P6 subsystems:', Object.keys(existingSubsystems));
  console.log('New equipment list:', newEquipmentList.length);
  console.log('New subsystems detected:', Object.keys(newSubsystems));
  
  // Step 1: Find equipment differences
  const equipmentComparison = {
    existing: [], // Equipment that exists in both P6 and new list
    new: [],      // Equipment in new list but not in P6
    removed: []   // Equipment in P6 but not in new list (edge case)
  };
  
  newEquipmentList.forEach(item => {
    const equipmentCode = item.equipment_number;
    if (existingEquipment.includes(equipmentCode)) {
      equipmentComparison.existing.push(item);
    } else {
      equipmentComparison.new.push(item);
    }
  });
  
  // Find removed equipment (in P6 but not in new list)
  existingEquipment.forEach(code => {
    const existsInNewList = newEquipmentList.some(item => item.equipment_number === code);
    if (!existsInNewList) {
      equipmentComparison.removed.push(code);
    }
  });
  
  // Step 2: Find subsystem differences
  const subsystemComparison = {
    existing: [], // Subsystems that exist in both P6 and new equipment
    new: []       // Subsystems in new equipment but not in P6
  };
  
  Object.entries(newSubsystems).forEach(([subsystemKey, subsystemData]) => {
    const subsystemId = `S${subsystemData.index}`; // S1, S2, S3, etc.
    
    if (existingSubsystems[subsystemId]) {
      subsystemComparison.existing.push({
        id: subsystemId,
        key: subsystemKey,
        data: subsystemData,
        existingWBSCode: existingSubsystems[subsystemId].wbs_code
      });
    } else {
      subsystemComparison.new.push({
        id: subsystemId,
        key: subsystemKey,
        data: subsystemData
      });
    }
  });
  
  // Step 3: Categorize new equipment by subsystem type
  const newEquipmentBySubsystemType = {
    existingSubsystems: [], // New equipment going into existing subsystems (S1)
    newSubsystems: []       // Equipment going into entirely new subsystems (S2-S6)
  };
  
  equipmentComparison.new.forEach(item => {
    const itemSubsystem = item.subsystem;
    const subsystemData = newSubsystems[itemSubsystem];
    
    if (subsystemData) {
      const subsystemId = `S${subsystemData.index}`;
      
      if (existingSubsystems[subsystemId]) {
        // Equipment for existing subsystem
        newEquipmentBySubsystemType.existingSubsystems.push({
          ...item,
          targetSubsystem: subsystemId,
          existingWBSCode: existingSubsystems[subsystemId].wbs_code
        });
      } else {
        // Equipment for new subsystem  
        newEquipmentBySubsystemType.newSubsystems.push({
          ...item,
          targetSubsystem: subsystemId,
          subsystemData: subsystemData
        });
      }
    }
  });
  
  const results = {
    equipment: equipmentComparison,
    subsystems: subsystemComparison,
    newEquipmentByType: newEquipmentBySubsystemType,
    summary: {
      total_existing_equipment: equipmentComparison.existing.length,
      total_new_equipment: equipmentComparison.new.length,
      total_removed_equipment: equipmentComparison.removed.length,
      existing_subsystems: subsystemComparison.existing.length,
      new_subsystems: subsystemComparison.new.length,
      new_equipment_for_existing_subsystems: newEquipmentBySubsystemType.existingSubsystems.length,
      new_equipment_for_new_subsystems: newEquipmentBySubsystemType.newSubsystems.length
    }
  };
  
  console.log('=== COMPARISON RESULTS ===');
  console.log('Equipment Summary:', results.summary);
  console.log('New Subsystems:', subsystemComparison.new.map(s => s.id));
  
  return results;
};

// ENHANCED: Smart WBS assignment for Missing Equipment functionality
export const assignSmartWBSCodes = (comparisonResults, existingP6Data, processedEquipmentData) => {
  console.log('=== SMART WBS CODE ASSIGNMENT ===');
  
  const { equipmentMapping: existingEquipmentMapping, existingSubsystems } = existingP6Data;
  const { newEquipmentByType } = comparisonResults;
  const finalWBSStructure = [];
  
  // Step 1: Analyze existing project structure to understand numbering patterns
  const projectStructure = analyzeProjectStructure(existingP6Data);
  console.log('Project structure analysis:', projectStructure);
  
  // Step 2: Handle new equipment in existing subsystems (S1)
  if (newEquipmentByType.existingSubsystems.length > 0) {
    console.log(`Processing ${newEquipmentByType.existingSubsystems.length} new equipment items for existing subsystems`);
    
    const existingSubsystemWBS = assignToExistingSubsystems(
      newEquipmentByType.existingSubsystems,
      existingEquipmentMapping,
      existingSubsystems,
      projectStructure
    );
    
    finalWBSStructure.push(...existingSubsystemWBS);
  }
  
  // Step 3: Handle equipment in entirely new subsystems (S2, S3, S4, S5, S6)
  if (newEquipmentByType.newSubsystems.length > 0) {
    console.log(`Processing ${newEquipmentByType.newSubsystems.length} equipment items for new subsystems`);
    
    const newSubsystemWBS = createNewSubsystemStructures(
      newEquipmentByType.newSubsystems,
      comparisonResults.subsystems.new,
      projectStructure,
      processedEquipmentData
    );
    
    finalWBSStructure.push(...newSubsystemWBS);
  }
  
  console.log(`Total new WBS items created: ${finalWBSStructure.length}`);
  return finalWBSStructure;
};

// Analyze existing project structure to understand numbering patterns
const analyzeProjectStructure = (existingP6Data) => {
  const { existingSubsystems } = existingP6Data;
  
  // Extract project root and numbering pattern
  const subsystemWBSCodes = Object.values(existingSubsystems).map(s => s.wbs_code);
  
  if (subsystemWBSCodes.length === 0) {
    // Fallback if no subsystems found
    return {
      projectRoot: '1',
      nextSubsystemCode: '1.2',
      numberingPattern: 'sequential'
    };
  }
  
  // Analyze existing pattern (e.g., 5737.1064 for S1)
  const firstSubsystem = subsystemWBSCodes[0]; // "5737.1064"
  const parts = firstSubsystem.split('.');
  
  let projectRoot, nextSubsystemCode;
  
  if (parts.length >= 2) {
    projectRoot = parts[0]; // "5737"
    const subsystemLevel = parseInt(parts[1]); // 1064
    nextSubsystemCode = `${projectRoot}.${subsystemLevel + 1}`; // "5737.1065"
  } else {
    projectRoot = '1';
    nextSubsystemCode = '1.2';
  }
  
  return {
    projectRoot,
    nextSubsystemCode,
    numberingPattern: 'incremental',
    existingSubsystems: Object.keys(existingSubsystems)
  };
};

// Assign WBS codes to equipment in existing subsystems
const assignToExistingSubsystems = (equipmentList, existingEquipmentMapping, existingSubsystems, projectStructure) => {
  console.log('Assigning codes to equipment in existing subsystems...');
  
  const wbsItems = [];
  
  // Group equipment by category for smart assignment
  const equipmentByCategory = {};
  equipmentList.forEach(item => {
    const category = item.category;
    if (!equipmentByCategory[category]) {
      equipmentByCategory[category] = [];
    }
    equipmentByCategory[category].push(item);
  });
  
  // For each category, find existing equipment and continue the pattern
  Object.entries(equipmentByCategory).forEach(([categoryId, equipment]) => {
    // Find existing equipment in this category
    const existingInCategory = Object.entries(existingEquipmentMapping)
      .filter(([code, data]) => {
        // Determine category of existing equipment using same logic as equipment processor
        return determineEquipmentCategoryFromCode(code) === categoryId;
      });
    
    if (existingInCategory.length > 0) {
      // Continue existing pattern
      const nextWBSCode = findNextAvailableWBSCode(existingInCategory, categoryId);
      
      equipment.forEach((item, index) => {
        const itemWBSCode = incrementWBSCode(nextWBSCode, index);
        
        wbsItems.push({
          wbs_code: itemWBSCode,
          parent_wbs_code: getParentWBSCode(itemWBSCode),
          wbs_name: `${item.equipment_number} | ${item.description}`,
          equipment_number: item.equipment_number,
          description: item.description,
          commissioning_yn: item.commissioning_yn,
          category: item.category,
          category_name: item.category_name,
          level: getWBSLevel(itemWBSCode),
          is_equipment: true,
          is_structural: false,
          subsystem: item.subsystem,
          isNew: true
        });
      });
    }
  });
  
  return wbsItems;
};

// Create entire new subsystem structures
const createNewSubsystemStructures = (equipmentList, newSubsystems, projectStructure, processedEquipmentData) => {
  console.log('Creating new subsystem structures...');
  
  const wbsItems = [];
  let currentSubsystemCode = projectStructure.nextSubsystemCode;
  
  // Create each new subsystem
  newSubsystems.forEach((subsystemInfo, index) => {
    const subsystemWBSCode = incrementWBSCode(projectStructure.nextSubsystemCode, index);
    
    // Create subsystem header
    wbsItems.push({
      wbs_code: subsystemWBSCode,
      parent_wbs_code: projectStructure.projectRoot,
      wbs_name: subsystemInfo.data.full_name,
      equipment_number: null,
      description: subsystemInfo.data.full_name,
      commissioning_yn: null,
      category: null,
      category_name: null,
      level: getWBSLevel(subsystemWBSCode),
      is_equipment: false,
      is_structural: true,
      subsystem: subsystemInfo.key,
      isNew: true
    });
    
    // Create all categories for this subsystem (reuse existing logic)
    const subsystemEquipment = equipmentList.filter(item => 
      processedEquipmentData.subsystemMapping[item.subsystem]?.index === parseInt(subsystemInfo.id.replace('S', ''))
    );
    
    // Use existing WBS generator logic but with new subsystem root
    const categoryWBSItems = createCategoriesForNewSubsystem(
      subsystemWBSCode,
      subsystemEquipment,
      processedEquipmentData
    );
    
    wbsItems.push(...categoryWBSItems);
  });
  
  return wbsItems;
};

// Helper functions
const determineEquipmentCategoryFromCode = (equipmentCode) => {
  // Use same patterns as equipment processor
  if (/^\+UH\d+/i.test(equipmentCode)) return '02';
  if (/^\+GB\d+/i.test(equipmentCode)) return '06';
  if (/^T\d+/i.test(equipmentCode)) return '05';
  if (/^-F\d+/i.test(equipmentCode)) return '02'; // Child of protection panels
  if (/^-Y\d+/i.test(equipmentCode)) return '02'; // Child of protection panels
  if (/^-FM\d+/i.test(equipmentCode)) return '08';
  // Add more patterns as needed
  return '99';
};

const findNextAvailableWBSCode = (existingInCategory, categoryId) => {
  // Find the highest numbered WBS code in this category
  const wbsCodes = existingInCategory.map(([code, data]) => data.wbs_code);
  const highestCode = wbsCodes.sort().pop();
  
  // Increment to get next available
  return incrementWBSCode(highestCode, 1);
};

const incrementWBSCode = (baseCode, increment) => {
  const parts = baseCode.split('.');
  const lastPart = parseInt(parts[parts.length - 1]) + increment;
  return parts.slice(0, -1).concat([lastPart]).join('.');
};

const getParentWBSCode = (wbsCode) => {
  const parts = wbsCode.split('.');
  return parts.slice(0, -1).join('.');
};

const getWBSLevel = (wbsCode) => {
  return wbsCode.split('.').length;
};

const createCategoriesForNewSubsystem = (subsystemWBSCode, equipment, processedEquipmentData) => {
  // This would reuse existing WBS generator logic but adapted for a single subsystem
  // Create all 11 categories, then add equipment to appropriate categories
  const categoryItems = [];
  
  // Create categories 01-99 for this subsystem
  Object.entries(processedEquipmentData.categoryStats || {}).forEach(([categoryId, stats], index) => {
    const categoryWBSCode = `${subsystemWBSCode}.${index + 1}`;
    
    // Create category structure
    categoryItems.push({
      wbs_code: categoryWBSCode,
      parent_wbs_code: subsystemWBSCode,
      wbs_name: `${categoryId} | ${stats.name}`,
      equipment_number: null,
      description: stats.name,
      commissioning_yn: null,
      category: categoryId,
      category_name: stats.name,
      level: getWBSLevel(categoryWBSCode),
      is_equipment: false,
      is_structural: true,
      isNew: true
    });
    
    // Add equipment for this category
    const categoryEquipment = equipment.filter(item => item.category === categoryId);
    categoryEquipment.forEach((item, equipIndex) => {
      const equipmentWBSCode = `${categoryWBSCode}.${equipIndex + 1}`;
      
      categoryItems.push({
        wbs_code: equipmentWBSCode,
        parent_wbs_code: categoryWBSCode,
        wbs_name: `${item.equipment_number} | ${item.description}`,
        equipment_number: item.equipment_number,
        description: item.description,
        commissioning_yn: item.commissioning_yn,
        category: item.category,
        category_name: item.category_name,
        level: getWBSLevel(equipmentWBSCode),
        is_equipment: true,
        is_structural: false,
        subsystem: item.subsystem,
        isNew: true
      });
    });
  });
  
  return categoryItems;
};

// MAIN WRAPPER: Updated function that uses the new comparison approach
export const compareEquipmentLists = (existingProject, updatedEquipmentList) => {
  try {
    if (!existingProject || !updatedEquipmentList) {
      throw new Error('Both existing project and updated equipment list are required');
    }

    console.log('=== ENHANCED EQUIPMENT COMPARISON WITH SUBSYSTEM SUPPORT ===');

    // STEP 1: Process new equipment through categorization first
    console.log('Processing new equipment through categorization...');
    const processedNewEquipment = await categorizeEquipment(updatedEquipmentList);
    
    // STEP 2: Use the enhanced comparison function
    const comparisonResults = compareEquipmentWithSubsystems(existingProject, processedNewEquipment);
    
    // STEP 3: Assign WBS codes to new equipment
    console.log('Assigning WBS codes to new equipment...');
    const newWBSItems = assignSmartWBSCodes(comparisonResults, existingProject, processedNewEquipment);
    
    // STEP 4: Build integrated structure (existing + new)
    const integratedStructure = buildIntegratedWBSStructure(
      existingProject.wbsStructure || existingProject.wbs_structure,
      newWBSItems
    );
    
    // STEP 5: Prepare export data (new items only)
    const exportData = prepareExportData(newWBSItems);
    
    // STEP 6: Build final result in expected format
    const finalResult = {
      comparison: {
        added: comparisonResults.equipment.new,
        existing: comparisonResults.equipment.existing,
        removed: comparisonResults.equipment.removed,
        modified: []
      },
      subsystems: comparisonResults.subsystems,
      wbs_assignment: {
        new_wbs_items: newWBSItems
      },
      integrated_structure: integratedStructure,
      summary: comparisonResults.summary,
      export_ready: exportData
    };

    console.log('Enhanced comparison completed:', {
      newEquipment: finalResult.comparison.added.length,
      existingEquipment: finalResult.comparison.existing.length,
      newSubsystems: finalResult.subsystems.new.length,
      newWBSItems: newWBSItems.length
    });

    return finalResult;

  } catch (error) {
    throw new Error(`Equipment comparison failed: ${error.message}`);
  }
};

// ENHANCED: Extract equipment from existing project structure with better P6 support
const extractEquipmentFromProject = (existingProject) => {
  console.log('Extracting equipment from existing project...');
  
  // NEW: Handle enhanced P6 data structure
  if (existingProject.equipmentCodes && existingProject.equipmentMapping) {
    console.log('Using enhanced P6 equipment mapping...');
    return Object.entries(existingProject.equipmentMapping).map(([code, data]) => ({
      equipment_number: code,
      description: data.description || '',
      wbs_code: data.wbs_code,
      parent_wbs_code: data.parent_wbs_code,
      level: data.level || 0,
      existing_wbs_code: data.wbs_code,
      parent_wbs_code: data.parent_wbs_code
    }));
  }
  
  // FALLBACK: Extract from WBS structure
  const wbsStructure = existingProject.wbsStructure || existingProject.wbs_structure || [];
  
  return wbsStructure
    .filter(item => item.wbs_name && item.wbs_name.includes('|'))
    .map(item => {
      const parts = item.wbs_name.split('|');
      const equipmentCode = parts[0] ? parts[0].trim() : '';
      const description = parts[1] ? parts[1].trim() : '';
      
      return {
        equipment_number: equipmentCode,
        description: description,
        wbs_code: item.wbs_code,
        parent_wbs_code: item.parent_wbs_code,
        level: item.level || 0,
        existing_wbs_code: item.wbs_code,
        parent_wbs_code: item.parent_wbs_code
      };
    });
};

// ENHANCED: Extract subsystems from existing project
const extractSubsystemsFromProject = (existingProject) => {
  console.log('Extracting subsystems from existing project...');
  
  const subsystems = {};
  
  // NEW: Handle enhanced P6 data with existing subsystems
  if (existingProject.existingSubsystems) {
    console.log('Using enhanced P6 subsystem data...');
    return existingProject.existingSubsystems;
  }
  
  // FALLBACK: Extract from WBS structure
  const wbsStructure = existingProject.wbsStructure || existingProject.wbs_structure || [];
  
  wbsStructure.forEach(item => {
    const wbsName = item.wbs_name || '';
    
    // Look for subsystem pattern: S1 | +Z01 | Subsystem Name
    const subsystemMatch = wbsName.match(/^S(\d+)\s*\|\s*([^|]+)\s*\|\s*(.+)/);
    if (subsystemMatch) {
      const subsystemNumber = subsystemMatch[1];
      const subsystemCode = subsystemMatch[2].trim();
      const subsystemName = subsystemMatch[3].trim();
      
      subsystems[`S${subsystemNumber}`] = {
        wbs_code: item.wbs_code,
        code: subsystemCode,
        name: subsystemName,
        full_name: wbsName
      };
    }
  });
  
  console.log('Extracted subsystems:', Object.keys(subsystems));
  return subsystems;
};

// EXISTING: Build integrated WBS structure (existing + new with flags)
const buildIntegratedWBSStructure = (existingWBS, newWBSItems) => {
  console.log('Building integrated WBS structure...');
  
  // Mark existing items
  const markedExisting = existingWBS.map(item => ({ ...item, isNew: false }));
  
  // Mark new items
  const markedNew = newWBSItems.map(item => ({ ...item, isNew: true }));
  
  // Combine and sort by WBS code
  const combined = [...markedExisting, ...markedNew];
  
  // Sort hierarchically
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

// EXISTING: Prepare export data (new items only)
const prepareExportData = (newWBSItems) => {
  return newWBSItems.map(item => ({
    wbs_code: item.wbs_code,
    parent_wbs_code: item.parent_wbs_code || '',
    wbs_name: item.wbs_name,
    equipment_number: item.equipment_number,
    description: item.description,
    commissioning_yn: item.commissioning_yn,
    is_new: true
  }));
};

// LEGACY COMPATIBILITY: Keep original function name as alias
export const compareEquipment = compareEquipmentLists;

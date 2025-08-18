import { arrayHelpers, stringHelpers, wbsHelpers } from '../utils';
import { categorizeEquipment } from './equipmentProcessor';
import { generateWBSStructure } from './wbsGenerator';
import { WBS_LEVEL_COLORS, BRAND_COLORS } from '../constants';

/**
 * Project Comparer - ENHANCED for Missing Equipment with Subsystem Support
 * Compares equipment lists to identify changes and handles multiple subsystems
 */

// ENHANCED: Main comparison function with subsystem support
export const compareEquipmentLists = async (existingProject, updatedEquipmentList) => {
  try {
    if (!existingProject || !updatedEquipmentList) {
      throw new Error('Both existing project and updated equipment list are required');
    }

    console.log('=== ENHANCED EQUIPMENT COMPARISON WITH SUBSYSTEM SUPPORT ===');

    // Extract equipment from existing project
    const existingEquipment = extractEquipmentFromProject(existingProject);
    
    // ENHANCED: Extract subsystem information from existing project  
    const existingSubsystems = extractSubsystemsFromProject(existingProject);
    
    // Normalize both equipment lists for comparison
    const normalizedExisting = normalizeEquipmentForComparison(existingEquipment);
    const normalizedUpdated = normalizeEquipmentForComparison(updatedEquipmentList);

    // ENHANCED: Perform detailed comparison with subsystem awareness
    const comparisonResult = performEnhancedComparison(normalizedExisting, normalizedUpdated);
    
    // Process new equipment through categorization (includes subsystem detection)
    let processedNewEquipment = null;
    if (comparisonResult.added.length > 0) {
      console.log('Processing new equipment through categorization...');
      processedNewEquipment = await categorizeEquipment(comparisonResult.added);
      comparisonResult.added = processedNewEquipment.equipment;
    }

    // ENHANCED: Subsystem comparison
    const subsystemComparison = compareSubsystems(existingSubsystems, processedNewEquipment);

    // ENHANCED: Smart WBS code assignment with subsystem support
    const wbsAssignment = assignEnhancedWBSCodes(
      comparisonResult,
      subsystemComparison,
      existingProject,
      processedNewEquipment
    );

    // Build integrated WBS structure
    const integratedStructure = buildIntegratedWBSStructure(
      existingProject.wbsStructure || existingProject.wbs_structure,
      wbsAssignment.new_wbs_items
    );

    // Generate enhanced comparison summary
    const summary = generateEnhancedComparisonSummary(comparisonResult, subsystemComparison, wbsAssignment);

    return {
      comparison: comparisonResult,
      subsystems: subsystemComparison, // ENHANCED
      wbs_assignment: wbsAssignment,
      integrated_structure: integratedStructure,
      summary: summary,
      export_ready: prepareExportData(wbsAssignment.new_wbs_items)
    };

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
      commissioning_status: 'Y', // Default for existing equipment
      wbs_code: data.wbs_code,
      category: extractCategoryFromWBSName(data.wbs_name),
      existing_wbs_code: data.wbs_code,
      parent_wbs_code: data.parent_wbs_code
    }));
  }
  
  // EXISTING: Handle direct equipment list
  if (existingProject.equipment_list && existingProject.equipment_list.length > 0) {
    return existingProject.equipment_list;
  }
  
  // EXISTING: Extract from WBS structure
  if (existingProject.wbs_structure && existingProject.wbs_structure.length > 0) {
    return existingProject.wbs_structure
      .filter(item => item.is_equipment && item.equipment_number)
      .map(item => ({
        equipment_number: item.equipment_number,
        description: item.description || '',
        commissioning_status: item.commissioning_status || 'Y',
        wbs_code: item.wbs_code,
        category: extractCategoryFromWBS(item),
        existing_wbs_code: item.wbs_code
      }));
  }
  
  // EXISTING: Handle alternative WBS structure property name
  if (existingProject.wbsStructure && existingProject.wbsStructure.length > 0) {
    return existingProject.wbsStructure
      .filter(item => item.wbs_name && item.wbs_name.includes('|'))
      .map(item => {
        const equipmentCode = item.wbs_name.split('|')[0].trim();
        const description = item.wbs_name.split('|')[1]?.trim() || '';
        
        return {
          equipment_number: equipmentCode,
          description: description,
          commissioning_status: 'Y',
          wbs_code: item.wbs_code,
          category: extractCategoryFromWBSName(item.wbs_name),
          existing_wbs_code: item.wbs_code,
          parent_wbs_code: item.parent_wbs_code
        };
      });
  }
  
  throw new Error('No equipment data found in existing project');
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

// ENHANCED: Extract category from WBS name (handles various formats)
const extractCategoryFromWBSName = (wbsName) => {
  // Look for category pattern in WBS name (e.g., "02 | Protection Panels")
  const categoryMatch = wbsName.match(/(\d{2})\s*\|/);
  return categoryMatch ? categoryMatch[1] : '99';
};

// EXISTING: Extract category from WBS structure (kept for compatibility)
const extractCategoryFromWBS = (wbsItem) => {
  const categoryMatch = wbsItem.wbs_name.match(/^(\d{2})\s*\|/);
  return categoryMatch ? categoryMatch[1] : '99';
};

// EXISTING: Normalize equipment for comparison (kept existing logic)
const normalizeEquipmentForComparison = (equipmentList) => {
  return equipmentList.map(item => ({
    equipment_number: stringHelpers.cleanEquipmentCode(item.equipment_number),
    description: (item.description || '').trim(),
    commissioning_status: (item.commissioning_status || item.commissioning_yn || 'Y').toUpperCase(),
    plu_field: stringHelpers.cleanEquipmentCode(item.plu_field || ''),
    category: item.category || null,
    wbs_code: item.wbs_code || item.existing_wbs_code || null,
    parent_wbs_code: item.parent_wbs_code || null,
    subsystem: item.subsystem || null, // ENHANCED: Include subsystem
    original_data: item // Keep reference to original
  }));
};

// ENHANCED: Perform detailed equipment comparison with subsystem tracking
const performEnhancedComparison = (existingEquipment, updatedEquipment) => {
  console.log('Performing enhanced equipment comparison...');
  
  // Create lookup maps for efficient comparison
  const existingMap = new Map();
  const updatedMap = new Map();
  
  existingEquipment.forEach(item => {
    existingMap.set(item.equipment_number, item);
  });
  
  updatedEquipment.forEach(item => {
    updatedMap.set(item.equipment_number, item);
  });

  // Find differences
  const added = [];
  const removed = [];
  const existing = [];
  const modified = [];

  // Check for new equipment (in updated but not in existing)
  updatedEquipment.forEach(updatedItem => {
    if (!existingMap.has(updatedItem.equipment_number)) {
      added.push({
        ...updatedItem.original_data,
        equipment_number: updatedItem.equipment_number,
        is_new: true,
        change_type: 'added'
      });
    }
  });

  // Check for removed equipment (in existing but not in updated)
  existingEquipment.forEach(existingItem => {
    if (!updatedMap.has(existingItem.equipment_number)) {
      removed.push({
        ...existingItem.original_data,
        equipment_number: existingItem.equipment_number,
        change_type: 'removed'
      });
    }
  });

  // Check for existing and modified equipment
  existingEquipment.forEach(existingItem => {
    const updatedItem = updatedMap.get(existingItem.equipment_number);
    if (updatedItem) {
      // Equipment exists in both lists - check for modifications
      const changes = detectEquipmentChanges(existingItem, updatedItem);
      
      if (changes.length > 0) {
        modified.push({
          ...updatedItem.original_data,
          equipment_number: updatedItem.equipment_number,
          changes: changes,
          change_type: 'modified',
          existing_data: existingItem.original_data
        });
      } else {
        existing.push({
          ...existingItem.original_data,
          equipment_number: existingItem.equipment_number,
          change_type: 'unchanged'
        });
      }
    }
  });

  console.log('Enhanced comparison results:', {
    added: added.length,
    removed: removed.length,
    existing: existing.length,
    modified: modified.length
  });

  return {
    added,
    removed,
    existing,
    modified,
    total_existing_equipment: existingEquipment.length,
    total_updated_equipment: updatedEquipment.length
  };
};

// ENHANCED: Compare subsystems between existing and new
const compareSubsystems = (existingSubsystems, processedNewEquipment) => {
  console.log('=== COMPARING SUBSYSTEMS ===');
  
  if (!processedNewEquipment || !processedNewEquipment.subsystemMapping) {
    console.log('No new subsystem data available');
    return {
      existing: Object.keys(existingSubsystems).map(key => ({ id: key, ...existingSubsystems[key] })),
      new: [],
      summary: {
        existing_count: Object.keys(existingSubsystems).length,
        new_count: 0
      }
    };
  }
  
  const newSubsystems = processedNewEquipment.subsystemMapping;
  const subsystemComparison = {
    existing: [],
    new: []
  };
  
  // Check each new subsystem against existing ones
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
  
  console.log('Subsystem comparison:', {
    existing: subsystemComparison.existing.map(s => s.id),
    new: subsystemComparison.new.map(s => s.id)
  });
  
  return {
    ...subsystemComparison,
    summary: {
      existing_count: subsystemComparison.existing.length,
      new_count: subsystemComparison.new.length
    }
  };
};

// EXISTING: Detect changes between equipment items (kept your existing logic)
const detectEquipmentChanges = (existingItem, updatedItem) => {
  const changes = [];

  // Check description changes
  if (existingItem.description !== updatedItem.description) {
    changes.push({
      field: 'description',
      old_value: existingItem.description,
      new_value: updatedItem.description
    });
  }

  // Check commissioning status changes
  if (existingItem.commissioning_status !== updatedItem.commissioning_status) {
    changes.push({
      field: 'commissioning_status',
      old_value: existingItem.commissioning_status,
      new_value: updatedItem.commissioning_status
    });
  }

  // ENHANCED: Check subsystem changes
  if (existingItem.subsystem !== updatedItem.subsystem) {
    changes.push({
      field: 'subsystem',
      old_value: existingItem.subsystem,
      new_value: updatedItem.subsystem
    });
  }

  return changes;
};

// ENHANCED: Smart WBS code assignment with subsystem support
const assignEnhancedWBSCodes = (comparisonResult, subsystemComparison, existingProject, processedNewEquipment) => {
  console.log('=== ENHANCED WBS CODE ASSIGNMENT ===');
  
  const newWBSItems = [];
  const assignmentSummary = {
    by_category: {},
    by_subsystem: {},
    total_assigned: 0
  };

  // ENHANCED: Handle equipment for existing subsystems (smart continuation)
  const newEquipmentForExistingSubsystems = comparisonResult.added.filter(item => {
    const itemSubsystem = item.subsystem;
    const subsystemData = processedNewEquipment?.subsystemMapping?.[itemSubsystem];
    if (!subsystemData) return false;
    
    const subsystemId = `S${subsystemData.index}`;
    return subsystemComparison.existing.some(existing => existing.id === subsystemId);
  });

  if (newEquipmentForExistingSubsystems.length > 0) {
    console.log(`Assigning ${newEquipmentForExistingSubsystems.length} equipment items to existing subsystems`);
    const existingSubsystemWBS = assignToExistingSubsystems(
      newEquipmentForExistingSubsystems,
      existingProject,
      subsystemComparison.existing
    );
    newWBSItems.push(...existingSubsystemWBS);
  }

  // ENHANCED: Handle equipment for new subsystems (full structure creation)
  const newEquipmentForNewSubsystems = comparisonResult.added.filter(item => {
    const itemSubsystem = item.subsystem;
    const subsystemData = processedNewEquipment?.subsystemMapping?.[itemSubsystem];
    if (!subsystemData) return false;
    
    const subsystemId = `S${subsystemData.index}`;
    return subsystemComparison.new.some(newSub => newSub.id === subsystemId);
  });

  if (newEquipmentForNewSubsystems.length > 0) {
    console.log(`Creating structures for ${subsystemComparison.new.length} new subsystems`);
    const newSubsystemWBS = createNewSubsystemStructures(
      newEquipmentForNewSubsystems,
      subsystemComparison.new,
      existingProject,
      processedNewEquipment
    );
    newWBSItems.push(...newSubsystemWBS);
  }

  // EXISTING: Fallback to original logic for equipment without subsystem data
  const remainingEquipment = comparisonResult.added.filter(item => 
    !newEquipmentForExistingSubsystems.includes(item) && 
    !newEquipmentForNewSubsystems.includes(item)
  );

  if (remainingEquipment.length > 0) {
    console.log(`Using fallback assignment for ${remainingEquipment.length} equipment items`);
    const fallbackWBS = assignWBSCodesToNewEquipment(
      remainingEquipment,
      existingProject.wbsStructure || existingProject.wbs_structure
    );
    newWBSItems.push(...fallbackWBS.new_wbs_items);
  }

  return {
    new_wbs_items: newWBSItems,
    assignment_summary: assignmentSummary
  };
};

// ENHANCED: Assign codes to equipment in existing subsystems
const assignToExistingSubsystems = (equipmentList, existingProject, existingSubsystems) => {
  console.log('Assigning WBS codes to equipment in existing subsystems...');
  
  const wbsItems = [];
  const existingWBS = existingProject.wbsStructure || existingProject.wbs_structure || [];
  
  // Group equipment by category
  const equipmentByCategory = arrayHelpers.groupBy(equipmentList, 'category');
  
  Object.entries(equipmentByCategory).forEach(([categoryId, equipment]) => {
    console.log(`Processing category ${categoryId} with ${equipment.length} items`);
    
    // Find existing equipment in this category to understand the pattern
    const existingInCategory = existingWBS.filter(item => {
      return item.wbs_name && extractCategoryFromWBSName(item.wbs_name) === categoryId;
    });
    
    if (existingInCategory.length > 0) {
      // Find the category parent WBS code
      const categoryWBS = findCategoryWBSCode(existingInCategory);
      const nextAvailableCode = findNextAvailableWBSCode(existingInCategory);
      
      equipment.forEach((item, index) => {
        const itemWBSCode = wbsHelpers.incrementWBSCode(nextAvailableCode, index);
        
        wbsItems.push({
          wbs_code: itemWBSCode,
          parent_wbs_code: categoryWBS,
          wbs_name: `${item.equipment_number} | ${item.description}`,
          equipment_number: item.equipment_number,
          description: item.description,
          commissioning_yn: item.commissioning_yn || item.commissioning_status,
          category: item.category,
          category_name: item.category_name,
          level: itemWBSCode.split('.').length,
          is_equipment: true,
          is_structural: false,
          subsystem: item.subsystem,
          isNew: true
        });
        
        console.log(`Assigned: ${item.equipment_number} → ${itemWBSCode}`);
      });
    }
  });
  
  return wbsItems;
};

// ENHANCED: Create new subsystem structures
const createNewSubsystemStructures = (equipmentList, newSubsystems, existingProject, processedNewEquipment) => {
  console.log('Creating new subsystem structures...');
  
  // Analyze existing project structure for patterns
  const projectStructure = analyzeExistingProjectStructure(existingProject);
  
  // Use existing WBS generator to create new subsystem structures
  const newSubsystemEquipmentData = {
    equipment: equipmentList,
    subsystemMapping: {},
    categoryStats: processedNewEquipment?.categoryStats || {}
  };
  
  // Create subsystem mapping for new subsystems only
  newSubsystems.forEach(subsystem => {
    newSubsystemEquipmentData.subsystemMapping[subsystem.key] = subsystem.data;
  });
  
  // Generate WBS structure for new subsystems using existing generator
  const generatedWBS = generateWBSStructure(
    newSubsystemEquipmentData,
    existingProject.projectInfo?.projectName || 'Project Update'
  );
  
  // Adjust WBS codes to fit after existing structure
  const adjustedWBS = adjustWBSCodesForExistingProject(
    generatedWBS.wbsStructure,
    projectStructure
  );
  
  return adjustedWBS;
};

// ENHANCED: Analyze existing project structure for pattern continuation
const analyzeExistingProjectStructure = (existingProject) => {
  const wbsStructure = existingProject.wbsStructure || existingProject.wbs_structure || [];
  
  if (wbsStructure.length === 0) {
    return {
      projectRoot: '1',
      nextSubsystemCode: '1.3',
      numberingPattern: 'sequential'
    };
  }
  
  // Find project root and highest subsystem number
  const subsystemItems = wbsStructure.filter(item => 
    item.wbs_name && /^S\d+\s*\|/.test(item.wbs_name)
  );
  
  if (subsystemItems.length > 0) {
    const firstSubsystem = subsystemItems[0];
    const parts = firstSubsystem.wbs_code.split('.');
    const projectRoot = parts[0];
    const lastSubsystemLevel = Math.max(...subsystemItems.map(item => 
      parseInt(item.wbs_code.split('.')[1])
    ));
    
    return {
      projectRoot: projectRoot,
      nextSubsystemCode: `${projectRoot}.${lastSubsystemLevel + 1}`,
      numberingPattern: 'incremental'
    };
  }
  
  // Fallback analysis
  const allWBSCodes = wbsStructure.map(item => item.wbs_code);
  const rootCode = allWBSCodes[0]?.split('.')[0] || '1';
  
  return {
    projectRoot: rootCode,
    nextSubsystemCode: `${rootCode}.3`,
    numberingPattern: 'sequential'
  };
};

// ENHANCED: Adjust generated WBS codes to fit existing project
const adjustWBSCodesForExistingProject = (generatedWBS, projectStructure) => {
  console.log('Adjusting WBS codes for existing project structure...');
  
  return generatedWBS.map(item => {
    // Skip root item (project name)
    if (!item.parent_wbs_code) {
      return null; // Don't include project root
    }
    
    // Adjust subsystem codes
    if (item.wbs_code.split('.').length === 2) {
      const subsystemIndex = parseInt(item.wbs_code.split('.')[1]) - 3; // Adjust for M, P sections
      const newWBSCode = wbsHelpers.incrementWBSCode(projectStructure.nextSubsystemCode, subsystemIndex);
      
      return {
        ...item,
        wbs_code: newWBSCode,
        parent_wbs_code: projectStructure.projectRoot,
        isNew: true
      };
    }
    
    // Adjust child codes accordingly
    const parts = item.wbs_code.split('.');
    const subsystemIndex = parseInt(parts[1]) - 3;
    const newSubsystemCode = wbsHelpers.incrementWBSCode(projectStructure.nextSubsystemCode, subsystemIndex);
    const newWBSCode = newSubsystemCode + '.' + parts.slice(2).join('.');
    const newParentCode = parts.length > 3 ? 
      newSubsystemCode + '.' + parts.slice(2, -1).join('.') : 
      newSubsystemCode;
    
    return {
      ...item,
      wbs_code: newWBSCode,
      parent_wbs_code: newParentCode,
      isNew: true
    };
  }).filter(item => item !== null);
};

// EXISTING: Helper functions (kept your existing logic)
const findCategoryWBSCode = (existingInCategory) => {
  const categoryItem = existingInCategory.find(item => 
    /^\d{2}\s*\|/.test(item.wbs_name)
  );
  return categoryItem ? categoryItem.wbs_code : null;
};

const findNextAvailableWBSCode = (existingInCategory) => {
  const equipmentItems = existingInCategory.filter(item => 
    item.wbs_name && item.wbs_name.includes('|') && !/^\d{2}\s*\|/.test(item.wbs_name)
  );
  
  if (equipmentItems.length === 0) {
    const categoryWBS = findCategoryWBSCode(existingInCategory);
    return categoryWBS ? `${categoryWBS}.1` : '1.1.1.1';
  }
  
  const wbsCodes = equipmentItems.map(item => item.wbs_code).sort();
  const lastCode = wbsCodes[wbsCodes.length - 1];
  return wbsHelpers.incrementWBSCode(lastCode, 1);
};

// EXISTING: Assign WBS codes to new equipment (kept for fallback compatibility)
const assignWBSCodesToNewEquipment = (newEquipment, existingWBSStructure) => {
  console.log('Assigning WBS codes using fallback method...');
  
  if (!existingWBSStructure || existingWBSStructure.length === 0) {
    throw new Error('No existing WBS structure provided for code assignment');
  }

  const newWBSItems = [];
  let wbsCodeCounter = findHighestWBSCode(existingWBSStructure) + 1;

  // Group equipment by category for better organization
  const equipmentByCategory = arrayHelpers.groupBy(newEquipment, 'category');

  Object.entries(equipmentByCategory).forEach(([category, equipment]) => {
    // Find existing category structure in WBS
    const categoryWBS = existingWBSStructure.find(item => 
      item.category === category || extractCategoryFromWBS(item) === category
    );

    const categoryWBSCode = categoryWBS ? categoryWBS.wbs_code : `1.1.${wbsCodeCounter++}`;

    equipment.forEach((item, index) => {
      const equipmentWBSCode = `${categoryWBSCode}.${index + 1}`;
      
      newWBSItems.push({
        wbs_code: equipmentWBSCode,
        parent_wbs_code: categoryWBSCode,
        wbs_name: `${item.equipment_number} | ${item.description}`,
        equipment_number: item.equipment_number,
        description: item.description,
        commissioning_yn: item.commissioning_yn || item.commissioning_status,
        category: item.category,
        level: equipmentWBSCode.split('.').length,
        is_equipment: true,
        is_new: true
      });
    });
  });

  return {
    new_wbs_items: newWBSItems,
    assignment_summary: {
      by_category: equipmentByCategory,
      total_assigned: newWBSItems.length
    }
  };
};

// EXISTING: Build integrated WBS structure (kept your existing logic)
const buildIntegratedWBSStructure = (existingWBS, newWBSItems) => {
  // Mark existing items
  const markedExisting = existingWBS.map(item => ({ ...item, is_new: false }));
  
  // Mark new items
  const markedNew = newWBSItems.map(item => ({ ...item, is_new: true }));
  
  // Combine and sort
  const combined = [...markedExisting, ...markedNew];
  
  return arrayHelpers.sortBy(combined, [
    { key: 'wbs_code', order: 'asc' }
  ]);
};

// ENHANCED: Generate comparison summary with subsystem info
const generateEnhancedComparisonSummary = (comparisonResult, subsystemComparison, wbsAssignment) => {
  const summary = {
    equipment_changes: {
      added: comparisonResult.added.length,
      removed: comparisonResult.removed.length,
      modified: comparisonResult.modified.length,
      unchanged: comparisonResult.existing.length
    },
    subsystem_changes: { // ENHANCED
      existing_subsystems: subsystemComparison.existing.length,
      new_subsystems: subsystemComparison.new.length
    },
    wbs_changes: {
      new_wbs_items: wbsAssignment.new_wbs_items.length,
      categories_affected: Object.keys(wbsAssignment.assignment_summary.by_category).length
    },
    significant_changes: comparisonResult.added.length > 0 || comparisonResult.removed.length > 0,
    change_percentage: calculateChangePercentage(comparisonResult),
    recommendations: generateEnhancedRecommendations(comparisonResult, subsystemComparison, wbsAssignment)
  };

  console.log('Enhanced comparison summary:', summary);
  return summary;
};

// EXISTING: Calculate change percentage (kept your existing logic)
const calculateChangePercentage = (comparisonResult) => {
  const totalChanges = comparisonResult.added.length + 
                      comparisonResult.removed.length + 
                      comparisonResult.modified.length;
  
  const totalEquipment = comparisonResult.total_existing_equipment;
  
  return totalEquipment > 0 ? 
    Math.round((totalChanges / totalEquipment) * 100) : 0;
};

// ENHANCED: Generate recommendations with subsystem awareness
const generateEnhancedRecommendations = (comparisonResult, subsystemComparison, wbsAssignment) => {
  const recommendations = [];

  if (comparisonResult.added.length > 0) {
    recommendations.push(`Import ${comparisonResult.added.length} new equipment items into P6`);
  }

  if (subsystemComparison.new.length > 0) {
    recommendations.push(`Create ${subsystemComparison.new.length} new subsystem structures in P6`);
  }

  if (comparisonResult.removed.length > 0) {
    recommendations.push(`Review ${comparisonResult.removed.length} equipment items that were removed`);
  }

  if (comparisonResult.modified.length > 0) {
    recommendations.push(`Update ${comparisonResult.modified.length} modified equipment items`);
  }

  return recommendations;
};

// EXISTING: Helper functions (kept your existing logic)
const findHighestWBSCode = (wbsStructure) => {
  const wbsCodes = wbsStructure
    .map(item => item.wbs_code)
    .filter(code => code && /^\d+(\.\d+)*$/.test(code))
    .map(code => parseInt(code.split('.').pop()))
    .filter(num => !isNaN(num));
  
  return wbsCodes.length > 0 ? Math.max(...wbsCodes) : 0;
};

// EXISTING: Prepare export data (kept your existing logic)
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

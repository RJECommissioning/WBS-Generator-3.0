import {
  WBS_STRUCTURE,
  WBS_CATEGORIES, 
  EQUIPMENT_CATEGORY_RULES,
  SUB_CATEGORY_PATTERNS,
  COMMISSIONING_STATUS,
  WBS_SETTINGS,
  EQUIPMENT_MAPPINGS
} from './constants.js';

/**
 * Core WBS Processing Functions
 */

/**
 * Categorize equipment based on predefined rules
 * @param {string} equipmentCode - Equipment identifier
 * @param {string} equipmentName - Equipment name/description
 * @returns {string} Category code (01-10, 99)
 */
export function categorizeEquipment(equipmentCode, equipmentName = '') {
  if (!equipmentCode) return '99';
  
  const cleanCode = equipmentCode.trim().toUpperCase();
  
  // Check each category's rules
  for (const [categoryCode, rules] of Object.entries(EQUIPMENT_CATEGORY_RULES)) {
    if (Array.isArray(rules)) {
      // Handle string matches (like 'Test bay', 'Panel Shop')
      for (const rule of rules) {
        if (typeof rule === 'string' && cleanCode.includes(rule.toUpperCase())) {
          return categoryCode;
        } else if (typeof rule === 'object' && rule.pattern) {
          // Handle regex patterns
          if (rule.pattern.test(cleanCode)) {
            return categoryCode;
          }
        }
      }
    }
  }
  
  return '99'; // Unrecognized equipment
}

/**
 * Generate WBS code for equipment
 * @param {string} parentCode - Parent WBS code
 * @param {number} sequence - Sequence number for this level
 * @returns {string} Generated WBS code
 */
export function generateWBSCode(parentCode, sequence) {
  if (!parentCode) return WBS_SETTINGS.ROOT_CODE;
  return `${parentCode}${WBS_SETTINGS.SEPARATOR}${sequence}`;
}

/**
 * Extract base equipment code from full equipment identifier
 * @param {string} equipmentId - Full equipment identifier (e.g., "+UH101-F")
 * @returns {string} Base code (e.g., "UH101")
 */
export function extractBaseEquipmentCode(equipmentId) {
  if (!equipmentId) return '';
  
  const cleaned = equipmentId.trim().replace(/^\+/, ''); // Remove leading +
  const dashIndex = cleaned.indexOf('-');
  
  return dashIndex > -1 ? cleaned.substring(0, dashIndex) : cleaned;
}

/**
 * Extract sub-device code from equipment identifier
 * @param {string} equipmentId - Full equipment identifier (e.g., "+UH101-F")
 * @returns {string|null} Sub-device code (e.g., "-F") or null
 */
export function extractSubDeviceCode(equipmentId) {
  if (!equipmentId) return null;
  
  const dashIndex = equipmentId.indexOf('-');
  return dashIndex > -1 ? equipmentId.substring(dashIndex) : null;
}

/**
 * Build hierarchical WBS structure from equipment list
 * @param {Array} equipmentList - Array of equipment objects
 * @param {string} projectName - Name of the project
 * @param {string} subsystemName - Name of the subsystem
 * @returns {Object} Complete WBS structure
 */
export function buildWBSStructure(equipmentList, projectName = 'Project Name', subsystemName = 'Subsystem Name') {
  const structure = {
    code: WBS_SETTINGS.ROOT_CODE,
    name: projectName,
    children: [],
    level: 0
  };

  // Add Milestone
  structure.children.push({
    code: WBS_SETTINGS.MILESTONE_CODE,
    name: WBS_STRUCTURE.MILESTONE,
    children: [],
    level: 1,
    parent_code: WBS_SETTINGS.ROOT_CODE
  });

  // Add Prerequisites  
  structure.children.push({
    code: WBS_SETTINGS.PREREQUISITES_CODE,
    name: WBS_STRUCTURE.PREREQUISITES,
    children: [],
    level: 1,
    parent_code: WBS_SETTINGS.ROOT_CODE
  });

  // Add Main Subsystem
  const subsystemCode = WBS_SETTINGS.SUBSYSTEM_START_CODE;
  const subsystem = {
    code: subsystemCode,
    name: `S1 | Z01 | ${subsystemName}`,
    children: [],
    level: 1,
    parent_code: WBS_SETTINGS.ROOT_CODE
  };

  // Group equipment by categories
  const categoryGroups = groupEquipmentByCategory(equipmentList);
  
  // Build category structure
  let categorySequence = 1;
  for (const [categoryCode, equipment] of Object.entries(categoryGroups)) {
    const categoryWBSCode = generateWBSCode(subsystemCode, categorySequence);
    const categoryNode = {
      code: categoryWBSCode,
      name: `${categoryCode} | ${WBS_CATEGORIES[categoryCode]}`,
      children: [],
      level: 2,
      parent_code: subsystemCode,
      category: categoryCode
    };

    // Add equipment to category
    const equipmentNodes = buildEquipmentNodes(equipment, categoryWBSCode);
    categoryNode.children = equipmentNodes;
    
    subsystem.children.push(categoryNode);
    categorySequence++;
  }

  structure.children.push(subsystem);

  // Add TBC section if needed
  const tbcEquipment = equipmentList.filter(eq => eq.commissioning_status === 'TBC');
  if (tbcEquipment.length > 0) {
    const tbcNode = {
      code: WBS_SETTINGS.TBC_CODE,
      name: 'TBC - Equipment To Be Confirmed',
      children: buildEquipmentNodes(tbcEquipment, WBS_SETTINGS.TBC_CODE),
      level: 1,
      parent_code: WBS_SETTINGS.ROOT_CODE
    };
    structure.children.push(tbcNode);
  }

  return structure;
}

/**
 * Group equipment by category
 * @param {Array} equipmentList - Array of equipment objects
 * @returns {Object} Equipment grouped by category code
 */
export function groupEquipmentByCategory(equipmentList) {
  const groups = {};
  
  equipmentList
    .filter(eq => eq.commissioning_status === 'Y')
    .forEach(equipment => {
      const category = categorizeEquipment(equipment.equipment_number, equipment.equipment_name);
      
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(equipment);
    });

  return groups;
}

/**
 * Build equipment nodes for a specific category
 * @param {Array} equipmentArray - Equipment in this category
 * @param {string} parentCode - Parent WBS code
 * @returns {Array} Array of equipment WBS nodes
 */
export function buildEquipmentNodes(equipmentArray, parentCode) {
  const nodes = [];
  let sequence = 1;

  // Group by base equipment code to handle parent-child relationships
  const baseGroups = groupByBaseEquipment(equipmentArray);

  for (const [baseCode, equipmentGroup] of Object.entries(baseGroups)) {
    const parentEquipment = equipmentGroup.find(eq => !extractSubDeviceCode(eq.equipment_number));
    const childEquipment = equipmentGroup.filter(eq => extractSubDeviceCode(eq.equipment_number));

    // Create parent node
    const equipmentCode = generateWBSCode(parentCode, sequence);
    const parentNode = {
      code: equipmentCode,
      name: parentEquipment ? 
        `${parentEquipment.equipment_number} | ${parentEquipment.equipment_name || getEquipmentDescription(parentEquipment.equipment_number)}` :
        `${baseCode} | ${getEquipmentDescription(baseCode)}`,
      children: [],
      level: getNodeLevel(parentCode) + 1,
      parent_code: parentCode,
      equipment_data: parentEquipment || { equipment_number: baseCode },
      is_new: false
    };

    // Add child devices
    let childSequence = 1;
    childEquipment.forEach(childEq => {
      const childCode = generateWBSCode(equipmentCode, childSequence);
      const childNode = {
        code: childCode,
        name: `${childEq.equipment_number} | ${childEq.equipment_name || getEquipmentDescription(childEq.equipment_number)}`,
        children: [],
        level: getNodeLevel(equipmentCode) + 1,
        parent_code: equipmentCode,
        equipment_data: childEq,
        is_new: false
      };
      parentNode.children.push(childNode);
      childSequence++;
    });

    nodes.push(parentNode);
    sequence++;
  }

  return nodes;
}

/**
 * Group equipment by base equipment code
 * @param {Array} equipmentArray - Array of equipment
 * @returns {Object} Equipment grouped by base code
 */
export function groupByBaseEquipment(equipmentArray) {
  const groups = {};

  equipmentArray.forEach(equipment => {
    const baseCode = extractBaseEquipmentCode(equipment.equipment_number);
    if (!groups[baseCode]) {
      groups[baseCode] = [];
    }
    groups[baseCode].push(equipment);
  });

  return groups;
}

/**
 * Get equipment description from equipment mappings
 * @param {string} equipmentCode - Equipment code
 * @returns {string} Equipment description
 */
export function getEquipmentDescription(equipmentCode) {
  if (!equipmentCode) return 'Unknown Equipment';
  
  const baseCode = extractBaseEquipmentCode(equipmentCode);
  const equipmentType = baseCode.replace(/\d+/g, ''); // Remove numbers
  
  return EQUIPMENT_MAPPINGS[equipmentType] || 'Unknown Equipment Type';
}

/**
 * Calculate node level based on WBS code
 * @param {string} wbsCode - WBS code
 * @returns {number} Level depth
 */
export function getNodeLevel(wbsCode) {
  if (!wbsCode) return 0;
  return wbsCode.split(WBS_SETTINGS.SEPARATOR).length - 1;
}

/**
 * Flatten WBS structure into a flat array for export
 * @param {Object} wbsStructure - Hierarchical WBS structure
 * @returns {Array} Flat array of WBS items
 */
export function flattenWBSStructure(wbsStructure) {
  const flattened = [];

  function traverse(node) {
    flattened.push({
      wbs_code: node.code,
      parent_wbs_code: node.parent_code || '',
      wbs_name: node.name,
      wbs_short_name: node.name.split(' | ')[0] || node.name,
      level: node.level,
      category: node.category,
      equipment_data: node.equipment_data,
      is_new: node.is_new || false
    });

    if (node.children && node.children.length > 0) {
      node.children.forEach(child => traverse(child));
    }
  }

  traverse(wbsStructure);
  return flattened;
}

/**
 * Find missing equipment by comparing two equipment lists
 * @param {Array} originalList - Original equipment list
 * @param {Array} newList - New equipment list
 * @returns {Object} Object with added and removed equipment
 */
export function findMissingEquipment(originalList, newList) {
  const originalIds = new Set(originalList.map(eq => eq.equipment_number));
  const newIds = new Set(newList.map(eq => eq.equipment_number));

  const added = newList.filter(eq => !originalIds.has(eq.equipment_number));
  const removed = originalList.filter(eq => !newIds.has(eq.equipment_number));

  return { added, removed };
}

/**
 * Integrate new equipment into existing WBS structure
 * @param {Object} existingStructure - Existing WBS structure
 * @param {Array} newEquipment - Array of new equipment
 * @returns {Object} Updated WBS structure
 */
export function integrateNewEquipment(existingStructure, newEquipment) {
  const updatedStructure = JSON.parse(JSON.stringify(existingStructure)); // Deep clone
  
  // Group new equipment by category
  const categoryGroups = groupEquipmentByCategory(newEquipment);
  
  // Find subsystem node
  const subsystemNode = findSubsystemNode(updatedStructure);
  if (!subsystemNode) return updatedStructure;

  // Integrate into existing categories or create new ones
  for (const [categoryCode, equipment] of Object.entries(categoryGroups)) {
    const existingCategory = subsystemNode.children.find(child => child.category === categoryCode);
    
    if (existingCategory) {
      // Add to existing category
      const newNodes = buildEquipmentNodes(equipment, existingCategory.code);
      newNodes.forEach(node => {
        node.is_new = true; // Mark as new
        // Update sequence numbers to avoid conflicts
        const nextSequence = existingCategory.children.length + 1;
        node.code = generateWBSCode(existingCategory.code, nextSequence + newNodes.indexOf(node));
      });
      existingCategory.children.push(...newNodes);
    } else {
      // Create new category
      const categorySequence = subsystemNode.children.length + 1;
      const categoryWBSCode = generateWBSCode(subsystemNode.code, categorySequence);
      const categoryNode = {
        code: categoryWBSCode,
        name: `${categoryCode} | ${WBS_CATEGORIES[categoryCode]}`,
        children: buildEquipmentNodes(equipment, categoryWBSCode),
        level: 2,
        parent_code: subsystemNode.code,
        category: categoryCode,
        is_new: true
      };
      
      categoryNode.children.forEach(child => {
        child.is_new = true;
      });
      
      subsystemNode.children.push(categoryNode);
    }
  }

  return updatedStructure;
}

/**
 * Find the main subsystem node in WBS structure
 * @param {Object} structure - WBS structure
 * @returns {Object|null} Subsystem node or null
 */
export function findSubsystemNode(structure) {
  if (!structure.children) return null;
  
  return structure.children.find(child => 
    child.name && child.name.startsWith('S1 |')
  );
}

/**
 * Generate next WBS codes for continuing projects
 * @param {Array} existingWBS - Existing WBS structure from XER
 * @param {string} newSubsystemName - Name of new subsystem
 * @returns {string} Next subsystem code
 */
export function generateNextSubsystemCode(existingWBS, newSubsystemName) {
  // Find the highest subsystem code
  const subsystemCodes = existingWBS
    .filter(item => item.wbs_name && item.wbs_name.match(/^S\d+/))
    .map(item => {
      const match = item.wbs_name.match(/^S(\d+)/);
      return match ? parseInt(match[1]) : 0;
    });

  const nextNumber = subsystemCodes.length > 0 ? Math.max(...subsystemCodes) + 1 : 1;
  const baseCode = WBS_SETTINGS.ROOT_CODE;
  const nextSequence = existingWBS.filter(item => item.parent_wbs_code === baseCode).length + 1;
  
  return generateWBSCode(baseCode, nextSequence);
}

export default {
  categorizeEquipment,
  generateWBSCode,
  extractBaseEquipmentCode,
  extractSubDeviceCode,
  buildWBSStructure,
  groupEquipmentByCategory,
  buildEquipmentNodes,
  groupByBaseEquipment,
  getEquipmentDescription,
  getNodeLevel,
  flattenWBSStructure,
  findMissingEquipment,
  integrateNewEquipment,
  findSubsystemNode,
  generateNextSubsystemCode
};

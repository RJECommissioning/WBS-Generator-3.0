// File handling utilities
export const fileHelpers = {
  /**
   * Read file as text
   * @param {File} file 
   * @returns {Promise<string>}
   */
  readFileAsText: (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  },

  /**
   * Check if file is valid CSV/XER
   * @param {File} file 
   * @returns {boolean}
   */
  isValidFile: (file) => {
    const validTypes = ['.csv', '.xer', 'text/csv', 'application/vnd.ms-excel'];
    const fileName = file.name.toLowerCase();
    const fileType = file.type;
    
    return validTypes.some(type => fileName.endsWith(type) || fileType === type);
  },

  /**
   * Get file extension
   * @param {string} filename 
   * @returns {string}
   */
  getFileExtension: (filename) => {
    return filename.split('.').pop().toLowerCase();
  }
};

// String manipulation utilities
export const stringHelpers = {
  /**
   * Clean and normalize equipment code
   * @param {string} code 
   * @returns {string}
   */
  cleanEquipmentCode: (code) => {
    if (!code) return '';
    return code.toString().trim().toUpperCase();
  },

  /**
   * Remove special characters for matching
   * @param {string} str 
   * @returns {string}
   */
  normalizeForMatching: (str) => {
    if (!str) return '';
    return str.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  },

  /**
   * Generate WBS code
   * @param {string} parentCode 
   * @param {number} sequence 
   * @returns {string}
   */
  generateWBSCode: (parentCode, sequence) => {
    if (!parentCode) {
      return sequence.toString();
    }
    return `${parentCode}.${sequence}`;
  },

  /**
   * Parse WBS code to get level
   * @param {string} wbsCode 
   * @returns {number}
   */
  getWBSLevel: (wbsCode) => {
    if (!wbsCode) return 0;
    return wbsCode.split('.').length;
  },

  /**
   * Get parent WBS code
   * @param {string} wbsCode 
   * @returns {string|null}
   */
  getParentWBSCode: (wbsCode) => {
    if (!wbsCode) return null;
    const parts = wbsCode.split('.');
    if (parts.length <= 1) return null;
    return parts.slice(0, -1).join('.');
  },

  /**
   * Format equipment description
   * @param {string} equipmentCode 
   * @param {string} description 
   * @returns {string}
   */
  formatEquipmentDescription: (equipmentCode, description) => {
    if (!equipmentCode) return description || '';
    if (!description) return equipmentCode;
    return `${equipmentCode} | ${description}`;
  }
};

// Array processing utilities
export const arrayHelpers = {
  /**
   * Group array by key
   * @param {Array} array 
   * @param {string|Function} key 
   * @returns {Object}
   */
  groupBy: (array, key) => {
    return array.reduce((groups, item) => {
      const groupKey = typeof key === 'function' ? key(item) : item[key];
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    }, {});
  },

  /**
   * Remove duplicates from array by key
   * @param {Array} array 
   * @param {string} key 
   * @returns {Array}
   */
  uniqueBy: (array, key) => {
    const seen = new Set();
    return array.filter(item => {
      const keyValue = item[key];
      if (seen.has(keyValue)) {
        return false;
      }
      seen.add(keyValue);
      return true;
    });
  },

  /**
   * Sort array by multiple keys
   * @param {Array} array 
   * @param {Array} sortKeys - Array of {key, order} objects
   * @returns {Array}
   */
  sortBy: (array, sortKeys) => {
    return [...array].sort((a, b) => {
      for (const { key, order = 'asc' } of sortKeys) {
        const aVal = a[key];
        const bVal = b[key];
        
        if (aVal < bVal) return order === 'asc' ? -1 : 1;
        if (aVal > bVal) return order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  },

  /**
   * Find differences between two arrays
   * @param {Array} oldArray 
   * @param {Array} newArray 
   * @param {string} compareKey 
   * @returns {Object}
   */
  findDifferences: (oldArray, newArray, compareKey) => {
    const oldSet = new Set(oldArray.map(item => item[compareKey]));
    const newSet = new Set(newArray.map(item => item[compareKey]));
    
    const added = newArray.filter(item => !oldSet.has(item[compareKey]));
    const removed = oldArray.filter(item => !newSet.has(item[compareKey]));
    const existing = newArray.filter(item => oldSet.has(item[compareKey]));
    
    return { added, removed, existing };
  }
};

// Validation utilities
export const validationHelpers = {
  /**
   * Validate equipment list structure
   * @param {Array} equipmentList 
   * @returns {Object}
   */
  validateEquipmentList: (equipmentList) => {
    const errors = [];
    const warnings = [];
    
    if (!Array.isArray(equipmentList) || equipmentList.length === 0) {
      errors.push('Equipment list is empty or invalid');
      return { isValid: false, errors, warnings };
    }
    
    // Check required headers
    const requiredHeaders = ['equipment_number', 'description'];
    const firstItem = equipmentList[0];
    const headers = Object.keys(firstItem);
    
    for (const required of requiredHeaders) {
      if (!headers.includes(required)) {
        errors.push(`Missing required column: ${required}`);
      }
    }
    
    // Check for empty equipment numbers
    const emptyEquipmentNumbers = equipmentList.filter(item => 
      !item.equipment_number || item.equipment_number.toString().trim() === ''
    );
    
    if (emptyEquipmentNumbers.length > 0) {
      warnings.push(`${emptyEquipmentNumbers.length} items have empty equipment numbers`);
    }
    
    return { 
      isValid: errors.length === 0, 
      errors, 
      warnings,
      totalItems: equipmentList.length
    };
  },

  /**
   * Validate WBS structure
   * @param {Array} wbsStructure 
   * @returns {Object}
   */
  validateWBSStructure: (wbsStructure) => {
    const errors = [];
    const warnings = [];
    
    if (!Array.isArray(wbsStructure) || wbsStructure.length === 0) {
      errors.push('WBS structure is empty or invalid');
      return { isValid: false, errors, warnings };
    }
    
    // Check for duplicate WBS codes
    const wbsCodes = wbsStructure.map(item => item.wbs_code);
    const duplicates = wbsCodes.filter((code, index) => wbsCodes.indexOf(code) !== index);
    
    if (duplicates.length > 0) {
      errors.push(`Duplicate WBS codes found: ${duplicates.join(', ')}`);
    }
    
    // Check parent-child relationships
    for (const item of wbsStructure) {
      if (item.parent_wbs_code) {
        const parentExists = wbsStructure.some(parent => 
          parent.wbs_code === item.parent_wbs_code
        );
        if (!parentExists) {
          warnings.push(`Parent WBS code not found: ${item.parent_wbs_code} for ${item.wbs_code}`);
        }
      }
    }
    
    return { 
      isValid: errors.length === 0, 
      errors, 
      warnings,
      totalItems: wbsStructure.length
    };
  }
};

// Equipment pattern matching utilities
export const patternHelpers = {
  /**
   * Check if equipment matches a pattern
   * @param {string} equipmentCode 
   * @param {RegExp} pattern 
   * @returns {boolean}
   */
  matchesPattern: (equipmentCode, pattern) => {
    if (!equipmentCode || !pattern) return false;
    const cleanCode = stringHelpers.cleanEquipmentCode(equipmentCode);
    return pattern.test(cleanCode);
  },

  /**
   * Extract base equipment code (remove suffixes like -F, -KF)
   * @param {string} equipmentCode 
   * @returns {string}
   */
  getBaseEquipmentCode: (equipmentCode) => {
    if (!equipmentCode) return '';
    const cleanCode = stringHelpers.cleanEquipmentCode(equipmentCode);
    // Remove common suffixes
    return cleanCode.replace(/(-F|-KF|-Y|-P)$/g, '');
  },

  /**
   * Check if equipment is a sub-device
   * @param {string} equipmentCode 
   * @returns {boolean}
   */
  isSubEquipment: (equipmentCode) => {
    if (!equipmentCode) return false;
    const cleanCode = stringHelpers.cleanEquipmentCode(equipmentCode);
    return /(-F|-KF|-Y|-P)$/g.test(cleanCode);
  },

  /**
   * Get sub-equipment type
   * @param {string} equipmentCode 
   * @returns {string|null}
   */
  getSubEquipmentType: (equipmentCode) => {
    if (!equipmentCode) return null;
    const cleanCode = stringHelpers.cleanEquipmentCode(equipmentCode);
    const match = cleanCode.match(/(-F|-KF|-Y|-P)$/g);
    return match ? match[0] : null;
  }
};

// WBS generation utilities
export const wbsHelpers = {
  /**
   * Generate unique WBS code for category
   * @param {string} parentCode 
   * @param {Array} existingCodes 
   * @returns {string}
   */
  generateUniqueWBSCode: (parentCode, existingCodes = []) => {
    let sequence = 1;
    let proposedCode;
    
    do {
      proposedCode = stringHelpers.generateWBSCode(parentCode, sequence);
      sequence++;
    } while (existingCodes.includes(proposedCode));
    
    return proposedCode;
  },

  /**
   * Build hierarchical tree from flat WBS list
   * @param {Array} flatList 
   * @returns {Array}
   */
  buildHierarchicalTree: (flatList) => {
    const tree = [];
    const lookup = {};
    
    // First pass: create lookup table
    flatList.forEach(item => {
      lookup[item.wbs_code] = { ...item, children: [] };
    });
    
    // Second pass: build tree structure
    flatList.forEach(item => {
      if (item.parent_wbs_code && lookup[item.parent_wbs_code]) {
        lookup[item.parent_wbs_code].children.push(lookup[item.wbs_code]);
      } else {
        tree.push(lookup[item.wbs_code]);
      }
    });
    
    return tree;
  },

  /**
   * Flatten hierarchical tree to list
   * @param {Array} tree 
   * @returns {Array}
   */
  flattenTree: (tree) => {
    const result = [];
    
    const traverse = (nodes) => {
      nodes.forEach(node => {
        const { children, ...item } = node;
        result.push(item);
        if (children && children.length > 0) {
          traverse(children);
        }
      });
    };
    
    traverse(tree);
    return result;
  }
};

// Date utilities
export const dateHelpers = {
  /**
   * Get formatted date string for filenames
   * @returns {string}
   */
  getDateStamp: () => {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD
  },

  /**
   * Get formatted timestamp
   * @returns {string}
   */
  getTimestamp: () => {
    const now = new Date();
    return now.toISOString().replace(/[:.]/g, '-').slice(0, -5); // YYYY-MM-DDTHH-mm-ss
  }
};


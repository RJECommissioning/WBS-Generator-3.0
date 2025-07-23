/**
 * Data structure definitions for WBS Generator
 * These serve as documentation and validation templates
 */

// Equipment Item Structure
/**
 * @typedef {Object} EquipmentItem
 * @property {string} equipment_number - Equipment code (e.g., "UH101", "T10")
 * @property {string} description - Equipment description
 * @property {string} [plu_field] - Secondary equipment identifier
 * @property {string} [commissioning_status] - Y/N/TBC status
 * @property {string} [category] - Auto-assigned category (01-10, 99)
 * @property {string} [category_name] - Human readable category name
 * @property {string} [parent_equipment] - Parent equipment code for sub-devices
 * @property {boolean} [is_sub_equipment] - True if this is a -F, -KF, -Y, -P device
 * @property {boolean} [is_new] - True if this is a newly added item
 */
export const EquipmentItemExample = {
  equipment_number: "UH101",
  description: "Protection Panel",
  plu_field: "",
  commissioning_status: "Y",
  category: "02",
  category_name: "Protection Panels",
  parent_equipment: null,
  is_sub_equipment: false,
  is_new: false
};

// WBS Structure Item
/**
 * @typedef {Object} WBSItem
 * @property {string} wbs_code - Hierarchical code (e.g., "1.3.2.1")
 * @property {string|null} parent_wbs_code - Parent WBS code (e.g., "1.3.2")
 * @property {string} wbs_name - Display name for WBS item
 * @property {string} [equipment_number] - Associated equipment code
 * @property {string} [description] - Full description
 * @property {string} [commissioning_status] - Y/N/TBC status
 * @property {number} level - Tree depth level (1, 2, 3, 4, 5)
 * @property {string} color - Brand color for this level
 * @property {boolean} [is_new] - True if this is newly added
 * @property {Array} [children] - Child WBS items (for tree structure)
 * @property {boolean} [expanded] - UI state for tree expansion
 */
export const WBSItemExample = {
  wbs_code: "1.3.2.1",
  parent_wbs_code: "1.3.2",
  wbs_name: "UH101 | Protection Panel",
  equipment_number: "UH101",
  description: "Protection Panel",
  commissioning_status: "Y",
  level: 4,
  color: "#4A9B8E",
  is_new: false,
  children: [],
  expanded: false
};

// Project Structure
/**
 * @typedef {Object} ProjectData
 * @property {string} project_name - Project identifier
 * @property {Array<EquipmentItem>} equipment_list - All equipment items
 * @property {Array<WBSItem>} wbs_structure - Hierarchical WBS structure
 * @property {Object} subsystems - Grouped by subsystem code
 * @property {string} created_date - ISO date string
 * @property {string} last_modified - ISO date string
 */
export const ProjectDataExample = {
  project_name: "Project 5737",
  equipment_list: [],
  wbs_structure: [],
  subsystems: {
    "Z01": { name: "Subsystem 1", equipment: [] },
    "Z02": { name: "Subsystem 2", equipment: [] }
  },
  created_date: "2025-01-01T00:00:00.000Z",
  last_modified: "2025-01-01T00:00:00.000Z"
};

// Comparison Results (for Missing Equipment feature)
/**
 * @typedef {Object} ComparisonResult
 * @property {Array<EquipmentItem>} added - Newly added equipment
 * @property {Array<EquipmentItem>} removed - Removed equipment
 * @property {Array<EquipmentItem>} existing - Unchanged equipment
 * @property {Array<EquipmentItem>} modified - Modified equipment
 * @property {Object} summary - Count summaries
 */
export const ComparisonResultExample = {
  added: [],
  removed: [],
  existing: [],
  modified: [],
  summary: {
    total_added: 0,
    total_removed: 0,
    total_existing: 0,
    total_modified: 0
  }
};

// File Upload State
/**
 * @typedef {Object} FileUploadState
 * @property {File|null} file - Selected file object
 * @property {string} status - 'idle' | 'uploading' | 'success' | 'error'
 * @property {string|null} error - Error message if failed
 * @property {Array} data - Parsed file data
 * @property {Object} validation - Validation results
 */
export const FileUploadStateExample = {
  file: null,
  status: 'idle',
  error: null,
  data: [],
  validation: {
    isValid: true,
    errors: [],
    warnings: [],
    totalItems: 0
  }
};

// UI State
/**
 * @typedef {Object} UIState
 * @property {boolean} loading - Global loading state
 * @property {string|null} error - Global error message
 * @property {string|null} success - Success message
 * @property {Object} modals - Modal visibility states
 * @property {Object} expansions - Tree expansion states
 */
export const UIStateExample = {
  loading: false,
  error: null,
  success: null,
  modals: {
    export: false,
    confirmation: false,
    preview: false
  },
  expansions: {
    "1.3.1": true,
    "1.3.2": false
  }
};

// Export Configuration
/**
 * @typedef {Object} ExportConfig
 * @property {string} format - 'csv' | 'xlsx'
 * @property {string} filename - Output filename
 * @property {Array<string>} columns - Column headers to include
 * @property {boolean} include_new_only - Only export new items
 * @property {boolean} include_headers - Include column headers
 */
export const ExportConfigExample = {
  format: 'csv',
  filename: 'WBS_Export_2025-01-01.csv',
  columns: ['wbs_code', 'parent_wbs_code', 'wbs_name', 'equipment_number', 'description', 'commissioning_status'],
  include_new_only: false,
  include_headers: true
};

// Equipment Pattern
/**
 * @typedef {Object} EquipmentPattern
 * @property {RegExp} pattern - Regular expression for matching
 * @property {string} name - Human readable name
 * @property {string} category - Category code (01-10, 99)
 * @property {boolean} [is_sub_equipment] - True if this creates sub-equipment
 */
export const EquipmentPatternExample = {
  pattern: /^\+?UH\d+/i,
  name: 'Protection Panels',
  category: '02',
  is_sub_equipment: false
};

// XER File Structure (from P6 exports)
/**
 * @typedef {Object} XERData
 * @property {Array<Object>} wbs_items - WBS items from XER
 * @property {Array<Object>} activities - Activity items (if present)
 * @property {Object} project_info - Project metadata
 * @property {string} last_wbs_code - Highest WBS code found
 */
export const XERDataExample = {
  wbs_items: [
    {
      wbs_code: "1.3.2",
      parent_wbs_code: "1.3",
      wbs_name: "02 | Protection Panels"
    }
  ],
  activities: [],
  project_info: {
    project_name: "Sample Project"
  },
  last_wbs_code: "1.3.2.15"
};

// Tree Node (for visualization)
/**
 * @typedef {Object} TreeNode
 * @property {string} id - Unique identifier (usually wbs_code)
 * @property {string} label - Display text
 * @property {string} color - Background color
 * @property {boolean} expanded - Expansion state
 * @property {boolean} is_new - New item highlight
 * @property {Array<TreeNode>} children - Child nodes
 * @property {Object} data - Original data object
 */
export const TreeNodeExample = {
  id: "1.3.2.1",
  label: "UH101 | Protection Panel",
  color: "#4A9B8E",
  expanded: false,
  is_new: false,
  children: [
    {
      id: "1.3.2.1.1",
      label: "UH101-F | Protection Relay",
      color: "#2E8B8B",
      expanded: false,
      is_new: true,
      children: [],
      data: {}
    }
  ],
  data: {}
};

// Validation Result
/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Overall validation status
 * @property {Array<string>} errors - Critical errors that prevent processing
 * @property {Array<string>} warnings - Non-critical issues
 * @property {number} totalItems - Total number of items processed
 * @property {Object} [details] - Additional validation details
 */
export const ValidationResultExample = {
  isValid: true,
  errors: [],
  warnings: ["2 items have empty descriptions"],
  totalItems: 150,
  details: {
    duplicateEquipmentCodes: [],
    missingRequiredFields: [],
    invalidCommissioningStatus: []
  }
};

// Processing Status
/**
 * @typedef {Object} ProcessingStatus
 * @property {string} stage - Current processing stage
 * @property {number} progress - Percentage complete (0-100)
 * @property {string} message - Status message
 * @property {boolean} completed - True when finished
 * @property {Object|null} result - Final result when completed
 */
export const ProcessingStatusExample = {
  stage: 'categorizing_equipment',
  progress: 75,
  message: 'Categorizing equipment items...',
  completed: false,
  result: null
};

// Store State Structure (for Zustand)
/**
 * @typedef {Object} StoreState
 * @property {ProjectData} project - Current project data
 * @property {UIState} ui - UI state and settings
 * @property {Object} uploads - File upload states
 * @property {Array} history - Action history for undo
 */
export const StoreStateExample = {
  project: ProjectDataExample,
  ui: UIStateExample,
  uploads: {
    equipment_list: FileUploadStateExample,
    existing_project: FileUploadStateExample,
    xer_file: FileUploadStateExample
  },
  history: []
};

// Feature-specific types
export const FEATURE_TYPES = {
  START_PROJECT: 'start_project',
  CONTINUE_PROJECT: 'continue_project', 
  MISSING_EQUIPMENT: 'missing_equipment'
};

// Processing stages
export const PROCESSING_STAGES = {
  UPLOADING: 'uploading',
  PARSING: 'parsing',
  VALIDATING: 'validating',
  CATEGORIZING: 'categorizing_equipment',
  GENERATING_WBS: 'generating_wbs',
  BUILDING_TREE: 'building_tree',
  COMPARING: 'comparing',
  COMPLETE: 'complete',
  ERROR: 'error'
};

// File types
export const FILE_TYPES = {
  EQUIPMENT_LIST: 'equipment_list',
  XER_FILE: 'xer_file',
  EXISTING_PROJECT: 'existing_project'
};

// Component prop templates (for development reference)
export const COMPONENT_PROPS = {
  /**
   * WBSTreeVisualization component props
   */
  WBSTree: {
    data: [], // Array<TreeNode>
    onNodeClick: () => {}, // Function
    onNodeExpand: () => {}, // Function
    expandedNodes: {}, // Object
    showNewBadges: true, // boolean
    colors: {} // Object
  },

  /**
   * FileUpload component props  
   */
  FileUpload: {
    accept: '.csv,.xer', // string
    onFileSelect: () => {}, // Function
    loading: false, // boolean
    error: null, // string|null
    multiple: false // boolean
  },

  /**
   * ExportButton component props
   */
  ExportButton: {
    data: [], // Array
    filename: 'export.csv', // string
    disabled: false, // boolean
    includeNewOnly: false, // boolean
    onExportComplete: () => {} // Function
  }
};

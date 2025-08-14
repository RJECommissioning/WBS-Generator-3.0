// Brand Colors (from your company palette)
export const BRAND_COLORS = {
  level1: '#C8D982', // Light green - for M|Milestones, P|Pre-req, S1|Subsystem
  level2: '#A8CC6B', // Medium green - for categories (01|Prep, 02|Protection, etc.)
  level3: '#7FB069', // Green-teal - for individual equipment
  level4: '#4A9B8E', // Teal - for sub-equipment (-F devices)
  level5: '#2E8B8B', // Dark teal - for deeper nesting
  accent: '#1F7A7A', // Darkest for "New" badges and highlights
  text: '#2E2E2E', // Dark text
  background: '#F8F9FA', // Light background
  white: '#FFFFFF'
};

// Equipment Categories (from your WBS system)
export const EQUIPMENT_CATEGORIES = {
  '01': 'Preparations and set-up',
  '02': 'Protection Panels',
  '03': 'HV Switchboards',
  '04': 'LV Switchboards',
  '05': 'Transformers',
  '06': 'Battery Systems',
  '07': 'Earthing',
  '08': 'Building Services',
  '09': 'Interface Testing',
  '10': 'Ancillary Systems',
  '99': 'Unrecognised Equipment'
};

// Equipment Pattern Matching (from your documentation) - UPDATED with missing patterns
export const EQUIPMENT_PATTERNS = {
  // Protection Panels (02)
  '02': [
    { pattern: /^\+?UH\d+/i, name: 'Protection Panels' },
    { pattern: /^UH\d+/i, name: 'Protection Panels' }
  ],
  
  // HV Switchboards (03)
  '03': [
    { pattern: /^\+?WA\d*/i, name: 'HV Switchgear Assembly' },
    { pattern: /^WA\d*/i, name: 'HV Switchgear Assembly' }
  ],
  
  // LV Switchboards (04)
  '04': [
    { pattern: /^\+?WC\d+/i, name: 'Distribution Board' },
    { pattern: /^WC\d+/i, name: 'Distribution Board' }
  ],
  
  // Transformers (05)
  '05': [
    { pattern: /^T\d+/i, name: 'Transformer' },
    { pattern: /^NET\d*/i, name: 'Neutral Earthing Transformer' },
    { pattern: /^TA\d*/i, name: 'AC/DC Converter' },
    { pattern: /^NER\d*/i, name: 'Neutral Earth Resistor' }
  ],
  
  // Battery Systems (06)
  '06': [
    { pattern: /^\+?GB\d+/i, name: 'Battery System' },
    { pattern: /^GB\d+/i, name: 'Battery System' },
    { pattern: /^BAN\d*/i, name: 'Battery Bank' },
    { pattern: /^BCR\d*/i, name: 'Battery Charger' }
  ],
  
  // Earthing (07) - UPDATED: Added EG01 pattern
  '07': [
    { pattern: /^E\d+/i, name: 'HV Earth Switch' },
    { pattern: /^EB\d+/i, name: 'Earth Bar' },
    { pattern: /^EEP\d+/i, name: 'Earthing Pit' },
    { pattern: /^MEB\d*/i, name: 'Main Earth Bar' },
    { pattern: /^EG01-/i, name: 'Earthing Pit' }
  ],
  
  // Building Services (08) - UPDATED: Added security, fire, and beacon patterns
  '08': [
    { pattern: /^-?FM\d+/i, name: 'Fire Indication Panel' },
    { pattern: /^-?A\d*/i, name: 'SDU Switchroom Security Panel' },
    { pattern: /^LT\d*/i, name: 'Lighting' },
    { pattern: /^HTP\d*/i, name: 'Heat Tracing Panel' },
    { pattern: /^DDC/i, name: 'Computer' },
    { pattern: /^ESS-/i, name: 'Aspirating Smoke Detection' },
    { pattern: /^ISS-/i, name: 'Detection Equipment' },
    { pattern: /^MCP-/i, name: 'Manual Call Point' },
    { pattern: /^POSD-/i, name: 'Fire System Equipment' },
    { pattern: /^LS1-/i, name: 'Detection Equipment' },
    { pattern: /^-BE/i, name: 'Beacon/Strobe' }
  ],
  
  // Ancillary Systems (10) - UPDATED: Added computer network pattern
  '10': [
    { pattern: /^PSU\d*/i, name: 'Power Supply Units' },
    { pattern: /^UPS\d*/i, name: 'Uninterruptible Power Supply' },
    { pattern: /^BCR\d*/i, name: 'Battery Charger' },
    { pattern: /^-Y/i, name: 'Computer Network' },
    { pattern: /^KP-/i, name: 'Security Equipment' },
    { pattern: /^MPIR-/i, name: 'Security Equipment' },
    { pattern: /^REED-/i, name: 'Security Equipment' },
    { pattern: /^SCR-/i, name: 'Security Equipment' },
    { pattern: /^WBC-/i, name: 'Security Equipment' }
  ]
};

// Sub-equipment patterns (devices that sit under main equipment)
export const SUB_EQUIPMENT_PATTERNS = {
  protection: [
    { pattern: /^-F$/i, name: 'Protection Relay' },
    { pattern: /^-KF$/i, name: 'Programmable Controller' },
    { pattern: /^-Y$/i, name: 'Computer Network' },
    { pattern: /^-P$/i, name: 'Power Quality Meter' }
  ]
};

// Commissioning Status
export const COMMISSIONING_STATUS = {
  YES: 'Y',
  NO: 'N',
  TBC: 'TBC'
};

// WBS Level Colors (maps to your brand colors)
export const WBS_LEVEL_COLORS = {
  1: BRAND_COLORS.level1, // Project/Milestones/Prerequisites/Subsystem
  2: BRAND_COLORS.level2, // Categories (01, 02, 03, etc.)
  3: BRAND_COLORS.level3, // Equipment items
  4: BRAND_COLORS.level4, // Sub-equipment
  5: BRAND_COLORS.level5  // Deep nesting
};

// Special locations/preparations (01 category)
export const PREPARATION_ITEMS = [
  'Test bay',
  'Panel Shop', 
  'Pad'
];

// Interface Testing phases (09 category)
export const INTERFACE_TESTING_PHASES = [
  'Phase 1',
  'Phase 2'
];

// Export format settings - CORRECTED to 3 columns only
export const EXPORT_SETTINGS = {
  csv: {
    delimiter: ',',
    headers: [
      'wbs_code',
      'parent_wbs_code', 
      'wbs_name'
    ]
  },
  filename: {
    prefix: 'WBS_Export_',
    dateFormat: 'YYYY-MM-DD',
    extension: '.csv'
  }
};

// UI Settings
export const UI_SETTINGS = {
  treeView: {
    expandedByDefault: false,
    showIcons: true,
    highlightNewItems: true,
    newItemBadgeColor: BRAND_COLORS.accent
  },
  fileUpload: {
    acceptedTypes: '.csv,.xer',
    maxSizeGB: 10
  }
};

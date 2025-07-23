// WBS Structure based on Mermaid Chart
export const WBS_STRUCTURE = {
  ROOT: 'Project Name',
  MILESTONE: 'M | Milestone',
  PREREQUISITES: 'P | Pre-Requisites', 
  SUBSYSTEM_S1: 'S1 | Z01 | XXX',
  SUBSYSTEM_SX: 'SX | Z0X | XXX'
};

// WBS Categories (01-10, 99)
export const WBS_CATEGORIES = {
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

// Equipment Code Mappings from Equipment Name Key
export const EQUIPMENT_MAPPINGS = {
  'ACR': 'Access Card Reader',
  'ACS': 'Access Control System', 
  'ALT': 'Alternator',
  'ASD': 'Aspirating smoke detection apparatus',
  'ATS': 'Automatic Transfer Switch',
  'BAN': 'Battery Bank',
  'BCR': 'Battery Charger',
  'BEA': 'Beacon/Strobe',
  'BSG': 'Black Start Generator',
  'CA': 'Capacitor',
  'CB': 'Circuit Breaker',
  'CN': 'Gas Bottle',
  'CP': 'Control Panel',
  'CPU': 'Computer',
  'CT': 'Current Transformer',
  'CTV': 'CCTV Camera',
  'D': 'HV Disconnector',
  'DET': 'Detector',
  'DOL': 'Direct Online',
  'E': 'HV Earth Switch',
  'EB': 'Earth Bar',
  'EEP': 'Earthing Pit',
  'EHT': 'Electrical Heat Trace',
  'F': 'Protection Relay',
  'FC': 'Fuse',
  'FDR': 'Feeder',
  'FIP': 'Fire Indication Panel',
  'FOB': 'Fibre Optic Breakout Terminal (FOBOT)',
  'FP': 'Fibre Optic Panel',
  'G': 'Generator Set',
  'GC': 'Solar cell',
  'GCB': 'Generator Circuit Breaker',
  'GPO': 'Power Outlet',
  'GT': 'Gas Turbine',
  'GTG': 'Gas Turbine Generator',
  'H': 'HV Switchboard Tier',
  'HFT': 'Harmonic Filter',
  'HMI': 'Human Machine Interface',
  'HRN': 'Horn / Hooter',
  'HTP': 'Heat Tracing Panel',
  'IJB': 'Instrument Junction Box',
  'IND': 'Indicator Light (LED)',
  'IOP': 'I/O Panel',
  'ITP': 'Instrumentation Panel',
  'K': 'Contactor/Relay',
  'KF': 'Programmable controller',
  'LCS': 'Local Control Station',
  'LCT': 'Lighting Circuit',
  'LSW': 'Load Break Switch',
  'LT': 'Pole Mounted Flood Light',
  'LTP': 'Lighting Panel',
  'MA': 'LV Electric Motor',
  'MCC': 'Motor Control Centre',
  'MCP': 'Manual Call Point',
  'MEB': 'Main Earth Bar',
  'MET': 'Measurement Tower (MET Mast)',
  'MP': 'Marshalling Panel',
  'MR': 'Revenue Meter',
  'MTR': 'Motor',
  'MTS': 'Manual Transfer Switch',
  'NER': 'Neutral Earth Resistor',
  'NET': 'Neutral Earthing Transformer',
  'OHL': 'Overhead Line',
  'P': 'Power Quality Meter',
  'PB': 'Push Button',
  'PSU': 'Power supply unit',
  'Q': 'Miniature Circuit Breaker',
  'R': 'Resistor',
  'RA': 'Reactor',
  'RMU': 'Ring Main Unit',
  'SA': 'Surge Arrester',
  'SUB': 'Substation',
  'SVC': 'Static VAR Compensator',
  'SW': 'Selector Switch',
  'T': 'Transformer',
  'TA': 'AC/DC converter',
  'TOF': 'Timer OFF Delay',
  'TOL': 'Thermal Overload',
  'TON': 'Timer ON Delay',
  'TOW': 'Power Transmission Tower',
  'TRN': 'Transmission Line',
  'TSS': 'Transportable Substation',
  'UA': 'Insulator, Electrical Supporting Structures',
  'UB': 'Cable Stand/Gantry',
  'UC': 'Rectifier',
  'UH': 'Protection Panels',
  'UM': 'Substation Structural Objects',
  'UPS': 'Uninterruptible power supply (UPS)',
  'VDO': 'Voice / Data Outlet',
  'VFD': 'Variable Frequency Drive',
  'VT': 'Voltage Transformer',
  'WA': 'HV Switchgear Assembly',
  'WC': 'Distribution Board',
  'WTG': 'Wind Turbine Generator',
  'X': 'Generic Device',
  'XB': 'Substation HV Junction Box',
  'XD': 'Substation LV Junction Box',
  'Y': 'Computer network (e.g. Switches, GPS Clocks)',
  'UI': 'Post Insulator'
};

// Equipment Categorization Rules
export const EQUIPMENT_CATEGORY_RULES = {
  // 01 - Preparations and set-up
  '01': [
    'Test bay', 'Panel Shop', 'Pad'
  ],
  
  // 02 - Protection Panels
  '02': [
    { pattern: /^\+?UH/, category: '02' },
    { pattern: /^UH/, category: '02' }
  ],
  
  // 03 - HV Switchboards  
  '03': [
    { pattern: /^\+?WA/, category: '03' },
    { pattern: /^WA/, category: '03' }
  ],
  
  // 04 - LV Switchboards
  '04': [
    { pattern: /^\+?WC/, category: '04' },
    { pattern: /^WC/, category: '04' }
  ],
  
  // 05 - Transformers
  '05': [
    { pattern: /^T\d/, category: '05' },
    { pattern: /^NET/, category: '05' },
    { pattern: /^TA/, category: '05' },
    { pattern: /^NER/, category: '05' }
  ],
  
  // 06 - Battery Systems  
  '06': [
    { pattern: /^\+?GB/, category: '06' },
    { pattern: /^GB/, category: '06' },
    { pattern: /^BAN/, category: '06' },
    { pattern: /^BCR/, category: '06' }
  ],
  
  // 07 - Earthing
  '07': [
    { pattern: /^E\d/, category: '07' },
    { pattern: /^EB/, category: '07' },
    { pattern: /^EEP/, category: '07' },
    { pattern: /^MEB/, category: '07' }
  ],
  
  // 08 - Building Services
  '08': [
    { pattern: /^-?FM/, category: '08' },
    { pattern: /^-?A/, category: '08' },
    { pattern: /^LT/, category: '08' },
    { pattern: /^HN/, category: '08' },
    { pattern: /^FIP/, category: '08' },
    { pattern: /^CTV/, category: '08' },
    { pattern: /^ACR/, category: '08' },
    { pattern: /^ACS/, category: '08' }
  ],
  
  // 09 - Interface Testing
  '09': [
    'Phase 1', 'Phase 2'
  ],
  
  // 10 - Ancillary Systems
  '10': [
    { pattern: /^PSU/, category: '10' },
    { pattern: /^UPS/, category: '10' },
    { pattern: /^BCR/, category: '10' },
    { pattern: /^HMI/, category: '10' },
    { pattern: /^CP/, category: '10' },
    { pattern: /^MP/, category: '10' }
  ]
};

// Sub-category patterns for detailed equipment
export const SUB_CATEGORY_PATTERNS = {
  // Protection Panel sub-devices
  'UH': ['-F', '-KF', '-Y', '-P'],
  // Add more sub-patterns as needed
};

// Commissioning Status Options
export const COMMISSIONING_STATUS = {
  Y: 'Yes - Include in WBS',
  TBC: 'To Be Confirmed',  
  N: 'No - Exclude from WBS'
};

// WBS Code Generation Settings
export const WBS_SETTINGS = {
  ROOT_CODE: '1',
  MILESTONE_CODE: '1.1',
  PREREQUISITES_CODE: '1.2', 
  SUBSYSTEM_START_CODE: '1.3',
  TBC_CODE: '1.X',
  MAX_LEVELS: 6,
  SEPARATOR: '.'
};

// Color coding for visualization
export const WBS_COLORS = {
  level0: '#1f2937', // Root - Dark gray
  level1: '#3b82f6', // Blue
  level2: '#10b981', // Green  
  level3: '#f59e0b', // Yellow
  level4: '#ef4444', // Red
  level5: '#8b5cf6', // Purple
  level6: '#f97316'  // Orange
};

// CSV Export Headers for P6 Compatibility
export const P6_EXPORT_HEADERS = [
  'wbs_code',
  'parent_wbs_code', 
  'wbs_name',
  'wbs_short_name'
];

export default {
  WBS_STRUCTURE,
  WBS_CATEGORIES,
  EQUIPMENT_MAPPINGS,
  EQUIPMENT_CATEGORY_RULES,
  SUB_CATEGORY_PATTERNS,
  COMMISSIONING_STATUS,
  WBS_SETTINGS,
  WBS_COLORS,
  P6_EXPORT_HEADERS
};

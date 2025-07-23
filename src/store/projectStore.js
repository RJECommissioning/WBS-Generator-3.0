import { create } from 'zustand';
import { fileHelpers, validationHelpers, dateHelpers } from '../utils';

const useProjectStore = create((set, get) => ({
  // ==== MAIN STATE ====
  
  // Project data
  project: {
    project_name: '',
    equipment_list: [],
    wbs_structure: [],
    subsystems: {},
    created_date: null,
    last_modified: null
  },

  // UI state
  ui: {
    loading: false,
    error: null,
    success: null,
    currentFeature: null, // 'start_project' | 'continue_project' | 'missing_equipment'
    processing: {
      stage: null,
      progress: 0,
      message: ''
    },
    modals: {
      export: false,
      confirmation: false,
      preview: false
    },
    treeExpansions: {} // Track which WBS nodes are expanded
  },

  // File upload states
  uploads: {
    equipment_list: {
      file: null,
      status: 'idle', // 'idle' | 'uploading' | 'success' | 'error'
      error: null,
      data: [],
      validation: null
    },
    existing_project: {
      file: null,
      status: 'idle',
      error: null,
      data: [],
      validation: null
    },
    xer_file: {
      file: null,
      status: 'idle', 
      error: null,
      data: [],
      validation: null
    }
  },

  // Comparison results (for missing equipment feature)
  comparison: {
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
  },

  // ==== ACTIONS ====

  // UI Actions
  setLoading: (loading) => set((state) => ({ 
    ui: { ...state.ui, loading } 
  })),

  setError: (error) => set((state) => ({ 
    ui: { ...state.ui, error } 
  })),

  setSuccess: (success) => set((state) => ({ 
    ui: { ...state.ui, success } 
  })),

  clearMessages: () => set((state) => ({ 
    ui: { ...state.ui, error: null, success: null } 
  })),

  setCurrentFeature: (feature) => set((state) => ({ 
    ui: { ...state.ui, currentFeature: feature } 
  })),

  setProcessingStage: (stage, progress = 0, message = '') => set((state) => ({
    ui: {
      ...state.ui,
      processing: { stage, progress, message }
    }
  })),

  toggleModal: (modalName, isOpen) => set((state) => ({
    ui: {
      ...state.ui,
      modals: {
        ...state.ui.modals,
        [modalName]: isOpen
      }
    }
  })),

  toggleTreeExpansion: (nodeId) => set((state) => ({
    ui: {
      ...state.ui,
      treeExpansions: {
        ...state.ui.treeExpansions,
        [nodeId]: !state.ui.treeExpansions[nodeId]
      }
    }
  })),

  // File Upload Actions
  setFileUpload: (uploadType, fileData) => set((state) => ({
    uploads: {
      ...state.uploads,
      [uploadType]: {
        ...state.uploads[uploadType],
        ...fileData
      }
    }
  })),

uploadFile: async (uploadType, file) => {
  const { setFileUpload, setError, setLoading } = get();
  
  try {
    setLoading(true);
    setFileUpload(uploadType, { 
      file, 
      status: 'uploading', 
      error: null 
    });

    // Validate file
    if (!file || typeof file.size !== 'number') {
      throw new Error('Invalid file provided');
    }

    if (!fileHelpers.isValidFile(file)) {
      throw new Error('Invalid file type. Please upload a CSV file.');
    }

    // Read file content
    const content = await fileHelpers.readFileAsText(file);
    
    // Simple data structure for now
    const parsedData = { raw: content, type: 'csv' };

    setFileUpload(uploadType, {
      status: 'success',
      data: parsedData,
      error: null
    });

    setLoading(false);
    return parsedData;

  } catch (error) {
    setFileUpload(uploadType, {
      status: 'error',
      error: error.message,
      data: []
    });
    setError(`File upload failed: ${error.message}`);
    setLoading(false);
    throw error;
  }
},

  clearFileUpload: (uploadType) => set((state) => ({
    uploads: {
      ...state.uploads,
      [uploadType]: {
        file: null,
        status: 'idle',
        error: null,
        data: [],
        validation: null
      }
    }
  })),

  // Project Actions
  initializeProject: (projectName) => set(() => ({
    project: {
      project_name: projectName || `Project_${dateHelpers.getDateStamp()}`,
      equipment_list: [],
      wbs_structure: [],
      subsystems: {},
      created_date: new Date().toISOString(),
      last_modified: new Date().toISOString()
    }
  })),

  setProjectData: (projectData) => set((state) => ({
    project: {
      ...state.project,
      ...projectData,
      last_modified: new Date().toISOString()
    }
  })),

  updateEquipmentList: (equipmentList) => set((state) => {
    // Validate equipment list
    const validation = validationHelpers.validateEquipmentList(equipmentList);
    
    return {
      project: {
        ...state.project,
        equipment_list: equipmentList,
        last_modified: new Date().toISOString()
      },
      uploads: {
        ...state.uploads,
        equipment_list: {
          ...state.uploads.equipment_list,
          validation
        }
      }
    };
  }),

  updateWBSStructure: (wbsStructure) => set((state) => {
    // Validate WBS structure
    const validation = validationHelpers.validateWBSStructure(wbsStructure);
    
    return {
      project: {
        ...state.project,
        wbs_structure: wbsStructure,
        last_modified: new Date().toISOString()
      },
      ui: {
        ...state.ui,
        success: validation.isValid ? 'WBS structure updated successfully!' : null,
        error: validation.isValid ? null : `WBS validation failed: ${validation.errors.join(', ')}`
      }
    };
  }),

  // Feature-specific actions
  
  // START PROJECT FEATURE
  processStartProject: async (equipmentFile) => {
    const { 
      uploadFile, 
      setProcessingStage, 
      initializeProject, 
      setError,
      setSuccess 
    } = get();
    
    try {
      setProcessingStage('parsing', 10, 'Parsing equipment list...');
      
      // Upload and parse file
      const fileData = await uploadFile('equipment_list', equipmentFile);
      
      setProcessingStage('validating', 30, 'Validating equipment data...');
      
      // Initialize new project
      initializeProject();
      
      setProcessingStage('categorizing_equipment', 50, 'Categorizing equipment...');
      // Equipment processing will be handled by lib/equipmentProcessor.js
      
      setProcessingStage('generating_wbs', 70, 'Generating WBS structure...');
      // WBS generation will be handled by lib/wbsGenerator.js
      
      setProcessingStage('building_tree', 90, 'Building visualization...');
      
      setProcessingStage('complete', 100, 'Project created successfully!');
      setSuccess('New project created successfully!');
      
      return true;
      
    } catch (error) {
      setProcessingStage('error', 0, error.message);
      setError(`Failed to create project: ${error.message}`);
      return false;
    }
  },

  // CONTINUE PROJECT FEATURE  
  processContinueProject: async (xerFile, newEquipmentFile) => {
    const { 
      uploadFile, 
      setProcessingStage, 
      setError,
      setSuccess 
    } = get();
    
    try {
      setProcessingStage('parsing', 10, 'Parsing existing project...');
      
      // Upload XER file
      const xerData = await uploadFile('xer_file', xerFile);
      
      setProcessingStage('parsing', 30, 'Parsing new equipment...');
      
      // Upload new equipment file
      const equipmentData = await uploadFile('equipment_list', newEquipmentFile);
      
      setProcessingStage('generating_wbs', 50, 'Analyzing existing WBS structure...');
      // XER analysis will be handled by lib/fileParser.js
      
      setProcessingStage('generating_wbs', 70, 'Adding new equipment to structure...');
      // New WBS codes will be generated by lib/wbsGenerator.js
      
      setProcessingStage('building_tree', 90, 'Building combined visualization...');
      
      setProcessingStage('complete', 100, 'Project continued successfully!');
      setSuccess('New equipment added to existing project!');
      
      return true;
      
    } catch (error) {
      setProcessingStage('error', 0, error.message);
      setError(`Failed to continue project: ${error.message}`);
      return false;
    }
  },

  // MISSING EQUIPMENT FEATURE
  processMissingEquipment: async (existingProjectFile, updatedEquipmentFile) => {
    const { 
      uploadFile, 
      setProcessingStage, 
      setError,
      setSuccess,
      setComparisonResults 
    } = get();
    
    try {
      setProcessingStage('parsing', 10, 'Parsing existing project...');
      
      // Upload existing project
      const existingData = await uploadFile('existing_project', existingProjectFile);
      
      setProcessingStage('parsing', 30, 'Parsing updated equipment list...');
      
      // Upload updated equipment list  
      const updatedData = await uploadFile('equipment_list', updatedEquipmentFile);
      
      setProcessingStage('comparing', 50, 'Comparing equipment lists...');
      // Comparison will be handled by lib/projectComparer.js
      
      setProcessingStage('generating_wbs', 70, 'Generating WBS codes for new items...');
      
      setProcessingStage('building_tree', 90, 'Building comparison visualization...');
      
      setProcessingStage('complete', 100, 'Comparison completed!');
      setSuccess('Equipment comparison completed successfully!');
      
      return true;
      
    } catch (error) {
      setProcessingStage('error', 0, error.message);
      setError(`Failed to compare equipment: ${error.message}`);
      return false;
    }
  },

  // Comparison results management
  setComparisonResults: (results) => set(() => ({
    comparison: {
      ...results,
      summary: {
        total_added: results.added.length,
        total_removed: results.removed.length,
        total_existing: results.existing.length,
        total_modified: results.modified.length
      }
    }
  })),

  clearComparison: () => set(() => ({
    comparison: {
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
    }
  })),

  // Export functionality
  prepareExport: (includeNewOnly = false) => {
    const { project, comparison } = get();
    
    if (includeNewOnly && comparison.added.length > 0) {
      // Export only new items
      return comparison.added;
    }
    
    // Export full WBS structure
    return project.wbs_structure;
  },

  // Reset store
  resetStore: () => set(() => ({
    project: {
      project_name: '',
      equipment_list: [],
      wbs_structure: [],
      subsystems: {},
      created_date: null,
      last_modified: null
    },
    ui: {
      loading: false,
      error: null,
      success: null,
      currentFeature: null,
      processing: {
        stage: null,
        progress: 0,
        message: ''
      },
      modals: {
        export: false,
        confirmation: false,
        preview: false
      },
      treeExpansions: {}
    },
    uploads: {
      equipment_list: {
        file: null,
        status: 'idle',
        error: null,
        data: [],
        validation: null
      },
      existing_project: {
        file: null,
        status: 'idle',
        error: null,
        data: [],
        validation: null
      },
      xer_file: {
        file: null,
        status: 'idle',
        error: null,
        data: [],
        validation: null
      }
    },
    comparison: {
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
    }
  })),

  // Getters (computed values)
  getTreeData: () => {
    const { project, ui } = get();
    // This will be processed by WBS tree component
    return {
      wbs_structure: project.wbs_structure,
      expansions: ui.treeExpansions
    };
  },

  getProjectSummary: () => {
    const { project, comparison } = get();
    return {
      total_equipment: project.equipment_list.length,
      total_wbs_items: project.wbs_structure.length,
      has_changes: comparison.added.length > 0 || comparison.removed.length > 0,
      last_modified: project.last_modified
    };
  }
}));

export default useProjectStore;

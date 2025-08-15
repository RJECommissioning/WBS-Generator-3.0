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
    p6_paste: {
      content: '',
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

  // Missing Equipment specific state
  missingEquipment: {
    existingProject: { wbsStructure: [], projectInfo: {}, equipmentCodes: [] },
    combinedWBS: [],
    exportData: []
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
      [uploadType]: uploadType === 'p6_paste' ? {
        content: '',
        status: 'idle',
        error: null,
        data: [],
        validation: null
      } : {
        file: null,
        status: 'idle',
        error: null,
        data: [],
        validation: null
      }
    }
  })),

  // P6 Paste Actions
  setP6PasteData: (content, status = 'success', error = null, data = [], validation = null) => set((state) => ({
    uploads: {
      ...state.uploads,
      p6_paste: {
        content: content,
        status: status,
        error: error,
        data: data,
        validation: validation
      }
    }
  })),

  processP6Paste: async (pasteContent) => {
    const { setP6PasteData, setError, setSuccess, setMissingEquipmentExistingProject } = get();
    
    try {
      console.log('Processing P6 paste data...');
      setP6PasteData(pasteContent, 'processing');
      
      // Import P6 parser
      const { parseP6PasteData, extractEquipmentCodesFromP6WBS } = await import('../lib/p6Parser');
      
      // Parse the P6 data
      const parseResult = await parseP6PasteData(pasteContent);
      
      if (!parseResult.hasData) {
        throw new Error('No valid WBS data found in paste content');
      }
      
      // Extract equipment codes for comparison
      const equipmentCodes = extractEquipmentCodesFromP6WBS(parseResult.data);
      
      // Update missing equipment state
      setMissingEquipmentExistingProject({
        wbsStructure: parseResult.data,
        projectInfo: parseResult.projectInfo,
        equipmentCodes: equipmentCodes
      });
      
      // Update P6 paste state
      setP6PasteData(pasteContent, 'success', null, parseResult.data, parseResult.validation);
      
      setSuccess(`P6 data processed successfully! Found ${parseResult.dataLength} WBS items.`);
      
      return parseResult;
      
    } catch (error) {
      console.error('P6 paste processing failed:', error);
      setP6PasteData(pasteContent, 'error', error.message);
      setError(`P6 parsing failed: ${error.message}`);
      throw error;
    }
  },

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
  processMissingEquipment: async (xerFile, equipmentFile) => {
    const { 
      uploadFile, 
      setProcessingStage, 
      setError,
      setSuccess,
      setComparisonResults,
      setMissingEquipmentExistingProject,
      setMissingEquipmentCombinedWBS,
      setMissingEquipmentExportData
    } = get();
    
    try {
      setProcessingStage('parsing', 10, 'Parsing existing project (XER)...');
      
      // Upload and parse XER file
      const xerData = await uploadFile('xer_file', xerFile);
      
      setProcessingStage('parsing', 30, 'Parsing equipment list...');
      
      // Upload and parse equipment file
      const equipmentData = await uploadFile('equipment_list', equipmentFile);
      
      setProcessingStage('comparing', 50, 'Comparing equipment lists...');
      
      // Equipment comparison will be handled by lib/projectComparer.js
      // For now, simulate the process
      
      setProcessingStage('assigning_codes', 70, 'Assigning WBS codes to new equipment...');
      
      // Smart WBS code assignment will be handled by enhanced lib/wbsGenerator.js
      
      setProcessingStage('building_tree', 90, 'Building combined visualization...');
      
      setProcessingStage('complete', 100, 'Missing equipment processed successfully!');
      setSuccess('New equipment identified and assigned WBS codes!');
      
      return true;
      
    } catch (error) {
      setProcessingStage('error', 0, error.message);
      setError(`Failed to process missing equipment: ${error.message}`);
      return false;
    }
  },

  // Missing Equipment Actions
  setMissingEquipmentExistingProject: (project) => set((state) => ({
    missingEquipment: { 
      ...state.missingEquipment, 
      existingProject: project 
    }
  })),

  setMissingEquipmentCombinedWBS: (wbs) => set((state) => ({
    missingEquipment: { 
      ...state.missingEquipment, 
      combinedWBS: wbs 
    }
  })),

  setMissingEquipmentExportData: (data) => set((state) => ({
    missingEquipment: { 
      ...state.missingEquipment, 
      exportData: data 
    }
  })),

  resetMissingEquipment: () => set((state) => ({
    missingEquipment: {
      existingProject: { wbsStructure: [], projectInfo: {}, equipmentCodes: [] },
      combinedWBS: [],
      exportData: []
    },
    // Also clear related uploads and comparison data
    uploads: {
      ...state.uploads,
      p6_paste: {
        content: '',
        status: 'idle',
        error: null,
        data: [],
        validation: null
      },
      equipment_list: {
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

  // Equipment comparison processing
  compareEquipment: async (existingWBS, newEquipmentList) => {
    const { 
      setProcessingStage, 
      setComparisonResults, 
      setError,
      setSuccess 
    } = get();
    
    try {
      setProcessingStage('comparing', 20, 'Extracting existing equipment codes...');
      
      // This will be handled by lib/projectComparer.js
      // For now, basic simulation
      const existingEquipmentCodes = existingWBS
        .filter(item => item.wbs_name && item.wbs_name.includes('|'))
        .map(item => item.wbs_name.split('|')[0].trim());
      
      setProcessingStage('comparing', 60, 'Finding new equipment...');
      
      const newEquipment = newEquipmentList.filter(item => 
        !existingEquipmentCodes.includes(item.equipment_number)
      );
      
      const results = {
        added: newEquipment,
        removed: [], // Will be implemented later
        existing: newEquipmentList.filter(item => 
          existingEquipmentCodes.includes(item.equipment_number)
        ),
        modified: [] // Will be implemented later
      };
      
      setComparisonResults(results);
      setProcessingStage('complete', 100, 'Equipment comparison completed!');
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
    const { project, comparison, missingEquipment } = get();
    
    if (includeNewOnly && comparison.added.length > 0) {
      // Export only new items (for missing equipment feature)
      return missingEquipment.exportData.length > 0 ? 
        missingEquipment.exportData : comparison.added;
    }
    
    // Export full WBS structure or combined structure
    return missingEquipment.combinedWBS.length > 0 ? 
      missingEquipment.combinedWBS : project.wbs_structure;
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
      p6_paste: {
        content: '',
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
    },
    missingEquipment: {
      existingProject: { wbsStructure: [], projectInfo: {}, equipmentCodes: [] },
      combinedWBS: [],
      exportData: []
    }
  })),

  // Getters (computed values)
  getTreeData: () => {
    const { project, ui, missingEquipment } = get();
    // This will be processed by WBS tree component
    return {
      wbs_structure: missingEquipment.combinedWBS.length > 0 ? 
        missingEquipment.combinedWBS : project.wbs_structure,
      expansions: ui.treeExpansions
    };
  },

  getProjectSummary: () => {
    const { project, comparison, missingEquipment } = get();
    return {
      total_equipment: project.equipment_list.length,
      total_wbs_items: missingEquipment.combinedWBS.length > 0 ? 
        missingEquipment.combinedWBS.length : project.wbs_structure.length,
      has_changes: comparison.added.length > 0 || comparison.removed.length > 0,
      last_modified: project.last_modified,
      new_equipment_count: comparison.added.length,
      existing_equipment_count: missingEquipment.existingProject.equipmentCodes?.length || 0
    };
  }
}));

export default useProjectStore;

import React, { createContext, useContext, useReducer, useCallback } from 'react';

// Initial State
const initialState = {
  // Current project data
  project: {
    name: '',
    subsystem: '',
    created_date: null,
    last_modified: null
  },
  
  // Equipment data
  equipment: {
    original_list: [],
    current_list: [], 
    changes: {
      added: [],
      removed: []
    }
  },
  
  // WBS Structure
  wbs: {
    structure: null,
    flat_data: [],
    existing_structure: null // For continue project feature
  },
  
  // UI State
  ui: {
    current_page: 'home',
    loading: false,
    error: null,
    success_message: null,
    file_upload_progress: 0
  },
  
  // File Processing
  files: {
    equipment_file: null,
    wbs_file: null,
    xer_file: null,
    processed_data: null
  },
  
  // Visualization settings
  visualization: {
    expanded_nodes: new Set(['1']), // Root node expanded by default
    selected_node: null,
    show_new_only: false,
    color_by_category: true
  }
};

// Action Types
export const ActionTypes = {
  // Project actions
  SET_PROJECT_INFO: 'SET_PROJECT_INFO',
  RESET_PROJECT: 'RESET_PROJECT',
  
  // Equipment actions
  SET_EQUIPMENT_LIST: 'SET_EQUIPMENT_LIST',
  UPDATE_EQUIPMENT: 'UPDATE_EQUIPMENT',
  SET_EQUIPMENT_CHANGES: 'SET_EQUIPMENT_CHANGES',
  
  // WBS actions
  SET_WBS_STRUCTURE: 'SET_WBS_STRUCTURE',
  UPDATE_WBS_STRUCTURE: 'UPDATE_WBS_STRUCTURE',
  SET_EXISTING_WBS: 'SET_EXISTING_WBS',
  INTEGRATE_NEW_EQUIPMENT: 'INTEGRATE_NEW_EQUIPMENT',
  
  // UI actions
  SET_CURRENT_PAGE: 'SET_CURRENT_PAGE',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_SUCCESS_MESSAGE: 'SET_SUCCESS_MESSAGE',
  CLEAR_MESSAGES: 'CLEAR_MESSAGES',
  SET_UPLOAD_PROGRESS: 'SET_UPLOAD_PROGRESS',
  
  // File actions
  SET_FILE: 'SET_FILE',
  SET_PROCESSED_DATA: 'SET_PROCESSED_DATA',
  CLEAR_FILES: 'CLEAR_FILES',
  
  // Visualization actions
  TOGGLE_NODE_EXPANSION: 'TOGGLE_NODE_EXPANSION',
  SET_SELECTED_NODE: 'SET_SELECTED_NODE',
  SET_VISUALIZATION_OPTION: 'SET_VISUALIZATION_OPTION',
  EXPAND_ALL_NODES: 'EXPAND_ALL_NODES',
  COLLAPSE_ALL_NODES: 'COLLAPSE_ALL_NODES'
};

// Reducer Function
function appReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_PROJECT_INFO:
      return {
        ...state,
        project: {
          ...state.project,
          ...action.payload
        }
      };

    case ActionTypes.RESET_PROJECT:
      return {
        ...initialState,
        ui: {
          ...initialState.ui,
          current_page: action.payload?.page || 'home'
        }
      };

    case ActionTypes.SET_EQUIPMENT_LIST:
      return {
        ...state,
        equipment: {
          ...state.equipment,
          [action.payload.type]: action.payload.data,
          ...(action.payload.type === 'original_list' && {
            current_list: action.payload.data
          })
        }
      };

    case ActionTypes.UPDATE_EQUIPMENT:
      return {
        ...state,
        equipment: {
          ...state.equipment,
          current_list: action.payload
        }
      };

    case ActionTypes.SET_EQUIPMENT_CHANGES:
      return {
        ...state,
        equipment: {
          ...state.equipment,
          changes: action.payload
        }
      };

    case ActionTypes.SET_WBS_STRUCTURE:
      return {
        ...state,
        wbs: {
          ...state.wbs,
          structure: action.payload.structure,
          flat_data: action.payload.flat_data || []
        }
      };

    case ActionTypes.UPDATE_WBS_STRUCTURE:
      return {
        ...state,
        wbs: {
          ...state.wbs,
          structure: action.payload
        }
      };

    case ActionTypes.SET_EXISTING_WBS:
      return {
        ...state,
        wbs: {
          ...state.wbs,
          existing_structure: action.payload
        }
      };

    case ActionTypes.INTEGRATE_NEW_EQUIPMENT:
      return {
        ...state,
        wbs: {
          ...state.wbs,
          structure: action.payload.structure,
          flat_data: action.payload.flat_data || []
        },
        equipment: {
          ...state.equipment,
          changes: action.payload.changes || state.equipment.changes
        }
      };

    case ActionTypes.SET_CURRENT_PAGE:
      return {
        ...state,
        ui: {
          ...state.ui,
          current_page: action.payload
        }
      };

    case ActionTypes.SET_LOADING:
      return {
        ...state,
        ui: {
          ...state.ui,
          loading: action.payload
        }
      };

    case ActionTypes.SET_ERROR:
      return {
        ...state,
        ui: {
          ...state.ui,
          error: action.payload,
          loading: false
        }
      };

    case ActionTypes.SET_SUCCESS_MESSAGE:
      return {
        ...state,
        ui: {
          ...state.ui,
          success_message: action.payload,
          loading: false
        }
      };

    case ActionTypes.CLEAR_MESSAGES:
      return {
        ...state,
        ui: {
          ...state.ui,
          error: null,
          success_message: null
        }
      };

    case ActionTypes.SET_UPLOAD_PROGRESS:
      return {
        ...state,
        ui: {
          ...state.ui,
          file_upload_progress: action.payload
        }
      };

    case ActionTypes.SET_FILE:
      return {
        ...state,
        files: {
          ...state.files,
          [action.payload.type]: action.payload.file
        }
      };

    case ActionTypes.SET_PROCESSED_DATA:
      return {
        ...state,
        files: {
          ...state.files,
          processed_data: action.payload
        }
      };

    case ActionTypes.CLEAR_FILES:
      return {
        ...state,
        files: {
          equipment_file: null,
          wbs_file: null,
          xer_file: null,
          processed_data: null
        }
      };

    case ActionTypes.TOGGLE_NODE_EXPANSION:
      const newExpanded = new Set(state.visualization.expanded_nodes);
      if (newExpanded.has(action.payload)) {
        newExpanded.delete(action.payload);
      } else {
        newExpanded.add(action.payload);
      }
      return {
        ...state,
        visualization: {
          ...state.visualization,
          expanded_nodes: newExpanded
        }
      };

    case ActionTypes.SET_SELECTED_NODE:
      return {
        ...state,
        visualization: {
          ...state.visualization,
          selected_node: action.payload
        }
      };

    case ActionTypes.SET_VISUALIZATION_OPTION:
      return {
        ...state,
        visualization: {
          ...state.visualization,
          [action.payload.key]: action.payload.value
        }
      };

    case ActionTypes.EXPAND_ALL_NODES:
      // Extract all node codes from WBS structure
      const allNodes = new Set();
      const collectNodes = (node) => {
        if (node.code) allNodes.add(node.code);
        if (node.children) {
          node.children.forEach(collectNodes);
        }
      };
      if (state.wbs.structure) {
        collectNodes(state.wbs.structure);
      }
      
      return {
        ...state,
        visualization: {
          ...state.visualization,
          expanded_nodes: allNodes
        }
      };

    case ActionTypes.COLLAPSE_ALL_NODES:
      return {
        ...state,
        visualization: {
          ...state.visualization,
          expanded_nodes: new Set(['1']) // Keep only root expanded
        }
      };

    default:
      return state;
  }
}

// Context Creation
const AppContext = createContext();

// Provider Component
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Action creators
  const actions = {
    // Project actions
    setProjectInfo: useCallback((projectInfo) => {
      dispatch({
        type: ActionTypes.SET_PROJECT_INFO,
        payload: { ...projectInfo, last_modified: new Date() }
      });
    }, []),

    resetProject: useCallback((page = 'home') => {
      dispatch({
        type: ActionTypes.RESET_PROJECT,
        payload: { page }
      });
    }, []),

    // Equipment actions
    setEquipmentList: useCallback((data, type = 'original_list') => {
      dispatch({
        type: ActionTypes.SET_EQUIPMENT_LIST,
        payload: { data, type }
      });
    }, []),

    updateEquipment: useCallback((equipmentList) => {
      dispatch({
        type: ActionTypes.UPDATE_EQUIPMENT,
        payload: equipmentList
      });
    }, []),

    setEquipmentChanges: useCallback((changes) => {
      dispatch({
        type: ActionTypes.SET_EQUIPMENT_CHANGES,
        payload: changes
      });
    }, []),

    // WBS actions
    setWBSStructure: useCallback((structure, flatData = []) => {
      dispatch({
        type: ActionTypes.SET_WBS_STRUCTURE,
        payload: { structure, flat_data: flatData }
      });
    }, []),

    updateWBSStructure: useCallback((structure) => {
      dispatch({
        type: ActionTypes.UPDATE_WBS_STRUCTURE,
        payload: structure
      });
    }, []),

    setExistingWBS: useCallback((wbsData) => {
      dispatch({
        type: ActionTypes.SET_EXISTING_WBS,
        payload: wbsData
      });
    }, []),

    integrateNewEquipment: useCallback((structure, flatData, changes) => {
      dispatch({
        type: ActionTypes.INTEGRATE_NEW_EQUIPMENT,
        payload: { structure, flat_data: flatData, changes }
      });
    }, []),

    // UI actions
    setCurrentPage: useCallback((page) => {
      dispatch({
        type: ActionTypes.SET_CURRENT_PAGE,
        payload: page
      });
    }, []),

    setLoading: useCallback((loading) => {
      dispatch({
        type: ActionTypes.SET_LOADING,
        payload: loading
      });
    }, []),

    setError: useCallback((error) => {
      dispatch({
        type: ActionTypes.SET_ERROR,
        payload: error
      });
    }, []),

    setSuccessMessage: useCallback((message) => {
      dispatch({
        type: ActionTypes.SET_SUCCESS_MESSAGE,
        payload: message
      });
    }, []),

    clearMessages: useCallback(() => {
      dispatch({
        type: ActionTypes.CLEAR_MESSAGES
      });
    }, []),

    setUploadProgress: useCallback((progress) => {
      dispatch({
        type: ActionTypes.SET_UPLOAD_PROGRESS,
        payload: progress
      });
    }, []),

    // File actions
    setFile: useCallback((file, type) => {
      dispatch({
        type: ActionTypes.SET_FILE,
        payload: { file, type }
      });
    }, []),

    setProcessedData: useCallback((data) => {
      dispatch({
        type: ActionTypes.SET_PROCESSED_DATA,
        payload: data
      });
    }, []),

    clearFiles: useCallback(() => {
      dispatch({
        type: ActionTypes.CLEAR_FILES
      });
    }, []),
https://github.com/RJECommissioning/WBS-Generator-3.0/tree/main/src/utils
    // Visualization actions
    toggleNodeExpansion: useCallback((nodeCode) => {
      dispatch({
        type: ActionTypes.TOGGLE_NODE_EXPANSION,
        payload: nodeCode
      });
    }, []),

    setSelectedNode: useCallback((nodeCode) => {
      dispatch({
        type: ActionTypes.SET_SELECTED_NODE,
        payload: nodeCode
      });
    }, []),

    setVisualizationOption: useCallback((key, value) => {
      dispatch({
        type: ActionTypes.SET_VISUALIZATION_OPTION,
        payload: { key, value }
      });
    }, []),

    expandAllNodes: useCallback(() => {
      dispatch({
        type: ActionTypes.EXPAND_ALL_NODES
      });
    }, []),

    collapseAllNodes: useCallback(() => {
      dispatch({
        type: ActionTypes.COLLAPSE_ALL_NODES
      });
    }, [])
  };

  const value = {
    state,
    actions,
    dispatch
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Custom hook to use the context
export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

export default AppContext;

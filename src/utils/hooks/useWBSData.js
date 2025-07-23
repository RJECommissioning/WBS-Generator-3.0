import { useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import {
  buildWBSStructure,
  flattenWBSStructure,
  findMissingEquipment,
  integrateNewEquipment,
  generateNextSubsystemCode
} from '../utils/wbsProcessor';

/**
 * Custom hook for WBS data management
 * Handles all WBS-related operations including creation, updates, and integration
 */
export function useWBSData() {
  const { state, actions } = useAppContext();

  /**
   * Generate WBS structure from equipment list
   * @param {Array} equipmentList - Equipment data
   * @param {string} projectName - Project name
   * @param {string} subsystemName - Subsystem name
   */
  const generateWBS = useCallback(async (equipmentList, projectName, subsystemName) => {
    try {
      actions.setLoading(true);
      actions.clearMessages();

      console.log(`Generating WBS for ${equipmentList.length} equipment items`);
      
      // Build hierarchical WBS structure
      const wbsStructure = buildWBSStructure(equipmentList, projectName, subsystemName);
      
      // Flatten for export purposes
      const flatData = flattenWBSStructure(wbsStructure);
      
      // Update context
      actions.setWBSStructure(wbsStructure, flatData);
      actions.setEquipmentList(equipmentList, 'original_list');
      actions.setProjectInfo({
        name: projectName,
        subsystem: subsystemName,
        created_date: new Date()
      });
      
      actions.setSuccessMessage(`WBS generated successfully with ${flatData.length} items`);
      
      return { structure: wbsStructure, flatData };
      
    } catch (error) {
      console.error('WBS generation error:', error);
      actions.setError(`Failed to generate WBS: ${error.message}`);
      throw error;
    } finally {
      actions.setLoading(false);
    }
  }, [actions]);

  /**
   * Process missing equipment changes
   * @param {Array} originalEquipment - Original equipment list
   * @param {Array} newEquipment - New equipment list
   */
  const processEquipmentChanges = useCallback(async (originalEquipment, newEquipment) => {
    try {
      actions.setLoading(true);
      actions.clearMessages();

      console.log('Processing equipment changes...');
      
      // Find differences
      const changes = findMissingEquipment(originalEquipment, newEquipment);
      
      // Update context
      actions.setEquipmentChanges(changes);
      actions.setEquipmentList(newEquipment, 'current_list');
      
      if (changes.added.length === 0 && changes.removed.length === 0) {
        actions.setSuccessMessage('No changes detected in equipment list');
      } else {
        actions.setSuccessMessage(
          `Found ${changes.added.length} new items and ${changes.removed.length} removed items`
        );
      }
      
      return changes;
      
    } catch (error) {
      console.error('Equipment changes processing error:', error);
      actions.setError(`Failed to process changes: ${error.message}`);
      throw error;
    } finally {
      actions.setLoading(false);
    }
  }, [actions]);

  /**
   * Integrate new equipment into existing WBS
   * @param {Array} newEquipment - New equipment to integrate
   * @param {Object} existingStructure - Existing WBS structure (optional)
   */
  const integrateEquipment = useCallback(async (newEquipment, existingStructure = null) => {
    try {
      actions.setLoading(true);
      actions.clearMessages();

      console.log(`Integrating ${newEquipment.length} new equipment items`);
      
      const baseStructure = existingStructure || state.wbs.structure;
      if (!baseStructure) {
        throw new Error('No existing WBS structure found');
      }
      
      // Integrate new equipment
      const updatedStructure = integrateNewEquipment(baseStructure, newEquipment);
      
      // Flatten updated structure
      const flatData = flattenWBSStructure(updatedStructure);
      
      // Update context
      actions.integrateNewEquipment(updatedStructure, flatData, {
        added: newEquipment,
        removed: []
      });
      
      actions.setSuccessMessage(`Integrated ${newEquipment.length} new equipment items`);
      
      return { structure: updatedStructure, flatData };
      
    } catch (error) {
      console.error('Equipment integration error:', error);
      actions.setError(`Failed to integrate equipment: ${error.message}`);
      throw error;
    } finally {
      actions.setLoading(false);
    }
  }, [state.wbs.structure, actions]);

  /**
   * Continue project with new subsystem
   * @param {Array} existingWBS - Existing WBS data from XER
   * @param {Array} newEquipment - New subsystem equipment
   * @param {string} newSubsystemName - New subsystem name
   */
  const continueProject = useCallback(async (existingWBS, newEquipment, newSubsystemName) => {
    try {
      actions.setLoading(true);
      actions.clearMessages();

      console.log('Continuing project with new subsystem...');
      
      // Set existing WBS data
      actions.setExistingWBS(existingWBS);
      
      // Generate next subsystem code
      const nextSubsystemCode = generateNextSubsystemCode(existingWBS, newSubsystemName);
      
      // Build WBS for new subsystem only
      const projectName = state.project.name || 'Continued Project';
      const newSubsystemWBS = buildWBSStructure(newEquipment, projectName, newSubsystemName);
      
      // Update subsystem code in structure
      if (newSubsystemWBS.children && newSubsystemWBS.children.length > 2) {
        const subsystemNode = newSubsystemWBS.children[2]; // Third child is usually the subsystem
        subsystemNode.code = nextSubsystemCode;
        subsystemNode.name = `S${nextSubsystemCode.split('.')[1]} | Z0${nextSubsystemCode.split('.')[1]} | ${newSubsystemName}`;
        
        // Update all child codes
        updateChildCodes(subsystemNode, nextSubsystemCode);
      }
      
      const flatData = flattenWBSStructure(newSubsystemWBS);
      
      // Mark new items
      flatData.forEach(item => {
        item.is_new = true;
      });
      
      actions.setWBSStructure(newSubsystemWBS, flatData);
      actions.setProjectInfo({
        name: projectName,
        subsystem: newSubsystemName
      });
      
      actions.setSuccessMessage(`New subsystem '${newSubsystemName}' ready for integration`);
      
      return { structure: newSubsystemWBS, flatData, nextCode: nextSubsystemCode };
      
    } catch (error) {
      console.error('Project continuation error:', error);
      actions.setError(`Failed to continue project: ${error.message}`);
      throw error;
    } finally {
      actions.setLoading(false);
    }
  }, [state.project.name, actions]);

  /**
   * Update child codes recursively
   * @param {Object} node - Parent node
   * @param {string} parentCode - Parent WBS code
   */
  const updateChildCodes = (node, parentCode) => {
    if (node.children) {
      node.children.forEach((child, index) => {
        const sequence = index + 1;
        child.code = `${parentCode}.${sequence}`;
        child.parent_code = parentCode;
        updateChildCodes(child, child.code);
      });
    }
  };

  /**
   * Validate WBS structure
   * @param {Object} structure - WBS structure to validate
   */
  const validateWBS = useCallback((structure) => {
    const issues = [];
    
    if (!structure) {
      issues.push('WBS structure is null or undefined');
      return issues;
    }
    
    if (!structure.code) {
      issues.push('Root node missing WBS code');
    }
    
    if (!structure.name) {
      issues.push('Root node missing name');
    }
    
    // Validate hierarchy
    const validateNode = (node, level = 0) => {
      if (level > 6) {
        issues.push(`Node '${node.name}' exceeds maximum depth of 6 levels`);
      }
      
      if (node.children) {
        node.children.forEach(child => {
          if (!child.code) {
            issues.push(`Child node '${child.name}' missing WBS code`);
          }
          
          if (!child.parent_code) {
            issues.push(`Child node '${child.name}' missing parent code`);
          }
          
          if (child.parent_code !== node.code) {
            issues.push(`Child node '${child.name}' parent code mismatch`);
          }
          
          validateNode(child, level + 1);
        });
      }
    };
    
    validateNode(structure);
    return issues;
  }, []);

  /**
   * Get WBS statistics
   */
  const getWBSStats = useCallback(() => {
    if (!state.wbs.flat_data || state.wbs.flat_data.length === 0) {
      return null;
    }
    
    const data = state.wbs.flat_data;
    
    return {
      total_items: data.length,
      new_items: data.filter(item => item.is_new).length,
      categories: [...new Set(data.map(item => item.category).filter(Boolean))],
      max_level: Math.max(...data.map(item => item.level)),
      equipment_count: data.filter(item => item.equipment_data).length,
      unrecognized: data.filter(item => item.category === '99').length
    };
  }, [state.wbs.flat_data]);

  /**
   * Clear WBS data
   */
  const clearWBS = useCallback(() => {
    actions.setWBSStructure(null, []);
    actions.setEquipmentList([], 'original_list');
    actions.setEquipmentList([], 'current_list');
    actions.setEquipmentChanges({ added: [], removed: [] });
    actions.clearMessages();
  }, [actions]);

  return {
    // Data
    wbsStructure: state.wbs.structure,
    flatWBSData: state.wbs.flat_data,
    existingWBS: state.wbs.existing_structure,
    equipmentChanges: state.equipment.changes,
    
    // Actions
    generateWBS,
    processEquipmentChanges,
    integrateEquipment,
    continueProject,
    validateWBS,
    clearWBS,
    
    // Utilities
    getWBSStats,
    
    // State
    isLoading: state.ui.loading,
    error: state.ui.error,
    successMessage: state.ui.success_message
  };
}

export default useWBSData;

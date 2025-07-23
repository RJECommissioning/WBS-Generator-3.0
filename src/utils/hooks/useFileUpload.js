import { useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import {
  processFile,
  processEquipmentCSV,
  processWBSStructureCSV,
  processXERFile,
  validateFile,
  previewFile
} from '../utils/fileProcessor';

/**
 * Custom hook for file upload and processing operations
 */
export function useFileUpload() {
  const { state, actions } = useAppContext();

  /**
   * Upload and process any supported file type
   * @param {File} file - File to upload
   * @param {string} expectedType - Expected file type ('equipment', 'wbs', 'xer')
   */
  const uploadFile = useCallback(async (file, expectedType = null) => {
    try {
      actions.setLoading(true);
      actions.clearMessages();
      actions.setUploadProgress(0);

      console.log(`Uploading file: ${file.name} (${file.size} bytes)`);
      
      // Validate file
      validateFile(file);
      
      // Set upload progress
      actions.setUploadProgress(25);
      
      // Process file
      const result = await processFile(file);
      
      actions.setUploadProgress(75);
      
      // Store file and processed data
      const fileType = expectedType || result.type;
      actions.setFile(file, `${fileType}_file`);
      actions.setProcessedData({
        ...result,
        processed_at: new Date(),
        expected_type: expectedType
      });
      
      actions.setUploadProgress(100);
      
      // Set success message based on file type
      const successMessages = {
        equipment_list: `Equipment list uploaded: ${result.data.length} items`,
        wbs_structure: `WBS structure uploaded: ${result.data.length} items`,
        xer: `XER file uploaded: ${result.data.wbs.length} WBS items`
      };
      
      actions.setSuccessMessage(
        successMessages[result.type] || `File uploaded successfully: ${result.data.length} items`
      );
      
      console.log(`File processed successfully: ${result.type}`);
      return result;
      
    } catch (error) {
      console.error('File upload error:', error);
      actions.setError(error.message);
      actions.setUploadProgress(0);
      throw error;
    } finally {
      actions.setLoading(false);
    }
  }, [actions]);

  /**
   * Upload equipment list file
   * @param {File} file - Equipment CSV file
   */
  const uploadEquipmentList = useCallback(async (file) => {
    try {
      actions.setLoading(true);
      actions.clearMessages();
      
      console.log('Processing equipment list...');
      
      const equipmentData = await processEquipmentCSV(file);
      
      // Validate equipment data
      if (!equipmentData || equipmentData.length === 0) {
        throw new Error('No valid equipment data found in file');
      }
      
      // Check required fields
      const hasRequiredFields = equipmentData.every(item => 
        item.equipment_number && item.equipment_number.trim() !== ''
      );
      
      if (!hasRequiredFields) {
        console.warn('Some equipment items missing required fields');
      }
      
      // Store data
      actions.setFile(file, 'equipment_file');
      actions.setEquipmentList(equipmentData, 'original_list');
      
      actions.setSuccessMessage(
        `Equipment list uploaded successfully: ${equipmentData.length} items`
      );
      
      return equipmentData;
      
    } catch (error) {
      console.error('Equipment upload error:', error);
      actions.setError(`Failed to process equipment list: ${error.message}`);
      throw error;
    } finally {
      actions.setLoading(false);
    }
  }, [actions]);

  /**
   * Upload WBS structure file
   * @param {File} file - WBS CSV file
   */
  const uploadWBSStructure = useCallback(async (file) => {
    try {
      actions.setLoading(true);
      actions.clearMessages();
      
      console.log('Processing WBS structure...');
      
      const wbsData = await processWBSStructureCSV(file);
      
      // Validate WBS data
      if (!wbsData || wbsData.length === 0) {
        throw new Error('No valid WBS data found in file');
      }
      
      // Store data
      actions.setFile(file, 'wbs_file');
      actions.setExistingWBS(wbsData);
      
      actions.setSuccessMessage(
        `WBS structure uploaded successfully: ${wbsData.length} items`
      );
      
      return wbsData;
      
    } catch (error) {
      console.error('WBS upload error:', error);
      actions.setError(`Failed to process WBS structure: ${error.message}`);
      throw error;
    } finally {
      actions.setLoading(false);
    }
  }, [actions]);

  /**
   * Upload XER file
   * @param {File} file - XER file
   */
  const uploadXERFile = useCallback(async (file) => {
    try {
      actions.setLoading(true);
      actions.clearMessages();
      
      console.log('Processing XER file...');
      
      const xerData = await processXERFile(file);
      
      // Validate XER data
      if (!xerData.wbs || xerData.wbs.length === 0) {
        throw new Error('No valid WBS data found in XER file');
      }
      
      // Store data
      actions.setFile(file, 'xer_file');
      actions.setExistingWBS(xerData.wbs);
      
      actions.setSuccessMessage(
        `XER file uploaded successfully: ${xerData.wbs.length} WBS items, ${xerData.tasks.length} tasks`
      );
      
      return xerData;
      
    } catch (error) {
      console.error('XER upload error:', error);
      actions.setError(`Failed to process XER file: ${error.message}`);
      throw error;
    } finally {
      actions.setLoading(false);
    }
  }, [actions]);

  /**
   * Preview file contents before processing
   * @param {File} file - File to preview
   * @param {number} rowCount - Number of rows to preview
   */
  const previewFileContents = useCallback(async (file, rowCount = 5) => {
    try {
      actions.setLoading(true);
      
      const preview = await previewFile(file, rowCount);
      
      console.log(`File preview: ${preview.headers.length} columns, ${preview.rows.length} rows`);
      
      return preview;
      
    } catch (error) {
      console.error('File preview error:', error);
      actions.setError(`Failed to preview file: ${error.message}`);
      throw error;
    } finally {
      actions.setLoading(false);
    }
  }, [actions]);

  /**
   * Validate file before upload
   * @param {File} file - File to validate
   * @param {string} expectedType - Expected file type
   */
  const validateFileUpload = useCallback((file, expectedType = null) => {
    try {
      // Basic validation
      validateFile(file);
      
      // Type-specific validation
      const extension = file.name.split('.').pop().toLowerCase();
      
      if (expectedType) {
        const expectedExtensions = {
          equipment: ['csv', 'xlsx', 'xls'],
          wbs: ['csv'],
          xer: ['xer']
        };
        
        const validExtensions = expectedExtensions[expectedType];
        if (validExtensions && !validExtensions.includes(extension)) {
          throw new Error(
            `Invalid file type for ${expectedType}. Expected: ${validExtensions.join(', ')}`
          );
        }
      }
      
      return true;
      
    } catch (error) {
      actions.setError(error.message);
      return false;
    }
  }, [actions]);

  /**
   * Clear uploaded files
   * @param {string} fileType - Specific file type to clear, or 'all'
   */
  const clearFiles = useCallback((fileType = 'all') => {
    if (fileType === 'all') {
      actions.clearFiles();
      actions.clearMessages();
    } else {
      actions.setFile(null, fileType);
    }
    
    actions.setUploadProgress(0);
  }, [actions]);

  /**
   * Get file upload statistics
   */
  const getUploadStats = useCallback(() => {
    const files = state.files;
    const processedData = files.processed_data;
    
    if (!processedData) {
      return null;
    }
    
    const stats = {
      filename: processedData.filename,
      type: processedData.type,
      processed_at: processedData.processed_at,
      data_count: 0
    };
    
    if (processedData.type === 'equipment_list') {
      stats.data_count = processedData.data.length;
      stats.commissioning_status = {
        Y: processedData.data.filter(item => item.commissioning_status === 'Y').length,
        TBC: processedData.data.filter(item => item.commissioning_status === 'TBC').length,
        N: processedData.data.filter(item => item.commissioning_status === 'N').length
      };
    } else if (processedData.type === 'wbs_structure') {
      stats.data_count = processedData.data.length;
      stats.max_level = Math.max(...processedData.data.map(item => item.level || 0));
    } else if (processedData.type === 'xer') {
      stats.data_count = processedData.data.wbs.length;
      stats.projects_count = processedData.data.projects.length;
      stats.tasks_count = processedData.data.tasks.length;
    }
    
    return stats;
  }, [state.files.processed_data]);

  /**
   * Check if specific file type is uploaded
   * @param {string} fileType - File type to check
   */
  const hasFile = useCallback((fileType) => {
    return !!state.files[`${fileType}_file`];
  }, [state.files]);

  /**
   * Get processed data for specific file type
   * @param {string} fileType - File type
   */
  const getProcessedData = useCallback((fileType) => {
    const processedData = state.files.processed_data;
    
    if (!processedData) return null;
    
    if (fileType && processedData.type !== fileType) {
      return null;
    }
    
    return processedData.data;
  }, [state.files.processed_data]);

  return {
    // File upload actions
    uploadFile,
    uploadEquipmentList,
    uploadWBSStructure, 
    uploadXERFile,
    
    // Utilities
    previewFileContents,
    validateFileUpload,
    clearFiles,
    
    // Data access
    getUploadStats,
    hasFile,
    getProcessedData,
    
    // State
    isLoading: state.ui.loading,
    error: state.ui.error,
    successMessage: state.ui.success_message,
    uploadProgress: state.ui.file_upload_progress,
    
    // File references
    equipmentFile: state.files.equipment_file,
    wbsFile: state.files.wbs_file,
    xerFile: state.files.xer_file,
    processedData: state.files.processed_data
  };
}

export default useFileUpload;

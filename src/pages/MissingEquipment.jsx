import React, { useState, useEffect } from 'react';
import useProjectStore from '../store/projectStore';
import FileUpload from '../components/FileUpload';
import WBSVisualization from '../components/WBSVisualization';
import ExportButton from '../components/ExportButton';
import LoadingSpinner from '../components/LoadingSpinner';
import { parseFile } from '../lib/fileParser';
import { categorizeEquipment } from '../lib/equipmentProcessor';
import { generateWBSStructure } from '../lib/wbsGenerator';
import { extractEquipmentCodesFromWBS } from '../lib/xerParser';

const MissingEquipment = () => {
  console.log('=== MISSING EQUIPMENT PAGE LOADED ===');
  
  // Separate state from Start New Project to avoid interference
  const {
    // Missing Equipment specific state
    missingEquipment: {
      existingProject,
      combinedWBS,
      exportData
    },
    // Upload states
    uploads: {
      xer_file,
      equipment_list
    },
    // UI state
    ui: { processing, error, success },
    // Missing Equipment actions
    setMissingEquipmentExistingProject,
    setMissingEquipmentCombinedWBS,
    setMissingEquipmentExportData,
    resetMissingEquipment,
    // Generic actions
    setProcessingStage,
    setError,
    setSuccess,
    clearMessages,
    setFileUpload
  } = useProjectStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [debugInfo, setDebugInfo] = useState('');

  // Reset state on component mount
  useEffect(() => {
    console.log('Missing Equipment component mounted - resetting state');
    resetMissingEquipment();
    clearMessages();
    setCurrentStep(1);
  }, [resetMissingEquipment, clearMessages]);

  // Debug logging helper
  const addDebugInfo = (message) => {
    console.log('[DEBUG]', message);
    setDebugInfo(prev => prev + '\n' + `[${new Date().toLocaleTimeString()}] ${message}`);
  };

  // Step 1: Handle XER file upload and parsing
 const handleXERFileUpload = async (file) => {
  console.log('🚨 UPLOAD FUNCTION CALLED!', file); // 
  try {
      console.log('=== STARTING XER FILE UPLOAD ===');
      addDebugInfo(`Starting XER file upload: ${file.name} (${file.size} bytes)`);
      
      clearMessages();
      setProcessingStage('parsing', 10, 'Parsing XER file...');

      // Set file upload state
      setFileUpload('xer_file', {
        file: file,
        status: 'uploading',
        error: null
      });

      addDebugInfo('Calling parseFile() for XER processing...');
      console.log('Calling parseFile with XER file:', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      const parseResult = await parseFile(file);
      
      console.log('=== PARSE RESULT RECEIVED ===');
      console.log('Parse result:', parseResult);
      addDebugInfo(`Parse result type: ${parseResult?.type}, hasData: ${parseResult?.hasData}`);

      if (parseResult.type !== 'xer') {
        throw new Error(`Invalid file type. Expected XER, got ${parseResult.type}. Please upload an XER text file exported from P6.`);
      }

      if (!parseResult.hasData || parseResult.data.length === 0) {
        throw new Error('No WBS data found in XER file. Please check the file format.');
      }

      console.log('=== XER PARSING SUCCESSFUL ===');
      console.log('XER parsing successful:', {
        totalWBSItems: parseResult.dataLength,
        projectInfo: parseResult.projectInfo,
        sampleData: parseResult.data.slice(0, 3)
      });

      addDebugInfo(`XER parsing successful! Found ${parseResult.dataLength} WBS items`);
      addDebugInfo(`Project: ${parseResult.projectInfo?.projectName || 'Unknown'}`);

      // Extract equipment codes for comparison
      const equipmentCodes = extractEquipmentCodesFromWBS(parseResult.data);
      addDebugInfo(`Extracted ${equipmentCodes.length} equipment codes from WBS`);

      // Set the existing project data
      const projectData = {
        wbsStructure: parseResult.data,
        projectInfo: parseResult.projectInfo || { projectName: 'Unknown Project' },
        totalItems: parseResult.dataLength,
        equipmentCodes: equipmentCodes
      };

      console.log('Setting existing project data:', projectData);
      setMissingEquipmentExistingProject(projectData);

      // Update file upload state
      setFileUpload('xer_file', {
        file: file,
        status: 'success',
        error: null,
        data: parseResult.data
      });

      setProcessingStage('complete', 100, 'XER file processed successfully!');
      setSuccess(`XER file processed successfully! Found ${parseResult.dataLength} WBS items.`);
      
      addDebugInfo('XER file processing completed - ready for next step');
      
    } catch (error) {
      console.error('=== XER PARSING FAILED ===');
      console.error('XER parsing error:', error);
      addDebugInfo(`XER parsing failed: ${error.message}`);

      setError(`XER parsing failed: ${error.message}`);
      setFileUpload('xer_file', {
        file: file,
        status: 'error',
        error: error.message
      });
      setProcessingStage('error', 0, error.message);
    }
  };

  // Step 2: Handle equipment file upload and processing
  const handleEquipmentFileUpload = async (file) => {
    try {
      console.log('=== STARTING EQUIPMENT FILE UPLOAD ===');
      addDebugInfo(`Starting equipment file upload: ${file.name} (${file.size} bytes)`);
      
      clearMessages();
      setProcessingStage('parsing', 10, 'Parsing equipment file...');

      // Set file upload state
      setFileUpload('equipment_list', {
        file: file,
        status: 'uploading',
        error: null
      });

      console.log('Parsing equipment file...');
      const parseResult = await parseFile(file);

      if (parseResult.type !== 'equipment_list') {
        throw new Error(`Invalid file type. Expected equipment list, got ${parseResult.type}. Please upload an equipment CSV or Excel file.`);
      }

      if (!parseResult.hasData || parseResult.data.length === 0) {
        throw new Error('No equipment data found. Please check the file format.');
      }

      console.log('Equipment parsing successful:', {
        totalEquipment: parseResult.dataLength,
        sampleData: parseResult.data.slice(0, 3)
      });

      addDebugInfo(`Equipment parsing successful! Found ${parseResult.dataLength} equipment items`);

      // Update file upload state
      setFileUpload('equipment_list', {
        file: file,
        status: 'success',
        error: null,
        data: parseResult.data
      });

      setProcessingStage('processing', 50, 'Processing new equipment...');

      // Automatically start WBS processing
      await processNewEquipment(parseResult.data);
      
    } catch (error) {
      console.error('Equipment parsing failed:', error);
      addDebugInfo(`Equipment parsing failed: ${error.message}`);

      setError(`Equipment parsing failed: ${error.message}`);
      setFileUpload('equipment_list', {
        file: file,
        status: 'error',
        error: error.message
      });
      setProcessingStage('error', 0, error.message);
    }
  };

  // Step 3: Process new equipment and assign WBS codes
  const processNewEquipment = async (equipmentList) => {
    try {
      console.log('=== STARTING NEW EQUIPMENT PROCESSING ===');
      addDebugInfo('Starting equipment processing and WBS assignment');
      
      clearMessages();
      setProcessingStage('processing', 60, 'Categorizing equipment...');

      // Process equipment using existing logic
      console.log('Processing equipment with categorizeEquipment...');
      const processedEquipment = await categorizeEquipment(equipmentList);
      console.log('Equipment processing completed:', {
        totalProcessed: processedEquipment.totalProcessed,
        categories: Object.keys(processedEquipment.categoryStats || {}).length
      });

      addDebugInfo(`Equipment processing completed: ${processedEquipment.totalProcessed} items processed`);

      setProcessingStage('comparing', 70, 'Finding new equipment...');

      // Find new equipment by comparing with existing project
      const existingEquipmentCodes = existingProject.equipmentCodes || [];
      const newEquipment = processedEquipment.equipment.filter(item => 
        !existingEquipmentCodes.includes(item.equipment_number)
      );

      console.log('New equipment identification:', {
        existingCodes: existingEquipmentCodes.length,
        totalEquipment: processedEquipment.equipment.length,
        newEquipment: newEquipment.length
      });

      addDebugInfo(`Equipment comparison completed:`);
      addDebugInfo(`- Existing equipment: ${existingEquipmentCodes.length} items`);
      addDebugInfo(`- Total in new list: ${processedEquipment.equipment.length} items`);
      addDebugInfo(`- New equipment found: ${newEquipment.length} items`);

      if (newEquipment.length === 0) {
        const message = 'No new equipment found. All equipment items already exist in the project.';
        addDebugInfo(message);
        setError(message);
        setProcessingStage('complete', 100, 'Processing complete - no new equipment');
        return;
      }

      setProcessingStage('generating', 80, 'Generating WBS codes for new equipment...');

      // Generate WBS structure for new equipment
      const newEquipmentProcessed = {
        ...processedEquipment,
        equipment: newEquipment,
        totalProcessed: newEquipment.length
      };

      console.log('Generating WBS structure for new equipment...');
      const newWBSResult = await generateWBSStructure(
        newEquipmentProcessed,
        existingProject.projectInfo?.projectName || 'Project Update'
      );

      console.log('New WBS structure generated:', {
        newWBSItems: newWBSResult.totalWBSItems,
        validation: newWBSResult.validation
      });

      addDebugInfo(`WBS structure generated: ${newWBSResult.totalWBSItems} new WBS items`);

      setProcessingStage('building', 90, 'Building combined visualization...');

      // TODO: Implement smart WBS code assignment based on existing project structure
      // For now, mark all new items with isNew flag
      const markedNewWBS = newWBSResult.wbsStructure.map(item => ({
        ...item,
        isNew: true
      }));

      // Combine existing and new WBS structures
      const combinedWBS = [
        ...existingProject.wbsStructure,
        ...markedNewWBS
      ];

      console.log('Combined WBS structure:', {
        existingItems: existingProject.wbsStructure.length,
        newItems: markedNewWBS.length,
        totalItems: combinedWBS.length
      });

      setMissingEquipmentCombinedWBS(combinedWBS);
      setMissingEquipmentExportData(markedNewWBS); // Export only new items
      
      setProcessingStage('complete', 100, 'Processing complete!');
      setSuccess(`Successfully processed ${newEquipment.length} new equipment items and assigned WBS codes!`);
      
      addDebugInfo('Processing completed successfully!');
      addDebugInfo(`Combined structure: ${existingProject.wbsStructure.length} existing + ${markedNewWBS.length} new = ${combinedWBS.length} total`);
      
      setCurrentStep(3); // Move to visualization step

    } catch (error) {
      console.error('New equipment processing failed:', error);
      addDebugInfo(`Processing failed: ${error.message}`);
      setError(`Processing failed: ${error.message}`);
      setProcessingStage('error', 0, error.message);
    }
  };

  // Handle step progression
  const handleConfirmXERParsing = () => {
    console.log('Confirming XER parsing, checking conditions...');
    console.log('XER file status:', xer_file.status);
    console.log('Existing project WBS count:', existingProject.wbsStructure?.length || 0);
    
    if (xer_file.status === 'success' && existingProject.wbsStructure && existingProject.wbsStructure.length > 0) {
      addDebugInfo('XER parsing confirmed - moving to equipment upload step');
      setCurrentStep(2);
      clearMessages();
    } else {
      addDebugInfo('Cannot proceed - XER parsing not successful or no WBS data');
      setError('Cannot proceed: XER file not properly processed or no WBS data found.');
    }
  };

  const handleBackToStep = (step) => {
    console.log(`Going back to step ${step}`);
    addDebugInfo(`Going back to step ${step}`);
    setCurrentStep(step);
    clearMessages();
  };

  const handleReset = () => {
    console.log('Resetting Missing Equipment state');
    addDebugInfo('Resetting all state...');
    resetMissingEquipment();
    setCurrentStep(1);
    clearMessages();
    setDebugInfo('');
  };

  return (
    <div className="missing-equipment-page">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Missing Equipment</h1>
          <p className="text-gray-600">
            Add new equipment to an existing P6 project with intelligent WBS code assignment
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center ${currentStep >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
                currentStep >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-300'
              }`}>
                1
              </div>
              <span>Upload XER File</span>
            </div>
            <div className="h-px bg-gray-300 flex-1"></div>
            <div className={`flex items-center ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
                currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300'
              }`}>
                2
              </div>
              <span>Upload Equipment</span>
            </div>
            <div className="h-px bg-gray-300 flex-1"></div>
            <div className={`flex items-center ${currentStep >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
                currentStep >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-300'
              }`}>
                3
              </div>
              <span>Review & Export</span>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Success Display */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Success</h3>
                <p className="mt-1 text-sm text-green-700">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Processing Status */}
        {processing.stage && processing.stage !== 'complete' && processing.stage !== 'error' && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center">
              <LoadingSpinner />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Processing...</h3>
                <p className="mt-1 text-sm text-blue-700">{processing.message}</p>
                <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${processing.progress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debug Information */}
        {debugInfo && (
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
            <h3 className="text-sm font-medium text-gray-800 mb-2">Debug Information</h3>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {debugInfo}
            </pre>
          </div>
        )}

        {/* Step 1: XER File Upload */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Step 1: Upload Existing Project (XER File)</h2>
              <p className="text-gray-600 mb-4">
                Upload the XER text file exported from your P6 project to understand the existing WBS structure.
                Accepted formats: .xer and .txt files.
              </p>
              
              <FileUpload
                onFileUpload={handleXERFileUpload}
                accept=".xer,.txt
                maxSizeMB={50}
                title="Upload XER File"
                description="Select XER text file exported from Primavera P6 (both .xer and .txt formats accepted)"
                isLoading={processing.stage === 'parsing' && processing.message.includes('XER')}
                loadingText="Parsing XER file..."
              />
            </div>

            {/* XER Parse Results */}
            {xer_file.status === 'success' && existingProject.wbsStructure && existingProject.wbsStructure.length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4">Existing Project Structure</h3>
                <div className="mb-4">
                  <p className="text-sm text-gray-600">
                    <strong>Project:</strong> {existingProject.projectInfo?.projectName || 'Unknown Project'}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Total WBS Items:</strong> {existingProject.totalItems || 0}
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Existing Equipment:</strong> {existingProject.equipmentCodes?.length || 0} items
                  </p>
                </div>

                <div className="mb-4 max-h-96 overflow-y-auto border rounded">
                  <WBSVisualization 
                    wbsData={existingProject.wbsStructure}
                    title="Existing Project Structure"
                    showNewBadges={false}
                  />
                </div>

                <div className="flex space-x-4">
                  <button
                    onClick={handleConfirmXERParsing}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium"
                  >
                    Confirm & Continue
                  </button>
                  <button
                    onClick={handleReset}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-2 rounded-md font-medium"
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}

            {/* XER Error State */}
            {xer_file.status === 'error' && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold mb-4 text-red-600">XER Processing Failed</h3>
                <p className="text-red-600 mb-4">{xer_file.error}</p>
                <button
                  onClick={handleReset}
                  className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-md font-medium"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Equipment File Upload */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Step 2: Upload Updated Equipment List</h2>
              <p className="text-gray-600 mb-4">
                Upload your updated equipment list that includes both existing and new equipment items.
                The system will automatically identify new equipment and assign appropriate WBS codes.
              </p>
              
              <FileUpload
                onFileUpload={handleEquipmentFileUpload}
                acceptedTypes=".csv,.xlsx,.xls"
                maxSizeMB={10}
                title="Upload Equipment List"
                description="Select CSV or Excel file with equipment data"
                isLoading={processing.stage && processing.message && !processing.message.includes('XER')}
                loadingText={processing.message || 'Processing...'}
              />
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => handleBackToStep(1)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-2 rounded-md font-medium"
              >
                Back to XER Upload
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Export */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Step 3: Review Combined Project Structure</h2>
              <p className="text-gray-600 mb-4">
                Review the complete project structure with new equipment highlighted. 
                Export only the new items for import into P6.
              </p>

              {/* Summary Statistics */}
              {combinedWBS && exportData && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-md">
                    <p className="text-sm text-gray-600">Total WBS Items</p>
                    <p className="text-2xl font-semibold text-blue-600">{combinedWBS.length}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-md">
                    <p className="text-sm text-gray-600">New Equipment Items</p>
                    <p className="text-2xl font-semibold text-green-600">{exportData.length}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-600">Existing Items</p>
                    <p className="text-2xl font-semibold text-gray-600">{combinedWBS.length - exportData.length}</p>
                  </div>
                </div>
              )}

              {/* Combined WBS Visualization */}
              {combinedWBS && combinedWBS.length > 0 && (
                <div className="mb-6 max-h-96 overflow-y-auto border rounded">
                  <WBSVisualization 
                    wbsData={combinedWBS}
                    title="Combined Project Structure (Existing + New)"
                    showNewBadges={true}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-4">
                {exportData && exportData.length > 0 && (
                  <ExportButton
                    wbsData={exportData}
                    filename={`${existingProject.projectInfo?.projectName || 'Project'}_New_Equipment.csv`}
                    includeNewOnly={true}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md font-medium"
                  >
                    Export New Equipment Only ({exportData.length} items)
                  </ExportButton>
                )}
                <button
                  onClick={() => handleBackToStep(2)}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-2 rounded-md font-medium"
                >
                  Back to Equipment Upload
                </button>
                <button
                  onClick={handleReset}
                  className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-6 py-2 rounded-md font-medium"
                >
                  Start Over
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MissingEquipment;

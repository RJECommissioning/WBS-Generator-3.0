import React, { useState, useEffect } from 'react';
import useProjectStore from '../store/projectStore';
import FileUpload from '../components/FileUpload';
import P6PasteInput from '../components/P6PasteInput';
import WBSVisualization from '../components/WBSVisualization';
import ExportButton from '../components/ExportButton';
import LoadingSpinner from '../components/LoadingSpinner';
import { parseFile } from '../lib/fileParser';
import { categorizeEquipment } from '../lib/equipmentProcessor';
import { compareEquipmentLists } from '../lib/projectComparer';

const MissingEquipment = () => {
  console.log('=== MISSING EQUIPMENT PAGE LOADED ===');
  
  // Store state
  const {
    // Missing Equipment specific state
    missingEquipment: {
      existingProject,
      combinedWBS,
      exportData
    },
    // Upload states - Updated for P6 paste
    uploads: {
      p6_paste,
      equipment_list
    },
    // UI state
    ui: { processing, error, success },
    // Missing Equipment actions
    setMissingEquipmentExistingProject,
    setMissingEquipmentCombinedWBS,
    setMissingEquipmentExportData,
    resetMissingEquipment,
    // P6 paste actions
    processP6Paste,
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

  // Step 1: Handle P6 paste data processing
  const handleP6DataPasted = async (pasteContent) => {
    try {
      console.log('=== STARTING P6 PASTE PROCESSING ===');
      addDebugInfo(`Starting P6 paste processing: ${pasteContent.length} characters`);
      
      clearMessages();
      setProcessingStage('parsing', 10, 'Parsing P6 WBS data...');

      console.log('Processing P6 paste data...');
      const parseResult = await processP6Paste(pasteContent);

      console.log('P6 parsing successful:', {
        dataLength: parseResult.dataLength,
        projectName: parseResult.projectInfo?.projectName,
        equipmentCodes: existingProject.equipmentCodes?.length || 0
      });

      addDebugInfo(`P6 parsing successful! Found ${parseResult.dataLength} WBS items`);
      addDebugInfo(`Project: ${parseResult.projectInfo?.projectName || 'Unknown'}`);
      addDebugInfo(`Equipment codes extracted: ${existingProject.equipmentCodes?.length || 0}`);

      setProcessingStage('complete', 100, 'P6 data processed successfully!');
      setSuccess(`P6 data processed successfully! Found ${parseResult.dataLength} WBS items.`);
      
      addDebugInfo('P6 data processing completed - ready for next step');
      
    } catch (error) {
      console.error('=== P6 PARSING FAILED ===');
      console.error('P6 parsing error:', error);
      addDebugInfo(`P6 parsing failed: ${error.message}`);

      setError(`P6 parsing failed: ${error.message}`);
      setProcessingStage('error', 0, error.message);
    }
  };

  // Step 2: Handle equipment file upload and processing
  const handleEquipmentFileUpload = async (result) => {
    const file = result.file;
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

  // ENHANCED: Step 3 - Process new equipment using enhanced comparison logic
  const processNewEquipment = async (equipmentList) => {
    try {
      console.log('=== STARTING ENHANCED NEW EQUIPMENT PROCESSING ===');
      addDebugInfo('Starting enhanced equipment processing with subsystem support');
      
      clearMessages();
      setProcessingStage('comparing', 60, 'Comparing equipment with existing project...');

      // Use enhanced comparison function instead of basic logic
      console.log('Using enhanced comparison logic with subsystem support...');
      const comparisonResult = await compareEquipmentLists(existingProject, equipmentList);
      
      console.log('Enhanced comparison completed:', {
        newEquipment: comparisonResult.comparison.added.length,
        existingEquipment: comparisonResult.comparison.existing.length,
        newSubsystems: comparisonResult.subsystems?.new?.length || 0,
        existingSubsystems: comparisonResult.subsystems?.existing?.length || 0
      });

      addDebugInfo(`Enhanced comparison completed:`);
      addDebugInfo(`- New equipment found: ${comparisonResult.comparison.added.length} items`);
      addDebugInfo(`- Existing equipment: ${comparisonResult.comparison.existing.length} items`);
      addDebugInfo(`- New subsystems: ${comparisonResult.subsystems?.new?.length || 0}`);
      addDebugInfo(`- Existing subsystems: ${comparisonResult.subsystems?.existing?.length || 0}`);

      if (comparisonResult.comparison.added.length === 0) {
        const message = 'No new equipment found. All equipment items already exist in the project.';
        addDebugInfo(message);
        setError(message);
        setProcessingStage('complete', 100, 'Processing complete - no new equipment');
        return;
      }

      setProcessingStage('building', 80, 'Building combined project structure...');

      // Use the integrated structure from enhanced comparison
      const combinedWBS = comparisonResult.integrated_structure;
      const exportData = comparisonResult.export_ready;

      console.log('Enhanced integration completed:', {
        combinedItems: combinedWBS.length,
        exportItems: exportData.length,
        summary: comparisonResult.summary
      });

      addDebugInfo(`Enhanced integration completed:`);
      addDebugInfo(`- Combined WBS items: ${combinedWBS.length}`);
      addDebugInfo(`- Export-ready items: ${exportData.length}`);
      
      // Update state with enhanced results
      setMissingEquipmentCombinedWBS(combinedWBS);
      setMissingEquipmentExportData(exportData);
      
      setProcessingStage('complete', 100, 'Processing complete!');
      setSuccess(`Successfully processed ${comparisonResult.comparison.added.length} new equipment items across ${comparisonResult.subsystems?.new?.length || 0} new subsystems!`);
      
      addDebugInfo('Enhanced processing completed successfully!');
      addDebugInfo(`Final structure: ${existingProject.wbsStructure.length} existing + ${exportData.length} new = ${combinedWBS.length} total`);
      
      setCurrentStep(3); // Move to visualization step

    } catch (error) {
      console.error('Enhanced equipment processing failed:', error);
      addDebugInfo(`Enhanced processing failed: ${error.message}`);
      setError(`Enhanced processing failed: ${error.message}`);
      setProcessingStage('error', 0, error.message);
    }
  };

  // Handle step progression
  const handleConfirmP6Parsing = () => {
    console.log('Confirming P6 parsing, checking conditions...');
    console.log('P6 paste status:', p6_paste.status);
    console.log('Existing project WBS count:', existingProject.wbsStructure?.length || 0);
    
    if (p6_paste.status === 'success' && existingProject.wbsStructure && existingProject.wbsStructure.length > 0) {
      addDebugInfo('P6 parsing confirmed - moving to equipment upload step');
      setCurrentStep(2);
      clearMessages();
    } else {
      addDebugInfo('Cannot proceed - P6 parsing not successful or no WBS data');
      setError('Cannot proceed: P6 data not properly processed or no WBS data found.');
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
              <span>Paste P6 WBS Data</span>
            </div>
            <div className="h-px bg-gray-300 flex-1"></div>
            <div className={`flex items-center ${currentStep >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-2 ${
                currentStep >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-300'
              }`}>
                2
              </div>
              <span>Upload Equipment List</span>
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

        {/* Step 1: P6 Paste Input */}
        {currentStep === 1 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Step 1: Paste P6 WBS Data</h2>
              {existingProject.wbsStructure?.length > 0 && (
                <button
                  onClick={handleReset}
                  className="text-gray-600 hover:text-gray-800 text-sm"
                >
                  🔄 Start Over
                </button>
              )}
            </div>

            <P6PasteInput
              onDataPasted={handleP6DataPasted}
              isProcessing={processing.stage === 'parsing'}
            />

            {/* P6 Data Preview */}
            {existingProject.wbsStructure?.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-3">Existing Project Structure</h3>
                <div className="bg-gray-50 border rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-2">
                    Project: {existingProject.projectInfo?.projectName} | 
                    WBS Items: {existingProject.wbsStructure.length} | 
                    Equipment Codes: {existingProject.equipmentCodes?.length || 0}
                  </div>
                  <WBSVisualization 
                    wbsData={existingProject.wbsStructure.slice(0, 50)} 
                    showControls={false}
                    maxHeight="300px"
                  />
                  {existingProject.wbsStructure.length > 50 && (
                    <div className="text-xs text-gray-500 mt-2 text-center">
                      Showing first 50 items of {existingProject.wbsStructure.length} total
                    </div>
                  )}
                </div>
                <div className="mt-4">
                  <button
                    onClick={handleConfirmP6Parsing}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    ✓ Confirm P6 Data & Continue to Equipment Upload
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Equipment Upload */}
        {currentStep === 2 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Step 2: Upload Updated Equipment List</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBackToStep(1)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  ← Back to P6 Data
                </button>
                <button
                  onClick={handleReset}
                  className="text-gray-600 hover:text-gray-800 text-sm"
                >
                  🔄 Start Over
                </button>
              </div>
            </div>

            <div className="mb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">📋 Equipment List Requirements</h3>
                <div className="text-sm text-blue-700">
                  <p className="mb-2">Upload your complete equipment list (existing + new equipment). Required columns:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Subsystem</strong> - Equipment subsystem (S1, S2, S3, etc.)</li>
                    <li><strong>Equipment Number</strong> - Equipment code (+UH101, -F102, etc.)</li>
                    <li><strong>Parent Equipment Number</strong> - Parent equipment (if applicable)</li>
                    <li><strong>Description</strong> - Equipment description</li>
                    <li><strong>Commissioning (Y/N)</strong> - Commissioning status</li>
                  </ul>
                </div>
              </div>
            </div>

            <FileUpload
              accept=".csv,.xlsx,.xls"
              onFileSelect={handleEquipmentFileUpload}
              isProcessing={processing.stage && processing.stage !== 'complete'}
              label="Drop your equipment list here or click to browse"
              currentFile={equipment_list.file}
              status={equipment_list.status}
              error={equipment_list.error}
            />

            {/* Equipment Processing Status */}
            {equipment_list.status === 'success' && equipment_list.data?.length > 0 && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700">
                  ✓ Equipment file processed: {equipment_list.data.length} items found
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review and Export */}
        {currentStep === 3 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Step 3: Review Changes & Export</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBackToStep(2)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  ← Back to Equipment
                </button>
                <button
                  onClick={handleReset}
                  className="text-gray-600 hover:text-gray-800 text-sm"
                >
                  🔄 Start Over
                </button>
              </div>
            </div>

            {/* Combined WBS Visualization */}
            {combinedWBS?.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">Combined Project Structure</h3>
                <div className="border rounded-lg p-4 bg-gray-50">
                  <WBSVisualization 
                    wbsData={combinedWBS} 
                    showControls={true}
                    highlightNew={true}
                  />
                </div>
              </div>
            )}

            {/* Export Section */}
            {exportData?.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-medium text-blue-800 mb-3">
                  📤 Export New Equipment
                </h3>
                <p className="text-sm text-blue-700 mb-4">
                  Ready to export {exportData.length} new equipment items with assigned WBS codes.
                  This CSV can be imported directly into P6.
                </p>
                
                <ExportButton
                  data={exportData}
                  filename="new_equipment_wbs"
                  includeNewOnly={true}
                  variant="primary"
                />
              </div>
            )}
          </div>
        )}

        {/* Processing Indicator */}
        {processing.stage && processing.stage !== 'complete' && processing.stage !== 'error' && (
          <div className="fixed bottom-4 right-4 bg-white shadow-lg rounded-lg p-4 border">
            <div className="flex items-center space-x-3">
              <LoadingSpinner size="sm" />
              <div>
                <div className="text-sm font-medium">{processing.message}</div>
                <div className="text-xs text-gray-500">{processing.progress}% complete</div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-lg font-medium text-red-800 mb-2">Error</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Success Display */}
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-lg font-medium text-green-800 mb-2">Success</h3>
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {/* Debug Info (development only) */}
        {process.env.NODE_ENV === 'development' && debugInfo && (
          <div className="mt-8 p-4 bg-gray-100 border rounded-lg">
            <h3 className="text-sm font-medium mb-2">Debug Information</h3>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
              {debugInfo}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default MissingEquipment;

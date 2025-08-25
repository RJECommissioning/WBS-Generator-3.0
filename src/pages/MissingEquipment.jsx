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
    // Upload states
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
  const [equipmentFileData, setEquipmentFileData] = useState(null);
  const [isProcessingReady, setIsProcessingReady] = useState(false); // FIXED: Separate state to prevent loops

  // Debug logging helper
  const addDebugInfo = (message) => {
    console.log('[DEBUG]', message);
    setDebugInfo(prev => prev + '\n' + `[${new Date().toLocaleTimeString()}] ${message}`);
  };

  // FIXED: Reset state on component mount - only once
  useEffect(() => {
    console.log('Missing Equipment component mounted - resetting state');
    resetMissingEquipment();
    clearMessages();
    setCurrentStep(1);
    setEquipmentFileData(null);
    setIsProcessingReady(false);
  }, []); // FIXED: Empty dependency array

  // FIXED: Check processing readiness - separate effect with proper dependencies
  useEffect(() => {
    const p6Ready = existingProject?.equipmentCodes?.length > 0;
    const equipmentReady = equipmentFileData && equipmentFileData.length > 0;
    const newReadyState = p6Ready && equipmentReady;
    
    if (newReadyState !== isProcessingReady) {
      addDebugInfo(`Processing ready state changed: P6 ready: ${p6Ready}, Equipment ready: ${equipmentReady}`);
      setIsProcessingReady(newReadyState);
    }
  }, [existingProject?.equipmentCodes?.length, equipmentFileData?.length, isProcessingReady]);

  // Step 1: Handle P6 paste data processing
  const handleP6DataPasted = async (pasteContent) => {
    try {
      console.log('=== STARTING P6 PASTE PROCESSING ===');
      addDebugInfo(`Starting P6 paste processing: ${pasteContent.length} characters`);
      
      clearMessages();
      setProcessingStage('parsing', 10, 'Parsing P6 WBS data...');
      
      const parseResult = await processP6Paste(pasteContent);
      
      console.log('P6 parsing successful:', {
        dataLength: parseResult.dataLength,
        projectName: parseResult.projectInfo?.projectName,
        equipmentCodes: parseResult.equipmentCodes?.length || 0
      });
      
      addDebugInfo(`P6 parsing successful! Found ${parseResult.dataLength} WBS items`);
      addDebugInfo(`Project: ${parseResult.projectInfo?.projectName || 'Unknown'}`);
      addDebugInfo(`Equipment codes extracted: ${parseResult.equipmentCodes?.length || 0}`);
      
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
  
  // Step 2: Handle equipment file upload 
  const handleEquipmentFileUpload = async (result) => {
    const file = result.file;
    try {
      console.log('=== STARTING EQUIPMENT FILE UPLOAD ===');
      addDebugInfo(`Starting equipment file upload: ${file.name} (${file.size} bytes)`);
      
      clearMessages();
      setProcessingStage('parsing', 10, 'Parsing equipment file...');

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

      // FIXED: Store equipment data locally
      setEquipmentFileData(parseResult.data);
      
      // Update store state for UI display
      setFileUpload('equipment_list', {
        file: file,
        status: 'success',
        error: null,
        data: parseResult.data
      });

      setProcessingStage('complete', 100, 'Equipment file processed successfully!');
      setSuccess(`Equipment file processed successfully! Found ${parseResult.dataLength} equipment items.`);
      
      addDebugInfo('Equipment file processing completed - ready for comparison');
      
    } catch (error) {
      console.error('Equipment parsing failed:', error);
      addDebugInfo(`Equipment parsing failed: ${error.message}`);

      setError(`Equipment parsing failed: ${error.message}`);
      setEquipmentFileData(null);
      setFileUpload('equipment_list', {
        file: file,
        status: 'error',
        error: error.message
      });
      setProcessingStage('error', 0, error.message);
    }
  };

  // Step 3: Manual equipment processing when user clicks "Process Equipment"
  const handleProcessEquipment = async () => {
    try {
      console.log('=== STARTING MANUAL EQUIPMENT PROCESSING ===');
      addDebugInfo('Starting manual equipment processing with 3-tier priority logic');
      
      clearMessages();
      setProcessingStage('comparing', 20, 'Comparing equipment with existing project...');

      // Validate that we have both datasets
      if (!existingProject || !existingProject.wbsStructure || existingProject.wbsStructure.length === 0) {
        throw new Error('No existing project data found. Please ensure P6 data was processed correctly.');
      }

      if (!equipmentFileData || equipmentFileData.length === 0) {
        throw new Error('No equipment data found. Please ensure equipment file was uploaded successfully.');
      }

      console.log('Processing validation passed:', {
        wbsItems: existingProject.wbsStructure.length,
        equipmentCodes: existingProject.equipmentCodes?.length || 0,
        newEquipmentItems: equipmentFileData.length
      });

      addDebugInfo(`Processing validation passed:`);
      addDebugInfo(`- P6 WBS items: ${existingProject.wbsStructure.length}`);
      addDebugInfo(`- P6 equipment codes: ${existingProject.equipmentCodes?.length || 0}`);
      addDebugInfo(`- New equipment items: ${equipmentFileData.length}`);

      setProcessingStage('comparing', 40, 'Running 3-tier priority comparison...');

      // Use the new 3-tier priority comparison logic
      console.log('Using 3-tier priority comparison logic...');
      const comparisonResult = await compareEquipmentLists(existingProject, equipmentFileData);
      
      console.log('3-tier priority comparison completed:', {
        newEquipment: comparisonResult.comparison.added.length,
        existingEquipment: comparisonResult.comparison.existing.length,
        newWBSItems: comparisonResult.wbs_assignment?.new_wbs_items?.length || 0,
        exportReady: comparisonResult.export_ready?.length || 0
      });

      addDebugInfo(`3-tier priority comparison completed:`);
      addDebugInfo(`- New equipment found: ${comparisonResult.comparison.added.length} items`);
      addDebugInfo(`- Existing equipment: ${comparisonResult.comparison.existing.length} items`);
      addDebugInfo(`- New WBS items created: ${comparisonResult.wbs_assignment?.new_wbs_items?.length || 0}`);
      addDebugInfo(`- Export-ready items: ${comparisonResult.export_ready?.length || 0}`);

      if (comparisonResult.comparison.added.length === 0) {
        const message = 'No new equipment found. All equipment items already exist in the project.';
        addDebugInfo(message);
        setError(message);
        setProcessingStage('complete', 100, 'Processing complete - no new equipment');
        return;
      }

      setProcessingStage('building', 80, 'Building combined project structure...');

      // Use the enhanced results from new comparison
      const combinedWBS = comparisonResult.integrated_structure;
      const exportData = comparisonResult.export_ready;

      console.log('Integration completed:', {
        combinedItems: combinedWBS.length,
        exportItems: exportData.length
      });

      addDebugInfo(`Integration completed:`);
      addDebugInfo(`- Combined WBS items: ${combinedWBS.length}`);
      addDebugInfo(`- Export-ready items: ${exportData.length}`);
      
      // Update state with results
      setMissingEquipmentCombinedWBS(combinedWBS);
      setMissingEquipmentExportData(exportData);
      
      setProcessingStage('complete', 100, 'Processing complete!');
      setSuccess(`Successfully processed ${comparisonResult.comparison.added.length} new equipment items!`);
      
      addDebugInfo('Manual processing completed successfully!');
      addDebugInfo(`Final structure: ${existingProject.wbsStructure.length} existing + ${exportData.length} new = ${combinedWBS.length} total`);
      
      setCurrentStep(3); // Move to visualization step

    } catch (error) {
      console.error('Manual equipment processing failed:', error);
      addDebugInfo(`Manual processing failed: ${error.message}`);
      setError(`Processing failed: ${error.message}`);
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
    setEquipmentFileData(null);
    setIsProcessingReady(false);
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

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center">
              <div className="text-red-600 mr-2">❌</div>
              <div className="text-red-800">{error}</div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center">
              <div className="text-green-600 mr-2">✅</div>
              <div className="text-green-800">{success}</div>
            </div>
          </div>
        )}

        {/* Processing Status */}
        {processing.stage && processing.stage !== 'idle' && processing.stage !== 'complete' && (
          <div className="mb-6">
            <LoadingSpinner message={processing.message} progress={processing.progress} />
          </div>
        )}

        {/* Step 1: P6 Paste Input */}
        {currentStep === 1 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Step 1: Paste P6 WBS Data</h2>
              <button
                onClick={handleReset}
                className="text-gray-600 hover:text-gray-800 text-sm"
              >
                🔄 Reset
              </button>
            </div>

            <P6PasteInput
              onDataPasted={handleP6DataPasted}
              isProcessing={processing.stage === 'parsing'}
              currentContent={p6_paste.content}
              status={p6_paste.status}
              error={p6_paste.error}
            />

            {/* P6 Processing Status */}
            {p6_paste.status === 'success' && existingProject.wbsStructure?.length > 0 && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-green-800">
                      ✅ P6 Data Processed Successfully
                    </div>
                    <div className="text-green-700 text-sm mt-1">
                      Found {existingProject.wbsStructure.length} WBS items and {existingProject.equipmentCodes?.length || 0} equipment codes
                    </div>
                  </div>
                  <button
                    onClick={handleConfirmP6Parsing}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                  >
                    Continue to Equipment Upload →
                  </button>
                </div>
              </div>
            )}

            {/* FIXED: Simplified P6 Data Preview without problematic visualization */}
            {existingProject.wbsStructure?.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-4">P6 Data Summary</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="font-medium text-gray-800">Project Name</div>
                      <div className="text-gray-600">{existingProject.projectInfo?.projectName || 'Summerfield'}</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">Total WBS Items</div>
                      <div className="text-gray-600">{existingProject.wbsStructure.length}</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">Equipment Codes Found</div>
                      <div className="text-gray-600">{existingProject.equipmentCodes?.length || 0}</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">Sample Equipment</div>
                      <div className="text-gray-600 text-sm">
                        {existingProject.equipmentCodes?.slice(0, 3).join(', ') || 'None'}
                      </div>
                    </div>
                  </div>
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
                    <li><strong>Subsystem</strong> - Equipment subsystem (33kV Switchroom 1 - +Z01, etc.)</li>
                    <li><strong>Equipment Number</strong> - Equipment code (-XC11, ESS-FIRE-001, etc.)</li>
                    <li><strong>Parent Equipment Number</strong> - Parent equipment (if applicable, "-" if no parent)</li>
                    <li><strong>Description</strong> - Equipment description</li>
                    <li><strong>Commissioning (Y/N)</strong> - Commissioning status</li>
                  </ul>
                </div>
              </div>
            </div>

            <FileUpload
              uploadType="equipment_list"
              accept=".csv,.xlsx,.xls"
              onFileProcessed={handleEquipmentFileUpload}
              disabled={processing.stage && processing.stage !== 'complete'}
              title="Upload Equipment List"
              description="Drop your equipment list here or click to browse"
            />

            {/* Equipment Processing Status */}
            {equipment_list.status === 'success' && equipmentFileData?.length > 0 && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-green-800">
                      ✅ Equipment File Processed Successfully
                    </div>
                    <div className="text-green-700 text-sm mt-1">
                      Found {equipmentFileData.length} equipment items - ready for comparison
                    </div>
                  </div>
                  {/* FIXED: Use stable boolean instead of function call */}
                  {isProcessingReady && (
                    <button
                      onClick={handleProcessEquipment}
                      disabled={processing.stage && processing.stage !== 'complete'}
                      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400"
                    >
                      🚀 Process Equipment →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* FIXED: Ready to Process Indicator */}
            {isProcessingReady && !processing.stage && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-yellow-800">
                      🔄 Ready for Processing
                    </div>
                    <div className="text-yellow-700 text-sm mt-1">
                      Both P6 data and equipment list are ready. Click "Process Equipment" to start 3-tier priority comparison.
                    </div>
                  </div>
                  <button
                    onClick={handleProcessEquipment}
                    className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
                  >
                    🚀 Process Equipment →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Review & Export */}
        {currentStep === 3 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Step 3: Review & Export New Equipment</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBackToStep(2)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  ← Back to Equipment Upload
                </button>
                <button
                  onClick={handleReset}
                  className="text-gray-600 hover:text-gray-800 text-sm"
                >
                  🔄 Start Over
                </button>
              </div>
            </div>

            {/* Export Summary */}
            {exportData.length > 0 && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-medium text-blue-800 mb-2">📊 Export Summary</h3>
                <div className="text-sm text-blue-700">
                  <p>Ready to export <strong>{exportData.length} new equipment items</strong> that can be imported into P6.</p>
                  <p className="mt-1">These items will be added to your existing project without affecting current equipment.</p>
                </div>
              </div>
            )}

            {/* FIXED: Simplified Results Display */}
            {combinedWBS.length > 0 && (
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-4">Processing Results</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{existingProject.wbsStructure?.length || 0}</div>
                      <div className="text-sm text-gray-600">Existing Items</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{exportData.length}</div>
                      <div className="text-sm text-gray-600">New Items</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{combinedWBS.length}</div>
                      <div className="text-sm text-gray-600">Total Items</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Export Button */}
            {exportData.length > 0 && (
              <div className="flex justify-center">
                <ExportButton
                  data={exportData}
                  filename={`Missing_Equipment_${existingProject.projectInfo?.projectName || 'Project'}_${new Date().toISOString().split('T')[0]}.csv`}
                  label={`Export ${exportData.length} New Equipment Items`}
                  description="Export only new equipment for P6 import"
                  includeNewOnly={true}
                />
              </div>
            )}
          </div>
        )}

        {/* Debug Information */}
        {debugInfo && (
          <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-800 mb-2">Debug Information</h3>
            <pre className="text-xs text-gray-600 whitespace-pre-wrap max-h-64 overflow-y-auto">
              {debugInfo}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default MissingEquipment;

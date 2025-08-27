import React, { useState, useEffect } from 'react';
import useProjectStore from '../store/projectStore';
import FileUpload from '../components/FileUpload';
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
  const [comparisonResult, setComparisonResult] = useState(null);
  const [isProcessingReady, setIsProcessingReady] = useState(false);
  const [pasteContent, setPasteContent] = useState('');

  // Debug logging helper
  const addDebugInfo = (message) => {
    console.log('[DEBUG]', message);
    setDebugInfo(prev => prev + '\n' + `[${new Date().toLocaleTimeString()}] ${message}`);
  };

  // Reset state on component mount
  useEffect(() => {
    console.log('Missing Equipment component mounted - resetting state');
    resetMissingEquipment();
    clearMessages();
    setCurrentStep(1);
    setEquipmentFileData(null);
    setComparisonResult(null);
    setIsProcessingReady(false);
  }, []);

  // Check processing readiness
  useEffect(() => {
    const p6Ready = existingProject?.equipmentCodes?.length > 0;
    const equipmentReady = equipmentFileData?.length > 0;
    
    const ready = p6Ready && equipmentReady;
    
    if (ready !== isProcessingReady) {
      console.log('Processing ready state changed:', `P6 ready: ${p6Ready}, Equipment ready: ${equipmentReady ? equipmentFileData.length : null}`);
      setIsProcessingReady(ready);
    }
  }, [existingProject?.equipmentCodes?.length, equipmentFileData?.length, isProcessingReady]);

  // Step 1: Handle P6 data paste
  const handleP6Paste = async (content) => {
    try {
      console.log('=== STARTING P6 PASTE PROCESSING ===');
      addDebugInfo(`Starting P6 paste processing: ${content.length} characters`);
      
      clearMessages();
      setProcessingStage('parsing', 20, 'Processing P6 data...');

      const result = await processP6Paste(content);

      if (result.success) {
        setMissingEquipmentExistingProject(result.data);
        addDebugInfo(`P6 parsing successful! Found ${result.data.wbsStructure.length} WBS items`);
        addDebugInfo(`Project: ${result.data.projectName}`);
        addDebugInfo(`Equipment codes extracted: ${result.data.equipmentCodes.length}`);
        addDebugInfo('P6 data processing completed - ready for next step');
      } else {
        throw new Error(result.error || 'Failed to process P6 data');
      }

    } catch (error) {
      console.error('P6 processing failed:', error);
      addDebugInfo(`P6 processing failed: ${error.message}`);
      setError(`P6 processing failed: ${error.message}`);
      setProcessingStage('error', 0, error.message);
    }
  };

  // Step 2: Handle equipment file upload
  const handleEquipmentFile = async (file) => {
    try {
      console.log('=== STARTING EQUIPMENT FILE UPLOAD ===');
      addDebugInfo(`Starting equipment file upload: ${file.name} (${file.size} bytes)`);
      
      clearMessages();
      setProcessingStage('parsing', 20, 'Parsing equipment file...');

      console.log('Parsing equipment file...');
      const parseResult = await parseFile(file);
      
      if (parseResult.type !== 'equipment_list') {
        throw new Error(`Expected equipment list, got ${parseResult.type}. Please upload an equipment CSV or Excel file.`);
      }

      if (!parseResult.hasData || parseResult.data.length === 0) {
        throw new Error('No equipment data found. Please check the file format.');
      }

      console.log('Equipment parsing successful:', {
        totalEquipment: parseResult.dataLength,
        sampleData: parseResult.data.slice(0, 3)
      });

      addDebugInfo(`Equipment parsing successful! Found ${parseResult.dataLength} equipment items`);

      // Store equipment data locally
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

  // Step 3: Process equipment with 3-tier priority logic
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
      const comparisonData = await compareEquipmentLists(existingProject, equipmentFileData);
      
      console.log('3-tier priority comparison completed:', {
        newEquipment: comparisonData.comparison.added.length,
        existingEquipment: comparisonData.comparison.existing.length,
        newWBSItems: comparisonData.wbs_assignment?.new_wbs_items?.length || 0,
        exportReady: comparisonData.export_ready?.length || 0
      });

      addDebugInfo(`3-tier priority comparison completed:`);
      addDebugInfo(`- New equipment found: ${comparisonData.comparison.added.length} items`);
      addDebugInfo(`- Existing equipment: ${comparisonData.comparison.existing.length} items`);
      addDebugInfo(`- New WBS items created: ${comparisonData.wbs_assignment?.new_wbs_items?.length || 0}`);
      addDebugInfo(`- Export-ready items: ${comparisonData.export_ready?.length || 0}`);

      // Store comparison results for export
      setComparisonResult(comparisonData);

      if (comparisonData.comparison.added.length === 0) {
        const message = 'No new equipment found. All equipment items already exist in the project.';
        addDebugInfo(message);
        setError(message);
        setProcessingStage('complete', 100, 'Processing complete - no new equipment');
        return;
      }

      setProcessingStage('building', 80, 'Building combined project structure...');

      // Use the enhanced results from new comparison
      const combinedWBS = comparisonData.integrated_structure;
      const exportDataReady = comparisonData.export_ready;

      console.log('Integration completed:', {
        combinedItems: combinedWBS.length,
        exportItems: exportDataReady.length
      });

      addDebugInfo(`Integration completed:`);
      addDebugInfo(`- Combined WBS items: ${combinedWBS.length}`);
      addDebugInfo(`- Export-ready items: ${exportDataReady.length}`);
      
      // Update state with results
      setMissingEquipmentCombinedWBS(combinedWBS);
      setMissingEquipmentExportData(exportDataReady);
      
      setProcessingStage('complete', 100, 'Processing complete!');
      setSuccess(`Successfully processed ${comparisonData.comparison.added.length} new equipment items!`);
      
      addDebugInfo('Manual processing completed successfully!');
      addDebugInfo(`Final structure: ${existingProject.wbsStructure.length} existing + ${exportDataReady.length} new = ${combinedWBS.length} total`);
      
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
    setComparisonResult(null);
    setIsProcessingReady(false);
    clearMessages();
    setDebugInfo('');
    setPasteContent('');
  };

  // Handle export completion
  const handleExportComplete = (exportResult) => {
    addDebugInfo(`Export completed: ${exportResult.filename} with ${exportResult.recordCount} items`);
    setSuccess(`Export completed successfully! Downloaded ${exportResult.recordCount} items.`);
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

            {/* FIXED: Inline P6 Paste Input - No external component dependency */}
            <div className="p6-paste-input">
              <div className="mb-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">📋 P6 Export Instructions</h3>
                  <div className="text-sm text-blue-700">
                    <p className="mb-2">Copy your WBS structure from P6 with these exact columns:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li><strong>WBS Code</strong> - The WBS hierarchy code (5737.1064.1575, etc.)</li>
                      <li><strong>WBS Name</strong> - Equipment names with codes (+UH101 | Description)</li>
                      <li><strong>Total Activities</strong> - Activity count (can be ignored)</li>
                    </ul>
                  </div>
                </div>
                
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paste P6 WBS Data:
                </label>
                <textarea
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  placeholder="Paste your P6 WBS data here...&#10;&#10;Example:&#10;WBS Code&#9;WBS Name&#9;Total Activities&#10;5737&#9;Summerfield&#9;605&#10;  5737.1003&#9;M | Milestones&#9;1&#10;  5737.1002&#9;P | Pre-Requisites&#9;66"
                  className="w-full h-40 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                  disabled={processing.stage === 'parsing'}
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => handleP6Paste(pasteContent)}
                  disabled={!pasteContent.trim() || processing.stage === 'parsing'}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {processing.stage === 'parsing' ? 'Processing...' : 'Process P6 Data'}
                </button>
                
                <button
                  onClick={() => setPasteContent('')}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Clear
                </button>
              </div>
            </div>

            {existingProject && existingProject.wbsStructure && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="text-lg font-medium text-green-800 mb-3">✅ P6 Data Processed Successfully</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <div className="font-medium text-gray-800">Project Name</div>
                    <div className="text-gray-600">{existingProject.projectName}</div>
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
                
                <button 
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  onClick={handleConfirmP6Parsing}
                >
                  Continue to Equipment Upload →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Equipment Upload */}
        {currentStep >= 2 && (
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
                    <li><strong>Parent Equipment Number</strong> - Parent code or "-" for no parent</li>
                    <li><strong>Description</strong> - Equipment description</li>
                    <li><strong>Commissioning (Y/N)</strong> - Commissioning status</li>
                  </ul>
                </div>
              </div>

              <FileUpload 
                onFileUpload={handleEquipmentFile}
                acceptedTypes=".csv,.xlsx,.xls"
                label="Upload Equipment List"
                className="mb-4"
              />

              {equipmentFileData && equipmentFileData.length > 0 && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h3 className="text-lg font-medium text-green-800 mb-3">✅ Equipment File Processed</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-4">
                    <div>
                      <div className="font-medium text-gray-800">Total Equipment</div>
                      <div className="text-gray-600">{equipmentFileData.length}</div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">Sample Items</div>
                      <div className="text-gray-600">
                        {equipmentFileData.slice(0, 3).map(item => item.equipment_number).join(', ')}
                      </div>
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">Ready to Process</div>
                      <div className="text-green-600">✅ Both files loaded</div>
                    </div>
                  </div>

                  {/* Process Equipment Button */}
                  <button 
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium"
                    onClick={handleProcessEquipment}
                    disabled={!isProcessingReady || processing.active}
                  >
                    {processing.active ? 'Processing Equipment...' : 'Run 3-Tier Priority Analysis'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Results & Export */}
        {currentStep >= 3 && comparisonResult && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Step 3: Review Results & Export</h2>
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

            {/* Results Summary */}
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4">📊 Processing Results</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{comparisonResult.comparison.added.length}</div>
                  <div className="text-sm text-green-700">New Equipment Found</div>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{comparisonResult.comparison.existing.length}</div>
                  <div className="text-sm text-blue-700">Existing Equipment</div>
                </div>
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{comparisonResult.export_ready.length}</div>
                  <div className="text-sm text-purple-700">WBS Items Created</div>
                </div>
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{comparisonResult.export_ready.length}</div>
                  <div className="text-sm text-orange-700">Ready for P6 Import</div>
                </div>
              </div>
            </div>

            {/* Export Section */}
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4">📤 Export to P6</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="mb-4">
                  <p className="text-gray-700 mb-2">Download the new equipment items in P6-compatible CSV format:</p>
                  <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                    <li>Contains {comparisonResult.export_ready.length} new WBS items</li>
                    <li>P6-compatible format (wbs_code, parent_wbs_code, wbs_name)</li>
                    <li>Ready for direct import into P6</li>
                  </ul>
                </div>

                {/* FIXED: Use correct ExportButton props for comparison export */}
                <ExportButton
                  data={comparisonResult}
                  exportType="comparison"
                  variant="primary"
                  size="large"
                  customLabel="Export New Equipment to P6"
                  filename={`Missing_Equipment_${new Date().toISOString().split('T')[0].replace(/-/g, '')}`}
                  onExportComplete={handleExportComplete}
                />
              </div>
            </div>

            {/* Future: WBS Visualization */}
            <div className="mb-6">
              <h3 className="text-lg font-medium mb-4">🔍 WBS Structure Preview</h3>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-gray-600 text-center py-8">
                  WBS visualization will be implemented in the next development phase...
                  <br />
                  <span className="text-sm">Combined structure: {combinedWBS?.length || 0} total items</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Debug Information */}
        {debugInfo && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-6">
            <h3 className="text-lg font-medium mb-3">🔧 Debug Information</h3>
            <pre className="text-xs text-gray-700 bg-white p-3 rounded border overflow-x-auto whitespace-pre-wrap">
              {debugInfo}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

export default MissingEquipment;

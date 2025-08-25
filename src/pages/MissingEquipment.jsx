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
  const [comparisonResult, setComparisonResult] = useState(null); // Store comparison results for export
  const [isProcessingReady, setIsProcessingReady] = useState(false);

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
    setComparisonResult(null);
    setIsProcessingReady(false);
  }, []); // FIXED: Empty dependency array

  // FIXED: Check processing readiness - separate effect with proper dependencies
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
      const exportData = comparisonData.export_ready;

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
      setSuccess(`Successfully processed ${comparisonData.comparison.added.length} new equipment items!`);
      
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

  const handleConfirmEquipmentUpload = () => {
    if (equipmentFileData && equipmentFileData.length > 0) {
      addDebugInfo('Equipment upload confirmed - ready for processing');
      // Don't advance step yet - user needs to click "Process Equipment" button
      clearMessages();
    } else {
      addDebugInfo('Cannot proceed - no equipment data found');
      setError('Cannot proceed: No equipment file uploaded or no data found.');
    }
  };

  // 🆕 Handle export completion
  const handleExportComplete = (exportResult) => {
    addDebugInfo(`Export completed: ${exportResult.filename} with ${exportResult.recordCount} items`);
    setSuccess(`Export completed successfully! Downloaded ${exportResult.recordCount} items.`);
  };

  return (
    <div className="missing-equipment-container">
      <div className="header-section">
        <h1>Missing Equipment Analysis</h1>
        <p>Compare new equipment against existing P6 project structure</p>
      </div>

      <div className="steps-container">
        {/* Step 1: P6 Data Input */}
        <div className={`step ${currentStep === 1 ? 'active' : currentStep > 1 ? 'completed' : ''}`}>
          <div className="step-header">
            <h2>Step 1: Load Existing Project (P6 Data)</h2>
            <p>Copy and paste your P6 project structure</p>
          </div>
          
          <div className="step-content">
            <P6PasteInput onPaste={handleP6Paste} />
            
            {existingProject && existingProject.wbsStructure && (
              <div className="parse-results">
                <h3>P6 Data Summary</h3>
                <div className="summary-grid">
                  <div className="summary-item">
                    <strong>Project Name</strong>
                    <span>{existingProject.projectName}</span>
                  </div>
                  <div className="summary-item">
                    <strong>Total WBS Items</strong>
                    <span>{existingProject.wbsStructure.length}</span>
                  </div>
                  <div className="summary-item">
                    <strong>Equipment Codes Found</strong>
                    <span>{existingProject.equipmentCodes?.length || 0}</span>
                  </div>
                  <div className="summary-item">
                    <strong>Sample Equipment</strong>
                    <span>{existingProject.equipmentCodes?.slice(0, 3).join(', ')}</span>
                  </div>
                </div>
                
                {currentStep === 1 && (
                  <button 
                    className="btn btn-primary"
                    onClick={handleConfirmP6Parsing}
                    disabled={!existingProject.wbsStructure || existingProject.wbsStructure.length === 0}
                  >
                    Continue to Equipment Upload
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Equipment Upload */}
        {currentStep >= 2 && (
          <div className={`step ${currentStep === 2 ? 'active' : currentStep > 2 ? 'completed' : ''}`}>
            <div className="step-header">
              <h2>Step 2: Upload New Equipment List</h2>
              <p>Upload your equipment CSV file for comparison</p>
            </div>
            
            <div className="step-content">
              <FileUpload 
                onFileUpload={handleEquipmentFile}
                acceptedTypes=".csv,.xlsx,.xls"
                label="Upload Equipment List"
              />
              
              {equipmentFileData && (
                <div className="upload-results">
                  <h3>Equipment File Summary</h3>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <strong>Total Equipment</strong>
                      <span>{equipmentFileData.length}</span>
                    </div>
                    <div className="summary-item">
                      <strong>Sample Items</strong>
                      <span>{equipmentFileData.slice(0, 3).map(item => item.equipment_number).join(', ')}</span>
                    </div>
                  </div>
                  
                  {/* 🆕 Process Equipment Button */}
                  {currentStep === 2 && (
                    <div className="processing-controls">
                      <button 
                        className="btn btn-primary btn-large"
                        onClick={handleProcessEquipment}
                        disabled={!isProcessingReady || processing.active}
                      >
                        {processing.active ? 'Processing...' : 'Process Equipment'}
                      </button>
                      
                      {processing.active && (
                        <div className="processing-status">
                          <LoadingSpinner />
                          <p>{processing.message}</p>
                          <div className="progress-bar">
                            <div 
                              className="progress-fill" 
                              style={{ width: `${processing.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Results & Export */}
        {currentStep >= 3 && (
          <div className={`step ${currentStep === 3 ? 'active' : 'completed'}`}>
            <div className="step-header">
              <h2>Step 3: Review Results & Export</h2>
              <p>Review the processed equipment and export new items</p>
            </div>
            
            <div className="step-content">
              {comparisonResult && (
                <div className="results-summary">
                  <h3>Processing Results</h3>
                  <div className="summary-grid">
                    <div className="summary-item">
                      <strong>New Equipment Found</strong>
                      <span>{comparisonResult.comparison.added.length} items</span>
                    </div>
                    <div className="summary-item">
                      <strong>Existing Equipment</strong>
                      <span>{comparisonResult.comparison.existing.length} items</span>
                    </div>
                    <div className="summary-item">
                      <strong>New WBS Items Created</strong>
                      <span>{comparisonResult.export_ready.length} items</span>
                    </div>
                    <div className="summary-item">
                      <strong>Ready for P6 Import</strong>
                      <span>{comparisonResult.export_ready.length} items</span>
                    </div>
                  </div>

                  {/* 🆕 Export Controls */}
                  <div className="export-controls">
                    <h4>Export New Equipment to P6</h4>
                    <p>Download the new equipment items in P6-compatible CSV format</p>
                    
                    <div className="export-actions">
                      <ExportButton
                        variant="contained"
                        size="large"
                        exportType="comparison"
                        includeNewOnly={true}
                        customLabel="Export New Equipment"
                        onExportComplete={handleExportComplete}
                        comparisonResult={comparisonResult}
                      />
                      
                      <div className="export-info">
                        <p>✅ Contains {comparisonResult.export_ready.length} new WBS items</p>
                        <p>✅ P6-compatible format (wbs_code, parent_wbs_code, wbs_name)</p>
                        <p>✅ Ready for direct import into P6</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Placeholder for future visualization */}
              <div className="visualization-placeholder">
                <h4>WBS Visualization</h4>
                <p>WBS tree visualization will be implemented next...</p>
                {/* Future: <WBSVisualization data={combinedWBS} highlightNew={true} /> */}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="message error">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      {success && (
        <div className="message success">
          <strong>Success:</strong> {success}
        </div>
      )}

      {/* Debug Information */}
      {debugInfo && (
        <div className="debug-section">
          <h3>Debug Information</h3>
          <pre className="debug-output">{debugInfo}</pre>
        </div>
      )}
    </div>
  );
};

export default MissingEquipment;

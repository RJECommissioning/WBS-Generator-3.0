import React, { useState, useEffect } from 'react';
import useProjectStore from '../store/projectStore';
import FileUpload from '../components/FileUpload';
import WBSVisualization from '../components/WBSVisualization';
import ExportButton from '../components/ExportButton';
import LoadingSpinner from '../components/LoadingSpinner';
import { parseFile } from '../lib/fileParser';
import { processEquipment } from '../lib/equipmentProcessor';
import { generateWBSStructure } from '../lib/wbsGenerator';
import { extractEquipmentCodesFromWBS } from '../lib/xerParser';

const MissingEquipment = () => {
  // Separate state from Start New Project to avoid interference
  const {
    // Missing Equipment specific state
    missingEquipment: {
      xerFile,
      existingProject,
      xerParseStatus,
      equipmentFile,
      equipmentData,
      equipmentParseStatus,
      combinedWBS,
      processingStatus,
      exportData
    },
    // Missing Equipment actions
    setMissingEquipmentXERFile,
    setMissingEquipmentExistingProject,
    setMissingEquipmentXERParseStatus,
    setMissingEquipmentEquipmentFile,
    setMissingEquipmentEquipmentData,
    setMissingEquipmentEquipmentParseStatus,
    setMissingEquipmentCombinedWBS,
    setMissingEquipmentProcessingStatus,
    setMissingEquipmentExportData,
    resetMissingEquipment
  } = useProjectStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [error, setError] = useState(null);

  // Reset state on component mount
  useEffect(() => {
    resetMissingEquipment();
  }, [resetMissingEquipment]);

  // Step 1: Handle XER file upload and parsing
  const handleXERFileUpload = async (file) => {
    try {
      setError(null);
      setMissingEquipmentXERFile(file);
      setMissingEquipmentXERParseStatus('parsing');

      console.log('MISSING EQUIPMENT: Starting XER file parsing');
      const parseResult = await parseFile(file);

      if (parseResult.type !== 'xer') {
        throw new Error('Invalid file type. Please upload an XER text file exported from P6.');
      }

      if (!parseResult.hasData || parseResult.data.length === 0) {
        throw new Error('No WBS data found in XER file. Please check the file format.');
      }

      console.log('MISSING EQUIPMENT: XER parsing successful', {
        totalWBSItems: parseResult.dataLength,
        projectInfo: parseResult.projectInfo
      });

      setMissingEquipmentExistingProject({
        wbsStructure: parseResult.data,
        projectInfo: parseResult.projectInfo || { projectName: 'Unknown Project' },
        totalItems: parseResult.dataLength,
        equipmentCodes: extractEquipmentCodesFromWBS(parseResult.data)
      });

      setMissingEquipmentXERParseStatus('success');
      
    } catch (error) {
      console.error('MISSING EQUIPMENT: XER parsing failed:', error);
      setError(`XER parsing failed: ${error.message}`);
      setMissingEquipmentXERParseStatus('error');
    }
  };

  // Step 2: Handle equipment file upload and processing
  const handleEquipmentFileUpload = async (file) => {
    try {
      setError(null);
      setMissingEquipmentEquipmentFile(file);
      setMissingEquipmentEquipmentParseStatus('parsing');

      console.log('MISSING EQUIPMENT: Starting equipment file parsing');
      const parseResult = await parseFile(file);

      if (parseResult.type !== 'equipment_list') {
        throw new Error('Invalid file type. Please upload an equipment list CSV or Excel file.');
      }

      if (!parseResult.hasData || parseResult.data.length === 0) {
        throw new Error('No equipment data found. Please check the file format.');
      }

      console.log('MISSING EQUIPMENT: Equipment parsing successful', {
        totalEquipment: parseResult.dataLength
      });

      setMissingEquipmentEquipmentData(parseResult.data);
      setMissingEquipmentEquipmentParseStatus('success');

      // Automatically start WBS processing
      await processNewEquipment(parseResult.data);
      
    } catch (error) {
      console.error('MISSING EQUIPMENT: Equipment parsing failed:', error);
      setError(`Equipment parsing failed: ${error.message}`);
      setMissingEquipmentEquipmentParseStatus('error');
    }
  };

  // Step 3: Process new equipment and assign WBS codes
  const processNewEquipment = async (equipmentList) => {
    try {
      setError(null);
      setMissingEquipmentProcessingStatus('processing');

      console.log('MISSING EQUIPMENT: Starting equipment processing and WBS assignment');

      // Process equipment using existing logic
      const processedEquipment = await processEquipment(equipmentList);
      console.log('MISSING EQUIPMENT: Equipment processing completed', {
        totalProcessed: processedEquipment.totalProcessed
      });

      // Find new equipment by comparing with existing project
      const existingEquipmentCodes = existingProject.equipmentCodes || [];
      const newEquipment = processedEquipment.equipment.filter(item => 
        !existingEquipmentCodes.includes(item.equipment_number)
      );

      console.log('MISSING EQUIPMENT: New equipment identified', {
        existingCodes: existingEquipmentCodes.length,
        totalEquipment: processedEquipment.equipment.length,
        newEquipment: newEquipment.length
      });

      if (newEquipment.length === 0) {
        setError('No new equipment found. All equipment items already exist in the project.');
        setMissingEquipmentProcessingStatus('error');
        return;
      }

      // Generate WBS structure for new equipment
      const newEquipmentProcessed = {
        ...processedEquipment,
        equipment: newEquipment,
        totalProcessed: newEquipment.length
      };

      const newWBSResult = await generateWBSStructure(
        newEquipmentProcessed,
        existingProject.projectInfo?.projectName || 'Project Update'
      );

      console.log('MISSING EQUIPMENT: New WBS structure generated', {
        newWBSItems: newWBSResult.totalWBSItems
      });

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

      setMissingEquipmentCombinedWBS(combinedWBS);
      setMissingEquipmentExportData(markedNewWBS); // Export only new items
      setMissingEquipmentProcessingStatus('success');
      setCurrentStep(3); // Move to visualization step

    } catch (error) {
      console.error('MISSING EQUIPMENT: Processing failed:', error);
      setError(`Processing failed: ${error.message}`);
      setMissingEquipmentProcessingStatus('error');
    }
  };

  // Handle step progression
  const handleConfirmXERParsing = () => {
    if (xerParseStatus === 'success' && existingProject.wbsStructure.length > 0) {
      setCurrentStep(2);
    }
  };

  const handleBackToStep = (step) => {
    setCurrentStep(step);
    setError(null);
  };

  const handleReset = () => {
    resetMissingEquipment();
    setCurrentStep(1);
    setError(null);
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

        {/* Step 1: XER File Upload */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Step 1: Upload Existing Project (XER File)</h2>
              <p className="text-gray-600 mb-4">
                Upload the XER text file exported from your P6 project to understand the existing WBS structure.
              </p>
              
              <FileUpload
                onFileUpload={handleXERFileUpload}
                acceptedTypes=".xer,.txt"
                maxSizeMB={50}
                title="Upload XER File"
                description="Select XER text file exported from Primavera P6"
                isLoading={xerParseStatus === 'parsing'}
                loadingText="Parsing XER file..."
              />
            </div>

            {/* XER Parse Results */}
            {xerParseStatus === 'success' && existingProject.wbsStructure && (
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
                isLoading={equipmentParseStatus === 'parsing' || processingStatus === 'processing'}
                loadingText={
                  equipmentParseStatus === 'parsing' ? 'Parsing equipment file...' : 
                  processingStatus === 'processing' ? 'Processing new equipment...' : 
                  'Processing...'
                }
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
              {combinedWBS && (
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

        {/* Loading States */}
        {(xerParseStatus === 'parsing' || equipmentParseStatus === 'parsing' || processingStatus === 'processing') && (
          <LoadingSpinner message="Processing files..." />
        )}
      </div>
    </div>
  );
};

export default MissingEquipment;

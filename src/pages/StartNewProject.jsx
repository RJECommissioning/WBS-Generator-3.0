// Process equipment file after upload - REPLACE THE EXISTING handleFileProcessed FUNCTION
const handleFileProcessed = async (fileData) => {
  try {
    setLoading(true);
    setProcessingStage('parsing', 10, 'Processing uploaded file...');

    // Get the file data from the store (already parsed by uploadFile)
    const uploadState = uploads.equipment_list;
    
    if (!uploadState.data || uploadState.status !== 'success') {
      throw new Error('File upload failed or data not available');
    }

    // The file should already be parsed by the store, so use that data
    let equipmentData;
    
    if (uploadState.data.raw) {
      // If we have raw content, parse it
      const { parseEquipmentList } = await import('../lib/fileParser');
      const parsedResult = await parseEquipmentList(uploadState.data.raw);
      equipmentData = parsedResult.data;
    } else if (Array.isArray(uploadState.data)) {
      // If we already have parsed data
      equipmentData = uploadState.data;
    } else {
      throw new Error('Invalid data format from file upload');
    }

    if (!equipmentData || equipmentData.length === 0) {
      throw new Error('No equipment data found in uploaded file');
    }

    setProcessingStage('categorizing_equipment', 30, 'Categorizing equipment...');

    // Categorize equipment using our business logic
    const categorizedResult = categorizeEquipment(equipmentData);
    
    setProcessingStage('generating_wbs', 60, 'Generating WBS structure...');

    // Generate WBS structure
    const wbsResult = generateWBSStructure(
      categorizedResult.equipment, 
      project.project_name || 'New Project'
    );

    setProcessingStage('building_tree', 80, 'Building visualization...');

    // Update store with results
    updateEquipmentList(categorizedResult.equipment);
    updateWBSStructure(wbsResult.wbs_structure);

    // Store processing results for display
    setProcessingResults({
      equipment: categorizedResult,
      wbs: wbsResult,
      validation: uploadState.validation
    });

    setProcessingStage('complete', 100, 'Project created successfully!');
    setSuccess(`Successfully processed ${categorizedResult.equipment.length} equipment items and generated ${wbsResult.wbs_structure.length} WBS items.`);
    
    // Move to next step
    setActiveStep(1);

  } catch (error) {
    console.error('Processing error:', error);
    setProcessingStage('error', 0, error.message);
    setError(`Processing failed: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

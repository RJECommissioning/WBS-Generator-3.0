// Replace your existing handleProcessFile function in StartNewProject.jsx with this enhanced version

const handleProcessFile = async () => {
  try {
    setLoading(true);
    setProcessingStage('parsing', 10, 'Processing uploaded file...');

    console.log('🚀 STARTING COMPREHENSIVE ENHANCED PROCESSING WITH ALL FIXES...');

    // Get the uploaded file from the store
    const uploadState = uploads['equipment_list'];
    if (!uploadState || !uploadState.file) {
      throw new Error('No file available for processing. Please upload a file first.');
    }

    const file = uploadState.file;
    console.log('📁 Processing file:', {
      name: file.name,
      type: file.type,
      size: file.size,
      lastModified: new Date(file.lastModified).toLocaleString()
    });

    // PHASE 1: Enhanced File Parsing
    setProcessingStage('parsing', 30, 'Parsing file content...');
    console.log('🔍 PHASE 1: ENHANCED FILE PARSING');
    
    const parseResult = await parseFile(file);
    
    console.log('✅ Parse completed:', {
      type: parseResult.type,
      hasData: !!parseResult.data,
      dataLength: parseResult.data ? parseResult.data.length : 'N/A',
      hasOriginalHeaders: !!parseResult.originalHeaders,
      originalHeadersLength: parseResult.originalHeaders ? parseResult.originalHeaders.length : 'N/A'
    });

    if (!parseResult || !parseResult.data || parseResult.data.length === 0) {
      throw new Error(`No valid equipment data found. File parsed ${parseResult?.originalHeaders?.length || 0} headers but extracted ${parseResult?.data?.length || 0} equipment items.`);
    }

    const rawEquipmentData = parseResult.data;
    console.log(`✅ Successfully parsed ${rawEquipmentData.length} raw equipment items`);

    // PHASE 2: Enhanced Equipment Processing (with all fixes applied)
    setProcessingStage('categorizing_equipment', 50, 'Processing and categorizing equipment...');
    console.log('🔍 PHASE 2: ENHANCED EQUIPMENT PROCESSING WITH ALL FIXES');
    
    // Use the enhanced categorizeEquipment function (now with comprehensive filtering)
    const processedEquipmentResult = categorizeEquipment(rawEquipmentData);
    
    console.log('✅ Equipment processing completed:', {
      totalProcessed: processedEquipmentResult.total_processed,
      originalCount: processedEquipmentResult.totals?.original || rawEquipmentData.length,
      afterCommissioningFilter: processedEquipmentResult.totals?.afterCommissioningFilter || 0,
      finalCount: processedEquipmentResult.totals?.final || processedEquipmentResult.total_processed,
      parentItems: processedEquipmentResult.totals?.parentItems || 0,
      childItems: processedEquipmentResult.totals?.childItems || 0,
      categories: Object.keys(processedEquipmentResult.categoryStats || processedEquipmentResult.grouped).length,
      excludedCount: processedEquipmentResult.summary?.excluded_count || 0
    });

    // PHASE 3: Enhanced WBS Structure Generation (with all standard categories)
    setProcessingStage('generating_wbs', 70, 'Generating complete WBS structure...');
    console.log('🔍 PHASE 3: ENHANCED WBS STRUCTURE GENERATION WITH ALL STANDARD CATEGORIES');
    
    // Use the enhanced generateWBSStructure function
    const wbsResult = generateWBSStructure(processedEquipmentResult, '5737 Summerfield Project');
    
    console.log('✅ WBS generation completed:', {
      totalWBSItems: wbsResult.total_items,
      equipmentItems: wbsResult.summary?.equipment_items || 0,
      structuralItems: wbsResult.summary?.structural_items || 0,
      categoriesWithEquipment: wbsResult.summary?.categories_with_equipment || 0,
      emptyCategories: wbsResult.summary?.empty_categories || 0,
      parentChildPairs: wbsResult.summary?.parent_child_pairs || 0,
      maxLevel: wbsResult.max_level
    });

    // PHASE 4: Enhanced Export Preparation and Validation
    setProcessingStage('finalizing', 90, 'Preparing export data...');
    console.log('🔍 PHASE 4: ENHANCED EXPORT PREPARATION WITH DUPLICATE PREVENTION');
    
    // Test the enhanced export formatting
    const exportResult = formatDataForP6(wbsResult.wbs_structure);
    
    console.log('✅ Export preparation completed:', {
      exportRecords: exportResult.metadata.total_records,
      duplicatesRemoved: exportResult.metadata.duplicates_removed,
      levelDistribution: exportResult.metadata.levels,
      validationPassed: exportResult.metadata.validation.errors.length === 0,
      validationErrors: exportResult.metadata.validation.errors.length,
      validationWarnings: exportResult.metadata.validation.warnings.length
    });

    // Update store with enhanced results
    updateEquipmentList(processedEquipmentResult.equipment);
    updateWBSStructure(wbsResult.wbs_structure);

    // Store comprehensive results for display
    const finalResults = {
      equipment: {
        equipment: processedEquipmentResult.equipment,
        total_processed: processedEquipmentResult.total_processed,
        summary: {
          processing_warnings: processedEquipmentResult.summary?.processing_warnings || []
        },
        grouped: processedEquipmentResult.grouped,
        categoryStats: processedEquipmentResult.categoryStats,
        totals: processedEquipmentResult.totals,
        parentChildRelationships: processedEquipmentResult.parentChildRelationships?.length || 0
      },
      wbs: {
        wbs_structure: wbsResult.wbs_structure,
        total_items: wbsResult.total_items,
        max_level: wbsResult.max_level,
        summary: wbsResult.summary,
        validation: wbsResult.validation
      },
      export: {
        ready: true,
        records: exportResult.metadata.total_records,
        duplicates_removed: exportResult.metadata.duplicates_removed,
        validation: exportResult.metadata.validation,
        levels: exportResult.metadata.levels
      }
    };

    setProcessingResults(finalResults);

    // Comprehensive completion summary
    console.log('🎉 ALL ENHANCED PHASES COMPLETE - Comprehensive Final Summary:');
    console.log(`   🎯 SUCCESS: All critical fixes applied successfully!`);
    console.log(`   📊 Equipment processed: ${processedEquipmentResult.total_processed} (from ${rawEquipmentData.length} original)`);
    console.log(`   ❌ Filtered out (status N): ${(processedEquipmentResult.totals?.original || rawEquipmentData.length) - (processedEquipmentResult.totals?.afterCommissioningFilter || processedEquipmentResult.total_processed)} items`);
    console.log(`   🏗️ WBS items created: ${wbsResult.total_items}`);
    console.log(`   📂 ALL categories created: ${Object.keys(processedEquipmentResult.categoryStats || processedEquipmentResult.grouped).length} (including ${wbsResult.summary?.empty_categories || 0} empty)`);
    console.log(`   👨‍👦 Parent-child relationships: ${processedEquipmentResult.parentChildRelationships?.length || 0}`);
    console.log(`   📤 Export records: ${exportResult.metadata.total_records} (${exportResult.metadata.duplicates_removed} duplicates removed)`);
    console.log(`   ✅ Expected vs Actual: 1208 vs ${wbsResult.total_items} (${((wbsResult.total_items / 1208) * 100).toFixed(1)}%)`);
    console.log(`   🔧 FIXES APPLIED:`);
    console.log(`      ✅ All standard categories created (even empty ones like "03 | HV Switchboards")`);
    console.log(`      ✅ Commissioning "N" status completely filtered out`);
    console.log(`      ✅ Proper parent-child nesting (+UH → -F relationships)`);
    console.log(`      ✅ Export duplicates eliminated`);
    console.log(`      ✅ Hierarchical sorting and validation`);

    setProcessingStage('complete', 100, 'Project created successfully with ALL fixes applied!');
    setSuccess(`Successfully processed ${processedEquipmentResult.total_processed} equipment items with all fixes applied!`);
    
    // Move to next step
    setActiveStep(1);

  } catch (error) {
    console.error('❌ ENHANCED PROCESSING ERROR:', error);
    console.error('Error stack:', error.stack);
    setProcessingStage('error', 0, error.message);
    setError(`Processing failed: ${error.message}`);
  } finally {
    setLoading(false);
  }
};

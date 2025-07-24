import { saveAs } from 'file-saver';
import { EXPORT_SETTINGS } from '../constants';
import { dateHelpers, arrayHelpers, stringHelpers } from '../utils';

/**
 * P6 Exporter - Enhanced with comprehensive fixes
 * - Duplicate detection and elimination
 * - Proper hierarchical sorting
 * - Enhanced P6 format validation
 * - Clean CSV generation with proper 3-column format
 */

// Main export function for WBS structure - Enhanced with duplicate prevention
export const exportWBSToP6CSV = (wbsData, options = {}) => {
  try {
    console.log('📤 STARTING ENHANCED P6 EXPORT');
    console.log(`📊 Input data: ${wbsData?.length || 0} WBS items`);

    const defaultOptions = {
      filename: null,
      includeNewOnly: false,
      includeHeaders: true,
      format: 'csv'
    };

    const exportOptions = { ...defaultOptions, ...options };

    // Enhanced data filtering and validation
    const filteredData = filterDataForExport(wbsData, exportOptions);
    console.log(`✅ Filtered data: ${filteredData.length} items for export`);

    // Enhanced data validation
    validateExportRequest(filteredData, exportOptions);

    // Enhanced P6 formatting with duplicate elimination
    const formattedData = formatDataForP6(filteredData);
    console.log(`✅ Formatted data: ${formattedData.data.length} records`);

    // Generate CSV content
    const csvContent = generateCSVContent(formattedData, exportOptions);

    // Generate filename
    const filename = generateFilename(exportOptions.filename, exportOptions.includeNewOnly);

    // Download file
    downloadCSVFile(csvContent, filename);

    console.log('🎉 Export completed successfully:', {
      filename: filename,
      recordCount: formattedData.data.length,
      validationPassed: formattedData.metadata.validation.errors.length === 0
    });

    return {
      success: true,
      filename: filename,
      recordCount: formattedData.data.length,
      exportedData: formattedData.data,
      metadata: formattedData.metadata
    };

  } catch (error) {
    console.error('❌ Export failed:', error);
    throw new Error(`Export failed: ${error.message}`);
  }
};

// Enhanced data filtering for export
const filterDataForExport = (wbsData, options) => {
  console.log('🔍 ENHANCED DATA FILTERING');
  
  let data = Array.isArray(wbsData) ? wbsData : [];

  if (data.length === 0) {
    throw new Error('No data provided for export');
  }

  console.log(`📊 Initial data count: ${data.length}`);

  // Filter for new items only if requested
  if (options.includeNewOnly) {
    data = data.filter(item => item.is_new === true);
    console.log(`📊 After new-only filter: ${data.length} items`);
    
    if (data.length === 0) {
      throw new Error('No new items found for export');
    }
  }

  // Filter out excluded items (commissioning status 'N') - Should already be filtered but double-check
  const beforeCommissioningFilter = data.length;
  data = data.filter(item => {
    const status = item.commissioning_status;
    return !status || status.toUpperCase() !== 'N';
  });
  
  if (data.length !== beforeCommissioningFilter) {
    console.log(`📊 Filtered out ${beforeCommissioningFilter - data.length} items with commissioning status 'N'`);
  }

  // Filter out items with invalid WBS codes
  const beforeValidation = data.length;
  data = data.filter(item => {
    return item.wbs_code && item.wbs_code.toString().trim() !== '' && 
           item.wbs_name && item.wbs_name.toString().trim() !== '';
  });

  if (data.length !== beforeValidation) {
    console.log(`📊 Filtered out ${beforeValidation - data.length} items with invalid WBS codes/names`);
  }

  console.log(`✅ Final filtered data: ${data.length} items`);
  return data;
};

// Enhanced P6 format validation and processing
const formatDataForP6 = (data) => {
  console.log('📤 ENHANCED P6 FORMAT PROCESSING');
  console.log(`📊 Input: ${data.length} WBS items`);

  if (!data || data.length === 0) {
    throw new Error('No WBS structure provided for export');
  }

  // Step 1: Validate and clean WBS structure
  console.log('🧹 STEP 1: WBS Structure Validation & Cleaning');
  
  const validatedStructure = data
    .filter(item => {
      // Filter out invalid items
      const isValid = item.wbs_code && item.wbs_name;
      if (!isValid) {
        console.log(`⚠️ Filtering out invalid WBS item:`, { 
          wbs_code: item.wbs_code, 
          wbs_name: item.wbs_name 
        });
      }
      return isValid;
    })
    .map(item => ({
      ...item,
      wbs_code: item.wbs_code.toString().trim(),
      parent_wbs_code: item.parent_wbs_code ? item.parent_wbs_code.toString().trim() : null,
      wbs_name: item.wbs_name.toString().trim()
    }));

  console.log(`✅ Validated structure: ${validatedStructure.length} items (filtered out ${data.length - validatedStructure.length} invalid items)`);

  // Step 2: Enhanced duplicate detection and removal
  console.log('🔍 STEP 2: Enhanced Duplicate Detection & Removal');
  
  const seenWBSCodes = new Set();
  const duplicates = [];
  const uniqueStructure = [];

  validatedStructure.forEach(item => {
    if (seenWBSCodes.has(item.wbs_code)) {
      duplicates.push({
        wbs_code: item.wbs_code,
        wbs_name: item.wbs_name
      });
      console.log(`❌ Duplicate WBS code detected: ${item.wbs_code} - "${item.wbs_name}"`);
    } else {
      seenWBSCodes.add(item.wbs_code);
      uniqueStructure.push(item);
    }
  });

  if (duplicates.length > 0) {
    console.log(`⚠️ Removed ${duplicates.length} duplicate items:`, duplicates.slice(0, 5));
  }

  console.log(`✅ Unique structure: ${uniqueStructure.length} items`);

  // Step 3: Enhanced hierarchical sorting
  console.log('📊 STEP 3: Enhanced Hierarchical Sorting');
  
  const sortedStructure = uniqueStructure.sort((a, b) => {
    // Split WBS codes into parts for numerical sorting
    const aParts = a.wbs_code.split('.').map(part => parseInt(part) || 0);
    const bParts = b.wbs_code.split('.').map(part => parseInt(part) || 0);
    
    // Compare each level
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      
      if (aVal !== bVal) {
        return aVal - bVal;
      }
    }
    
    return 0;
  });

  console.log('📈 Sample sorted structure:', sortedStructure.slice(0, 10).map(item => ({
    wbs_code: item.wbs_code,
    wbs_name: item.wbs_name.substring(0, 30) + (item.wbs_name.length > 30 ? '...' : '')
  })));

  // Step 4: Enhanced P6 format conversion with proper column mapping
  console.log('🎯 STEP 4: Enhanced P6 Format Conversion');
  
  const p6FormattedData = sortedStructure.map((item, index) => {
    // Build the P6 export record with ONLY the 3 required columns
    const p6Record = {
      wbs_code: cleanWBSCode(item.wbs_code),
      parent_wbs_code: item.parent_wbs_code ? cleanWBSCode(item.parent_wbs_code) : '',
      wbs_name: cleanWBSName(item.wbs_name)
    };

    // Log first 10 records for debugging
    if (index < 10) {
      console.log(`   ${index + 1}. ${p6Record.wbs_code} | ${p6Record.parent_wbs_code || 'ROOT'} | ${p6Record.wbs_name.substring(0, 40)}${p6Record.wbs_name.length > 40 ? '...' : ''}`);
    }

    return p6Record;
  });

  console.log(`✅ P6 formatted data: ${p6FormattedData.length} records`);

  // Step 5: Comprehensive export validation
  console.log('✅ STEP 5: Comprehensive Export Validation');
  
  const exportValidation = validateP6Export(p6FormattedData);
  
  if (exportValidation.errors.length > 0) {
    console.error('❌ Export validation failed:', exportValidation.errors);
    throw new Error(`Export validation failed: ${exportValidation.errors.join(', ')}`);
  }

  // Step 6: Generate comprehensive export metadata
  const exportMetadata = {
    timestamp: new Date().toISOString(),
    total_records: p6FormattedData.length,
    duplicates_removed: duplicates.length,
    levels: {
      level1: p6FormattedData.filter(item => !item.parent_wbs_code || item.parent_wbs_code === '').length,
      level2: p6FormattedData.filter(item => item.parent_wbs_code && item.parent_wbs_code.split('.').length === 1).length,
      level3: p6FormattedData.filter(item => item.parent_wbs_code && item.parent_wbs_code.split('.').length === 2).length,
      level4: p6FormattedData.filter(item => item.parent_wbs_code && item.parent_wbs_code.split('.').length === 3).length,
      level5: p6FormattedData.filter(item => item.parent_wbs_code && item.parent_wbs_code.split('.').length === 4).length
    },
    validation: exportValidation,
    original_items: data.length,
    filtered_items: validatedStructure.length,
    final_export_items: p6FormattedData.length
  };

  console.log('📊 Enhanced Export Summary:');
  console.log(`   📄 Total Records: ${exportMetadata.total_records}`);
  console.log(`   🔄 Duplicates Removed: ${exportMetadata.duplicates_removed}`);
  console.log(`   📊 Level Distribution:`, exportMetadata.levels);
  console.log(`   ✅ Validation Status: ${exportValidation.errors.length === 0 ? 'PASSED' : 'FAILED'}`);

  return {
    data: p6FormattedData,
    metadata: exportMetadata,
    columns: ['wbs_code', 'parent_wbs_code', 'wbs_name'] // Only the 3 required columns
  };
};

// Enhanced export validation function
const validateP6Export = (exportData) => {
  console.log('✅ COMPREHENSIVE P6 EXPORT VALIDATION');
  
  const validation = {
    errors: [],
    warnings: [],
    stats: {
      total_records: exportData.length,
      unique_wbs_codes: new Set(exportData.map(item => item.wbs_code)).size,
      records_with_parents: exportData.filter(item => item.parent_wbs_code && item.parent_wbs_code !== '').length,
      root_records: exportData.filter(item => !item.parent_wbs_code || item.parent_wbs_code === '').length,
      empty_names: 0,
      long_names: 0
    }
  };

  // Check for duplicate WBS codes in export - CRITICAL
  const wbsCodes = exportData.map(item => item.wbs_code);
  const duplicateWBSCodes = wbsCodes.filter((code, index, arr) => arr.indexOf(code) !== index);
  
  if (duplicateWBSCodes.length > 0) {
    validation.errors.push(`Duplicate WBS codes in export: ${[...new Set(duplicateWBSCodes)].join(', ')}`);
  }

  // Check for broken parent references
  const wbsCodeSet = new Set(wbsCodes);
  exportData.forEach(item => {
    if (item.parent_wbs_code && item.parent_wbs_code !== '' && !wbsCodeSet.has(item.parent_wbs_code)) {
      validation.errors.push(`Broken parent reference: ${item.wbs_code} references non-existent parent ${item.parent_wbs_code}`);
    }
  });

  // Check for required columns - ONLY the 3 P6 columns
  const requiredColumns = ['wbs_code', 'parent_wbs_code', 'wbs_name'];
  if (exportData.length > 0) {
    const firstRecord = exportData[0];
    requiredColumns.forEach(column => {
      if (!firstRecord.hasOwnProperty(column)) {
        validation.errors.push(`Missing required column: ${column}`);
      }
    });
  }

  // Check for empty WBS names and long names
  exportData.forEach(item => {
    if (!item.wbs_name || item.wbs_name.trim() === '') {
      validation.warnings.push(`Empty WBS name for code: ${item.wbs_code}`);
      validation.stats.empty_names++;
    }
    
    if (item.wbs_name && item.wbs_name.length > 100) {
      validation.warnings.push(`Long WBS name (${item.wbs_name.length} chars) for code: ${item.wbs_code}`);
      validation.stats.long_names++;
    }
  });

  // Should have exactly one root record
  if (validation.stats.root_records !== 1) {
    validation.errors.push(`Expected exactly 1 root record, found ${validation.stats.root_records}`);
  }

  // Check total vs unique codes
  if (validation.stats.total_records !== validation.stats.unique_wbs_codes) {
    validation.errors.push(`Record count mismatch: ${validation.stats.total_records} records but only ${validation.stats.unique_wbs_codes} unique WBS codes`);
  }

  // Validate WBS code format
  exportData.forEach(item => {
    if (!isValidWBSCode(item.wbs_code)) {
      validation.errors.push(`Invalid WBS code format: ${item.wbs_code}`);
    }
  });

  console.log('📊 Validation Statistics:');
  console.log(`   📄 Total Records: ${validation.stats.total_records}`);
  console.log(`   🆔 Unique WBS Codes: ${validation.stats.unique_wbs_codes}`);
  console.log(`   🌳 Root Records: ${validation.stats.root_records}`);
  console.log(`   👨‍👦 Records with Parents: ${validation.stats.records_with_parents}`);
  console.log(`   ❌ Errors: ${validation.errors.length}`);
  console.log(`   ⚠️ Warnings: ${validation.warnings.length}`);

  return validation;
};

// Enhanced data validation before processing
const validateExportRequest = (data, options) => {
  console.log('🔍 VALIDATING EXPORT REQUEST');
  
  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };
  
  // Check data
  if (!data || !Array.isArray(data) || data.length === 0) {
    validation.errors.push('No data provided for export');
    validation.isValid = false;
    return validation;
  }
  
  // Check options
  if (options.includeNewOnly) {
    const newItems = data.filter(item => item.is_new === true);
    if (newItems.length === 0) {
      validation.warnings.push('No new items found for export');
    }
  }
  
  // Check for missing WBS codes
  const missingWBSCodes = data.filter(item => !item.wbs_code || item.wbs_code.toString().trim() === '');
  if (missingWBSCodes.length > 0) {
    validation.warnings.push(`${missingWBSCodes.length} items missing WBS codes`);
  }
  
  // Check for missing WBS names
  const missingWBSNames = data.filter(item => !item.wbs_name || item.wbs_name.toString().trim() === '');
  if (missingWBSNames.length > 0) {
    validation.warnings.push(`${missingWBSNames.length} items missing WBS names`);
  }
  
  // Check for long names that will be truncated
  const longNames = data.filter(item => 
    item.wbs_name && item.wbs_name.length > 100
  );
  if (longNames.length > 0) {
    validation.warnings.push(`${longNames.length} WBS names will be truncated`);
  }

  console.log(`✅ Export validation: ${validation.isValid ? 'PASSED' : 'FAILED'}`);
  console.log(`   ❌ Errors: ${validation.errors.length}`);
  console.log(`   ⚠️ Warnings: ${validation.warnings.length}`);
  
  return validation;
};

// Enhanced WBS code validation
const isValidWBSCode = (wbsCode) => {
  // WBS codes should be numeric with dots (e.g., "1.3.2.1")
  if (!wbsCode) return false;
  const codeStr = wbsCode.toString().trim();
  return /^[\d.]+$/.test(codeStr) && !codeStr.startsWith('.') && !codeStr.endsWith('.');
};

// Enhanced WBS code cleaning
const cleanWBSCode = (wbsCode) => {
  if (!wbsCode) return '';
  return wbsCode.toString().trim();
};

// Enhanced WBS name cleaning with better formatting
const cleanWBSName = (wbsName) => {
  if (!wbsName) return '';
  
  // Clean the name while preserving important formatting
  let cleaned = wbsName.toString().trim();
  
  // Remove or replace problematic characters for P6 compatibility
  cleaned = cleaned.replace(/[""]/g, '"'); // Normalize quotes
  cleaned = cleaned.replace(/\r\n|\r|\n/g, ' '); // Replace line breaks with spaces
  cleaned = cleaned.replace(/\s+/g, ' '); // Normalize multiple spaces
  cleaned = cleaned.replace(/[^\x20-\x7E]/g, ''); // Remove non-ASCII characters
  
  // Truncate if too long (P6 has limits)
  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 97) + '...';
  }
  
  return cleaned;
};

// Enhanced CSV content generation
const generateCSVContent = (exportData, options) => {
  console.log('📄 GENERATING ENHANCED CSV CONTENT');
  
  if (!exportData || !exportData.data || exportData.data.length === 0) {
    throw new Error('No export data provided for CSV generation');
  }

  const { data, columns } = exportData;
  const delimiter = EXPORT_SETTINGS?.csv?.delimiter || ',';
  
  console.log(`📊 Generating CSV: ${data.length} records, ${columns.length} columns`);
  
  let csvContent = '';
  
  // Add headers if requested
  if (options.includeHeaders) {
    csvContent += columns.join(delimiter) + '\n';
  }
  
  // Add data rows with enhanced formatting
  data.forEach((record, index) => {
    const row = columns.map(column => {
      const value = record[column] || '';
      return formatCSVValue(value, delimiter);
    });
    csvContent += row.join(delimiter) + '\n';
    
    // Log progress for large exports
    if (index % 100 === 0 && index > 0) {
      console.log(`   📄 Generated ${index} rows...`);
    }
  });
  
  console.log(`✅ CSV generation complete: ${csvContent.split('\n').length - 1} total lines`);
  return csvContent;
};

// Enhanced CSV value formatting with better escaping
const formatCSVValue = (value, delimiter = ',') => {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = value.toString();
  
  // If value is empty, return empty string
  if (stringValue.trim() === '') {
    return '';
  }
  
  // If value contains delimiter, quotes, or newlines, wrap in quotes
  if (stringValue.includes(delimiter) || 
      stringValue.includes('"') || 
      stringValue.includes('\n') || 
      stringValue.includes('\r')) {
    
    // Escape existing quotes by doubling them
    const escapedValue = stringValue.replace(/"/g, '""');
    return `"${escapedValue}"`;
  }
  
  return stringValue;
};

// Enhanced filename generation with better timestamps
const generateFilename = (customFilename, includeNewOnly) => {
  if (customFilename) {
    return customFilename.endsWith('.csv') ? customFilename : `${customFilename}.csv`;
  }
  
  const prefix = EXPORT_SETTINGS?.filename?.prefix || 'WBS_Export';
  const dateStamp = dateHelpers?.getDateStamp?.() || new Date().toISOString().split('T')[0].replace(/-/g, '');
  const newOnlyTag = includeNewOnly ? '_NewItems' : '';
  
  return `${prefix}_${dateStamp}${newOnlyTag}.csv`;
};

// Enhanced file download with better error handling
const downloadCSVFile = (csvContent, filename) => {
  try {
    console.log(`📥 Downloading file: ${filename} (${csvContent.length} characters)`);
    
    // Create blob with proper encoding for international characters
    const blob = new Blob(['\uFEFF' + csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    // Use FileSaver to download
    saveAs(blob, filename);
    console.log(`✅ File download initiated: ${filename}`);
    
  } catch (error) {
    console.warn('⚠️ FileSaver failed, using fallback method');
    
    // Enhanced fallback for browsers that don't support FileSaver
    try {
      const encodedUri = encodeURI(`data:text/csv;charset=utf-8,\uFEFF${csvContent}`);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log(`✅ Fallback download completed: ${filename}`);
    } catch (fallbackError) {
      console.error('❌ Both download methods failed:', fallbackError);
      throw new Error(`File download failed: ${fallbackError.message}`);
    }
  }
};

// Export equipment list (for debugging or separate use) - Enhanced
const exportEquipmentListToCSV = (equipmentList, options = {}) => {
  try {
    console.log('📤 EXPORTING EQUIPMENT LIST');
    
    const headers = [
      'equipment_number',
      'description', 
      'plu_field',
      'commissioning_status',
      'category',
      'category_name',
      'is_sub_equipment',
      'parent_equipment'
    ];
    
    const formattedData = equipmentList.map(item => ({
      equipment_number: item.equipment_number || '',
      description: item.description || '',
      plu_field: item.plu_field || '',
      commissioning_status: item.commissioning_status || 'Y',
      category: item.category || '',
      category_name: item.category_name || '',
      is_sub_equipment: item.is_sub_equipment ? 'Y' : 'N',
      parent_equipment: item.parent_equipment || item.parent_equipment_code || ''
    }));
    
    let csvContent = '';
    
    // Add headers
    csvContent += headers.join(',') + '\n';
    
    // Add data
    formattedData.forEach(item => {
      const row = headers.map(header => formatCSVValue(item[header], ','));
      csvContent += row.join(',') + '\n';
    });
    
    const filename = options.filename || `Equipment_List_${dateHelpers?.getDateStamp?.() || 'export'}.csv`;
    downloadCSVFile(csvContent, filename);
    
    console.log(`✅ Equipment list exported: ${filename}`);
    
    return {
      success: true,
      filename: filename,
      recordCount: formattedData.length
    };
    
  } catch (error) {
    console.error('❌ Equipment export failed:', error);
    throw new Error(`Equipment export failed: ${error.message}`);
  }
};

// Export comparison results (for Missing Equipment feature) - Enhanced
export const exportComparisonToCSV = (comparisonResult, options = {}) => {
  try {
    console.log('📤 EXPORTING COMPARISON RESULTS');
    
    const { added, removed, modified } = comparisonResult;
    
    const allChanges = [
      ...added.map(item => ({ ...item, change_type: 'ADDED' })),
      ...removed.map(item => ({ ...item, change_type: 'REMOVED' })),
      ...modified.map(item => ({ ...item, change_type: 'MODIFIED' }))
    ];
    
    const headers = [
      'change_type',
      'equipment_number',
      'description',
      'commissioning_status',
      'category',
      'wbs_code',
      'notes'
    ];
    
    const formattedData = allChanges.map(item => ({
      change_type: item.change_type,
      equipment_number: item.equipment_number || '',
      description: item.description || '',
      commissioning_status: item.commissioning_status || '',
      category: item.category || '',
      wbs_code: item.wbs_code || '',
      notes: formatChangeNotes(item)
    }));
    
    let csvContent = '';
    csvContent += headers.join(',') + '\n';
    
    formattedData.forEach(item => {
      const row = headers.map(header => formatCSVValue(item[header], ','));
      csvContent += row.join(',') + '\n';
    });
    
    const filename = options.filename || `Equipment_Changes_${dateHelpers?.getDateStamp?.() || 'export'}.csv`;
    downloadCSVFile(csvContent, filename);
    
    console.log(`✅ Comparison exported: ${filename}`);
    
    return {
      success: true,
      filename: filename,
      recordCount: formattedData.length,
      changes_summary: {
        added: added.length,
        removed: removed.length,
        modified: modified.length
      }
    };
    
  } catch (error) {
    console.error('❌ Comparison export failed:', error);
    throw new Error(`Comparison export failed: ${error.message}`);
  }
};

// Format change notes for export
const formatChangeNotes = (item) => {
  const notes = [];
  
  if (item.changes && item.changes.length > 0) {
    item.changes.forEach(change => {
      notes.push(`${change.field}: "${change.old_value}" → "${change.new_value}"`);
    });
  }
  
  if (item.processing_notes && item.processing_notes.length > 0) {
    notes.push(...item.processing_notes);
  }
  
  return notes.join('; ');
};

// Get enhanced export statistics
export const getExportStatistics = (data, options = {}) => {
  console.log('📊 CALCULATING EXPORT STATISTICS');
  
  const stats = {
    total_items: data.length,
    new_items: data.filter(item => item.is_new === true).length,
    equipment_items: data.filter(item => item.is_equipment === true).length,
    category_items: data.filter(item => item.is_category === true).length,
    max_level: Math.max(...data.map(item => item.level || 0)),
    commissioning_status: {
      Y: data.filter(item => (item.commissioning_status || 'Y') === 'Y').length,
      TBC: data.filter(item => item.commissioning_status === 'TBC').length,
      N: data.filter(item => item.commissioning_status === 'N').length
    },
    levels: {
      level1: data.filter(item => item.level === 1).length,
      level2: data.filter(item => item.level === 2).length,
      level3: data.filter(item => item.level === 3).length,
      level4: data.filter(item => item.level === 4).length,
      level5: data.filter(item => item.level === 5).length
    }
  };
  
  if (options.includeNewOnly) {
    stats.export_count = stats.new_items;
  } else {
    stats.export_count = data.filter(item => 
      !item.commissioning_status || item.commissioning_status !== 'N'
    ).length;
  }
  
  console.log('📈 Export Statistics:', stats);
  return stats;
};

  export { formatDataForP6, validateExportRequest, exportEquipmentListToCSV, exportComparisonToCSV, getExportStatistics };


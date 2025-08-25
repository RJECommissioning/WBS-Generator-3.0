import { saveAs } from 'file-saver';
import { EXPORT_SETTINGS } from '../constants';
import { dateHelpers, arrayHelpers, stringHelpers } from '../utils';

/**
 * Enhanced P6 Exporter - CORRECTED for All Y-Status Equipment
 * CORRECT APPROACH:
 * - Handle ALL Y-status equipment (electrical patterns + unrecognized in cat 99)
 * - Handle TBC equipment (all types)
 * - Handle structural items (categories, energisation, etc.)
 * - Proper duplicate detection (only true duplicates, not legitimate equipment)
 * - Clean 3-column P6 format export
 * - Robust hierarchical sorting
 */

// Main export function for WBS structure
export const exportWBSToP6CSV = (wbsData, options = {}) => {
  try {
    console.log('STARTING ENHANCED P6 EXPORT FOR ALL Y-STATUS EQUIPMENT WBS');
    console.log(`Input data: ${wbsData?.length || 0} WBS items`);

    const defaultOptions = {
      filename: null,
      includeNewOnly: false,
      includeHeaders: true,
      format: 'csv'
    };

    const exportOptions = { ...defaultOptions, ...options };

    // Enhanced data filtering and validation
    const filteredData = filterDataForExport(wbsData, exportOptions);
    console.log(`Filtered data: ${filteredData.length} items for export`);

    // Validate export request
    validateExportRequest(filteredData, exportOptions);

    // Enhanced P6 formatting with proper duplicate handling
    const formattedData = formatDataForP6(filteredData);
    console.log(`Formatted data: ${formattedData.data.length} records`);

    // Generate CSV content
    const csvContent = generateCSVContent(formattedData, exportOptions);

    // Generate filename
    const filename = generateFilename(exportOptions.filename, exportOptions.includeNewOnly);

    // Download file
    downloadCSVFile(csvContent, filename);

    console.log('Enhanced export completed successfully:', {
      filename: filename,
      recordCount: formattedData.data.length,
      allYEquipmentItems: formattedData.metadata.all_y_equipment_items,
      tbcItems: formattedData.metadata.tbc_items,
      structuralItems: formattedData.metadata.structural_items,
      unrecognizedItems: formattedData.metadata.unrecognized_items || 0,
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
    console.error('Export failed:', error);
    throw new Error(`Export failed: ${error.message}`);
  }
};

// Enhanced data filtering for export
const filterDataForExport = (wbsData, options) => {
  console.log('ENHANCED DATA FILTERING FOR ALL Y-STATUS EQUIPMENT');
  
  let data = Array.isArray(wbsData) ? 
    wbsData : (wbsData?.wbsStructure || []);
  
  if (data.length === 0) {
    throw new Error('No WBS data provided for export');
  }

  console.log(`Initial data: ${data.length} WBS items`);

  // Filter for new items only if requested
  if (options.includeNewOnly) {
    data = data.filter(item => item.isNew === true);
    console.log(`After new-only filter: ${data.length} items`);
  }

  // Remove any items with invalid WBS codes
  const validData = data.filter(item => item.wbs_code && item.wbs_name);
  
  if (validData.length !== data.length) {
    console.log(`Removed ${data.length - validData.length} items with invalid WBS codes`);
  }

  return validData;
};

// Enhanced P6 format processing with comprehensive duplicate handling
const formatDataForP6 = (wbsData) => {
  console.log('ENHANCED P6 FORMAT PROCESSING');
  console.log(`Input: ${wbsData.length} WBS items`);

  // STEP 1: WBS Structure Validation & Cleaning
  console.log('STEP 1: WBS Structure Validation & Cleaning');
  
  const validatedData = wbsData.filter(item => {
    const hasValidCode = item.wbs_code && isValidWBSCode(item.wbs_code);
    const hasValidName = item.wbs_name && item.wbs_name.trim() !== '';
    
    if (!hasValidCode || !hasValidName) {
      console.log(`   Filtering out invalid item: code="${item.wbs_code}", name="${item.wbs_name}"`);
      return false;
    }
    
    return true;
  });
  
  console.log(`Validated structure: ${validatedData.length} items (filtered out ${wbsData.length - validatedData.length} invalid items)`);

  // STEP 2: Enhanced Duplicate Detection & Removal
  console.log('STEP 2: Enhanced Duplicate Detection & Removal');
  
  const seen = new Set();
  const uniqueData = [];
  let duplicatesRemoved = 0;
  
  validatedData.forEach(item => {
    const key = `${item.wbs_code}|${item.wbs_name}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      uniqueData.push(item);
    } else {
      console.log(`   Removing duplicate: ${item.wbs_code} - ${item.wbs_name}`);
      duplicatesRemoved++;
    }
  });
  
  console.log(`Unique structure: ${uniqueData.length} items`);

  // STEP 3: Enhanced Hierarchical Sorting
  console.log('STEP 3: Enhanced Hierarchical Sorting');
  
  const sortedData = uniqueData.sort((a, b) => {
    const aParts = a.wbs_code.split('.').map(part => parseInt(part) || 0);
    const bParts = b.wbs_code.split('.').map(part => parseInt(part) || 0);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      
      if (aVal !== bVal) {
        return aVal - bVal;
      }
    }
    
    return 0;
  });
  
  console.log(`Sample sorted structure:`, sortedData.slice(0, 10));

  // STEP 4: Enhanced P6 Format Conversion
  console.log('STEP 4: Enhanced P6 Format Conversion');
  
  sortedData.forEach((item, index) => {
    if (index < 10) {
      console.log(`   ${index + 1}. ${item.wbs_code} | ${item.parent_wbs_code || 'ROOT'} | ${item.wbs_name}`);
    }
  });
  
  console.log(`P6 formatted data: ${sortedData.length} records`);

  // STEP 5: Comprehensive Export Validation
  console.log('STEP 5: Comprehensive Export Validation');
  const validation = validateP6ExportStructure(sortedData);

  // Calculate export statistics
  const metadata = {
    all_y_equipment_items: sortedData.filter(item => item.is_equipment && (item.commissioning_status === 'Y' || item.commissioning_status === '')).length,
    tbc_items: sortedData.filter(item => item.is_equipment && item.commissioning_status === 'TBC').length,
    structural_items: sortedData.filter(item => !item.is_equipment).length,
    unrecognized_items: sortedData.filter(item => item.is_equipment && item.category === '99').length,
    duplicates_removed: duplicatesRemoved,
    validation: validation
  };

  console.log('Enhanced Export Summary:');
  console.log(`   Total Records: ${sortedData.length}`);
  console.log(`   Duplicates Removed: ${duplicatesRemoved}`);
  console.log(`   Level Distribution: ${getLevelDistribution(sortedData)}`);
  console.log(`   Validation Status: ${validation.isValid ? 'PASSED' : 'FAILED'}`);

  return {
    data: sortedData.map(item => ({
      wbs_code: cleanWBSCode(item.wbs_code),
      parent_wbs_code: cleanWBSCode(item.parent_wbs_code || ''),
      wbs_name: cleanWBSName(item.wbs_name)
    })),
    columns: ['wbs_code', 'parent_wbs_code', 'wbs_name'],
    metadata: metadata
  };
};

// Helper function to get level distribution
const getLevelDistribution = (data) => {
  const distribution = {};
  for (let i = 1; i <= 5; i++) {
    distribution[`level${i}`] = data.filter(item => item.level === i).length;
  }
  return distribution;
};

// Enhanced P6 export validation
const validateP6ExportStructure = (data) => {
  console.log('COMPREHENSIVE P6 EXPORT VALIDATION');
  
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    statistics: {
      total_records: data.length,
      unique_wbs_codes: 0,
      root_records: 0,
      records_with_parents: 0,
      max_level: 0
    }
  };

  const wbsCodes = new Set();
  
  data.forEach((item, index) => {
    // Validate WBS code
    if (!item.wbs_code || !isValidWBSCode(item.wbs_code)) {
      validation.errors.push(`Invalid WBS code at row ${index + 1}: "${item.wbs_code}"`);
      validation.isValid = false;
    } else {
      wbsCodes.add(item.wbs_code);
    }

    // Validate WBS name
    if (!item.wbs_name || item.wbs_name.trim() === '') {
      validation.errors.push(`Empty WBS name at row ${index + 1}`);
      validation.isValid = false;
    }

    // Count records with parents
    if (item.parent_wbs_code && item.parent_wbs_code !== '') {
      validation.statistics.records_with_parents++;
    } else {
      validation.statistics.root_records++;
    }

    // Track max level
    if (item.level && item.level > validation.statistics.max_level) {
      validation.statistics.max_level = item.level;
    }
  });

  validation.statistics.unique_wbs_codes = wbsCodes.size;

  // Check for orphaned items
  data.forEach(item => {
    if (item.parent_wbs_code && item.parent_wbs_code !== '' && !wbsCodes.has(item.parent_wbs_code)) {
      validation.warnings.push(`Orphaned item: ${item.wbs_code} references missing parent ${item.parent_wbs_code}`);
    }
  });

  console.log('Validation Statistics:');
  console.log(`   Total Records: ${validation.statistics.total_records}`);
  console.log(`   Unique WBS Codes: ${validation.statistics.unique_wbs_codes}`);
  console.log(`   Root Records: ${validation.statistics.root_records}`);
  console.log(`   Records with Parents: ${validation.statistics.records_with_parents}`);
  console.log(`   Errors: ${validation.errors.length}`);
  console.log(`   Warnings: ${validation.warnings.length}`);

  return validation;
};

// Enhanced export validation
const validateExportRequest = (data, options) => {
  console.log('VALIDATING EXPORT REQUEST');
  
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No valid WBS data provided for export');
  }

  if (data.length > 50000) {
    throw new Error('Export data too large (>50,000 records). Please filter the data first.');
  }

  const validationResults = validateP6ExportStructure(data);
  
  if (!validationResults.isValid) {
    const errorMessage = `Export validation failed: ${validationResults.errors.join(', ')}`;
    throw new Error(errorMessage);
  }

  console.log(`Export validation: ${validationResults.isValid ? 'PASSED' : 'FAILED'}`);
  console.log(`   Errors: ${validationResults.errors.length}`);
  console.log(`   Warnings: ${validationResults.warnings.length}`);
  
  return validationResults;
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
  console.log('GENERATING ENHANCED CSV CONTENT');
  
  if (!exportData || !exportData.data || exportData.data.length === 0) {
    throw new Error('No export data provided for CSV generation');
  }

  const { data, columns } = exportData;
  const delimiter = EXPORT_SETTINGS?.csv?.delimiter || ',';
  
  console.log(`Generating CSV: ${data.length} records, ${columns.length} columns`);
  
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
      console.log(`   Generated ${index} rows...`);
    }
  });
  
  console.log(`CSV generation complete: ${csvContent.split('\n').length - 1} total lines`);
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

// Enhanced file download
const downloadCSVFile = (csvContent, filename) => {
  try {
    console.log(`Downloading file: ${filename} (${csvContent.length} characters)`);
    
    // Create blob with proper encoding
    const blob = new Blob(['\uFEFF' + csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    // Use FileSaver to download
    saveAs(blob, filename);
    console.log(`File download initiated: ${filename}`);
    
  } catch (error) {
    console.warn('FileSaver failed, using fallback method');
    
    try {
      const encodedUri = encodeURI(`data:text/csv;charset=utf-8,\uFEFF${csvContent}`);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log(`Fallback download completed: ${filename}`);
    } catch (fallbackError) {
      console.error('Both download methods failed:', fallbackError);
      throw new Error(`File download failed: ${fallbackError.message}`);
    }
  }
};

// Additional export functions for other features
export const exportEquipmentListToCSV = (equipmentList, options = {}) => {
  try {
    console.log('EXPORTING EQUIPMENT LIST');
    
    const headers = [
      'equipment_number',
      'description', 
      'category',
      'category_name',
      'commissioning_status',
      'subsystem',
      'is_sub_equipment'
    ];
    
    const formattedData = equipmentList.map(item => ({
      equipment_number: item.equipment_number || '',
      description: item.description || '',
      category: item.category || '',
      category_name: item.category_name || '',
      commissioning_status: item.commissioning_status || '',
      subsystem: item.subsystem || '',
      is_sub_equipment: item.is_sub_equipment ? 'Y' : 'N'
    }));
    
    let csvContent = headers.join(',') + '\n';
    
    formattedData.forEach(item => {
      const row = headers.map(header => formatCSVValue(item[header], ','));
      csvContent += row.join(',') + '\n';
    });
    
    const filename = options.filename || `Equipment_List_${dateHelpers?.getDateStamp?.() || 'export'}.csv`;
    downloadCSVFile(csvContent, filename);
    
    return {
      success: true,
      filename: filename,
      recordCount: formattedData.length
    };
    
  } catch (error) {
    console.error('Equipment export failed:', error);
    throw new Error(`Equipment export failed: ${error.message}`);
  }
};

// 🆕 NEW FUNCTION: Missing Equipment Comparison Export - ONLY ADDITION TO EXISTING FILE
export const exportComparisonToCSV = (comparisonResult, options = {}) => {
  try {
    console.log('🆕 MISSING EQUIPMENT COMPARISON EXPORT');
    console.log('Export options:', options);
    
    // Validate input
    if (!comparisonResult || !comparisonResult.export_ready) {
      throw new Error('Invalid comparison result provided - missing export_ready data');
    }
    
    const exportData = comparisonResult.export_ready;
    console.log(`📊 Exporting ${exportData.length} new WBS items`);
    
    // Validate export data format
    if (!Array.isArray(exportData) || exportData.length === 0) {
      throw new Error('No new equipment items to export');
    }
    
    // Check if data is already in P6 format (wbs_code, parent_wbs_code, wbs_name)
    const firstItem = exportData[0];
    if (!firstItem.wbs_code || !firstItem.wbs_name) {
      throw new Error('Export data is not in valid P6 format');
    }
    
    console.log('✅ Export data validation passed');
    console.log('📋 Sample items:', exportData.slice(0, 3).map(item => 
      `${item.wbs_code} | ${item.parent_wbs_code || 'ROOT'} | ${item.wbs_name}`
    ));
    
    // Generate CSV content - data is already in P6 format
    const columns = ['wbs_code', 'parent_wbs_code', 'wbs_name'];
    const delimiter = ',';
    
    let csvContent = '';
    
    // Add headers
    csvContent += columns.join(delimiter) + '\n';
    
    // Add data rows
    exportData.forEach((item, index) => {
      const row = columns.map(column => {
        const value = item[column] || '';
        return formatCSVValue(value, delimiter);
      });
      csvContent += row.join(delimiter) + '\n';
      
      // Log progress for large exports
      if (index % 100 === 0 && index > 0) {
        console.log(`   Generated ${index} rows...`);
      }
    });
    
    // Generate filename
    const filename = options.filename || `Missing_Equipment_${dateHelpers?.getDateStamp?.() || 'export'}.csv`;
    
    // Download file
    downloadCSVFile(csvContent, filename);
    
    console.log('🎉 Missing equipment export completed successfully:', {
      filename: filename,
      recordCount: exportData.length,
      columns: columns.length
    });

    return {
      success: true,
      filename: filename,
      recordCount: exportData.length,
      exportedData: exportData
    };
    
  } catch (error) {
    console.error('❌ Missing equipment export failed:', error);
    throw new Error(`Missing equipment export failed: ${error.message}`);
  }
};

export const getExportStatistics = (data, options = {}) => {
  console.log('CALCULATING EXPORT STATISTICS - BACKWARD COMPATIBLE');
  console.log(`Input data length: ${data?.length || 0}`);
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.log('❌ No data provided or data is not an array');
    return {
      total_items: 0,
      all_y_equipment_items: 0,
      tbc_items: 0,
      structural_items: 0,
      unrecognized_items: 0,
      max_level: 0,
      levels: { level1: 0, level2: 0, level3: 0, level4: 0, level5: 0 }
    };
  }

  // Check if we have rich format (Start New Project) or minimal format (Missing Equipment)
  const hasRichFormat = data.some(item => 
    item.hasOwnProperty('is_equipment') && 
    item.hasOwnProperty('level') && 
    item.hasOwnProperty('commissioning_yn')
  );
  
  console.log(`Data format detected: ${hasRichFormat ? 'RICH (Start New Project)' : 'MINIMAL (XER + Missing Equipment)'}`);

  if (hasRichFormat) {
    // ✅ ORIGINAL LOGIC: Use rich properties for Start New Project
    console.log('Using original rich property logic...');
    
    const stats = {
      total_items: data.length,
      all_y_equipment_items: data.filter(item => item.is_equipment && (item.commissioning_yn === 'Y' || item.commissioning_yn === '')).length,
      tbc_items: data.filter(item => item.is_equipment && item.commissioning_yn === 'TBC').length,
      structural_items: data.filter(item => !item.is_equipment).length,
      unrecognized_items: data.filter(item => item.is_equipment && item.category === '99').length,
      max_level: Math.max(...data.map(item => item.level || 0)),
      levels: {
        level1: data.filter(item => item.level === 1).length,
        level2: data.filter(item => item.level === 2).length,
        level3: data.filter(item => item.level === 3).length,
        level4: data.filter(item => item.level === 4).length,
        level5: data.filter(item => item.level === 5).length
      }
    };
    
    console.log('RICH FORMAT Export Statistics:', stats);
    return stats;
    
  } else {
    // 🔄 FALLBACK LOGIC: Use pattern analysis for Missing Equipment
    console.log('Using pattern analysis fallback logic...');
    
    // Helper function to identify equipment vs structural items from WBS data
    const isEquipmentItem = (item) => {
      // Equipment items have specific patterns in their wbs_name
      const name = item.wbs_name || '';
      
      // Equipment codes start with +, -, or contain specific patterns
      const equipmentPatterns = [
        /^\+[A-Z0-9]+\s*\|/,    // +UH201 | Description
        /^-[A-Z0-9]+\s*\|/,     // -F202 | Description  
        /^[A-Z0-9]+-[0-9]+\s*\|/, // T01-001 | Description
        /^[0-9]+\s*\|/          // Direct equipment numbers
      ];
      
      return equipmentPatterns.some(pattern => pattern.test(name));
    };

    // Helper function to get commissioning status from WBS name
    const getCommissioningStatus = (item) => {
      const name = item.wbs_name || '';
      if (name.toLowerCase().includes('tbc') || name.toLowerCase().includes('to be confirmed')) {
        return 'TBC';
      }
      return isEquipmentItem(item) ? 'Y' : 'N';
    };

    // Helper function to get level from WBS code
    const getLevel = (item) => {
      const code = item.wbs_code || '';
      return code.split('.').length;
    };

    // Helper function to identify category 99 (unrecognized) items
    const isUnrecognizedItem = (item) => {
      const name = item.wbs_name || '';
      return name.includes('99 |') || name.toLowerCase().includes('unrecognized');
    };

    // Calculate statistics using pattern analysis
    const equipmentItems = data.filter(isEquipmentItem);
    const structuralItems = data.filter(item => !isEquipmentItem(item));
    
    const stats = {
      total_items: data.length,
      all_y_equipment_items: equipmentItems.filter(item => {
        const status = getCommissioningStatus(item);
        return status === 'Y' || status === '';
      }).length,
      tbc_items: data.filter(item => getCommissioningStatus(item) === 'TBC').length,
      structural_items: structuralItems.length,
      unrecognized_items: data.filter(isUnrecognizedItem).length,
      max_level: data.length > 0 ? Math.max(...data.map(getLevel)) : 0,
      levels: {
        level1: data.filter(item => getLevel(item) === 1).length,
        level2: data.filter(item => getLevel(item) === 2).length,
        level3: data.filter(item => getLevel(item) === 3).length,
        level4: data.filter(item => getLevel(item) === 4).length,
        level5: data.filter(item => getLevel(item) === 5).length
      }
    };
    
    console.log('PATTERN ANALYSIS Export Statistics:', stats);
    console.log(`Sample equipment items:`, equipmentItems.slice(0, 3).map(item => item.wbs_name));
    console.log(`Sample structural items:`, structuralItems.slice(0, 3).map(item => item.wbs_name));
    
    return stats;
  }
};

// Export validation utilities
export { formatDataForP6, validateExportRequest };import { saveAs } from 'file-saver';
import { EXPORT_SETTINGS } from '../constants';
import { dateHelpers, arrayHelpers, stringHelpers } from '../utils';

/**
 * Enhanced P6 Exporter - CORRECTED for All Y-Status Equipment
 * CORRECT APPROACH:
 * - Handle ALL Y-status equipment (electrical patterns + unrecognized in cat 99)
 * - Handle TBC equipment (all types)
 * - Handle structural items (categories, energisation, etc.)
 * - Proper duplicate detection (only true duplicates, not legitimate equipment)
 * - Clean 3-column P6 format export
 * - Robust hierarchical sorting
 */

// Main export function for WBS structure
export const exportWBSToP6CSV = (wbsData, options = {}) => {
  try {
    console.log('STARTING ENHANCED P6 EXPORT FOR ALL Y-STATUS EQUIPMENT WBS');
    console.log(`Input data: ${wbsData?.length || 0} WBS items`);

    const defaultOptions = {
      filename: null,
      includeNewOnly: false,
      includeHeaders: true,
      format: 'csv'
    };

    const exportOptions = { ...defaultOptions, ...options };

    // Enhanced data filtering and validation
    const filteredData = filterDataForExport(wbsData, exportOptions);
    console.log(`Filtered data: ${filteredData.length} items for export`);

    // Validate export request
    validateExportRequest(filteredData, exportOptions);

    // Enhanced P6 formatting with proper duplicate handling
    const formattedData = formatDataForP6(filteredData);
    console.log(`Formatted data: ${formattedData.data.length} records`);

    // Generate CSV content
    const csvContent = generateCSVContent(formattedData, exportOptions);

    // Generate filename
    const filename = generateFilename(exportOptions.filename, exportOptions.includeNewOnly);

    // Download file
    downloadCSVFile(csvContent, filename);

    console.log('Enhanced export completed successfully:', {
      filename: filename,
      recordCount: formattedData.data.length,
      allYEquipmentItems: formattedData.metadata.all_y_equipment_items,
      tbcItems: formattedData.metadata.tbc_items,
      structuralItems: formattedData.metadata.structural_items,
      unrecognizedItems: formattedData.metadata.unrecognized_items || 0,
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
    console.error('Export failed:', error);
    throw new Error(`Export failed: ${error.message}`);
  }
};

// Enhanced data filtering for export
const filterDataForExport = (wbsData, options) => {
  console.log('ENHANCED DATA FILTERING FOR ALL Y-STATUS EQUIPMENT');
  
  let data = Array.isArray(wbsData) ? 
    wbsData : (wbsData?.wbsStructure || []);
  
  if (data.length === 0) {
    throw new Error('No WBS data provided for export');
  }

  console.log(`Initial data: ${data.length} WBS items`);

  // Filter for new items only if requested
  if (options.includeNewOnly) {
    data = data.filter(item => item.isNew === true);
    console.log(`After new-only filter: ${data.length} items`);
  }

  // Remove any items with invalid WBS codes
  const validData = data.filter(item => item.wbs_code && item.wbs_name);
  
  if (validData.length !== data.length) {
    console.log(`Removed ${data.length - validData.length} items with invalid WBS codes`);
  }

  return validData;
};

// Enhanced P6 format processing with comprehensive duplicate handling
const formatDataForP6 = (wbsData) => {
  console.log('ENHANCED P6 FORMAT PROCESSING');
  console.log(`Input: ${wbsData.length} WBS items`);

  // STEP 1: WBS Structure Validation & Cleaning
  console.log('STEP 1: WBS Structure Validation & Cleaning');
  
  const validatedData = wbsData.filter(item => {
    const hasValidCode = item.wbs_code && isValidWBSCode(item.wbs_code);
    const hasValidName = item.wbs_name && item.wbs_name.trim() !== '';
    
    if (!hasValidCode || !hasValidName) {
      console.log(`   Filtering out invalid item: code="${item.wbs_code}", name="${item.wbs_name}"`);
      return false;
    }
    
    return true;
  });
  
  console.log(`Validated structure: ${validatedData.length} items (filtered out ${wbsData.length - validatedData.length} invalid items)`);

  // STEP 2: Enhanced Duplicate Detection & Removal
  console.log('STEP 2: Enhanced Duplicate Detection & Removal');
  
  const seen = new Set();
  const uniqueData = [];
  let duplicatesRemoved = 0;
  
  validatedData.forEach(item => {
    const key = `${item.wbs_code}|${item.wbs_name}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      uniqueData.push(item);
    } else {
      console.log(`   Removing duplicate: ${item.wbs_code} - ${item.wbs_name}`);
      duplicatesRemoved++;
    }
  });
  
  console.log(`Unique structure: ${uniqueData.length} items`);

  // STEP 3: Enhanced Hierarchical Sorting
  console.log('STEP 3: Enhanced Hierarchical Sorting');
  
  const sortedData = uniqueData.sort((a, b) => {
    const aParts = a.wbs_code.split('.').map(part => parseInt(part) || 0);
    const bParts = b.wbs_code.split('.').map(part => parseInt(part) || 0);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aVal = aParts[i] || 0;
      const bVal = bParts[i] || 0;
      
      if (aVal !== bVal) {
        return aVal - bVal;
      }
    }
    
    return 0;
  });
  
  console.log(`Sample sorted structure:`, sortedData.slice(0, 10));

  // STEP 4: Enhanced P6 Format Conversion
  console.log('STEP 4: Enhanced P6 Format Conversion');
  
  sortedData.forEach((item, index) => {
    if (index < 10) {
      console.log(`   ${index + 1}. ${item.wbs_code} | ${item.parent_wbs_code || 'ROOT'} | ${item.wbs_name}`);
    }
  });
  
  console.log(`P6 formatted data: ${sortedData.length} records`);

  // STEP 5: Comprehensive Export Validation
  console.log('STEP 5: Comprehensive Export Validation');
  const validation = validateP6ExportStructure(sortedData);

  // Calculate export statistics
  const metadata = {
    all_y_equipment_items: sortedData.filter(item => item.is_equipment && (item.commissioning_status === 'Y' || item.commissioning_status === '')).length,
    tbc_items: sortedData.filter(item => item.is_equipment && item.commissioning_status === 'TBC').length,
    structural_items: sortedData.filter(item => !item.is_equipment).length,
    unrecognized_items: sortedData.filter(item => item.is_equipment && item.category === '99').length,
    duplicates_removed: duplicatesRemoved,
    validation: validation
  };

  console.log('Enhanced Export Summary:');
  console.log(`   Total Records: ${sortedData.length}`);
  console.log(`   Duplicates Removed: ${duplicatesRemoved}`);
  console.log(`   Level Distribution: ${getLevelDistribution(sortedData)}`);
  console.log(`   Validation Status: ${validation.isValid ? 'PASSED' : 'FAILED'}`);

  return {
    data: sortedData.map(item => ({
      wbs_code: cleanWBSCode(item.wbs_code),
      parent_wbs_code: cleanWBSCode(item.parent_wbs_code || ''),
      wbs_name: cleanWBSName(item.wbs_name)
    })),
    columns: ['wbs_code', 'parent_wbs_code', 'wbs_name'],
    metadata: metadata
  };
};

// Helper function to get level distribution
const getLevelDistribution = (data) => {
  const distribution = {};
  for (let i = 1; i <= 5; i++) {
    distribution[`level${i}`] = data.filter(item => item.level === i).length;
  }
  return distribution;
};

// Enhanced P6 export validation
const validateP6ExportStructure = (data) => {
  console.log('COMPREHENSIVE P6 EXPORT VALIDATION');
  
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    statistics: {
      total_records: data.length,
      unique_wbs_codes: 0,
      root_records: 0,
      records_with_parents: 0,
      max_level: 0
    }
  };

  const wbsCodes = new Set();
  
  data.forEach((item, index) => {
    // Validate WBS code
    if (!item.wbs_code || !isValidWBSCode(item.wbs_code)) {
      validation.errors.push(`Invalid WBS code at row ${index + 1}: "${item.wbs_code}"`);
      validation.isValid = false;
    } else {
      wbsCodes.add(item.wbs_code);
    }

    // Validate WBS name
    if (!item.wbs_name || item.wbs_name.trim() === '') {
      validation.errors.push(`Empty WBS name at row ${index + 1}`);
      validation.isValid = false;
    }

    // Count records with parents
    if (item.parent_wbs_code && item.parent_wbs_code !== '') {
      validation.statistics.records_with_parents++;
    } else {
      validation.statistics.root_records++;
    }

    // Track max level
    if (item.level && item.level > validation.statistics.max_level) {
      validation.statistics.max_level = item.level;
    }
  });

  validation.statistics.unique_wbs_codes = wbsCodes.size;

  // Check for orphaned items
  data.forEach(item => {
    if (item.parent_wbs_code && item.parent_wbs_code !== '' && !wbsCodes.has(item.parent_wbs_code)) {
      validation.warnings.push(`Orphaned item: ${item.wbs_code} references missing parent ${item.parent_wbs_code}`);
    }
  });

  console.log('Validation Statistics:');
  console.log(`   Total Records: ${validation.statistics.total_records}`);
  console.log(`   Unique WBS Codes: ${validation.statistics.unique_wbs_codes}`);
  console.log(`   Root Records: ${validation.statistics.root_records}`);
  console.log(`   Records with Parents: ${validation.statistics.records_with_parents}`);
  console.log(`   Errors: ${validation.errors.length}`);
  console.log(`   Warnings: ${validation.warnings.length}`);

  return validation;
};

// Enhanced export validation
const validateExportRequest = (data, options) => {
  console.log('VALIDATING EXPORT REQUEST');
  
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('No valid WBS data provided for export');
  }

  if (data.length > 50000) {
    throw new Error('Export data too large (>50,000 records). Please filter the data first.');
  }

  const validationResults = validateP6ExportStructure(data);
  
  if (!validationResults.isValid) {
    const errorMessage = `Export validation failed: ${validationResults.errors.join(', ')}`;
    throw new Error(errorMessage);
  }

  console.log(`Export validation: ${validationResults.isValid ? 'PASSED' : 'FAILED'}`);
  console.log(`   Errors: ${validationResults.errors.length}`);
  console.log(`   Warnings: ${validationResults.warnings.length}`);
  
  return validationResults;
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
  console.log('GENERATING ENHANCED CSV CONTENT');
  
  if (!exportData || !exportData.data || exportData.data.length === 0) {
    throw new Error('No export data provided for CSV generation');
  }

  const { data, columns } = exportData;
  const delimiter = EXPORT_SETTINGS?.csv?.delimiter || ',';
  
  console.log(`Generating CSV: ${data.length} records, ${columns.length} columns`);
  
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
      console.log(`   Generated ${index} rows...`);
    }
  });
  
  console.log(`CSV generation complete: ${csvContent.split('\n').length - 1} total lines`);
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

// Enhanced file download
const downloadCSVFile = (csvContent, filename) => {
  try {
    console.log(`Downloading file: ${filename} (${csvContent.length} characters)`);
    
    // Create blob with proper encoding
    const blob = new Blob(['\uFEFF' + csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    // Use FileSaver to download
    saveAs(blob, filename);
    console.log(`File download initiated: ${filename}`);
    
  } catch (error) {
    console.warn('FileSaver failed, using fallback method');
    
    try {
      const encodedUri = encodeURI(`data:text/csv;charset=utf-8,\uFEFF${csvContent}`);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      console.log(`Fallback download completed: ${filename}`);
    } catch (fallbackError) {
      console.error('Both download methods failed:', fallbackError);
      throw new Error(`File download failed: ${fallbackError.message}`);
    }
  }
};

// Additional export functions for other features
export const exportEquipmentListToCSV = (equipmentList, options = {}) => {
  try {
    console.log('EXPORTING EQUIPMENT LIST');
    
    const headers = [
      'equipment_number',
      'description', 
      'category',
      'category_name',
      'commissioning_status',
      'subsystem',
      'is_sub_equipment'
    ];
    
    const formattedData = equipmentList.map(item => ({
      equipment_number: item.equipment_number || '',
      description: item.description || '',
      category: item.category || '',
      category_name: item.category_name || '',
      commissioning_status: item.commissioning_status || '',
      subsystem: item.subsystem || '',
      is_sub_equipment: item.is_sub_equipment ? 'Y' : 'N'
    }));
    
    let csvContent = headers.join(',') + '\n';
    
    formattedData.forEach(item => {
      const row = headers.map(header => formatCSVValue(item[header], ','));
      csvContent += row.join(',') + '\n';
    });
    
    const filename = options.filename || `Equipment_List_${dateHelpers?.getDateStamp?.() || 'export'}.csv`;
    downloadCSVFile(csvContent, filename);
    
    return {
      success: true,
      filename: filename,
      recordCount: formattedData.length
    };
    
  } catch (error) {
    console.error('Equipment export failed:', error);
    throw new Error(`Equipment export failed: ${error.message}`);
  }
};

// 🆕 NEW FUNCTION: Missing Equipment Comparison Export - ONLY ADDITION TO EXISTING FILE
export const exportComparisonToCSV = (comparisonResult, options = {}) => {
  try {
    console.log('🆕 MISSING EQUIPMENT COMPARISON EXPORT');
    console.log('Export options:', options);
    
    // Validate input
    if (!comparisonResult || !comparisonResult.export_ready) {
      throw new Error('Invalid comparison result provided - missing export_ready data');
    }
    
    const exportData = comparisonResult.export_ready;
    console.log(`📊 Exporting ${exportData.length} new WBS items`);
    
    // Validate export data format
    if (!Array.isArray(exportData) || exportData.length === 0) {
      throw new Error('No new equipment items to export');
    }
    
    // Check if data is already in P6 format (wbs_code, parent_wbs_code, wbs_name)
    const firstItem = exportData[0];
    if (!firstItem.wbs_code || !firstItem.wbs_name) {
      throw new Error('Export data is not in valid P6 format');
    }
    
    console.log('✅ Export data validation passed');
    console.log('📋 Sample items:', exportData.slice(0, 3).map(item => 
      `${item.wbs_code} | ${item.parent_wbs_code || 'ROOT'} | ${item.wbs_name}`
    ));
    
    // Generate CSV content - data is already in P6 format
    const columns = ['wbs_code', 'parent_wbs_code', 'wbs_name'];
    const delimiter = ',';
    
    let csvContent = '';
    
    // Add headers
    csvContent += columns.join(delimiter) + '\n';
    
    // Add data rows
    exportData.forEach((item, index) => {
      const row = columns.map(column => {
        const value = item[column] || '';
        return formatCSVValue(value, delimiter);
      });
      csvContent += row.join(delimiter) + '\n';
      
      // Log progress for large exports
      if (index % 100 === 0 && index > 0) {
        console.log(`   Generated ${index} rows...`);
      }
    });
    
    // Generate filename
    const filename = options.filename || `Missing_Equipment_${dateHelpers?.getDateStamp?.() || 'export'}.csv`;
    
    // Download file
    downloadCSVFile(csvContent, filename);
    
    console.log('🎉 Missing equipment export completed successfully:', {
      filename: filename,
      recordCount: exportData.length,
      columns: columns.length
    });

    return {
      success: true,
      filename: filename,
      recordCount: exportData.length,
      exportedData: exportData
    };
    
  } catch (error) {
    console.error('❌ Missing equipment export failed:', error);
    throw new Error(`Missing equipment export failed: ${error.message}`);
  }
};

export const getExportStatistics = (data, options = {}) => {
  console.log('CALCULATING EXPORT STATISTICS - BACKWARD COMPATIBLE');
  console.log(`Input data length: ${data?.length || 0}`);
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    console.log('❌ No data provided or data is not an array');
    return {
      total_items: 0,
      all_y_equipment_items: 0,
      tbc_items: 0,
      structural_items: 0,
      unrecognized_items: 0,
      max_level: 0,
      levels: { level1: 0, level2: 0, level3: 0, level4: 0, level5: 0 }
    };
  }

  // Check if we have rich format (Start New Project) or minimal format (Missing Equipment)
  const hasRichFormat = data.some(item => 
    item.hasOwnProperty('is_equipment') && 
    item.hasOwnProperty('level') && 
    item.hasOwnProperty('commissioning_yn')
  );
  
  console.log(`Data format detected: ${hasRichFormat ? 'RICH (Start New Project)' : 'MINIMAL (XER + Missing Equipment)'}`);

  if (hasRichFormat) {
    // ✅ ORIGINAL LOGIC: Use rich properties for Start New Project
    console.log('Using original rich property logic...');
    
    const stats = {
      total_items: data.length,
      all_y_equipment_items: data.filter(item => item.is_equipment && (item.commissioning_yn === 'Y' || item.commissioning_yn === '')).length,
      tbc_items: data.filter(item => item.is_equipment && item.commissioning_yn === 'TBC').length,
      structural_items: data.filter(item => !item.is_equipment).length,
      unrecognized_items: data.filter(item => item.is_equipment && item.category === '99').length,
      max_level: Math.max(...data.map(item => item.level || 0)),
      levels: {
        level1: data.filter(item => item.level === 1).length,
        level2: data.filter(item => item.level === 2).length,
        level3: data.filter(item => item.level === 3).length,
        level4: data.filter(item => item.level === 4).length,
        level5: data.filter(item => item.level === 5).length
      }
    };
    
    console.log('RICH FORMAT Export Statistics:', stats);
    return stats;
    
  } else {
    // 🔄 FALLBACK LOGIC: Use pattern analysis for Missing Equipment
    console.log('Using pattern analysis fallback logic...');
    
    // Helper function to identify equipment vs structural items from WBS data
    const isEquipmentItem = (item) => {
      // Equipment items have specific patterns in their wbs_name
      const name = item.wbs_name || '';
      
      // Equipment codes start with +, -, or contain specific patterns
      const equipmentPatterns = [
        /^\+[A-Z0-9]+\s*\|/,    // +UH201 | Description
        /^-[A-Z0-9]+\s*\|/,     // -F202 | Description  
        /^[A-Z0-9]+-[0-9]+\s*\|/, // T01-001 | Description
        /^[0-9]+\s*\|/          // Direct equipment numbers
      ];
      
      return equipmentPatterns.some(pattern => pattern.test(name));
    };

    // Helper function to get commissioning status from WBS name
    const getCommissioningStatus = (item) => {
      const name = item.wbs_name || '';
      if (name.toLowerCase().includes('tbc') || name.toLowerCase().includes('to be confirmed')) {
        return 'TBC';
      }
      return isEquipmentItem(item) ? 'Y' : 'N';
    };

    // Helper function to get level from WBS code
    const getLevel = (item) => {
      const code = item.wbs_code || '';
      return code.split('.').length;
    };

    // Helper function to identify category 99 (unrecognized) items
    const isUnrecognizedItem = (item) => {
      const name = item.wbs_name || '';
      return name.includes('99 |') || name.toLowerCase().includes('unrecognized');
    };

    // Calculate statistics using pattern analysis
    const equipmentItems = data.filter(isEquipmentItem);
    const structuralItems = data.filter(item => !isEquipmentItem(item));
    
    const stats = {
      total_items: data.length,
      all_y_equipment_items: equipmentItems.filter(item => {
        const status = getCommissioningStatus(item);
        return status === 'Y' || status === '';
      }).length,
      tbc_items: data.filter(item => getCommissioningStatus(item) === 'TBC').length,
      structural_items: structuralItems.length,
      unrecognized_items: data.filter(isUnrecognizedItem).length,
      max_level: data.length > 0 ? Math.max(...data.map(getLevel)) : 0,
      levels: {
        level1: data.filter(item => getLevel(item) === 1).length,
        level2: data.filter(item => getLevel(item) === 2).length,
        level3: data.filter(item => getLevel(item) === 3).length,
        level4: data.filter(item => getLevel(item) === 4).length,
        level5: data.filter(item => getLevel(item) === 5).length
      }
    };
    
    console.log('PATTERN ANALYSIS Export Statistics:', stats);
    console.log(`Sample equipment items:`, equipmentItems.slice(0, 3).map(item => item.wbs_name));
    console.log(`Sample structural items:`, structuralItems.slice(0, 3).map(item => item.wbs_name));
    
    return stats;
  }
};

// Export validation utilities
export { formatDataForP6, validateExportRequest };

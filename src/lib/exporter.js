import { saveAs } from 'file-saver';
import { EXPORT_SETTINGS } from '../constants';
import { dateHelpers, arrayHelpers, stringHelpers } from '../utils';

/**
 * P6 Exporter - Generates CSV files compatible with Oracle Primavera P6
 */

// Main export function for WBS structure
export const exportWBSToP6CSV = (wbsData, options = {}) => {
  try {
    const defaultOptions = {
      filename: null,
      includeNewOnly: false,
      includeHeaders: true,
      format: 'csv'
    };

    const exportOptions = { ...defaultOptions, ...options };

    // Filter data based on export options
    const filteredData = filterDataForExport(wbsData, exportOptions);

    // Validate data before export
    validateExportData(filteredData);

    // Format data for P6 compatibility
    const formattedData = formatDataForP6(filteredData);

    // Generate CSV content
    const csvContent = generateCSVContent(formattedData, exportOptions);

    // Generate filename
    const filename = generateFilename(exportOptions.filename, exportOptions.includeNewOnly);

    // Download file
    downloadCSVFile(csvContent, filename);

    return {
      success: true,
      filename: filename,
      recordCount: formattedData.length,
      exportedData: formattedData
    };

  } catch (error) {
    throw new Error(`Export failed: ${error.message}`);
  }
};

// Filter data based on export options
const filterDataForExport = (wbsData, options) => {
  let data = Array.isArray(wbsData) ? wbsData : [];

  if (data.length === 0) {
    throw new Error('No data provided for export');
  }

  // Filter for new items only if requested
  if (options.includeNewOnly) {
    data = data.filter(item => item.is_new === true);
    
    if (data.length === 0) {
      throw new Error('No new items found for export');
    }
  }

  // Filter out excluded items (commissioning status 'N')
  data = data.filter(item => 
    !item.commissioning_status || item.commissioning_status !== 'N'
  );

  return data;
};

// Validate export data
const validateExportData = (data) => {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Invalid or empty data for export');
  }

  // Check for required fields
  const requiredFields = ['wbs_code', 'wbs_name'];
  const missingFields = [];

  data.forEach((item, index) => {
    requiredFields.forEach(field => {
      if (!item[field] || item[field].toString().trim() === '') {
        missingFields.push(`Row ${index + 1}: Missing ${field}`);
      }
    });

    // Validate WBS code format
    if (item.wbs_code && !isValidWBSCode(item.wbs_code)) {
      missingFields.push(`Row ${index + 1}: Invalid WBS code format "${item.wbs_code}"`);
    }
  });

  if (missingFields.length > 0) {
    throw new Error(`Data validation failed:\n${missingFields.slice(0, 10).join('\n')}`);
  }
};

// Check if WBS code is valid format
const isValidWBSCode = (wbsCode) => {
  // WBS codes should be numeric with dots (e.g., "1.3.2.1")
  return /^[\d.]+$/.test(wbsCode.toString());
};

// Format data for P6 compatibility
const formatDataForP6 = (data) => {
  return data.map(item => {
    // Clean and format fields for P6
    const formattedItem = {
      wbs_code: cleanWBSCode(item.wbs_code),
      parent_wbs_code: item.parent_wbs_code ? cleanWBSCode(item.parent_wbs_code) : '',
      wbs_name: cleanWBSName(item.wbs_name),
      equipment_number: cleanEquipmentNumber(item.equipment_number),
      description: cleanDescription(item.description),
      commissioning_status: cleanCommissioningStatus(item.commissioning_status)
    };

    // Add optional fields if present
    if (item.level !== undefined) {
      formattedItem.level = item.level;
    }

    if (item.is_equipment !== undefined) {
      formattedItem.is_equipment = item.is_equipment ? 'Y' : 'N';
    }

    if (item.is_new !== undefined) {
      formattedItem.is_new = item.is_new ? 'Y' : 'N';
    }

    return formattedItem;
  });
};

// Clean WBS code for P6 compatibility
const cleanWBSCode = (wbsCode) => {
  if (!wbsCode) return '';
  return wbsCode.toString().trim();
};

// Clean WBS name for P6 compatibility
const cleanWBSName = (wbsName) => {
  if (!wbsName) return '';
  
  // Clean the name while preserving important formatting
  let cleaned = wbsName.toString().trim();
  
  // Remove or replace problematic characters
  cleaned = cleaned.replace(/[""]/g, '"'); // Normalize quotes
  cleaned = cleaned.replace(/\r\n|\r|\n/g, ' '); // Replace line breaks with spaces
  cleaned = cleaned.replace(/\s+/g, ' '); // Normalize multiple spaces
  
  // Truncate if too long (P6 has limits)
  if (cleaned.length > 100) {
    cleaned = cleaned.substring(0, 97) + '...';
  }
  
  return cleaned;
};

// Clean equipment number
const cleanEquipmentNumber = (equipmentNumber) => {
  if (!equipmentNumber) return '';
  return stringHelpers.cleanEquipmentCode(equipmentNumber);
};

// Clean description
const cleanDescription = (description) => {
  if (!description) return '';
  
  let cleaned = description.toString().trim();
  
  // Remove problematic characters
  cleaned = cleaned.replace(/[""]/g, '"');
  cleaned = cleaned.replace(/\r\n|\r|\n/g, ' ');
  cleaned = cleaned.replace(/\s+/g, ' ');
  
  // Truncate if too long
  if (cleaned.length > 255) {
    cleaned = cleaned.substring(0, 252) + '...';
  }
  
  return cleaned;
};

// Clean commissioning status
const cleanCommissioningStatus = (status) => {
  if (!status) return 'Y';
  
  const cleanStatus = status.toString().toUpperCase().trim();
  return ['Y', 'N', 'TBC'].includes(cleanStatus) ? cleanStatus : 'Y';
};

// Generate CSV content
const generateCSVContent = (data, options) => {
  const headers = EXPORT_SETTINGS.csv.headers;
  const delimiter = EXPORT_SETTINGS.csv.delimiter;
  
  let csvContent = '';
  
  // Add headers if requested
  if (options.includeHeaders) {
    csvContent += headers.join(delimiter) + '\n';
  }
  
  // Add data rows
  data.forEach(item => {
    const row = headers.map(header => {
      const value = item[header] || '';
      return formatCSVValue(value, delimiter);
    });
    csvContent += row.join(delimiter) + '\n';
  });
  
  return csvContent;
};

// Format individual CSV value (handle quotes and delimiters)
const formatCSVValue = (value, delimiter) => {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = value.toString();
  
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

// Generate filename with timestamp
const generateFilename = (customFilename, includeNewOnly) => {
  if (customFilename) {
    return customFilename.endsWith('.csv') ? customFilename : `${customFilename}.csv`;
  }
  
  const prefix = EXPORT_SETTINGS.filename.prefix;
  const dateStamp = dateHelpers.getDateStamp();
  const newOnlyTag = includeNewOnly ? '_NewItems' : '';
  
  return `${prefix}${dateStamp}${newOnlyTag}.csv`;
};

// Download CSV file
const downloadCSVFile = (csvContent, filename) => {
  try {
    // Create blob with proper encoding
    const blob = new Blob([csvContent], { 
      type: 'text/csv;charset=utf-8;' 
    });
    
    // Use FileSaver to download
    saveAs(blob, filename);
    
  } catch (error) {
    // Fallback for browsers that don't support FileSaver
    const encodedUri = encodeURI(`data:text/csv;charset=utf-8,${csvContent}`);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

// Export equipment list (for debugging or separate use)
export const exportEquipmentListToCSV = (equipmentList, options = {}) => {
  try {
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
      parent_equipment: item.parent_equipment || ''
    }));
    
    let csvContent = '';
    
    // Add headers
    csvContent += headers.join(',') + '\n';
    
    // Add data
    formattedData.forEach(item => {
      const row = headers.map(header => formatCSVValue(item[header], ','));
      csvContent += row.join(',') + '\n';
    });
    
    const filename = options.filename || `Equipment_List_${dateHelpers.getDateStamp()}.csv`;
    downloadCSVFile(csvContent, filename);
    
    return {
      success: true,
      filename: filename,
      recordCount: formattedData.length
    };
    
  } catch (error) {
    throw new Error(`Equipment export failed: ${error.message}`);
  }
};

// Export comparison results (for Missing Equipment feature)
export const exportComparisonToCSV = (comparisonResult, options = {}) => {
  try {
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
    
    const filename = options.filename || `Equipment_Changes_${dateHelpers.getDateStamp()}.csv`;
    downloadCSVFile(csvContent, filename);
    
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

// Validate export before processing
export const validateExportRequest = (data, options) => {
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
  const missingWBSCodes = data.filter(item => !item.wbs_code);
  if (missingWBSCodes.length > 0) {
    validation.warnings.push(`${missingWBSCodes.length} items missing WBS codes`);
  }
  
  // Check for long names that will be truncated
  const longNames = data.filter(item => 
    item.wbs_name && item.wbs_name.length > 100
  );
  if (longNames.length > 0) {
    validation.warnings.push(`${longNames.length} WBS names will be truncated`);
  }
  
  return validation;
};

// Get export statistics
export const getExportStatistics = (data, options = {}) => {
  const stats = {
    total_items: data.length,
    new_items: data.filter(item => item.is_new === true).length,
    equipment_items: data.filter(item => item.is_equipment === true).length,
    category_items: data.filter(item => item.is_category === true).length,
    max_level: Math.max(...data.map(item => item.level || 0)),
    commissioning_status: {
      Y: data.filter(item => item.commissioning_status === 'Y').length,
      TBC: data.filter(item => item.commissioning_status === 'TBC').length,
      N: data.filter(item => item.commissioning_status === 'N').length
    }
  };
  
  if (options.includeNewOnly) {
    stats.export_count = stats.new_items;
  } else {
    stats.export_count = data.filter(item => 
      !item.commissioning_status || item.commissioning_status !== 'N'
    ).length;
  }
  
  return stats;
};

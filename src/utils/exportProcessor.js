import { saveAs } from 'file-saver';
import { P6_EXPORT_HEADERS } from './constants.js';
import { flattenWBSStructure } from './wbsProcessor.js';

/**
 * Export Processing Utilities for P6 Integration
 */

/**
 * Export WBS structure to P6-compatible CSV
 * @param {Object} wbsStructure - Hierarchical WBS structure
 * @param {string} filename - Export filename
 * @param {Object} options - Export options
 */
export function exportToP6CSV(wbsStructure, filename = 'wbs_export.csv', options = {}) {
  try {
    // Flatten the hierarchical structure
    const flatData = flattenWBSStructure(wbsStructure);
    
    // Filter based on options
    let exportData = flatData;
    
    if (options.newItemsOnly) {
      exportData = flatData.filter(item => item.is_new);
    }
    
    if (options.excludeRoot) {
      exportData = exportData.filter(item => item.level > 0);
    }

    // Format data for P6
    const formattedData = exportData.map(item => ({
      wbs_code: item.wbs_code || '',
      parent_wbs_code: item.parent_wbs_code || '',
      wbs_name: item.wbs_name || '',
      wbs_short_name: item.wbs_short_name || extractShortName(item.wbs_name)
    }));

    // Generate CSV content
    const csvContent = generateCSVContent(formattedData, P6_EXPORT_HEADERS);
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, filename);
    
    console.log(`Exported ${formattedData.length} WBS items to ${filename}`);
    return { success: true, count: formattedData.length };
    
  } catch (error) {
    console.error('Export error:', error);
    throw new Error(`Export failed: ${error.message}`);
  }
}

/**
 * Generate CSV content from data array
 * @param {Array} data - Data to export
 * @param {Array} headers - Column headers
 * @returns {string} CSV content string
 */
export function generateCSVContent(data, headers) {
  // Create header row
  const headerRow = headers.join(',');
  
  // Create data rows
  const dataRows = data.map(item => {
    return headers.map(header => {
      let value = item[header] || '';
      
      // Handle values that contain commas or quotes
      if (typeof value === 'string') {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = `"${value.replace(/"/g, '""')}"`;
        }
      }
      
      return value;
    }).join(',');
  });
  
  // Combine header and data
  return [headerRow, ...dataRows].join('\n');
}

/**
 * Extract short name from full WBS name
 * @param {string} fullName - Full WBS name
 * @returns {string} Short name
 */
function extractShortName(fullName) {
  if (!fullName) return '';
  
  // If name contains " | ", take the first part
  const parts = fullName.split(' | ');
  return parts[0].trim();
}

/**
 * Export equipment list template
 * @param {string} filename - Export filename
 */
export function exportEquipmentTemplate(filename = 'equipment_template.csv') {
  const templateData = [
    {
      equipment_number: 'UH101',
      equipment_name: 'Protection Panel 101',
      commissioning_status: 'Y',
      subsystem: 'Electrical',
      location: 'Switchroom 1',
      plu: ''
    },
    {
      equipment_number: 'UH101-F',
      equipment_name: 'Protection Relay F',
      commissioning_status: 'Y', 
      subsystem: 'Electrical',
      location: 'Switchroom 1',
      plu: ''
    },
    {
      equipment_number: 'T10',
      equipment_name: 'Main Transformer',
      commissioning_status: 'Y',
      subsystem: 'Power',
      location: 'Transformer Bay',
      plu: ''
    },
    {
      equipment_number: 'WC101',
      equipment_name: 'LV Distribution Board',
      commissioning_status: 'TBC',
      subsystem: 'LV System',
      location: 'Electrical Room',
      plu: ''
    }
  ];

  const headers = [
    'equipment_number',
    'equipment_name', 
    'commissioning_status',
    'subsystem',
    'location',
    'plu'
  ];

  const csvContent = generateCSVContent(templateData, headers);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, filename);
  
  return { success: true, count: templateData.length };
}

/**
 * Export changes report (added/removed equipment)
 * @param {Object} changes - Changes object with added/removed arrays
 * @param {string} filename - Export filename
 */
export function exportChangesReport(changes, filename = 'equipment_changes.csv') {
  const reportData = [];
  
  // Add new equipment
  changes.added?.forEach(item => {
    reportData.push({
      change_type: 'ADDED',
      equipment_number: item.equipment_number,
      equipment_name: item.equipment_name,
      commissioning_status: item.commissioning_status,
      subsystem: item.subsystem,
      notes: 'New equipment to be added to WBS'
    });
  });
  
  // Add removed equipment
  changes.removed?.forEach(item => {
    reportData.push({
      change_type: 'REMOVED', 
      equipment_number: item.equipment_number,
      equipment_name: item.equipment_name,
      commissioning_status: item.commissioning_status,
      subsystem: item.subsystem,
      notes: 'Equipment removed from latest list'
    });
  });

  const headers = [
    'change_type',
    'equipment_number',
    'equipment_name',
    'commissioning_status',
    'subsystem',
    'notes'
  ];

  const csvContent = generateCSVContent(reportData, headers);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, filename);
  
  return { 
    success: true, 
    added: changes.added?.length || 0,
    removed: changes.removed?.length || 0
  };
}

/**
 * Export WBS structure for visualization/backup
 * @param {Object} wbsStructure - WBS structure
 * @param {string} filename - Export filename
 * @param {string} format - Export format ('csv' or 'json')
 */
export function exportWBSStructure(wbsStructure, filename = 'wbs_structure', format = 'csv') {
  try {
    if (format === 'json') {
      const jsonContent = JSON.stringify(wbsStructure, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      saveAs(blob, `${filename}.json`);
      return { success: true, format: 'json' };
    }
    
    // Default CSV export
    const flatData = flattenWBSStructure(wbsStructure);
    const enhancedData = flatData.map(item => ({
      ...item,
      equipment_number: item.equipment_data?.equipment_number || '',
      equipment_name: item.equipment_data?.equipment_name || '',
      commissioning_status: item.equipment_data?.commissioning_status || '',
      category_code: item.category || '',
      is_new: item.is_new ? 'Yes' : 'No'
    }));

    const headers = [
      'wbs_code',
      'parent_wbs_code',
      'wbs_name',
      'wbs_short_name',
      'level',
      'equipment_number',
      'equipment_name',
      'commissioning_status',
      'category_code',
      'is_new'
    ];

    const csvContent = generateCSVContent(enhancedData, headers);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, `${filename}.csv`);
    
    return { success: true, count: enhancedData.length, format: 'csv' };
    
  } catch (error) {
    console.error('WBS structure export error:', error);
    throw new Error(`Export failed: ${error.message}`);
  }
}

/**
 * Create export summary report
 * @param {Object} wbsStructure - WBS structure
 * @param {Object} stats - Export statistics
 * @returns {string} Summary report content
 */
export function createExportSummary(wbsStructure, stats = {}) {
  const flatData = flattenWBSStructure(wbsStructure);
  
  // Calculate statistics
  const totalItems = flatData.length;
  const newItems = flatData.filter(item => item.is_new).length;
  const categories = [...new Set(flatData.map(item => item.category).filter(Boolean))];
  const maxLevel = Math.max(...flatData.map(item => item.level));

  const summary = `
WBS Export Summary Report
========================

Project: ${wbsStructure.name || 'Unknown Project'}
Export Date: ${new Date().toISOString().split('T')[0]}
Export Time: ${new Date().toLocaleTimeString()}

Structure Statistics:
- Total WBS Items: ${totalItems}
- New Items: ${newItems}
- Maximum Levels: ${maxLevel + 1}
- Categories: ${categories.length}

Category Breakdown:
${categories.map(cat => {
  const count = flatData.filter(item => item.category === cat).length;
  return `- ${cat}: ${count} items`;
}).join('\n')}

Export Options:
- New Items Only: ${stats.newItemsOnly ? 'Yes' : 'No'}
- Include Root: ${stats.excludeRoot ? 'No' : 'Yes'}
- Format: CSV (P6 Compatible)

Files Generated:
- WBS Structure CSV
${stats.changesReport ? '- Equipment Changes Report' : ''}
${stats.backupStructure ? '- WBS Structure Backup' : ''}

Notes:
- Import this CSV into P6 using the WBS import function
- Ensure parent WBS codes exist before importing child items
- Review any items marked as 'Unrecognised Equipment'
  `;

  return summary.trim();
}

/**
 * Export complete project package
 * @param {Object} wbsStructure - WBS structure
 * @param {Object} options - Export options
 * @param {string} projectName - Project name for filenames
 */
export function exportProjectPackage(wbsStructure, options = {}, projectName = 'project') {
  try {
    const timestamp = new Date().toISOString().split('T')[0];
    const baseFilename = `${projectName}_${timestamp}`;
    
    // Main P6 export
    exportToP6CSV(
      wbsStructure, 
      `${baseFilename}_p6_import.csv`,
      options
    );
    
    // Backup structure if requested
    if (options.includeBackup) {
      exportWBSStructure(
        wbsStructure,
        `${baseFilename}_structure_backup`,
        'csv'
      );
    }
    
    // Export summary
    const summary = createExportSummary(wbsStructure, options);
    const summaryBlob = new Blob([summary], { type: 'text/plain;charset=utf-8;' });
    saveAs(summaryBlob, `${baseFilename}_summary.txt`);
    
    // Export template if requested
    if (options.includeTemplate) {
      exportEquipmentTemplate(`${baseFilename}_equipment_template.csv`);
    }
    
    return { 
      success: true, 
      files: [
        `${baseFilename}_p6_import.csv`,
        `${baseFilename}_summary.txt`,
        ...(options.includeBackup ? [`${baseFilename}_structure_backup.csv`] : []),
        ...(options.includeTemplate ? [`${baseFilename}_equipment_template.csv`] : [])
      ]
    };
    
  } catch (error) {
    console.error('Project package export error:', error);
    throw new Error(`Project package export failed: ${error.message}`);
  }
}

export default {
  exportToP6CSV,
  generateCSVContent,
  exportEquipmentTemplate,
  exportChangesReport,
  exportWBSStructure,
  createExportSummary,
  exportProjectPackage
};

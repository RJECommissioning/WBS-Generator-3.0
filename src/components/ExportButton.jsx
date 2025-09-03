import React, { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  FormControlLabel,
  FormLabel,
  RadioGroup,
  Radio,
  Checkbox,
  TextField,
  Typography,
  Box,
  Alert,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress
} from '@mui/material';
import {
  FileDownload,
  TableChart,
  CheckCircle,
  NewReleases,
  Description,
  Close,
  Info
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import useProjectStore from '../store/projectStore';
import { BRAND_COLORS } from '../constants';
import { exportWBSToP6CSV, exportEquipmentListToCSV, exportComparisonToCSV, validateExportRequest, getExportStatistics } from '../lib/exporter';
import { dateHelpers } from '../utils';

// Styled components with brand colors
const StyledButton = styled(Button)(({ theme, variant }) => ({
  backgroundColor: variant === 'contained' ? BRAND_COLORS.accent : 'transparent',
  color: variant === 'contained' ? BRAND_COLORS.white : BRAND_COLORS.accent,
  borderColor: BRAND_COLORS.accent,
  '&:hover': {
    backgroundColor: variant === 'contained' ? BRAND_COLORS.level5 : `${BRAND_COLORS.accent}10`,
    borderColor: BRAND_COLORS.level5
  },
  '&:disabled': {
    backgroundColor: BRAND_COLORS.level2,
    color: BRAND_COLORS.white
  }
}));

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    minWidth: '500px',
    maxWidth: '700px'
  }
}));

const ExportButton = ({ 
  variant = 'contained',
  size = 'medium',
  disabled = false,
  exportType = 'wbs',
  includeNewOnly = false,
  customLabel = null,
  onExportComplete = null,
  data  // ADD THIS LINE
}) => {
  // Store hooks
  const { 
    project, 
    comparison, 
    prepareExport,
    setLoading,
    setError,
    setSuccess
  } = useProjectStore();

  // Local state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exportOptions, setExportOptions] = useState({
    format: 'csv',
    includeHeaders: true,
    includeNewOnly: includeNewOnly,
    filename: '',
    exportType: exportType
  });
  const [isExporting, setIsExporting] = useState(false);

// canExport function - SEPARATE function
const canExport = () => {
  if (exportOptions.exportType === 'comparison') {
    return data?.export_ready?.length > 0;
  }
  
  const exportData = getExportData();
  return Array.isArray(exportData) && exportData.length > 0;
};

// getExportData function - SEPARATE function  
const getExportData = () => {
  switch (exportOptions.exportType) {
    case 'wbs':
      return project.wbs_structure || [];
    case 'equipment':
      return project.equipment_list || [];
    case 'comparison':
      return data?.export_ready || []; // Also update this line per Change 2
    default:
      return [];
  }
};

    const getStats = () => {
      const exportData = getExportData();
      
      if (exportOptions.exportType === 'comparison') {
        const exportCount = exportData.length;
        return {
          total_items: exportCount,
          new_items: exportCount,
          removed_items: 0,
          modified_items: 0,
          export_count: exportCount
        };
      } else {
        return getExportStatistics(exportData, exportOptions);
      }
    };

  // Handle export dialog open
  const handleDialogOpen = () => {
    // Generate default filename
    const typePrefix = exportOptions.exportType === 'wbs' ? 'WBS' : 
                      exportOptions.exportType === 'equipment' ? 'Equipment' : 'Changes';
    const newOnlyTag = exportOptions.includeNewOnly ? '_NewItems' : '';
    const defaultFilename = `${typePrefix}_Export_${dateHelpers.getDateStamp()}${newOnlyTag}`;
    
    setExportOptions(prev => ({
      ...prev,
      filename: defaultFilename
    }));
    
    setDialogOpen(true);
  };

  // Handle export execution
  const handleExport = async () => {
    try {
      setIsExporting(true);
      setLoading(true);

      const data = getExportData();
      
      // Validate export request
      const validation = validateExportRequest(data, exportOptions);
      if (!validation.isValid) {
        setError(`Export validation failed: ${validation.errors.join(', ')}`);
        return;
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        console.warn('Export warnings:', validation.warnings);
      }

      let exportResult;

      // Execute export based on type
      switch (exportOptions.exportType) {
        case 'wbs':
          exportResult = await exportWBSToP6CSV(data, {
            filename: exportOptions.filename + '.csv',
            includeNewOnly: exportOptions.includeNewOnly,
            includeHeaders: exportOptions.includeHeaders
          });
          break;

        case 'equipment':
          exportResult = await exportEquipmentListToCSV(data, {
            filename: exportOptions.filename + '.csv'
          });
          break;

        case 'comparison':
          const csvData = data?.export_ready || [];
          
          if (csvData.length === 0) {
            throw new Error('No data available for export');
          }
          
          const headers = ['wbs_code', 'parent_wbs_code', 'wbs_name'];
          const csvContent = [
            exportOptions.includeHeaders ? headers.join(',') : null,
            ...csvData.map(item => [
              item.wbs_code || '',
              item.parent_wbs_code || '',
              item.wbs_name || ''
            ].join(','))
          ].filter(row => row !== null).join('\n');
          
          const blob = new Blob([csvContent], { type: 'text/csv' });
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = exportOptions.filename + '.csv';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          
          exportResult = {
            filename: exportOptions.filename + '.csv',
            recordCount: csvData.length,
            success: true
          };
          break;

        default:
          throw new Error('Invalid export type');
      }

      // Handle success
      setSuccess(`Export completed successfully! Downloaded ${exportResult.recordCount} items.`);
      setDialogOpen(false);

      if (onExportComplete) {
        onExportComplete(exportResult);
      }

    } catch (error) {
      setError(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
      setLoading(false);
    }
  };

  // Handle option changes
  const handleOptionChange = (field, value) => {
    setExportOptions(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Get button label
  const getButtonLabel = () => {
    if (customLabel) return customLabel;
    
    const typeLabels = {
      wbs: 'Export WBS',
      equipment: 'Export Equipment',
      comparison: 'Export Changes'
    };
    
    return typeLabels[exportType] || 'Export';
  };

  // Render export preview
  const renderExportPreview = () => {
    const stats = getStats();
    
    return (
      <Box sx={{ mt: 2, p: 2, backgroundColor: `${BRAND_COLORS.level1}20`, borderRadius: 1 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
          Export Preview
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Chip 
            label={`${stats.export_count || stats.total_items} items to export`} 
            color="primary" 
            size="small" 
          />
          {stats.new_items > 0 && (
            <Chip 
              label={`${stats.new_items} new items`} 
              sx={{ backgroundColor: BRAND_COLORS.accent, color: BRAND_COLORS.white }}
              size="small" 
            />
          )}
          {exportOptions.format && (
            <Chip 
              label={exportOptions.format.toUpperCase()} 
              color="default" 
              size="small" 
            />
          )}
        </Box>

        {/* Export type specific info */}
        {exportOptions.exportType === 'comparison' && (
          <List dense>
            {stats.new_items > 0 && (
              <ListItem sx={{ py: 0 }}>
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <NewReleases fontSize="small" color="success" />
                </ListItemIcon>
                <ListItemText 
                  primary={`${stats.new_items} added items`}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            )}
            {stats.removed_items > 0 && (
              <ListItem sx={{ py: 0 }}>
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <Close fontSize="small" color="error" />
                </ListItemIcon>
                <ListItemText 
                  primary={`${stats.removed_items} removed items`}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            )}
            {stats.modified_items > 0 && (
              <ListItem sx={{ py: 0 }}>
                <ListItemIcon sx={{ minWidth: 30 }}>
                  <Description fontSize="small" color="warning" />
                </ListItemIcon>
                <ListItemText 
                  primary={`${stats.modified_items} modified items`}
                  primaryTypographyProps={{ variant: 'body2' }}
                />
              </ListItem>
            )}
          </List>
        )}
      </Box>
    );
  };

  return (
    <>
      {/* Export Button */}
      <StyledButton
        variant={variant}
        size={size}
        disabled={disabled || !canExport() || isExporting}
        onClick={handleDialogOpen}
        startIcon={isExporting ? <CircularProgress size={16} /> : <FileDownload />}
      >
        {isExporting ? 'Exporting...' : getButtonLabel()}
      </StyledButton>

      {/* Export Options Dialog */}
      <StyledDialog
        open={dialogOpen}
        onClose={() => !isExporting && setDialogOpen(false)}
        maxWidth="md"
      >
        <DialogTitle sx={{ 
          backgroundColor: `${BRAND_COLORS.level1}30`,
          color: BRAND_COLORS.text
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TableChart sx={{ color: BRAND_COLORS.accent }} />
            Export Options
          </Box>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          {/* Export Type */}
          <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
            <FormLabel component="legend" sx={{ color: BRAND_COLORS.text, fontWeight: 600 }}>
              Export Type
            </FormLabel>
            <RadioGroup
              value={exportOptions.exportType}
              onChange={(e) => handleOptionChange('exportType', e.target.value)}
              row
            >
              <FormControlLabel 
                value="wbs" 
                control={<Radio sx={{ color: BRAND_COLORS.accent }} />} 
                label="WBS Structure (P6 Compatible)" 
              />
              <FormControlLabel 
                value="equipment" 
                control={<Radio sx={{ color: BRAND_COLORS.accent }} />} 
                label="Equipment List" 
              />
             {(data?.export_ready?.length > 0) && (
                <FormControlLabel 
                  value="comparison" 
                  control={<Radio sx={{ color: BRAND_COLORS.accent }} />} 
                  label="New Equipment (P6 Compatible)" 
                />
              )}
            </RadioGroup>
          </FormControl>

          <Divider sx={{ my: 2 }} />

          {/* Export Options */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: BRAND_COLORS.text }}>
              Export Settings
            </Typography>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Include headers */}
              <FormControlLabel
                control={
                  <Checkbox
                    checked={exportOptions.includeHeaders}
                    onChange={(e) => handleOptionChange('includeHeaders', e.target.checked)}
                    sx={{ color: BRAND_COLORS.accent }}
                  />
                }
                label="Include column headers"
              />

              {/* New items only */}
              {(exportOptions.exportType === 'wbs' || exportOptions.exportType === 'comparison') && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={exportOptions.includeNewOnly}
                      onChange={(e) => handleOptionChange('includeNewOnly', e.target.checked)}
                      sx={{ color: BRAND_COLORS.accent }}
                    />
                  }
                  label="Export new items only"
                />
              )}

              {/* Filename */}
              <TextField
                label="Filename (without extension)"
                value={exportOptions.filename}
                onChange={(e) => handleOptionChange('filename', e.target.value)}
                fullWidth
                size="small"
                helperText="File will be saved as .csv format"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    '&:hover fieldset': {
                      borderColor: BRAND_COLORS.level3
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: BRAND_COLORS.accent
                    }
                  }
                }}
              />
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Export Preview */}
          {renderExportPreview()}

          {/* P6 Compatibility Info */}
          {exportOptions.exportType === 'wbs' && (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                <strong>P6 Import:</strong> This CSV format is compatible with Oracle Primavera P6. 
                Use the WBS import function in P6 to import this structure.
              </Typography>
            </Alert>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 3, backgroundColor: `${BRAND_COLORS.background}` }}>
          <Button 
            onClick={() => setDialogOpen(false)}
            disabled={isExporting}
            sx={{ color: BRAND_COLORS.text }}
          >
            Cancel
          </Button>
          <StyledButton
            onClick={handleExport}
            variant="contained"
            disabled={isExporting || !exportOptions.filename.trim()}
            startIcon={isExporting ? <CircularProgress size={16} /> : <CheckCircle />}
          >
            {isExporting ? 'Exporting...' : 'Export'}
          </StyledButton>
        </DialogActions>
      </StyledDialog>
    </>
  );
};

export default ExportButton;

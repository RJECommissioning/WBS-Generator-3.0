import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  LinearProgress,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  CloudUpload,
  Description,
  CheckCircle,
  Error,
  Warning,
  Delete,
  Info
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import useProjectStore from '../store/projectStore';
import { BRAND_COLORS } from '../constants';
import { fileHelpers } from '../utils';

// Styled components with brand colors
const StyledPaper = styled(Paper)(({ theme, isDragActive, hasError }) => ({
  padding: theme.spacing(3),
  textAlign: 'center',
  border: `2px dashed ${
    hasError 
      ? theme.palette.error.main 
      : isDragActive 
        ? BRAND_COLORS.accent 
        : BRAND_COLORS.level3
  }`,
  backgroundColor: isDragActive ? `${BRAND_COLORS.level1}20` : BRAND_COLORS.background,
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  '&:hover': {
    borderColor: BRAND_COLORS.accent,
    backgroundColor: `${BRAND_COLORS.level1}30`
  }
}));

const StyledButton = styled(Button)(({ theme }) => ({
  backgroundColor: BRAND_COLORS.level4,
  color: BRAND_COLORS.white,
  '&:hover': {
    backgroundColor: BRAND_COLORS.accent
  }
}));

const FileUpload = ({ 
  uploadType, 
  accept = '.csv,.xlsx,.xls,.xer',
  title = 'Upload File',
  description = 'Click to browse or drag and drop your file here',
  maxSizeMB = 50,
  onFileProcessed = null,
  disabled = false
}) => {
  // Store hooks
  const { 
    uploads, 
    uploadFile, 
    clearFileUpload, 
    setError, 
    setSuccess 
  } = useProjectStore();

  // Local state
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Get upload state for this specific upload type
  const uploadState = uploads[uploadType] || {
    file: null,
    status: 'idle',
    error: null,
    data: [],
    validation: null
  };

  // Handle file selection
  const handleFileSelect = async (file) => {
    try {
      if (!file) return;

      // Validate file
      const validation = validateFile(file);
      if (!validation.isValid) {
        setError(validation.errors.join(', '));
        return;
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        console.warn('File upload warnings:', validation.warnings);
      }

      // Upload and process file
      // Don't process the file here - just store it for later processing
useProjectStore.setState(state => ({
  uploads: {
    ...state.uploads,
    [uploadType]: {
      file: file,
      status: 'success',
      error: null,
      data: [],
      validation: null
    }
  }
}));
const result = { file, status: 'success' };
      
      if (file && onFileProcessed) {
        onFileProcessed(file);
      }

      setSuccess(`File "${file.name}" uploaded successfully!`);

    } catch (error) {
      setError(`Upload failed: ${error.message}`);
    }
  };

  // Enhanced file validation for CSV and Excel files
  const validateFile = (file) => {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Check file type
    const fileExtension = fileHelpers.getFileExtension(file.name).toLowerCase();
    const supportedExtensions = ['csv', 'xlsx', 'xls', 'xer', 'txt'];
    
    if (!supportedExtensions.includes(fileExtension)) {
      validation.errors.push(`Invalid file type ".${fileExtension}". Please upload a CSV, Excel (.xlsx/.xls), or XER file.`);
      validation.isValid = false;
    }

    // Additional validation for specific file types
    if (fileExtension === 'csv') {
      // For CSV files, check if they might actually be Excel files
      if (file.type === 'application/vnd.ms-excel' || 
          file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        validation.warnings.push('This appears to be an Excel file with .csv extension. Please use .xlsx extension for best results.');
      }
    }

    if (fileExtension === 'xls') {
      validation.warnings.push('Old Excel format (.xls) detected. For best compatibility, consider using .xlsx format.');
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      validation.errors.push(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds limit of ${maxSizeMB}MB.`);
      validation.isValid = false;
    }

    // Check for suspiciously small files
    if (file.size < 100) {
      validation.warnings.push('File seems very small. Please ensure it contains equipment data.');
    }

    // Check file name
    if (file.name.length > 100) {
      validation.warnings.push('File name is very long and may be truncated.');
    }

    // Check for special characters in filename that might cause issues
    if (/[<>:"/\\|?*]/.test(file.name)) {
      validation.warnings.push('File name contains special characters that may cause issues.');
    }

    return validation;
  };

  // Handle drag and drop events
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Handle click to open file dialog
  const handleClick = () => {
    if (disabled || uploadState.status === 'uploading') return;
    fileInputRef.current?.click();
  };

  // Handle file input change
  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Clear uploaded file
  const handleClearFile = () => {
    clearFileUpload(uploadType);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Get status color
  const getStatusColor = () => {
    switch (uploadState.status) {
      case 'success': return 'success';
      case 'error': return 'error';
      case 'uploading': return 'info';
      default: return 'default';
    }
  };

  // Get status icon
  const getStatusIcon = () => {
    switch (uploadState.status) {
      case 'success': return <CheckCircle />;
      case 'error': return <Error />;
      case 'uploading': return <CloudUpload />;
      default: return <Description />;
    }
  };

  // Get file type display name
  const getFileTypeDisplay = (filename) => {
    const extension = fileHelpers.getFileExtension(filename).toLowerCase();
    switch (extension) {
      case 'xlsx': return 'Excel';
      case 'xls': return 'Excel (Legacy)';
      case 'csv': return 'CSV';
      case 'xer': return 'XER';
      default: return extension.toUpperCase();
    }
  };

  return (
    <Box sx={{ width: '100%', mb: 3 }}>
      {/* Main upload area */}
      <StyledPaper
        isDragActive={isDragActive}
        hasError={uploadState.status === 'error'}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        elevation={isDragActive ? 8 : 2}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
          disabled={disabled}
        />

        {/* Upload content */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          {/* Upload icon */}
          <CloudUpload 
            sx={{ 
              fontSize: 48, 
              color: uploadState.status === 'error' ? 'error.main' : BRAND_COLORS.level4,
              opacity: disabled ? 0.5 : 1
            }} 
          />

          {/* Title and description */}
          <Box>
            <Typography variant="h6" sx={{ color: BRAND_COLORS.text, mb: 1 }}>
              {title}
            </Typography>
            <Typography variant="body2" sx={{ color: BRAND_COLORS.text, opacity: 0.7 }}>
              {description}
            </Typography>
          </Box>

          {/* Upload button */}
          <StyledButton
            variant="contained"
            disabled={disabled || uploadState.status === 'uploading'}
          >
            {uploadState.status === 'uploading' ? 'Uploading...' : 'Choose File'}
          </StyledButton>

          {/* File type info */}
          <Typography variant="caption" sx={{ color: BRAND_COLORS.text, opacity: 0.6 }}>
            Supported formats: CSV, Excel (.xlsx/.xls), XER • Max size: {maxSizeMB}MB
          </Typography>
        </Box>
      </StyledPaper>

      {/* Progress bar */}
      {uploadState.status === 'uploading' && (
        <Box sx={{ mt: 2 }}>
          <LinearProgress 
            sx={{
              backgroundColor: `${BRAND_COLORS.level1}50`,
              '& .MuiLinearProgress-bar': {
                backgroundColor: BRAND_COLORS.accent
              }
            }}
          />
          <Typography variant="caption" sx={{ mt: 1, display: 'block', textAlign: 'center' }}>
            Processing file...
          </Typography>
        </Box>
      )}

      {/* File information */}
      {uploadState.file && (
        <Box sx={{ mt: 2 }}>
          <Paper 
            elevation={1} 
            sx={{ 
              p: 2, 
              backgroundColor: uploadState.status === 'success' 
                ? `${BRAND_COLORS.level1}30` 
                : `${BRAND_COLORS.background}`
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {getStatusIcon()}
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    {uploadState.file.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {(uploadState.file.size / 1024).toFixed(1)} KB • {getFileTypeDisplay(uploadState.file.name)}
                  </Typography>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip 
                  label={uploadState.status}
                  color={getStatusColor()}
                  size="small"
                  icon={getStatusIcon()}
                />
                <Tooltip title="Remove file">
                  <IconButton size="small" onClick={handleClearFile}>
                    <Delete />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          </Paper>
        </Box>
      )}

      {/* Validation results */}
      {uploadState.validation && (
        <Box sx={{ mt: 2 }}>
          {/* Success message */}
          {uploadState.validation.isValid && (
            <Alert 
              severity="success" 
              sx={{ mb: 1 }}
              icon={<CheckCircle />}
            >
              File processed successfully! Found {uploadState.validation.totalItems} equipment items.
            </Alert>
          )}

          {/* Errors */}
          {uploadState.validation.errors && uploadState.validation.errors.length > 0 && (
            <Alert severity="error" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Errors found:
              </Typography>
              <List dense>
                {uploadState.validation.errors.slice(0, 5).map((error, index) => (
                  <ListItem key={index} sx={{ py: 0 }}>
                    <ListItemIcon sx={{ minWidth: 20 }}>
                      <Error fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={error}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
                {uploadState.validation.errors.length > 5 && (
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText 
                      primary={`... and ${uploadState.validation.errors.length - 5} more errors`}
                      primaryTypographyProps={{ variant: 'body2', style: { fontStyle: 'italic' } }}
                    />
                  </ListItem>
                )}
              </List>
            </Alert>
          )}

          {/* Warnings */}
          {uploadState.validation.warnings && uploadState.validation.warnings.length > 0 && (
            <Alert severity="warning" sx={{ mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Warnings:
              </Typography>
              <List dense>
                {uploadState.validation.warnings.slice(0, 3).map((warning, index) => (
                  <ListItem key={index} sx={{ py: 0 }}>
                    <ListItemIcon sx={{ minWidth: 20 }}>
                      <Warning fontSize="small" />
                    </ListItemIcon>
                    <ListItemText 
                      primary={warning}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
                {uploadState.validation.warnings.length > 3 && (
                  <ListItem sx={{ py: 0 }}>
                    <ListItemText 
                      primary={`... and ${uploadState.validation.warnings.length - 3} more warnings`}
                      primaryTypographyProps={{ variant: 'body2', style: { fontStyle: 'italic' } }}
                    />
                  </ListItem>
                )}
              </List>
            </Alert>
          )}
        </Box>
      )}

      {/* Error message */}
      {uploadState.error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {uploadState.error}
        </Alert>
      )}

      {/* Upload tips */}
      {uploadState.status === 'idle' && (
        <Box sx={{ mt: 2 }}>
          <Alert severity="info" icon={<Info />}>
            <Typography variant="body2">
              <strong>Tips:</strong> Ensure your file has proper headers and equipment codes. 
              CSV and Excel files should contain columns like 'equipment_number', 'description', etc. 
              Excel files (.xlsx) are recommended for best compatibility.
            </Typography>
          </Alert>
        </Box>
      )}
    </Box>
  );
};

export default FileUpload;

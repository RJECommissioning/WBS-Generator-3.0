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
  accept = '.csv,.xer',
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

      // Upload and process file
      const result = await uploadFile(uploadType, file);
      
      if (result && onFileProcessed) {
        onFileProcessed(result);
      }

      setSuccess(`File "${file.name}" uploaded successfully!`);

    } catch (error) {
      setError(`Upload failed: ${error.message}`);
    }
  };

  // Validate file before upload
  const validateFile = (file) => {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Check file type
    if (!fileHelpers.isValidFile(file)) {
      validation.errors.push('Invalid file type. Please upload a CSV or XER file.');
      validation.isValid = false;
    }

    // Check file size
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      validation.errors.push(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds limit of ${maxSizeMB}MB.`);
      validation.isValid = false;
    }

    // Check file name
    if (file.name.length > 100) {
      validation.warnings.push('File name is very long and may be truncated.');
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
            Supported formats: {accept} • Max size: {maxSizeMB}MB
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
                    {(uploadState.file.size / 1024).toFixed(1)} KB • {fileHelpers.getFileExtension(uploadState.file.name).toUpperCase()}
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
              File processed successfully! Found {uploadState.validation.totalItems} items.
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
              CSV files should contain columns like 'equipment_number' and 'description'.
            </Typography>
          </Alert>
        </Box>
      )}
    </Box>
  );
};

export default FileUpload;

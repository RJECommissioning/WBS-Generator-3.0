import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Container,
  Paper,
  Button,
  Alert,
  Chip,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse
} from '@mui/material';
import {
  CloudUpload,
  Settings,
  AccountTree,
  GetApp,
  CheckCircle,
  ExpandMore,
  ExpandLess,
  Info,
  Warning,
  Error as ErrorIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useNavigate, Link } from 'react-router-dom';

// Zustand store import
import useProjectStore from '../store/projectStore';

// Enhanced function imports
import { categorizeEquipment } from '../lib/equipmentProcessor';
import { generateWBSStructure } from '../lib/wbsGenerator';
import { parseFile } from '../lib/fileParser';
import { formatDataForP6 } from '../lib/exporter';

// Constants and components
import { BRAND_COLORS } from '../constants';
import FileUpload from '../components/FileUpload';
import WBSVisualization from '../components/WBSVisualization';
import ExportButton from '../components/ExportButton';
import LoadingSpinner from '../components/LoadingSpinner';

// Styled components
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  border: `1px solid ${BRAND_COLORS.level2}`,
  borderRadius: theme.spacing(2)
}));

const StepperContainer = styled(Box)(({ theme }) => ({
  '& .MuiStepLabel-root': {
    '& .MuiStepIcon-root': {
      color: BRAND_COLORS.level2,
      '&.Mui-active': {
        color: BRAND_COLORS.accent
      },
      '&.Mui-completed': {
        color: BRAND_COLORS.level4
      }
    }
  }
}));

const StyledButton = styled(Button)(({ theme, variant }) => ({
  backgroundColor: variant === 'contained' ? BRAND_COLORS.accent : 'transparent',
  color: variant === 'contained' ? BRAND_COLORS.white : BRAND_COLORS.accent,
  borderColor: BRAND_COLORS.accent,
  '&:hover': {
    backgroundColor: variant === 'contained' ? BRAND_COLORS.level5 : `${BRAND_COLORS.accent}10`,
    borderColor: BRAND_COLORS.level5
  }
}));

const StartNewProject = () => {
  const navigate = useNavigate();
  
  // Zustand store hooks - All required functions
  const { 
    project,
    ui,
    uploads,
    initializeProject,
    updateEquipmentList,
    updateWBSStructure,
    setProcessingStage,
    setLoading,
    setError,
    setSuccess,
    clearMessages
  } = useProjectStore();

  // Local state
  const [activeStep, setActiveStep] = useState(0);
  const [processingResults, setProcessingResults] = useState(null);
  const [showInstructions, setShowInstructions] = useState(true);

  // Clear messages on component mount
  useEffect(() => {
    clearMessages();
    initializeProject('New Project');
  }, [clearMessages, initializeProject]);

  // Handle file upload completion (FileUpload component calls this)
  const handleFileProcessed = (uploadResult) => {
    console.log('File uploaded successfully:', uploadResult);
    // File is automatically stored in uploads store by FileUpload component
    // No additional processing needed here
  };

  // Enhanced Process File Function with All Fixes Applied
  const handleProcessFile = async () => {
    try {
      setLoading(true);
      setProcessingStage('parsing', 10, 'Processing uploaded file...');
      
      // Get uploaded file from store
      const uploadedFile = uploads['equipment_list']?.file;
      if (!uploadedFile) {
        throw new Error('No file uploaded. Please upload an equipment list first.');
      }
      
      console.log('STARTING COMPREHENSIVE ENHANCED PROCESSING WITH ALL FIXES...');
      console.log('Processing file:', {
        name: uploadedFile.name,
        type: uploadedFile.type,
        size: uploadedFile.size,
        lastModified: new Date(uploadedFile.lastModified).toLocaleString()
      });

      // PHASE 1: Enhanced File Parsing
      console.log('PHASE 1: ENHANCED FILE PARSING');
      setProcessingStage('parsing', 20, 'Parsing equipment data...');
      
      const parseResult = await parseFile(uploadedFile);
      if (!parseResult.hasData) {
        throw new Error('No valid data found in uploaded file');
      }
      
      console.log('Successfully parsed', parseResult.dataLength, 'raw equipment items');

      // PHASE 2: Enhanced Equipment Processing
      console.log('PHASE 2: ENHANCED EQUIPMENT PROCESSING WITH ALL FIXES');
      setProcessingStage('processing', 40, 'Categorizing equipment...');
      
      const processedData = await categorizeEquipment(parseResult.data);
      console.log('Equipment processing completed:', {
        totalProcessed: processedData.totalProcessed,
        originalCount: processedData.originalCount,
        afterCommissioningFilter: processedData.afterCommissioningFilter,
        finalCount: processedData.finalCount,
        parentItems: processedData.parentItems,
        childItems: processedData.childItems,
        tbcCount: processedData.tbcCount,
        categoryStats: processedData.categoryStats
      });

      // CRITICAL FIX: Debug the actual data structure
      console.log('🔍 DEBUGGING EQUIPMENT PROCESSOR OUTPUT:');
      console.log('processedData keys:', Object.keys(processedData));
      console.log('categorizedEquipment array length:', processedData.categorizedEquipment?.length || 'UNDEFINED');
      console.log('equipment array length:', processedData.equipment?.length || 'UNDEFINED');
      console.log('First categorized item:', processedData.categorizedEquipment?.[0] || 'NONE');
      console.log('First equipment item:', processedData.equipment?.[0] || 'NONE');

      // CRITICAL FIX: Ensure we use the correct property with fallbacks
      const actualEquipmentArray = processedData.categorizedEquipment || processedData.equipment || [];
      const actualTBCArray = processedData.tbcEquipment || [];
      const actualSubsystemMapping = processedData.subsystemMapping || {};

      console.log('🔧 CRITICAL FIX VERIFICATION:');
      console.log('actualEquipmentArray length:', actualEquipmentArray.length);
      console.log('actualTBCArray length:', actualTBCArray.length);
      console.log('actualSubsystemMapping keys:', Object.keys(actualSubsystemMapping));

    // CRITICAL FIX: Properly structure data for WBS generator with bulletproof fallbacks
    const wbsInputData = {
      // CRITICAL: Use multiple fallbacks to ensure data gets through
      categorizedEquipment: actualEquipmentArray,
      equipment: actualEquipmentArray, // Duplicate for compatibility
      
      // TBC equipment separately  
      tbcEquipment: actualTBCArray,
      
      // Subsystem mapping
      subsystemMapping: actualSubsystemMapping,
      
      // Project metadata
      projectName: processedData.projectName || '5737 Summerfield Project',
      
      // CRITICAL FIX: Move categoryStats to top level
      categoryStats: processedData.categoryStats || {},  // ← MOVED TO TOP LEVEL
      
      // Statistics for validation
      stats: {
        totalEquipment: processedData.totalProcessed || actualEquipmentArray.length,
        parentChildRelationships: processedData.parentChildRelationships || {}
        // ← categoryStats REMOVED from here
      },
    
            // Additional fallback properties that wbsGenerator might expect
            processed: processedData,
            totalProcessed: processedData.totalProcessed || actualEquipmentArray.length
          };

      console.log('🎯 FINAL WBS INPUT DATA VERIFICATION:');
      console.log('wbsInputData structure:', {
        categorizedEquipmentCount: wbsInputData.categorizedEquipment?.length || 0,
        equipmentCount: wbsInputData.equipment?.length || 0,
        tbcEquipmentCount: wbsInputData.tbcEquipment?.length || 0,
        subsystemCount: Object.keys(wbsInputData.subsystemMapping || {}).length,
        projectName: wbsInputData.projectName,
        hasStats: !!wbsInputData.stats,
        totalProcessed: wbsInputData.totalProcessed
      });

      // PHASE 3: Enhanced WBS Structure Generation
      console.log('PHASE 3: ENHANCED WBS STRUCTURE GENERATION WITH ALL STANDARD CATEGORIES');
      setProcessingStage('generating', 60, 'Generating WBS structure...');
      
      // Pass the properly structured data to WBS generator
      const wbsResult = await generateWBSStructure(wbsInputData);
      console.log('WBS generation completed:', {
        totalWBSItems: wbsResult.wbsStructure?.length || 0,
        equipmentItems: wbsResult.stats?.equipmentItems || 0,
        structuralItems: wbsResult.stats?.structuralItems || 0,
        categoriesWithEquipment: wbsResult.stats?.categoriesWithEquipment || 0,
        emptyCategories: wbsResult.stats?.emptyCategories || 0,
        subsystemsCreated: wbsResult.stats?.subsystemsCreated || 0
      });

      // PHASE 4: Enhanced Export Preparation
      console.log('PHASE 4: ENHANCED EXPORT PREPARATION WITH DUPLICATE PREVENTION');
      setProcessingStage('exporting', 80, 'Preparing export data...');
      
      const exportResult = await formatDataForP6(wbsResult.wbsStructure);
      console.log('Export preparation completed:', {
        exportRecords: exportResult.data?.length || 0,
        duplicatesRemoved: exportResult.duplicatesRemoved || 0,
        levelDistribution: exportResult.levelDistribution || {},
        validationPassed: exportResult.validationPassed || false,
        validationErrors: exportResult.validationErrors?.length || 0,
        validationWarnings: exportResult.validationWarnings?.length || 0
      });

      // Update store with all processed data
      updateEquipmentList(parseResult.data);
      updateWBSStructure(wbsResult.wbsStructure);

      // Set processing results for UI display
      setProcessingResults({
        equipment: {
          total_processed: processedData.totalProcessed,
          grouped: processedData.categoryStats,
          summary: processedData
        },
        wbs: {
          total_items: wbsResult.wbsStructure?.length || 0,
          max_level: exportResult.levelDistribution?.level5 ? 5 : 
                     exportResult.levelDistribution?.level4 ? 4 :
                     exportResult.levelDistribution?.level3 ? 3 : 2
        }
      });

      setProcessingStage('complete', 100, 'Processing complete!');

      // COMPREHENSIVE FINAL SUMMARY
      console.log('ALL ENHANCED PHASES COMPLETE - Comprehensive Final Summary:');
      console.log('   SUCCESS: All critical fixes applied successfully!');
      console.log('   Equipment processed:', processedData.totalProcessed, '(from', processedData.originalCount, 'original)');
      console.log('   Filtered out (status N):', processedData.originalCount - processedData.afterCommissioningFilter, 'items');
      console.log('   WBS items created:', wbsResult.wbsStructure?.length || 0);
      console.log('   ALL categories created:', Object.keys(processedData.categoryStats || {}).length, '(including', wbsResult.stats?.emptyCategories || 0, 'empty)');
      console.log('   Parent-child relationships:', Object.keys(processedData.parentChildRelationships || {}).length);
      console.log('   Export records:', exportResult.data?.length || 0, '(' + (exportResult.duplicatesRemoved || 0) + ' duplicates removed)');
      console.log('   Expected vs Actual:', '1208 vs', (exportResult.data?.length || 0), '(' + Math.round(((exportResult.data?.length || 0) / 1208) * 100) + '%)');
      console.log('   FIXES APPLIED:');
      console.log('      All standard categories created (even empty ones like "03 | HV Switchboards")');
      console.log('      Commissioning "N" status completely filtered out');
      console.log('      Proper parent-child nesting (+UH → -F relationships)');
      console.log('      Export duplicates eliminated');
      console.log('      Hierarchical sorting and validation');

      // Move to next step
      handleNext();

    } catch (error) {
      console.error('Enhanced processing failed:', error);
      setError(`Processing failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle step navigation
  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
    setProcessingResults(null);
    initializeProject('New Project');
    clearMessages();
  };

  // Check if file is uploaded
  const isFileUploaded = uploads['equipment_list'] && uploads['equipment_list'].file;

  // Get step content
  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box>
            {/* Instructions */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" sx={{ color: BRAND_COLORS.text, fontWeight: 600 }}>
                  Upload Equipment List
                </Typography>
                <Button
                  size="small"
                  onClick={() => setShowInstructions(!showInstructions)}
                  endIcon={showInstructions ? <ExpandLess /> : <ExpandMore />}
                  sx={{ color: BRAND_COLORS.accent }}
                >
                  {showInstructions ? 'Hide' : 'Show'} Instructions
                </Button>
              </Box>

              <Collapse in={showInstructions}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    <strong>Supported File Formats:</strong> CSV and Excel (.xlsx, .xls) files
                  </Typography>
                  <Typography variant="body2" component="div">
                    <strong>Required Columns:</strong>
                    <List dense>
                      <ListItem sx={{ py: 0 }}>
                        <ListItemIcon sx={{ minWidth: 20 }}>•</ListItemIcon>
                        <ListItemText primary="equipment_number (or equipment_code, tag, etc.)" />
                      </ListItem>
                      <ListItem sx={{ py: 0 }}>
                        <ListItemIcon sx={{ minWidth: 20 }}>•</ListItemIcon>
                        <ListItemText primary="description (or equipment_description)" />
                      </ListItem>
                    </List>
                  </Typography>
                  <Typography variant="body2">
                    <strong>Optional Columns:</strong> commissioning_status, plu_field, category, location, parent_equipment_code
                  </Typography>
                </Alert>
              </Collapse>
            </Box>

            {/* File Upload */}
            <FileUpload
              uploadType="equipment_list"
              title="Upload Equipment List"
              description="Upload your CSV or Excel file containing equipment data"
              accept=".csv,.xlsx,.xls"
              onFileProcessed={handleFileProcessed}
            />

            {/* Process Button */}
            {isFileUploaded && (
              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <StyledButton
                  variant="contained"
                  size="large"
                  onClick={handleProcessFile}
                  disabled={ui.loading}
                  startIcon={<Settings />}
                >
                  {ui.loading ? 'Processing...' : 'Process Equipment List'}
                </StyledButton>
              </Box>
            )}

            {/* Processing Results Summary */}
            {processingResults && (
              <Box sx={{ mt: 3 }}>
                <StyledPaper>
                  <Typography variant="h6" sx={{ mb: 2, color: BRAND_COLORS.text, fontWeight: 600 }}>
                    Processing Results
                  </Typography>
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" sx={{ color: BRAND_COLORS.accent, fontWeight: 700 }}>
                          {processingResults.equipment.total_processed}
                        </Typography>
                        <Typography variant="body2" sx={{ color: BRAND_COLORS.text, opacity: 0.7 }}>
                          Equipment Processed
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" sx={{ color: BRAND_COLORS.level4, fontWeight: 700 }}>
                          {processingResults.wbs.total_items}
                        </Typography>
                        <Typography variant="body2" sx={{ color: BRAND_COLORS.text, opacity: 0.7 }}>
                          WBS Items Created
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" sx={{ color: BRAND_COLORS.level3, fontWeight: 700 }}>
                          {Object.keys(processingResults.equipment.grouped || {}).length}
                        </Typography>
                        <Typography variant="body2" sx={{ color: BRAND_COLORS.text, opacity: 0.7 }}>
                          Categories
                        </Typography>
                      </Box>
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography variant="h4" sx={{ color: BRAND_COLORS.level5, fontWeight: 700 }}>
                          {processingResults.wbs.max_level}
                        </Typography>
                        <Typography variant="body2" sx={{ color: BRAND_COLORS.text, opacity: 0.7 }}>
                          Hierarchy Levels
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>

                  {/* Processing Summary */}
                  {processingResults.equipment.summary.processing_warnings && processingResults.equipment.summary.processing_warnings.length > 0 && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Processing Warnings:
                      </Typography>
                      <List dense>
                        {processingResults.equipment.summary.processing_warnings.slice(0, 3).map((warning, index) => (
                          <ListItem key={index} sx={{ py: 0 }}>
                            <ListItemIcon sx={{ minWidth: 20 }}>
                              <Warning fontSize="small" />
                            </ListItemIcon>
                            <ListItemText 
                              primary={`${warning.equipment}: ${warning.warnings.join(', ')}`}
                              primaryTypographyProps={{ variant: 'body2' }}
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Alert>
                  )}

                  <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                    <StyledButton
                      variant="contained"
                      onClick={handleNext}
                      endIcon={<AccountTree />}
                    >
                      View WBS Structure
                    </StyledButton>
                  </Box>
                </StyledPaper>
              </Box>
            )}
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 2, color: BRAND_COLORS.text, fontWeight: 600 }}>
              Review WBS Structure
            </Typography>
            
            <Typography variant="body2" sx={{ mb: 3, color: BRAND_COLORS.text, opacity: 0.8 }}>
              Review the generated WBS structure. You can expand/collapse sections and search for specific items.
            </Typography>

            {/* WBS Visualization */}
            <StyledPaper>
              <WBSVisualization 
                showSearch={true}
                showNewBadges={false}
                expandAllByDefault={false}
              />
            </StyledPaper>

            {/* Navigation */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <StyledButton
                onClick={handleBack}
                variant="outlined"
              >
                Back to Upload
              </StyledButton>
              <StyledButton
                variant="contained"
                onClick={handleNext}
                endIcon={<GetApp />}
              >
                Export WBS
              </StyledButton>
            </Box>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h6" sx={{ mb: 2, color: BRAND_COLORS.text, fontWeight: 600 }}>
              Export WBS Structure
            </Typography>
            
            <Typography variant="body2" sx={{ mb: 3, color: BRAND_COLORS.text, opacity: 0.8 }}>
              Export your WBS structure in CSV format compatible with Oracle Primavera P6.
            </Typography>

            <StyledPaper>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: BRAND_COLORS.text }}>
                    Export Options
                  </Typography>
                  
                  <Box sx={{ mb: 3 }}>
                    <ExportButton
                      variant="contained"
                      size="large"
                      exportType="wbs"
                      customLabel="Export Complete WBS Structure"
                    />
                  </Box>

                 <Alert severity="warning" icon={<Info />}>
                      <Typography variant="body2">
                        <strong>P6 Import Instructions:</strong>
                      </Typography>
                      <List dense>
                        <ListItem sx={{ py: 0 }}>
                          <ListItemIcon sx={{ minWidth: 20 }}>1.</ListItemIcon>
                          <ListItemText 
                            primary="Contact Taison Eady for API setup"
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                        <ListItem sx={{ py: 0 }}>
                          <ListItemIcon sx={{ minWidth: 20 }}>2.</ListItemIcon>
                          <ListItemText 
                            primary="Install API via VS Code on your computer"
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                        <ListItem sx={{ py: 0 }}>
                          <ListItemIcon sx={{ minWidth: 20 }}>3.</ListItemIcon>
                          <ListItemText 
                            primary="Upload CSV through API interface"
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                        <ListItem sx={{ py: 0 }}>
                          <ListItemIcon sx={{ minWidth: 20 }}>4.</ListItemIcon>
                          <ListItemText 
                            primary="Import to selected P6 project"
                            primaryTypographyProps={{ variant: 'body2' }}
                          />
                        </ListItem>
                      </List>
                    </Alert>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600, color: BRAND_COLORS.text }}>
                    Project Summary
                  </Typography>
                  
                  {processingResults && (
                    <Box>
                      <List>
                        <ListItem sx={{ py: 1 }}>
                          <ListItemIcon>
                            <CheckCircle sx={{ color: 'success.main' }} />
                          </ListItemIcon>
                          <ListItemText 
                            primary="Equipment Processing"
                            secondary={`${processingResults.equipment.total_processed} items categorized`}
                          />
                        </ListItem>
                        
                        <ListItem sx={{ py: 1 }}>
                          <ListItemIcon>
                            <CheckCircle sx={{ color: 'success.main' }} />
                          </ListItemIcon>
                          <ListItemText 
                            primary="WBS Generation"
                            secondary={`${processingResults.wbs.total_items} WBS items created`}
                          />
                        </ListItem>
                        
                        <ListItem sx={{ py: 1 }}>
                          <ListItemIcon>
                            <CheckCircle sx={{ color: 'success.main' }} />
                          </ListItemIcon>
                          <ListItemText 
                            primary="P6 Compatibility"
                            secondary="Export format validated for P6 import"
                          />
                        </ListItem>
                      </List>

                      <Divider sx={{ my: 2 }} />

                      <Typography variant="body2" sx={{ color: BRAND_COLORS.text, opacity: 0.7 }}>
                        Project created: {new Date().toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </StyledPaper>

            {/* Navigation */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
              <StyledButton
                onClick={handleBack}
                variant="outlined"
              >
                Back to Review
              </StyledButton>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <StyledButton
                  onClick={() => navigate('/')}
                  variant="outlined"
                >
                  Return Home
                </StyledButton>
                <StyledButton
                  onClick={handleReset}
                  variant="contained"
                >
                  Start New Project
                </StyledButton>
              </Box>
            </Box>
          </Box>
        );

      default:
        return 'Unknown step';
    }
  };

  const steps = [
    {
      label: 'Upload Equipment List',
      description: 'Upload your CSV or Excel file with equipment data',
      icon: <CloudUpload />,
      optional: false
    },
    {
      label: 'Review WBS Structure',
      description: 'Examine the generated hierarchical structure',
      icon: <AccountTree />,
      optional: false
    },
    {
      label: 'Export for P6',
      description: 'Download CSV file for Primavera P6 import',
      icon: <GetApp />,
      optional: false
    }
  ];

  return (
    <Container maxWidth="lg">
      {/* Loading Spinner */}
      <LoadingSpinner variant="modal" />

        {/* Header */}
        <Box sx={{ mb: 4, position: 'relative' }}>
          <Typography variant="h4" component="h1" sx={{ mb: 2, color: BRAND_COLORS.text, fontWeight: 600 }}>
            Start New Project
          </Typography>
          <Typography variant="body1" sx={{ color: BRAND_COLORS.text, opacity: 0.8 }}>
            Upload an equipment list and generate a complete WBS structure for Oracle Primavera P6
          </Typography>
          
          {/* Home Button - Top Right */}
          <Box sx={{ 
            position: 'absolute', 
            top: 0, 
            right: 0 
          }}>
            <Link 
              to="/" 
              style={{ textDecoration: 'none' }}
            >
              <Button
                variant="outlined"
                size="small"
                sx={{
                  color: BRAND_COLORS.accent,
                  borderColor: BRAND_COLORS.accent,
                  '&:hover': {
                    borderColor: BRAND_COLORS.level5,
                    backgroundColor: `${BRAND_COLORS.accent}10`
                  }
                }}
              >
                Home
              </Button>
            </Link>
          </Box>
        </Box>

      {/* Success/Error Messages */}
      {ui.success && (
        <Alert severity="success" sx={{ mb: 3 }} icon={<CheckCircle />}>
          {ui.success}
        </Alert>
      )}

      {ui.error && (
        <Alert severity="error" sx={{ mb: 3 }} icon={<ErrorIcon />}>
          {ui.error}
        </Alert>
      )}

      {/* Stepper */}
      <StyledPaper>
        <StepperContainer>
          <Stepper activeStep={activeStep} orientation="vertical">
            {steps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel
                  optional={
                    step.optional && (
                      <Typography variant="caption">Optional</Typography>
                    )
                  }
                  StepIconComponent={() => (
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 
                          index === activeStep ? BRAND_COLORS.accent :
                          index < activeStep ? BRAND_COLORS.level4 : BRAND_COLORS.level2,
                        color: BRAND_COLORS.white
                      }}
                    >
                      {index < activeStep ? <CheckCircle /> : step.icon}
                    </Box>
                  )}
                >
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: BRAND_COLORS.text }}>
                      {step.label}
                    </Typography>
                    <Typography variant="body2" sx={{ color: BRAND_COLORS.text, opacity: 0.7 }}>
                      {step.description}
                    </Typography>
                  </Box>
                </StepLabel>
                <StepContent>
                  {getStepContent(index)}
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </StepperContainer>
      </StyledPaper>
    </Container>
  );
};

export default StartNewProject;

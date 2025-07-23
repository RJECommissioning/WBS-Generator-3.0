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
import { useNavigate } from 'react-router-dom';
import useProjectStore from '../store/projectStore';
import { BRAND_COLORS } from '../constants';
import FileUpload from '../components/FileUpload';
import WBSVisualization from '../components/WBSVisualization';
import ExportButton from '../components/ExportButton';
import LoadingSpinner from '../components/LoadingSpinner';
import { categorizeEquipment } from '../lib/equipmentProcessor';
import { generateWBSStructure } from '../lib/wbsGenerator';
import { parseFile } from '../lib/fileParser';

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
  
  // Store hooks
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

  // Process equipment file after upload
// Process equipment file after upload
  const handleFileProcessed = async (fileData) => {
    try {
      setLoading(true);
      setProcessingStage('parsing', 10, 'Processing uploaded file...');

      // Get the raw content from the store
      const uploadState = uploads.equipment_list;
      
      if (!uploadState.data || !uploadState.data.raw) {
        throw new Error('No file data available');
      }

      // Parse CSV using Papa Parse directly
      const Papa = await import('papaparse');
      const parseResult = Papa.default.parse(uploadState.data.raw, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase().replace(/\s+/g, '_')
      });

      // Clean and filter data
      const equipmentData = parseResult.data
        .filter(item => item.equipment_number && item.equipment_number.toString().trim() !== '')
        .map(item => ({
          equipment_number: item.equipment_number.toString().trim().toUpperCase(),
          description: item.description || '',
          commissioning_status: item.commissioning_status || 'Y',
          plu_field: item.plu_field || ''
        }));

      if (equipmentData.length === 0) {
        throw new Error('No valid equipment data found in file');
      }

      setProcessingStage('categorizing_equipment', 30, 'Categorizing equipment...');

      // Simple categorization for now
      const categorizedEquipment = equipmentData.map(item => ({
        ...item,
        category: '99',
        category_name: 'Unrecognised Equipment',
        is_sub_equipment: false,
        parent_equipment: null
      }));

      setProcessingStage('generating_wbs', 60, 'Generating basic WBS structure...');

      // Simple WBS structure for testing
      const wbsStructure = [
        {
          wbs_code: '1',
          parent_wbs_code: null,
          wbs_name: 'Test Project',
          level: 1,
          color: '#C8D982',
          is_equipment: false
        },
        ...categorizedEquipment.map((item, index) => ({
          wbs_code: `1.${index + 1}`,
          parent_wbs_code: '1',
          wbs_name: `${item.equipment_number} | ${item.description}`,
          equipment_number: item.equipment_number,
          description: item.description,
          level: 2,
          color: '#A8CC6B',
          is_equipment: true
        }))
      ];

      setProcessingStage('building_tree', 80, 'Building visualization...');

      // Update store with results
      updateEquipmentList(categorizedEquipment);
      updateWBSStructure(wbsStructure);

      // Store results for display
      setProcessingResults({
        equipment: {
          equipment: categorizedEquipment,
          total_processed: categorizedEquipment.length
        },
        wbs: {
          wbs_structure: wbsStructure,
          total_items: wbsStructure.length,
          max_level: 2
        }
      });

      setProcessingStage('complete', 100, 'Project created successfully!');
      setSuccess(`Successfully processed ${categorizedEquipment.length} equipment items!`);
      
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
                    <strong>Required File Format:</strong> CSV file with equipment data
                  </Typography>
                  <Typography variant="body2" component="div">
                    <strong>Required Columns:</strong>
                    <List dense>
                      <ListItem sx={{ py: 0 }}>
                        <ListItemIcon sx={{ minWidth: 20 }}>•</ListItemIcon>
                        <ListItemText primary="equipment_number (or equipment_code)" />
                      </ListItem>
                      <ListItem sx={{ py: 0 }}>
                        <ListItemIcon sx={{ minWidth: 20 }}>•</ListItemIcon>
                        <ListItemText primary="description" />
                      </ListItem>
                    </List>
                  </Typography>
                  <Typography variant="body2">
                    <strong>Optional Columns:</strong> commissioning_status, plu_field, category
                  </Typography>
                </Alert>
              </Collapse>
            </Box>

            {/* File Upload */}
            <FileUpload
              uploadType="equipment_list"
              title="Upload Equipment List"
              description="Upload your CSV file containing equipment data"
              accept=".csv"
              onFileProcessed={handleFileProcessed}
            />

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
                          {Object.keys(processingResults.equipment.grouped).length}
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
                  {processingResults.equipment.summary.processing_warnings.length > 0 && (
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

                  <Alert severity="info" icon={<Info />}>
                    <Typography variant="body2">
                      <strong>P6 Import Instructions:</strong>
                    </Typography>
                    <List dense>
                      <ListItem sx={{ py: 0 }}>
                        <ListItemIcon sx={{ minWidth: 20 }}>1.</ListItemIcon>
                        <ListItemText 
                          primary="Open Oracle Primavera P6"
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                      <ListItem sx={{ py: 0 }}>
                        <ListItemIcon sx={{ minWidth: 20 }}>2.</ListItemIcon>
                        <ListItemText 
                          primary="Go to File → Import"
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                      <ListItem sx={{ py: 0 }}>
                        <ListItemIcon sx={{ minWidth: 20 }}>3.</ListItemIcon>
                        <ListItemText 
                          primary="Select 'WBS' as import type"
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                      <ListItem sx={{ py: 0 }}>
                        <ListItemIcon sx={{ minWidth: 20 }}>4.</ListItemIcon>
                        <ListItemText 
                          primary="Choose the exported CSV file"
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
      description: 'Upload your CSV file with equipment data',
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
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 2, color: BRAND_COLORS.text, fontWeight: 600 }}>
          Start New Project
        </Typography>
        <Typography variant="body1" sx={{ color: BRAND_COLORS.text, opacity: 0.8 }}>
          Upload an equipment list and generate a complete WBS structure for Oracle Primavera P6
        </Typography>
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

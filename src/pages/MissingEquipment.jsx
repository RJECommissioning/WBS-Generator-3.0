import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container,
  Paper,
  Button,
  Alert,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  Chip,
  Breadcrumbs,
  Link
} from '@mui/material';
import {
  CloudUpload,
  CheckCircle,
  ExpandMore,
  ExpandLess,
  Info,
  Warning,
  ArrowBack,
  Refresh,
  GetApp,
  Home as HomeIcon,
  NavigateNext
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

import useProjectStore from '../store/projectStore';
import FileUpload from '../components/FileUpload';
import WBSVisualization from '../components/WBSVisualization';
import ExportButton from '../components/ExportButton';
import LoadingSpinner from '../components/LoadingSpinner';
import { parseFile } from '../lib/fileParser';
import { categorizeEquipment } from '../lib/equipmentProcessor';
import { compareEquipmentLists } from '../lib/projectComparer';
import { BRAND_COLORS } from '../constants';

// Styled components matching StartNewProject.jsx
const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  border: `1px solid ${BRAND_COLORS.level2}`,
  borderRadius: theme.spacing(2)
}));

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

const NavigationHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(3),
  padding: theme.spacing(2, 0)
}));

const ProgressStep = styled(Box)(({ theme, isActive, isCompleted }) => ({
  display: 'flex',
  alignItems: 'center',
  flex: 1,
  '& .step-circle': {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing(1),
    backgroundColor: isCompleted ? BRAND_COLORS.level4 : isActive ? BRAND_COLORS.accent : BRAND_COLORS.level2,
    color: BRAND_COLORS.white,
    fontSize: '14px',
    fontWeight: 600
  },
  '& .step-text': {
    color: isActive || isCompleted ? BRAND_COLORS.accent : BRAND_COLORS.text,
    fontWeight: isActive ? 600 : 400
  }
}));

const ProgressDivider = styled(Box)(({ theme }) => ({
  height: 1,
  flex: 1,
  backgroundColor: BRAND_COLORS.level2,
  margin: `0 ${theme.spacing(1)}`
}));

const MissingEquipment = () => {
  console.log('=== MISSING EQUIPMENT PAGE LOADED ===');
  
  // Navigation hook
  const navigate = useNavigate();
  
  // Store state
  const {
    // Missing Equipment specific state
    missingEquipment: {
      existingProject,
      combinedWBS,
      exportData
    },
    // Upload states
    uploads: {
      p6_paste,
      equipment_list
    },
    // UI state
    ui: { processing, error, success },
    // Missing Equipment actions
    setMissingEquipmentExistingProject,
    setMissingEquipmentCombinedWBS,
    setMissingEquipmentExportData,
    resetMissingEquipment,
    // P6 paste actions
    processP6Paste,
    // Generic actions
    setProcessingStage,
    setError,
    setSuccess,
    clearMessages,
    setFileUpload
  } = useProjectStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [debugInfo, setDebugInfo] = useState('');
  const [equipmentFileData, setEquipmentFileData] = useState(null);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [isProcessingReady, setIsProcessingReady] = useState(false);
  const [pasteContent, setPasteContent] = useState('');
  const [showInstructions, setShowInstructions] = useState(true);

  // Debug logging helper
  const addDebugInfo = (message) => {
    console.log('[DEBUG]', message);
    setDebugInfo(prev => prev + '\n' + `[${new Date().toLocaleTimeString()}] ${message}`);
  };

  // Reset state on component mount
  useEffect(() => {
    console.log('Missing Equipment component mounted - resetting state');
    resetMissingEquipment();
    clearMessages();
    setCurrentStep(1);
    setEquipmentFileData(null);
    setComparisonResult(null);
    setIsProcessingReady(false);
  }, []);

  // Check processing readiness
  useEffect(() => {
    const p6Ready = existingProject?.equipmentCodes?.length > 0;
    const equipmentReady = equipmentFileData?.length > 0;
    
    const ready = p6Ready && equipmentReady;
    
    if (ready !== isProcessingReady) {
      console.log('Processing ready state changed:', `P6 ready: ${p6Ready}, Equipment ready: ${equipmentReady ? equipmentFileData.length : null}`);
      setIsProcessingReady(ready);
    }
  }, [existingProject?.equipmentCodes?.length, equipmentFileData?.length, isProcessingReady]);

  // Step 1: Handle P6 data paste
  const handleP6Paste = async (content) => {
    try {
      console.log('=== STARTING P6 PASTE PROCESSING ===');
      addDebugInfo(`Starting P6 paste processing: ${content.length} characters`);
      
      clearMessages();
      setProcessingStage('parsing', 20, 'Processing P6 data...');

      const result = await processP6Paste(content);

      if (result.success) {
        setMissingEquipmentExistingProject(result.data);
        addDebugInfo(`P6 parsing successful! Found ${result.data.wbsStructure.length} WBS items`);
        addDebugInfo(`Project: ${result.data.projectName}`);
        addDebugInfo(`Equipment codes extracted: ${result.data.equipmentCodes.length}`);
        addDebugInfo('P6 data processing completed - ready for next step');
      } else {
        throw new Error(result.error || 'Failed to process P6 data');
      }

    } catch (error) {
      console.error('P6 processing failed:', error);
      addDebugInfo(`P6 processing failed: ${error.message}`);
      setError(`P6 processing failed: ${error.message}`);
      setProcessingStage('error', 0, error.message);
    }
  };

  // Step 2: Handle equipment file upload
  const handleEquipmentFile = async (file) => {
    try {
      console.log('=== STARTING EQUIPMENT FILE UPLOAD ===');
      addDebugInfo(`Starting equipment file upload: ${file.name} (${file.size} bytes)`);
      
      clearMessages();
      setProcessingStage('parsing', 20, 'Parsing equipment file...');

      console.log('Parsing equipment file...');
      const parseResult = await parseFile(file);
      
      if (parseResult.type !== 'equipment_list') {
        throw new Error(`Expected equipment list, got ${parseResult.type}. Please upload an equipment CSV or Excel file.`);
      }

      if (!parseResult.hasData || parseResult.data.length === 0) {
        throw new Error('No equipment data found. Please check the file format.');
      }

      console.log('Equipment parsing successful:', {
        totalEquipment: parseResult.dataLength,
        sampleData: parseResult.data.slice(0, 3)
      });

      addDebugInfo(`Equipment parsing successful! Found ${parseResult.dataLength} equipment items`);

      // Store equipment data locally
      setEquipmentFileData(parseResult.data);
      
      // Update store state for UI display
      setFileUpload('equipment_list', {
        file: file,
        status: 'success',
        error: null,
        data: parseResult.data
      });

      setProcessingStage('complete', 100, 'Equipment file processed successfully!');
      setSuccess(`Equipment file processed successfully! Found ${parseResult.dataLength} equipment items.`);
      
      addDebugInfo('Equipment file processing completed - ready for comparison');
      
    } catch (error) {
      console.error('Equipment parsing failed:', error);
      addDebugInfo(`Equipment parsing failed: ${error.message}`);

      setError(`Equipment parsing failed: ${error.message}`);
      setEquipmentFileData(null);
      setFileUpload('equipment_list', {
        file: file,
        status: 'error',
        error: error.message
      });
      setProcessingStage('error', 0, error.message);
    }
  };

  // Step 3: Process equipment with 3-tier priority logic
  const handleProcessEquipment = async () => {
    try {
      console.log('=== STARTING MANUAL EQUIPMENT PROCESSING ===');
      addDebugInfo('Starting manual equipment processing with 3-tier priority logic');
      
      clearMessages();
      setProcessingStage('comparing', 20, 'Comparing equipment with existing project...');

      // Validate that we have both datasets
      if (!existingProject || !existingProject.wbsStructure || existingProject.wbsStructure.length === 0) {
        throw new Error('No existing project data found. Please ensure P6 data was processed correctly.');
      }

      if (!equipmentFileData || equipmentFileData.length === 0) {
        throw new Error('No equipment data found. Please ensure equipment file was uploaded successfully.');
      }

      console.log('Processing validation passed:', {
        wbsItems: existingProject.wbsStructure.length,
        equipmentCodes: existingProject.equipmentCodes?.length || 0,
        newEquipmentItems: equipmentFileData.length
      });

      addDebugInfo(`Processing validation passed:`);
      addDebugInfo(`- P6 WBS items: ${existingProject.wbsStructure.length}`);
      addDebugInfo(`- P6 equipment codes: ${existingProject.equipmentCodes?.length || 0}`);
      addDebugInfo(`- New equipment items: ${equipmentFileData.length}`);

      setProcessingStage('comparing', 40, 'Running 3-tier priority comparison...');

      // Use the new 3-tier priority comparison logic
      console.log('Using 3-tier priority comparison logic...');
      const comparisonData = await compareEquipmentLists(existingProject, equipmentFileData);
      
      console.log('3-tier priority comparison completed:', {
        newEquipment: comparisonData.comparison.added.length,
        existingEquipment: comparisonData.comparison.existing.length,
        newWBSItems: comparisonData.wbs_assignment?.new_wbs_items?.length || 0,
        exportReady: comparisonData.export_ready?.length || 0
      });

      addDebugInfo(`3-tier priority comparison completed:`);
      addDebugInfo(`- New equipment found: ${comparisonData.comparison.added.length} items`);
      addDebugInfo(`- Existing equipment: ${comparisonData.comparison.existing.length} items`);
      addDebugInfo(`- New WBS items created: ${comparisonData.wbs_assignment?.new_wbs_items?.length || 0}`);
      addDebugInfo(`- Export-ready items: ${comparisonData.export_ready?.length || 0}`);

      // Store comparison results for export
      setComparisonResult(comparisonData);

      if (comparisonData.comparison.added.length === 0) {
        const message = 'No new equipment found. All equipment items already exist in the project.';
        addDebugInfo(message);
        setError(message);
        setProcessingStage('complete', 100, 'Processing complete - no new equipment');
        return;
      }

      setProcessingStage('building', 80, 'Building combined project structure...');

      // Use the enhanced results from new comparison
      const combinedWBS = comparisonData.integrated_structure;
      const exportDataReady = comparisonData.export_ready;

      console.log('Integration completed:', {
        combinedItems: combinedWBS.length,
        exportItems: exportDataReady.length
      });

      addDebugInfo(`Integration completed:`);
      addDebugInfo(`- Combined WBS items: ${combinedWBS.length}`);
      addDebugInfo(`- Export-ready items: ${exportDataReady.length}`);
      
      // Update state with results
      setMissingEquipmentCombinedWBS(combinedWBS);
      setMissingEquipmentExportData(exportDataReady);
      
      setProcessingStage('complete', 100, 'Processing complete!');
      setSuccess(`Successfully processed ${comparisonData.comparison.added.length} new equipment items!`);
      
      addDebugInfo('Manual processing completed successfully!');
      addDebugInfo(`Final structure: ${existingProject.wbsStructure.length} existing + ${exportDataReady.length} new = ${combinedWBS.length} total`);
      
      setCurrentStep(3); // Move to visualization step

    } catch (error) {
      console.error('Manual equipment processing failed:', error);
      addDebugInfo(`Manual processing failed: ${error.message}`);
      setError(`Processing failed: ${error.message}`);
      setProcessingStage('error', 0, error.message);
    }
  };

  // Handle step progression
  const handleConfirmP6Parsing = () => {
    console.log('Confirming P6 parsing, checking conditions...');
    console.log('P6 paste status:', p6_paste.status);
    console.log('Existing project WBS count:', existingProject.wbsStructure?.length || 0);
    
    if (p6_paste.status === 'success' && existingProject.wbsStructure && existingProject.wbsStructure.length > 0) {
      addDebugInfo('P6 parsing confirmed - moving to equipment upload step');
      setCurrentStep(2);
      clearMessages();
    } else {
      addDebugInfo('Cannot proceed - P6 parsing not successful or no WBS data');
      setError('Cannot proceed: P6 data not properly processed or no WBS data found.');
    }
  };

  const handleBackToStep = (step) => {
    console.log(`Going back to step ${step}`);
    addDebugInfo(`Going back to step ${step}`);
    setCurrentStep(step);
    clearMessages();
  };

  const handleReset = () => {
    console.log('Resetting Missing Equipment state');
    addDebugInfo('Resetting all state...');
    resetMissingEquipment();
    setCurrentStep(1);
    setEquipmentFileData(null);
    setComparisonResult(null);
    setIsProcessingReady(false);
    clearMessages();
    setDebugInfo('');
    setPasteContent('');
  };

  // Handle export completion
  const handleExportComplete = (exportResult) => {
    addDebugInfo(`Export completed: ${exportResult.filename} with ${exportResult.recordCount} items`);
    setSuccess(`Export completed successfully! Downloaded ${exportResult.recordCount} items.`);
  };

  // Render progress indicator
  const renderProgressIndicator = () => (
    <Box sx={{ mb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <ProgressStep isActive={currentStep === 1} isCompleted={currentStep > 1}>
          <div className="step-circle">1</div>
          <Typography variant="body2" className="step-text">Paste P6 WBS Data</Typography>
        </ProgressStep>
        <ProgressDivider />
        <ProgressStep isActive={currentStep === 2} isCompleted={currentStep > 2}>
          <div className="step-circle">2</div>
          <Typography variant="body2" className="step-text">Upload Equipment List</Typography>
        </ProgressStep>
        <ProgressDivider />
        <ProgressStep isActive={currentStep === 3} isCompleted={currentStep > 3}>
          <div className="step-circle">3</div>
          <Typography variant="body2" className="step-text">Review & Export</Typography>
        </ProgressStep>
      </Box>
    </Box>
  );

  return (
    <Container maxWidth="lg">
      {/* Loading Spinner */}
      <LoadingSpinner variant="modal" />

      {/* Navigation Header */}
      <NavigationHeader>
        <Breadcrumbs separator={<NavigateNext fontSize="small" />} sx={{ color: BRAND_COLORS.text }}>
          <Link 
            component="button"
            variant="body2"
            onClick={() => navigate('/')}
            sx={{ 
              display: 'flex', 
              alignItems: 'center',
              color: BRAND_COLORS.accent,
              textDecoration: 'none',
              '&:hover': { textDecoration: 'underline' }
            }}
          >
            <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
            Home
          </Link>
          <Typography variant="body2" sx={{ color: BRAND_COLORS.text }}>
            Missing Equipment
          </Typography>
        </Breadcrumbs>
        
        <StyledButton
          variant="outlined"
          startIcon={<HomeIcon />}
          onClick={() => navigate('/')}
        >
          Home
        </StyledButton>
      </NavigationHeader>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ mb: 2, color: BRAND_COLORS.text, fontWeight: 600 }}>
          Missing Equipment
        </Typography>
        <Typography variant="body1" sx={{ color: BRAND_COLORS.text, opacity: 0.8 }}>
          Add new equipment to an existing P6 project with intelligent WBS code assignment
        </Typography>
      </Box>

      {/* Progress Indicator */}
      {renderProgressIndicator()}

      {/* Success/Error Messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} icon={<Warning />}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} icon={<CheckCircle />}>
          {success}
        </Alert>
      )}

      {/* Processing Status */}
      {(processing.stage === 'parsing' || processing.stage === 'comparing' || processing.stage === 'building') && (
        <Box sx={{ mb: 3 }}>
          <LoadingSpinner message={processing.message} progress={processing.progress} />
        </Box>
      )}

      {/* Step 1: P6 Paste Input */}
      {currentStep === 1 && (
        <StyledPaper>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5" sx={{ color: BRAND_COLORS.text, fontWeight: 600 }}>
              Step 1: Paste P6 WBS Data
            </Typography>
            <StyledButton
              onClick={handleReset}
              variant="outlined"
              size="small"
              startIcon={<Refresh />}
            >
              Reset
            </StyledButton>
          </Box>

          {/* Instructions */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6" sx={{ color: BRAND_COLORS.text, fontWeight: 600 }}>
                P6 Export Instructions
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
                  Copy your WBS structure from P6 with these exact columns:
                </Typography>
                <List dense>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemIcon sx={{ minWidth: 20 }}>•</ListItemIcon>
                    <ListItemText primary="WBS Code - The WBS hierarchy code (5737.1064.1575, etc.)" />
                  </ListItem>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemIcon sx={{ minWidth: 20 }}>•</ListItemIcon>
                    <ListItemText primary="WBS Name - Equipment names with codes (+UH101 | Description)" />
                  </ListItem>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemIcon sx={{ minWidth: 20 }}>•</ListItemIcon>
                    <ListItemText primary="Total Activities - Activity count (can be ignored)" />
                  </ListItem>
                </List>
              </Alert>
            </Collapse>
          </Box>
          
          {/* P6 Paste Area */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ mb: 2, color: BRAND_COLORS.text, fontWeight: 500 }}>
              Paste P6 WBS Data:
            </Typography>
            <Box
              component="textarea"
              value={pasteContent}
              onChange={(e) => setPasteContent(e.target.value)}
              placeholder="Paste your P6 WBS data here...&#10;&#10;Example:&#10;WBS Code&#9;WBS Name&#9;Total Activities&#10;5737&#9;Summerfield&#9;605&#10;  5737.1003&#9;M | Milestones&#9;1"
              disabled={processing.stage === 'parsing'}
              sx={{
                width: '100%',
                minHeight: 160,
                p: 2,
                border: `1px solid ${BRAND_COLORS.level3}`,
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '14px',
                resize: 'vertical',
                '&:focus': {
                  outline: 'none',
                  borderColor: BRAND_COLORS.accent,
                  boxShadow: `0 0 0 2px ${BRAND_COLORS.accent}20`
                },
                '&:disabled': {
                  backgroundColor: BRAND_COLORS.background,
                  opacity: 0.6
                }
              }}
            />
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <StyledButton
              onClick={() => handleP6Paste(pasteContent)}
              disabled={!pasteContent.trim() || processing.stage === 'parsing'}
              variant="contained"
              startIcon={<CloudUpload />}
            >
              {processing.stage === 'parsing' ? 'Processing...' : 'Process P6 Data'}
            </StyledButton>
            
            <StyledButton
              onClick={() => setPasteContent('')}
              variant="outlined"
            >
              Clear
            </StyledButton>
          </Box>

          {/* P6 Processing Results */}
          {existingProject && existingProject.wbsStructure && (
            <Box sx={{ mt: 3 }}>
              <Alert severity="success" icon={<CheckCircle />}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  ✅ P6 Data Processed Successfully
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" sx={{ color: BRAND_COLORS.accent, fontWeight: 700 }}>
                        {existingProject.wbsStructure.length}
                      </Typography>
                      <Typography variant="body2" sx={{ color: BRAND_COLORS.text, opacity: 0.7 }}>
                        Total WBS Items
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" sx={{ color: BRAND_COLORS.level4, fontWeight: 700 }}>
                        {existingProject.equipmentCodes?.length || 0}
                      </Typography>
                      <Typography variant="body2" sx={{ color: BRAND_COLORS.text, opacity: 0.7 }}>
                        Equipment Codes Found
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" sx={{ color: BRAND_COLORS.text, fontWeight: 500 }}>
                      Project Name:
                    </Typography>
                    <Typography variant="body2" sx={{ color: BRAND_COLORS.text, opacity: 0.7 }}>
                      {existingProject.projectName}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Typography variant="body2" sx={{ color: BRAND_COLORS.text, fontWeight: 500 }}>
                      Sample Equipment:
                    </Typography>
                    <Typography variant="body2" sx={{ color: BRAND_COLORS.text, opacity: 0.7, fontSize: '12px' }}>
                      {existingProject.equipmentCodes?.slice(0, 3).join(', ') || 'None'}
                    </Typography>
                  </Grid>
                </Grid>
                
                <Box sx={{ mt: 3 }}>
                  <StyledButton 
                    variant="contained"
                    onClick={handleConfirmP6Parsing}
                    endIcon={<ArrowBack sx={{ transform: 'rotate(180deg)' }} />}
                  >
                    Continue to Equipment Upload
                  </StyledButton>
                </Box>
              </Alert>
            </Box>
          )}
        </StyledPaper>
      )}

      {/* Step 2: Equipment Upload */}
      {currentStep >= 2 && (
        <StyledPaper>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5" sx={{ color: BRAND_COLORS.text, fontWeight: 600 }}>
              Step 2: Upload Updated Equipment List
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <StyledButton
                onClick={() => handleBackToStep(1)}
                variant="outlined"
                size="small"
                startIcon={<ArrowBack />}
              >
                Back to P6 Data
              </StyledButton>
              <StyledButton
                onClick={handleReset}
                variant="outlined"
                size="small"
                startIcon={<Refresh />}
              >
                Start Over
              </StyledButton>
            </Box>
          </Box>

          {/* Equipment List Requirements */}
          <Box sx={{ mb: 3 }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600 }}>
                Equipment List Requirements
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Upload your complete equipment list (existing + new equipment). Required columns:
              </Typography>
              <List dense>
                <ListItem sx={{ py: 0 }}>
                  <ListItemIcon sx={{ minWidth: 20 }}>•</ListItemIcon>
                  <ListItemText primary="Subsystem - Equipment subsystem (33kV Switchroom 1 - +Z01, etc.)" />
                </ListItem>
                <ListItem sx={{ py: 0 }}>
                  <ListItemIcon sx={{ minWidth: 20 }}>•</ListItemIcon>
                  <ListItemText primary="Equipment Number - Equipment code (-XC11, ESS-FIRE-001, etc.)" />
                </ListItem>
                <ListItem sx={{ py: 0 }}>
                  <ListItemIcon sx={{ minWidth: 20 }}>•</ListItemIcon>
                  <ListItemText primary="Parent Equipment Number - Parent code or &quot;-&quot; for no parent" />
                </ListItem>
                <ListItem sx={{ py: 0 }}>
                  <ListItemIcon sx={{ minWidth: 20 }}>•</ListItemIcon>
                  <ListItemText primary="Description - Equipment description" />
                </ListItem>
                <ListItem sx={{ py: 0 }}>
                  <ListItemIcon sx={{ minWidth: 20 }}>•</ListItemIcon>
                  <ListItemText primary="Commissioning (Y/N) - Commissioning status" />
                </ListItem>
              </List>
            </Alert>

            <FileUpload 
              uploadType="equipment_list"
              title="Upload Equipment List"
              description="Upload your CSV or Excel file containing equipment data"
              accept=".csv,.xlsx,.xls"
              onFileProcessed={handleEquipmentFile}
            />
          </Box>

          {/* Equipment Processing Results */}
          {equipmentFileData && equipmentFileData.length > 0 && (
            <Alert severity="success" icon={<CheckCircle />}>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                ✅ Equipment File Processed
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={4}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ color: BRAND_COLORS.accent, fontWeight: 700 }}>
                      {equipmentFileData.length}
                    </Typography>
                    <Typography variant="body2" sx={{ color: BRAND_COLORS.text, opacity: 0.7 }}>
                      Total Equipment
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Typography variant="body2" sx={{ color: BRAND_COLORS.text, fontWeight: 500 }}>
                    Sample Items:
                  </Typography>
                  <Typography variant="body2" sx={{ color: BRAND_COLORS.text, opacity: 0.7 }}>
                    {equipmentFileData.slice(0, 3).map(item => item.equipment_number).join(', ')}
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <CheckCircle sx={{ color: 'success.main', mr: 1 }} />
                    <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 500 }}>
                      Ready to Process
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              <Box sx={{ mt: 3 }}>
                <StyledButton 
                  variant="contained"
                  size="large"
                  onClick={handleProcessEquipment}
                  disabled={!isProcessingReady || processing.active}
                  startIcon={<CloudUpload />}
                >
                  {processing.active ? 'Processing Equipment...' : 'Run 3-Tier Priority Analysis'}
                </StyledButton>
              </Box>
            </Alert>
          )}
        </StyledPaper>
      )}

      {/* Step 3: Results & Export */}
      {currentStep >= 3 && comparisonResult && (
        <StyledPaper>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5" sx={{ color: BRAND_COLORS.text, fontWeight: 600 }}>
              Step 3: Review Results & Export
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <StyledButton
                onClick={() => handleBackToStep(2)}
                variant="outlined"
                size="small"
                startIcon={<ArrowBack />}
              >
                Back to Equipment Upload
              </StyledButton>
              <StyledButton
                onClick={handleReset}
                variant="outlined"
                size="small"
                startIcon={<Refresh />}
              >
                Start Over
              </StyledButton>
            </Box>
          </Box>

          {/* Results Summary */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 3, color: BRAND_COLORS.text, fontWeight: 600 }}>
              📊 Processing Results
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ 
                  p: 3, 
                  backgroundColor: `${BRAND_COLORS.accent}15`,
                  borderRadius: 2,
                  textAlign: 'center'
                }}>
                  <Typography variant="h3" sx={{ color: BRAND_COLORS.accent, fontWeight: 700 }}>
                    {comparisonResult.comparison.added.length}
                  </Typography>
                  <Typography variant="body2" sx={{ color: BRAND_COLORS.accent }}>
                    New Equipment Found
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ 
                  p: 3, 
                  backgroundColor: `${BRAND_COLORS.level4}15`,
                  borderRadius: 2,
                  textAlign: 'center'
                }}>
                  <Typography variant="h3" sx={{ color: BRAND_COLORS.level4, fontWeight: 700 }}>
                    {comparisonResult.comparison.existing.length}
                  </Typography>
                  <Typography variant="body2" sx={{ color: BRAND_COLORS.level4 }}>
                    Existing Equipment
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ 
                  p: 3, 
                  backgroundColor: `${BRAND_COLORS.level3}15`,
                  borderRadius: 2,
                  textAlign: 'center'
                }}>
                  <Typography variant="h3" sx={{ color: BRAND_COLORS.level3, fontWeight: 700 }}>
                    {comparisonResult.export_ready.length}
                  </Typography>
                  <Typography variant="body2" sx={{ color: BRAND_COLORS.level3 }}>
                    WBS Items Created
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ 
                  p: 3, 
                  backgroundColor: `${BRAND_COLORS.level5}15`,
                  borderRadius: 2,
                  textAlign: 'center'
                }}>
                  <Typography variant="h3" sx={{ color: BRAND_COLORS.level5, fontWeight: 700 }}>
                    {comparisonResult.export_ready.length}
                  </Typography>
                  <Typography variant="body2" sx={{ color: BRAND_COLORS.level5 }}>
                    Ready for P6 Import
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>

          {/* Export Section */}
          <Box sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 3, color: BRAND_COLORS.text, fontWeight: 600 }}>
              📤 Export to P6
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="body1" sx={{ color: BRAND_COLORS.text, mb: 2 }}>
                  Download the new equipment items in P6-compatible CSV format:
                </Typography>
                <List>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemIcon sx={{ minWidth: 20 }}>•</ListItemIcon>
                    <ListItemText primary={`Contains ${comparisonResult.export_ready.length} new WBS items`} />
                  </ListItem>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemIcon sx={{ minWidth: 20 }}>•</ListItemIcon>
                    <ListItemText primary="P6-compatible format (wbs_code, parent_wbs_code, wbs_name)" />
                  </ListItem>
                  <ListItem sx={{ py: 0 }}>
                    <ListItemIcon sx={{ minWidth: 20 }}>•</ListItemIcon>
                    <ListItemText primary="Ready for direct import into P6" />
                  </ListItem>
                </List>

                <Box sx={{ mt: 3 }}>
                  <ExportButton
                    data={comparisonResult}
                    exportType="comparison"
                    variant="contained"
                    size="large"
                    customLabel="Export New Equipment to P6"
                    filename={`Missing_Equipment_${new Date().toISOString().split('T')[0].replace(/-/g, '')}`}
                    onExportComplete={handleExportComplete}
                    startIcon={<GetApp />}
                  />
                </Box>
              </Grid>

              <Grid item xs={12} md={6}>
                <Alert severity="info" icon={<Info />}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    P6 Import Instructions:
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
            </Grid>
          </Box>

          {/* Future: WBS Visualization */}
          <Box>
            <Typography variant="h6" sx={{ mb: 3, color: BRAND_COLORS.text, fontWeight: 600 }}>
              🔍 WBS Structure Preview
            </Typography>
            <Alert severity="info" icon={<Info />}>
              <Typography variant="body1" sx={{ textAlign: 'center', py: 4 }}>
                WBS visualization will be implemented in the next development phase...
                <br />
                <Typography variant="body2" sx={{ mt: 1, opacity: 0.7 }}>
                  Combined structure: {combinedWBS?.length || 0} total items
                </Typography>
              </Typography>
            </Alert>
          </Box>
        </StyledPaper>
      )}

      {/* Debug Information */}
      {debugInfo && (
        <StyledPaper>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h6" sx={{ color: BRAND_COLORS.text, fontWeight: 600 }}>
              🔧 Debug Information
            </Typography>
            <Chip label="Development Mode" size="small" color="primary" />
          </Box>
          <Box
            component="pre"
            sx={{
              fontSize: '12px',
              color: BRAND_COLORS.text,
              backgroundColor: BRAND_COLORS.background,
              p: 2,
              borderRadius: 1,
              overflow: 'auto',
              maxHeight: 300,
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace'
            }}
          >
            {debugInfo}
          </Box>
        </StyledPaper>
      )}
    </Container>
  );
};

export default MissingEquipment;

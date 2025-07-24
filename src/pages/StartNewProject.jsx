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

  // Handle file upload completion (FileUpload component calls this)
  const handleFileProcessed = (uploadResult) => {
    console.log('File uploaded successfully:', uploadResult);
    // File is automatically stored in uploads store by FileUpload component
    // No additional processing needed here
  };

  // WBS Generation Test Function
  const testWBSGeneration = (processedEquipment) => {
    console.log('🏗️ TESTING WBS GENERATION PROCESS');
    console.log(`📊 Input: ${processedEquipment.length} processed equipment items`);

    // Step 1: Test categorization
    console.log('📂 STEP 1: Testing Equipment Categorization');
    const categorized = {};
    const uncategorized = [];

    processedEquipment.forEach(item => {
      if (item.category && item.category !== '99') {
        if (!categorized[item.category]) {
          categorized[item.category] = [];
        }
        categorized[item.category].push(item.equipment_number);
      } else {
        uncategorized.push(item.equipment_number);
      }
    });

    console.log('✅ Categorized equipment:', Object.entries(categorized).map(([cat, items]) => ({
      category: cat,
      count: items.length,
      samples: items.slice(0, 3)
    })));
    
    console.log('❌ Uncategorized equipment:', uncategorized.slice(0, 10));

    // Step 2: Test WBS structure building
    console.log('🏗️ STEP 2: Testing WBS Structure Building');
    
    const wbsStructure = [];
    let wbsCounter = 1;

    // Project root
    wbsStructure.push({
      wbs_code: "1",
      parent_wbs_code: null,
      wbs_name: "5737 Summerfield Project"
    });

    // Standard structure
    wbsStructure.push({
      wbs_code: "1.1",
      parent_wbs_code: "1", 
      wbs_name: "M | Milestones"
    });

    wbsStructure.push({
      wbs_code: "1.2",
      parent_wbs_code: "1",
      wbs_name: "P | Pre-requisites"
    });

    wbsStructure.push({
      wbs_code: "1.3", 
      parent_wbs_code: "1",
      wbs_name: "S1 | Z01 | Main Subsystem"
    });

    // Add categories with equipment
    let categoryIndex = 1;
    for (const [categoryId, equipmentList] of Object.entries(categorized)) {
      const categoryWBS = `1.3.${categoryIndex}`;
      
      // Add category
      wbsStructure.push({
        wbs_code: categoryWBS,
        parent_wbs_code: "1.3",
        wbs_name: `${categoryId} | Category Name`
      });

      // Add equipment under category
      equipmentList.forEach((equipmentNumber, equipIdx) => {
        const equipmentWBS = `${categoryWBS}.${equipIdx + 1}`;
        wbsStructure.push({
          wbs_code: equipmentWBS,
          parent_wbs_code: categoryWBS,
          wbs_name: `${equipmentNumber} | Equipment Description`
        });
      });

      categoryIndex++;
    }

    // Add TBC section for uncategorized
    if (uncategorized.length > 0) {
      const tbcWBS = `1.${categoryIndex + 3}`;
      wbsStructure.push({
        wbs_code: tbcWBS,
        parent_wbs_code: "1",
        wbs_name: "TBC - Equipment To Be Confirmed"
      });

      uncategorized.forEach((equipmentNumber, equipIdx) => {
        const equipmentWBS = `${tbcWBS}.${equipIdx + 1}`;
        wbsStructure.push({
          wbs_code: equipmentWBS,
          parent_wbs_code: tbcWBS,
          wbs_name: `${equipmentNumber} | To be confirmed`
        });
      });
    }

    console.log('📊 Generated WBS Structure:');
    console.log(`   Total WBS Items: ${wbsStructure.length}`);
    console.log(`   Expected ~1200, Got: ${wbsStructure.length}`);
    console.log('   Sample WBS items:', wbsStructure.slice(0, 10));

    // Step 3: Compare with expected structure
    console.log('📋 STEP 3: Comparison with Expected');
    console.log(`   Expected rows: 1208`);
    console.log(`   Generated rows: ${wbsStructure.length}`);
    console.log(`   Current export: 6 rows`);
    console.log(`   Gap Analysis: ${1208 - wbsStructure.length} items missing from generation`);
    console.log(`   Export Gap: ${wbsStructure.length - 6} items lost in export`);

    return wbsStructure;
  };

  // Enhanced Process File Function with Debug Logging
  const handleProcessFile = async () => {
    try {
      setLoading(true);
      setProcessingStage('parsing', 10, 'Processing uploaded file...');

      console.log('🚀 STARTING COMPREHENSIVE FILE PROCESSING...');

      // Get the uploaded file from the store
      const uploadState = uploads['equipment_list'];
      if (!uploadState || !uploadState.file) {
        throw new Error('No file available for processing. Please upload a file first.');
      }

      const file = uploadState.file;
      console.log('📁 Processing file:', {
        name: file.name,
        type: file.type,
        size: file.size,
        lastModified: new Date(file.lastModified).toLocaleString()
      });

      // Use the new parseFile function that handles both CSV and Excel
      setProcessingStage('parsing', 30, 'Parsing file content...');
      
      console.log('🔍 PHASE 1: FILE PARSING');
      const parseResult = await parseFile(file);
      
      console.log('✅ Parse completed:', {
        type: parseResult.type,
        hasData: !!parseResult.data,
        dataLength: parseResult.data ? parseResult.data.length : 'N/A',
        hasOriginalHeaders: !!parseResult.originalHeaders,
        originalHeadersLength: parseResult.originalHeaders ? parseResult.originalHeaders.length : 'N/A',
        hasValidation: !!parseResult.validation,
        totalItems: parseResult.totalItems,
        errors: parseResult.errors
      });

      // Detailed equipment data analysis
      if (parseResult.data && parseResult.data.length > 0) {
        console.log('🔍 DETAILED EQUIPMENT ANALYSIS:');
        console.log('📊 Equipment Data Analysis:');
        console.log(`   Total Items: ${parseResult.data.length}`);
        
        // Sample first 5 equipment items with all fields
        console.log('📋 First 5 Equipment Items (Full Details):');
        parseResult.data.slice(0, 5).forEach((item, idx) => {
          console.log(`   ${idx + 1}. Equipment:`, {
            equipment_number: item.equipment_number,
            description: item.description,
            commissioning_status: item.commissioning_status,
            parent_equipment_code: item.parent_equipment_code,
            all_fields: Object.keys(item),
            all_field_count: Object.keys(item).length
          });
        });

        // Check for equipment code patterns
        console.log('🏷️ Equipment Code Pattern Analysis:');
        const patterns = {};
        parseResult.data.forEach(item => {
          if (item.equipment_number) {
            const firstChars = item.equipment_number.substring(0, 3).toUpperCase();
            patterns[firstChars] = (patterns[firstChars] || 0) + 1;
          }
        });
        const topPatterns = Object.entries(patterns)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 15);
        console.log('   Top 15 patterns found:', topPatterns);

        // Check commissioning status distribution
        console.log('📋 Commissioning Status Distribution:');
        const statusDist = {};
        parseResult.data.forEach(item => {
          const status = item.commissioning_status || 'undefined';
          statusDist[status] = (statusDist[status] || 0) + 1;
        });
        console.log('   Status breakdown:', statusDist);

        // Check parent-child relationships
        console.log('👨‍👦 Parent-Child Relationships:');
        const withParents = parseResult.data.filter(item => item.parent_equipment_code);
        console.log(`   Items with parents: ${withParents.length}`);
        if (withParents.length > 0) {
          console.log('   Sample parent-child pairs:', withParents.slice(0, 5).map(item => ({
            child: item.equipment_number,
            parent: item.parent_equipment_code
          })));
        }

        // Check for specific equipment types that should be categorized
        console.log('🔍 Equipment Type Analysis:');
        const equipmentTypes = {
          protection_panels: parseResult.data.filter(item => 
            item.equipment_number && (item.equipment_number.startsWith('+UH') || item.equipment_number.startsWith('UH'))
          ).length,
          transformers: parseResult.data.filter(item => 
            item.equipment_number && item.equipment_number.match(/^T\d+/)
          ).length,
          lv_switchboards: parseResult.data.filter(item => 
            item.equipment_number && (item.equipment_number.startsWith('+WC') || item.equipment_number.startsWith('WC'))
          ).length,
          hv_switchboards: parseResult.data.filter(item => 
            item.equipment_number && (item.equipment_number.startsWith('+WA') || item.equipment_number.startsWith('WA'))
          ).length,
          battery_systems: parseResult.data.filter(item => 
            item.equipment_number && (item.equipment_number.startsWith('+GB') || item.equipment_number.startsWith('GB'))
          ).length
        };
        console.log('   Equipment type counts:', equipmentTypes);
      }

      // Additional debugging: let's see what headers we got
      if (parseResult.originalHeaders && parseResult.originalHeaders.length > 0) {
        console.log('📄 Headers Analysis:');
        console.log(`   Total headers found: ${parseResult.originalHeaders.length}`);
        console.log('   All headers:', parseResult.originalHeaders);
        
        // Look for equipment-related columns
        const equipmentHeaders = parseResult.originalHeaders.filter(header => 
          typeof header === 'string' && 
          (header.toLowerCase().includes('equipment') || 
           header.toLowerCase().includes('tag') || 
           header.toLowerCase().includes('description') ||
           header.toLowerCase().includes('code') ||
           header.toLowerCase().includes('parent'))
        );
        console.log('   Equipment-related headers:', equipmentHeaders);

        // Check specifically for parent equipment columns
        const parentColumns = parseResult.originalHeaders.filter(header => 
          typeof header === 'string' &&
          (header.toLowerCase().includes('parent') || 
           header.toLowerCase().includes('equipment_code') ||
           header.toLowerCase().includes('parent_equipment'))
        );
        console.log('   Parent equipment columns found:', parentColumns);
      }

      if (!parseResult || !parseResult.data || parseResult.data.length === 0) {
        console.error('❌ PARSING FAILED - Detailed analysis:', {
          hasResult: !!parseResult,
          hasData: !!(parseResult && parseResult.data),
          dataLength: parseResult && parseResult.data ? parseResult.data.length : 'N/A',
          originalHeaders: parseResult && parseResult.originalHeaders ? parseResult.originalHeaders.length : 'N/A',
          type: parseResult && parseResult.type,
          validation: parseResult && parseResult.validation,
          errors: parseResult && parseResult.errors
        });
        
        throw new Error(`No valid equipment data found. File parsed ${parseResult?.originalHeaders?.length || 0} headers but extracted ${parseResult?.data?.length || 0} equipment items. Please check your file contains equipment information with proper column headers (equipment_number, description, etc.).`);
      }

      const equipmentData = parseResult.data;
      console.log(`✅ Successfully parsed ${equipmentData.length} equipment items`);

      console.log('🔍 PHASE 2: EQUIPMENT CATEGORIZATION');
      setProcessingStage('categorizing_equipment', 50, 'Categorizing equipment...');

      // Enhanced categorization for debugging
      const categorizedEquipment = equipmentData.map((item, index) => {
        console.log(`🔍 Categorizing item ${index + 1}/${equipmentData.length}: ${item.equipment_number}`);
        
        // Basic categorization logic for now (will be enhanced later)
        let category = '99'; // Default to unrecognized
        let categoryName = 'Unrecognised Equipment';
        
        // Simple pattern matching for common equipment types
        if (item.equipment_number) {
          const code = item.equipment_number.toUpperCase();
          if (code.startsWith('+UH') || code.startsWith('UH')) {
            category = '02';
            categoryName = 'Protection Panels';
          } else if (code.match(/^T\d+/)) {
            category = '05';
            categoryName = 'Transformers';
          } else if (code.startsWith('+WC') || code.startsWith('WC')) {
            category = '04';
            categoryName = 'LV Switchboards';
          } else if (code.startsWith('+WA') || code.startsWith('WA')) {
            category = '03';
            categoryName = 'HV Switchboards';
          } else if (code.startsWith('+GB') || code.startsWith('GB')) {
            category = '06';
            categoryName = 'Battery Systems';
          }
        }
        
        const categorizedItem = {
          ...item,
          category: category,
          category_name: categoryName,
          is_sub_equipment: !!item.parent_equipment_code,
          parent_equipment: item.parent_equipment_code || null,
          debug_info: {
            original_index: index,
            pattern_matched: category !== '99',
            has_parent: !!item.parent_equipment_code
          }
        };
        
        if (index < 10) { // Log first 10 for debugging
          console.log(`   Result: ${item.equipment_number} → Category: ${category} (${categoryName})`);
        }
        
        return categorizedItem;
      });

      // Categorization summary
      const categorizationSummary = {};
      categorizedEquipment.forEach(item => {
        if (!categorizationSummary[item.category]) {
          categorizationSummary[item.category] = {
            count: 0,
            name: item.category_name,
            samples: []
          };
        }
        categorizationSummary[item.category].count++;
        if (categorizationSummary[item.category].samples.length < 3) {
          categorizationSummary[item.category].samples.push(item.equipment_number);
        }
      });

      console.log('📊 Categorization Summary:', categorizationSummary);

      console.log('🔍 PHASE 3: WBS STRUCTURE GENERATION');
      setProcessingStage('generating_wbs', 70, 'Generating WBS structure...');

      // Test WBS generation process
      const debugWBS = testWBSGeneration(categorizedEquipment);

      // Create enhanced WBS structure
      const wbsStructure = [
        {
          wbs_code: '1',
          parent_wbs_code: null,
          wbs_name: '5737 Summerfield Project',
          level: 1,
          color: '#C8D982',
          is_equipment: false
        },
        {
          wbs_code: '1.1',
          parent_wbs_code: '1',
          wbs_name: 'M | Milestones',
          level: 2,
          color: '#B5D369',
          is_equipment: false
        },
        {
          wbs_code: '1.2',
          parent_wbs_code: '1',
          wbs_name: 'P | Pre-requisites',
          level: 2,
          color: '#B5D369',
          is_equipment: false
        },
        {
          wbs_code: '1.3',
          parent_wbs_code: '1',
          wbs_name: 'S1 | Z01 | Main Subsystem',
          level: 2,
          color: '#B5D369',
          is_equipment: false
        }
      ];

      // Add categories and equipment
      let categoryIndex = 1;
      for (const [categoryId, categoryInfo] of Object.entries(categorizationSummary)) {
        if (categoryInfo.count > 0) {
          const categoryWBS = `1.3.${categoryIndex}`;
          
          // Add category
          wbsStructure.push({
            wbs_code: categoryWBS,
            parent_wbs_code: '1.3',
            wbs_name: `${categoryId} | ${categoryInfo.name}`,
            level: 3,
            color: '#A8CC6B',
            is_equipment: false
          });

          // Add equipment items (limit to first 50 per category for testing)
          const categoryEquipment = categorizedEquipment
            .filter(item => item.category === categoryId)
            .slice(0, 50);

          categoryEquipment.forEach((item, equipIdx) => {
            const equipmentWBS = `${categoryWBS}.${equipIdx + 1}`;
            wbsStructure.push({
              wbs_code: equipmentWBS,
              parent_wbs_code: categoryWBS,
              wbs_name: `${item.equipment_number} | ${item.description || 'Equipment Description'}`,
              equipment_number: item.equipment_number,
              description: item.description,
              commissioning_status: item.commissioning_status,
              level: 4,
              color: '#95C157',
              is_equipment: true,
              parent_equipment_code: item.parent_equipment_code
            });

            // Add sub-equipment if it has a parent
            if (item.parent_equipment_code) {
              // This would be enhanced to properly handle parent-child relationships
              console.log(`🔗 Sub-equipment detected: ${item.equipment_number} → parent: ${item.parent_equipment_code}`);
            }
          });

          categoryIndex++;
        }
      }

      console.log('🏗️ WBS Structure Generated:');
      console.log(`   Total WBS Items: ${wbsStructure.length}`);
      console.log(`   Expected: ~1208, Generated: ${wbsStructure.length}`);
      console.log(`   Levels: ${Math.max(...wbsStructure.map(item => item.level))}`);
      console.log('   Sample structure:', wbsStructure.slice(0, 10));

      setProcessingStage('finalizing', 90, 'Building visualization...');

      // Update store with results
      updateEquipmentList(categorizedEquipment);
      updateWBSStructure(wbsStructure);

      // Store results for display
      const finalResults = {
        equipment: {
          equipment: categorizedEquipment,
          total_processed: categorizedEquipment.length,
          summary: {
            processing_warnings: []
          },
          grouped: categorizationSummary
        },
        wbs: {
          wbs_structure: wbsStructure,
          total_items: wbsStructure.length,
          max_level: Math.max(...wbsStructure.map(item => item.level))
        }
      };

      setProcessingResults(finalResults);

      console.log('✅ PROCESSING COMPLETE - Final Summary:');
      console.log(`   📊 Equipment processed: ${categorizedEquipment.length}`);
      console.log(`   🏗️ WBS items created: ${wbsStructure.length}`);
      console.log(`   📂 Categories found: ${Object.keys(categorizationSummary).length}`);
      console.log(`   🎯 Expected vs Actual: 1208 vs ${wbsStructure.length} (${((wbsStructure.length / 1208) * 100).toFixed(1)}%)`);

      setProcessingStage('complete', 100, 'Project created successfully!');
      setSuccess(`Successfully processed ${categorizedEquipment.length} equipment items from ${file.name}!`);
      
      // Move to next step
      setActiveStep(1);

    } catch (error) {
      console.error('❌ PROCESSING ERROR:', error);
      console.error('Error stack:', error.stack);
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

  // Check if file is uploaded
  const isFileUploaded = uploads['equipment_list'] && uploads['equipment_list'].file;

  // Get step content - [Rest of your existing step content code remains the same]
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
                    <strong>Optional Columns:</strong> commissioning_status, plu_field, category, location
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

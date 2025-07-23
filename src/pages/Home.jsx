import React, { useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Container,
  Grid,
  Alert,
  Chip,
  Divider,
  Paper
} from '@mui/material';
import {
  Add,
  PlayArrow,
  CompareArrows,
  AccountTree,
  Upload,
  GetApp,
  Info,
  CheckCircle
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';
import useProjectStore from '../store/projectStore';
import { BRAND_COLORS } from '../constants';
import LoadingSpinner from '../components/LoadingSpinner';

// Styled components with brand colors
const HeroSection = styled(Box)(({ theme }) => ({
  background: `linear-gradient(135deg, ${BRAND_COLORS.level1} 0%, ${BRAND_COLORS.level3} 100%)`,
  color: BRAND_COLORS.white,
  padding: theme.spacing(6, 0),
  textAlign: 'center',
  marginBottom: theme.spacing(4)
}));

const FeatureCard = styled(Card)(({ theme, featured }) => ({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  transition: 'all 0.3s ease',
  cursor: 'pointer',
  position: 'relative',
  border: featured ? `2px solid ${BRAND_COLORS.accent}` : `1px solid ${BRAND_COLORS.level2}`,
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[8],
    borderColor: BRAND_COLORS.accent
  },
  ...(featured && {
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: '4px',
      background: `linear-gradient(90deg, ${BRAND_COLORS.accent}, ${BRAND_COLORS.level5})`,
    }
  })
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

const StatsBox = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(3),
  background: `linear-gradient(45deg, ${BRAND_COLORS.level1}30, ${BRAND_COLORS.level2}20)`,
  border: `1px solid ${BRAND_COLORS.level2}`,
  borderRadius: theme.spacing(2)
}));

const Home = () => {
  const navigate = useNavigate();
  
  // Store hooks
  const { 
    project, 
    ui, 
    comparison,
    resetStore,
    setCurrentFeature,
    clearMessages
  } = useProjectStore();

  // Clear any existing messages on load
  useEffect(() => {
    clearMessages();
  }, [clearMessages]);

  // Get project statistics
  const getProjectStats = () => {
    return {
      hasProject: project.wbs_structure.length > 0 || project.equipment_list.length > 0,
      totalWBSItems: project.wbs_structure.length,
      totalEquipment: project.equipment_list.length,
      hasChanges: comparison.added.length > 0 || comparison.removed.length > 0,
      newItems: comparison.added.length,
      lastModified: project.last_modified
    };
  };

  const stats = getProjectStats();

  // Handle feature navigation
  const handleFeatureSelect = (feature) => {
    setCurrentFeature(feature);
    navigate(`/${feature.replace('_', '-')}`);
  };

  // Handle reset project
  const handleResetProject = () => {
    if (window.confirm('Are you sure you want to start over? This will clear all current project data.')) {
      resetStore();
    }
  };

  // Feature definitions
  const features = [
    {
      id: 'start-project',
      title: 'Start New Project',
      description: 'Upload a complete equipment list and generate a new WBS structure from scratch. Perfect for new projects.',
      icon: <Add fontSize="large" />,
      color: BRAND_COLORS.level3,
      featured: true,
      steps: [
        'Upload equipment list (CSV)',
        'Automatic equipment categorization',
        'WBS structure generation',
        'Export for P6 import'
      ],
      requirements: 'Equipment list with columns: equipment_number, description',
      estimatedTime: '2-5 minutes'
    },
    {
      id: 'continue-project',
      title: 'Continue Project',
      description: 'Add new equipment to an existing project by uploading the P6 export and new equipment list.',
      icon: <PlayArrow fontSize="large" />,
      color: BRAND_COLORS.level4,
      featured: false,
      steps: [
        'Upload existing project (XER/CSV)',
        'Upload new equipment list',
        'Analyze existing WBS patterns',
        'Generate codes for new items'
      ],
      requirements: 'XER file from P6 + new equipment list',
      estimatedTime: '3-7 minutes'
    },
    {
      id: 'missing-equipment',
      title: 'Missing Equipment',
      description: 'Compare equipment lists to identify changes and generate WBS codes for new or modified items.',
      icon: <CompareArrows fontSize="large" />,
      color: BRAND_COLORS.level5,
      featured: false,
      steps: [
        'Upload original project',
        'Upload updated equipment list',
        'Identify changes automatically',
        'Export only new/changed items'
      ],
      requirements: 'Original WBS structure + updated equipment list',
      estimatedTime: '2-4 minutes'
    }
  ];

  return (
    <Container maxWidth="xl">
      {/* Loading Spinner */}
      <LoadingSpinner variant="modal" />

      {/* Hero Section */}
      <HeroSection>
        <Container>
          <Typography variant="h2" component="h1" sx={{ fontWeight: 700, mb: 2 }}>
            WBS Generator
          </Typography>
          <Typography variant="h6" sx={{ opacity: 0.9, mb: 3, maxWidth: '600px', mx: 'auto' }}>
            Transform your equipment lists into structured WBS hierarchies compatible with Oracle Primavera P6
          </Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Chip 
              icon={<AccountTree />} 
              label="Hierarchical Structure" 
              sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
            />
            <Chip 
              icon={<Upload />} 
              label="CSV/XER Support" 
              sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
            />
            <Chip 
              icon={<GetApp />} 
              label="P6 Compatible Export" 
              sx={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
            />
          </Box>
        </Container>
      </HeroSection>

      {/* Current Project Status */}
      {stats.hasProject && (
        <Box sx={{ mb: 4 }}>
          <StatsBox>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ color: BRAND_COLORS.text, fontWeight: 600 }}>
                Current Project Status
              </Typography>
              <Button 
                variant="outlined" 
                size="small" 
                onClick={handleResetProject}
                sx={{ color: BRAND_COLORS.text, borderColor: BRAND_COLORS.level3 }}
              >
                Start Over
              </Button>
            </Box>
            
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ color: BRAND_COLORS.accent, fontWeight: 700 }}>
                    {stats.totalWBSItems}
                  </Typography>
                  <Typography variant="body2" sx={{ color: BRAND_COLORS.text, opacity: 0.7 }}>
                    WBS Items
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ color: BRAND_COLORS.level4, fontWeight: 700 }}>
                    {stats.totalEquipment}
                  </Typography>
                  <Typography variant="body2" sx={{ color: BRAND_COLORS.text, opacity: 0.7 }}>
                    Equipment Items
                  </Typography>
                </Box>
              </Grid>
              
              {stats.hasChanges && (
                <Grid item xs={12} sm={6} md={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" sx={{ color: BRAND_COLORS.accent, fontWeight: 700 }}>
                      {stats.newItems}
                    </Typography>
                    <Typography variant="body2" sx={{ color: BRAND_COLORS.text, opacity: 0.7 }}>
                      New Changes
                    </Typography>
                  </Box>
                </Grid>
              )}
              
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ color: BRAND_COLORS.text, fontWeight: 600 }}>
                    Last Modified
                  </Typography>
                  <Typography variant="caption" sx={{ color: BRAND_COLORS.text, opacity: 0.7 }}>
                    {stats.lastModified ? new Date(stats.lastModified).toLocaleDateString() : 'Never'}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </StatsBox>
        </Box>
      )}

      {/* Success/Error Messages */}
      {ui.success && (
        <Alert 
          severity="success" 
          sx={{ mb: 3 }}
          icon={<CheckCircle />}
        >
          {ui.success}
        </Alert>
      )}

      {ui.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {ui.error}
        </Alert>
      )}

      {/* Feature Selection */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h2" sx={{ mb: 1, color: BRAND_COLORS.text, fontWeight: 600 }}>
          Choose Your Workflow
        </Typography>
        <Typography variant="body1" sx={{ mb: 4, color: BRAND_COLORS.text, opacity: 0.8 }}>
          Select the workflow that matches your project needs
        </Typography>

        <Grid container spacing={3}>
          {features.map((feature) => (
            <Grid item xs={12} md={4} key={feature.id}>
              <FeatureCard 
                featured={feature.featured}
                onClick={() => handleFeatureSelect(feature.id)}
              >
                <CardContent sx={{ flexGrow: 1, pb: 1 }}>
                  {/* Feature Icon and Title */}
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ color: feature.color, mr: 2 }}>
                      {feature.icon}
                    </Box>
                    <Typography variant="h6" component="h3" sx={{ fontWeight: 600, color: BRAND_COLORS.text }}>
                      {feature.title}
                    </Typography>
                    {feature.featured && (
                      <Chip 
                        label="Popular" 
                        size="small" 
                        sx={{ 
                          ml: 'auto', 
                          backgroundColor: BRAND_COLORS.accent, 
                          color: BRAND_COLORS.white,
                          fontSize: '0.7rem'
                        }} 
                      />
                    )}
                  </Box>

                  {/* Description */}
                  <Typography variant="body2" sx={{ mb: 3, color: BRAND_COLORS.text, opacity: 0.8 }}>
                    {feature.description}
                  </Typography>

                  {/* Steps */}
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: BRAND_COLORS.text }}>
                    Process Steps:
                  </Typography>
                  <Box component="ol" sx={{ pl: 2, mb: 2 }}>
                    {feature.steps.map((step, index) => (
                      <Typography 
                        component="li" 
                        variant="caption" 
                        key={index}
                        sx={{ color: BRAND_COLORS.text, opacity: 0.7, mb: 0.5 }}
                      >
                        {step}
                      </Typography>
                    ))}
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  {/* Requirements and Time */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="caption" sx={{ color: BRAND_COLORS.text, opacity: 0.6 }}>
                      Est. Time:
                    </Typography>
                    <Typography variant="caption" sx={{ color: BRAND_COLORS.text, fontWeight: 600 }}>
                      {feature.estimatedTime}
                    </Typography>
                  </Box>
                  
                  <Typography variant="caption" sx={{ color: BRAND_COLORS.text, opacity: 0.6, display: 'block' }}>
                    Requirements: {feature.requirements}
                  </Typography>
                </CardContent>

                <CardActions sx={{ p: 2, pt: 0 }}>
                  <StyledButton 
                    variant={feature.featured ? "contained" : "outlined"}
                    fullWidth
                    endIcon={<PlayArrow />}
                  >
                    {feature.featured ? 'Start Now' : 'Begin'}
                  </StyledButton>
                </CardActions>
              </FeatureCard>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Info Section */}
      <Box sx={{ mt: 6, mb: 4 }}>
        <Alert severity="info" icon={<Info />}>
          <Typography variant="body2">
            <strong>Need Help?</strong> Each workflow includes step-by-step guidance and file validation. 
            All exports are formatted for direct import into Oracle Primavera P6.
          </Typography>
        </Alert>
      </Box>
    </Container>
  );
};

export default Home;

import React from 'react';
import {
  Box,
  CircularProgress,
  LinearProgress,
  Typography,
  Paper,
  Backdrop,
  Alert,
  Button,
  Fade,
  Grow
} from '@mui/material';
import {
  CloudUpload,
  Settings,
  AccountTree,
  CompareArrows,
  CheckCircle,
  Error,
  Refresh
} from '@mui/icons-material';
import { styled, keyframes } from '@mui/material/styles';
import useProjectStore from '../store/projectStore';
import { BRAND_COLORS } from '../constants';

// Animations
const pulse = keyframes`
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
`;

const rotate = keyframes`
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
`;

// Styled components with brand colors
const StyledBackdrop = styled(Backdrop)(({ theme }) => ({
  zIndex: theme.zIndex.drawer + 1,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  backdropFilter: 'blur(4px)'
}));

const LoadingContainer = styled(Paper)(({ theme, variant }) => ({
  padding: theme.spacing(4),
  textAlign: 'center',
  backgroundColor: BRAND_COLORS.white,
  border: `2px solid ${BRAND_COLORS.level2}`,
  borderRadius: theme.spacing(2),
  minWidth: variant === 'modal' ? '400px' : 'auto',
  maxWidth: '500px',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '4px',
    background: `linear-gradient(90deg, ${BRAND_COLORS.level1}, ${BRAND_COLORS.level3}, ${BRAND_COLORS.accent})`,
    animation: variant === 'modal' ? `${pulse} 2s ease-in-out infinite` : 'none'
  }
}));

const StyledCircularProgress = styled(CircularProgress)(({ theme }) => ({
  color: BRAND_COLORS.accent,
  '& .MuiCircularProgress-circle': {
    strokeLinecap: 'round'
  }
}));

const StyledLinearProgress = styled(LinearProgress)(({ theme }) => ({
  height: 8,
  borderRadius: 4,
  backgroundColor: `${BRAND_COLORS.level1}40`,
  '& .MuiLinearProgress-bar': {
    borderRadius: 4,
    background: `linear-gradient(90deg, ${BRAND_COLORS.level3}, ${BRAND_COLORS.accent})`
  }
}));

const AnimatedIcon = styled(Box)(({ theme }) => ({
  animation: `${rotate} 2s linear infinite`,
  display: 'inline-flex',
  marginBottom: theme.spacing(2)
}));

const PulsingIcon = styled(Box)(({ theme }) => ({
  animation: `${pulse} 1.5s ease-in-out infinite`,
  display: 'inline-flex',
  marginBottom: theme.spacing(2)
}));

const LoadingSpinner = ({ 
  variant = 'inline', // 'inline' | 'modal' | 'fullscreen'
  size = 'medium', // 'small' | 'medium' | 'large'
  showProgress = false,
  showMessage = true,
  customMessage = null,
  onCancel = null
}) => {
  // Store hooks
  const { ui, setError } = useProjectStore();

  // Get processing information
  const { loading, processing } = ui;
  const { stage, progress, message } = processing;

  // Determine if we should show the spinner
  const isVisible = loading || (stage && stage !== 'complete' && stage !== 'error');

  // Get stage icon
  const getStageIcon = (currentStage) => {
    const iconProps = {
      fontSize: size === 'small' ? 'medium' : size === 'large' ? 'large' : 'large',
      sx: { color: BRAND_COLORS.accent }
    };

    switch (currentStage) {
      case 'uploading':
      case 'parsing':
        return <CloudUpload {...iconProps} />;
      case 'validating':
      case 'categorizing_equipment':
        return <Settings {...iconProps} />;
      case 'generating_wbs':
      case 'building_tree':
        return <AccountTree {...iconProps} />;
      case 'comparing':
        return <CompareArrows {...iconProps} />;
      case 'complete':
        return <CheckCircle {...iconProps} sx={{ color: 'success.main' }} />;
      case 'error':
        return <Error {...iconProps} sx={{ color: 'error.main' }} />;
      default:
        return <Settings {...iconProps} />;
    }
  };

  // Get spinner size
  const getSpinnerSize = () => {
    switch (size) {
      case 'small': return 32;
      case 'large': return 64;
      default: return 48;
    }
  };

  // Get display message
  const getDisplayMessage = () => {
    if (customMessage) return customMessage;
    if (message) return message;
    if (stage === 'complete') return 'Processing completed successfully!';
    if (stage === 'error') return 'An error occurred during processing';
    return 'Processing...';
  };

  // Handle cancel
  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  // Render progress section
  const renderProgress = () => {
    if (!showProgress || !progress) return null;

    return (
      <Box sx={{ mt: 3, width: '100%' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" sx={{ color: BRAND_COLORS.text }}>
            Progress
          </Typography>
          <Typography variant="caption" sx={{ color: BRAND_COLORS.text }}>
            {Math.round(progress)}%
          </Typography>
        </Box>
        <StyledLinearProgress
          variant="determinate"
          value={progress}
        />
      </Box>
    );
  };

  // Render message section
  const renderMessage = () => {
    if (!showMessage) return null;

    return (
      <Box sx={{ mt: 2 }}>
        <Typography 
          variant={size === 'small' ? 'body2' : 'h6'} 
          sx={{ 
            color: BRAND_COLORS.text,
            fontWeight: size === 'small' ? 400 : 500,
            mb: 1
          }}
        >
          {getDisplayMessage()}
        </Typography>
        
        {stage && stage !== 'complete' && stage !== 'error' && (
          <Typography 
            variant="caption" 
            sx={{ 
              color: BRAND_COLORS.text, 
              opacity: 0.7,
              display: 'block'
            }}
          >
            Stage: {stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </Typography>
        )}
      </Box>
    );
  };

  // Render cancel button
  const renderCancelButton = () => {
    if (!onCancel || stage === 'complete' || stage === 'error') return null;

    return (
      <Box sx={{ mt: 3 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={handleCancel}
          sx={{ 
            borderColor: BRAND_COLORS.level3,
            color: BRAND_COLORS.text,
            '&:hover': {
              borderColor: BRAND_COLORS.accent,
              backgroundColor: `${BRAND_COLORS.accent}10`
            }
          }}
        >
          Cancel
        </Button>
      </Box>
    );
  };

  // Render loading content
  const renderLoadingContent = () => (
    <LoadingContainer variant={variant} elevation={variant === 'modal' ? 8 : 2}>
      {/* Stage Icon */}
      {stage ? (
        stage === 'complete' || stage === 'error' ? (
          <PulsingIcon>
            {getStageIcon(stage)}
          </PulsingIcon>
        ) : (
          <AnimatedIcon>
            {getStageIcon(stage)}
          </AnimatedIcon>
        )
      ) : (
        <Box sx={{ mb: 2 }}>
          <StyledCircularProgress size={getSpinnerSize()} thickness={4} />
        </Box>
      )}

      {/* Message */}
      {renderMessage()}

      {/* Progress */}
      {renderProgress()}

      {/* Cancel Button */}
      {renderCancelButton()}

      {/* Retry Button for Error State */}
      {stage === 'error' && (
        <Box sx={{ mt: 2 }}>
          <Button
            variant="contained"
            size="small"
            startIcon={<Refresh />}
            onClick={() => window.location.reload()}
            sx={{ 
              backgroundColor: BRAND_COLORS.accent,
              '&:hover': { backgroundColor: BRAND_COLORS.level5 }
            }}
          >
            Retry
          </Button>
        </Box>
      )}
    </LoadingContainer>
  );

  // Don't render if not visible
  if (!isVisible) return null;

  // Render based on variant
  switch (variant) {
    case 'modal':
      return (
        <StyledBackdrop open={isVisible}>
          <Fade in={isVisible} timeout={300}>
            <Box>
              {renderLoadingContent()}
            </Box>
          </Fade>
        </StyledBackdrop>
      );

    case 'fullscreen':
      return (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
          }}
        >
          <Grow in={isVisible} timeout={500}>
            <Box>
              {renderLoadingContent()}
            </Box>
          </Grow>
        </Box>
      );

    case 'inline':
    default:
      return (
        <Fade in={isVisible} timeout={200}>
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            {renderLoadingContent()}
          </Box>
        </Fade>
      );
  }
};

// Simple loading overlay for quick use
export const LoadingOverlay = ({ isLoading, message = 'Loading...' }) => (
  <LoadingSpinner
    variant="modal"
    showProgress={false}
    showMessage={true}
    customMessage={message}
  />
);

// Inline spinner for small spaces
export const InlineSpinner = ({ size = 'small', message = null }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}>
    <StyledCircularProgress size={size === 'small' ? 20 : 32} thickness={4} />
    {message && (
      <Typography variant="body2" sx={{ color: BRAND_COLORS.text }}>
        {message}
      </Typography>
    )}
  </Box>
);

export default LoadingSpinner;

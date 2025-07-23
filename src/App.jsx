import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { BRAND_COLORS } from './constants';

// Import pages
import Home from './pages/Home';
import StartNewProject from './pages/StartNewProject';
import ContinueProject from './pages/ContinueProject';
import MissingEquipment from './pages/MissingEquipment';

// Import layout if you want to use it (optional)
import Layout from './components/Layout';

// Create Material-UI theme with your brand colors
const theme = createTheme({
  palette: {
    primary: {
      main: BRAND_COLORS.accent,
      light: BRAND_COLORS.level1,
      dark: BRAND_COLORS.level5,
      contrastText: BRAND_COLORS.white
    },
    secondary: {
      main: BRAND_COLORS.level4,
      light: BRAND_COLORS.level2,
      dark: BRAND_COLORS.level5,
      contrastText: BRAND_COLORS.white
    },
    background: {
      default: BRAND_COLORS.background,
      paper: BRAND_COLORS.white
    },
    text: {
      primary: BRAND_COLORS.text,
      secondary: `${BRAND_COLORS.text}CC` // 80% opacity
    },
    success: {
      main: BRAND_COLORS.level4
    },
    warning: {
      main: '#ff9800'
    },
    error: {
      main: '#f44336'
    },
    info: {
      main: BRAND_COLORS.level3
    }
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
      color: BRAND_COLORS.text
    },
    h2: {
      fontWeight: 600,
      color: BRAND_COLORS.text
    },
    h3: {
      fontWeight: 600,
      color: BRAND_COLORS.text
    },
    h4: {
      fontWeight: 600,
      color: BRAND_COLORS.text
    },
    h5: {
      fontWeight: 600,
      color: BRAND_COLORS.text
    },
    h6: {
      fontWeight: 600,
      color: BRAND_COLORS.text
    },
    body1: {
      color: BRAND_COLORS.text
    },
    body2: {
      color: BRAND_COLORS.text
    }
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          borderRadius: 8,
          fontWeight: 500
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 8
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6
        }
      }
    }
  }
});

// Main App Component
function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
          <Routes>
            {/* Home page */}
            <Route path="/" element={<Home />} />
            
            {/* Feature pages */}
            <Route path="/start-project" element={<StartNewProject />} />
            <Route path="/continue-project" element={<ContinueProject />} />
            <Route path="/missing-equipment" element={<MissingEquipment />} />
            
            {/* Fallback to home for any unmatched routes */}
            <Route path="*" element={<Home />} />
          </Routes>
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;

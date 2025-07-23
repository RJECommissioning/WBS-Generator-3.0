import React from 'react';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import StartNewProject from './pages/StartNewProject';
import ContinueProject from './pages/ContinueProject';
import MissingEquipment from './pages/MissingEquipment';
import { useAppContext } from './context/AppContext';
import './App.css';

// Main App Content Component
function AppContent() {
  const { state } = useAppContext();
  const currentPage = state.ui.current_page;

  const renderPage = () => {
    switch (currentPage) {
      case 'start-new-project':
        return <StartNewProject />;
      case 'continue-project':
        return <ContinueProject />;
      case 'missing-equipment':
        return <MissingEquipment />;
      case 'home':
      default:
        return <Home />;
    }
  };

  return (
    <Layout>
      {renderPage()}
    </Layout>
  );
}

// Main App Component
function App() {
  return (
    <div className="App">
      <AppProvider>
        <AppContent />
      </AppProvider>
    </div>
  );
}

export default App;

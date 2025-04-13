import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { LaserEyesProvider } from '@omnisat/lasereyes';
import EndpointToggle from './components/shared/EndpointToggle';
import WalletConnector from './components/shared/WalletConnector';
import NavSidebar from './components/layout/NavSidebar';
import { mapNetworkToLaserEyes } from './utils/networkMapping';

// Lazy load BlockHeight component to prevent initial render issues
const BlockHeight = lazy(() => import('./components/shared/BlockHeight'));

/**
 * ErrorBoundary component to catch and handle errors
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Component error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>Something went wrong.</div>;
    }
    return this.props.children;
  }
}

/**
 * App Component
 */
function App() {
  const [network, setNetwork] = useState('mainnet');
  const [isClient, setIsClient] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleNetworkChange = (newNetwork) => {
    console.log('Network changed to:', newNetwork);
    setNetwork(newNetwork);
  };

  // Styles for the windows
  const containerStyle = {
    display: 'flex',
    gap: '15px',
    padding: '20px',
    width: 'calc(100% - 40px)',
    margin: '0 auto'
  };
  
  const sidebarWindowStyle = {
    width: '250px',
    height: 'fit-content'
  };
  
  const mainWindowStyle = {
    flex: 1
  };

  return (
    <>
      {isClient ? (
        <LaserEyesProvider config={{ network: mapNetworkToLaserEyes(network) }}>
          {/* Container for both windows */}
          <div style={containerStyle}>
            {/* Sidebar Window */}
            <div className="window" style={sidebarWindowStyle}>
              <div className="title-bar">
                <div className="title-bar-text">Navigation</div>
                <div className="title-bar-controls">
                  <button aria-label="Minimize"></button>
                  <button aria-label="Maximize"></button>
                  <button aria-label="Close"></button>
                </div>
              </div>
              <div className="window-body">
                <NavSidebar />
              </div>
            </div>
            
            {/* Main Content Window */}
            <div className="window" style={mainWindowStyle}>
              <div className="title-bar">
                <div className="title-bar-text">Metagraph</div>
                <div className="title-bar-controls">
                  <button aria-label="Minimize"></button>
                  <button aria-label="Maximize"></button>
                  <button aria-label="Close"></button>
                </div>
              </div>
              
              <div className="window-body">
                {/* Header Content */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '10px', borderBottom: '1px solid silver', marginBottom: '10px' }}>
                  {/* Left side: Title, Subtitle, Home Link */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                      <h1 style={{ margin: 0 }}>METAGRAPH</h1>
                      <span>Method Exploration, Tool And Graph Renderer for Alkanes Protocol Handling</span>
                    </div>
                    <div>
                      <Link
                        to="/home"
                        style={{ color: 'blue', textDecoration: 'underline', fontSize: '12px', marginTop: '4px' }}
                      >
                        /home
                      </Link>
                    </div>
                  </div>
                  
                  {/* Right side: Controls */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <EndpointToggle
                      onChange={handleNetworkChange}
                      initialEndpoint={network}
                    />
                    <WalletConnector />
                    <ErrorBoundary fallback={<div className="status-bar-field">Height: Err</div>}>
                      <Suspense fallback={<div className="status-bar-field">Loading...</div>}>
                        <div className="status-bar-field">
                          <BlockHeight network={network} refreshInterval={10000} />
                        </div>
                      </Suspense>
                    </ErrorBoundary>
                  </div>
                </div>
                
                {/* Main Content */}
                <main>
                  {/* Renders the current route's component */}
                  <Outlet context={{ endpoint: network }} />
                </main>
              </div>
              
              {/* Status Bar */}
              <div className="status-bar">
                <p className="status-bar-field">Network: {network}</p>
                <p className="status-bar-field">Ready</p>
                <p className="status-bar-field">CPU: 5%</p>
              </div>
            </div>
          </div>
        </LaserEyesProvider>
      ) : null}
    </>
  );
}

export default App;

import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import Home from './pages/Home';
import APIMethodPage from './pages/APIMethodPage';
import NotFound from './pages/NotFound';
import ShadowVoutDocs from './pages/ShadowVoutDocs';
import TraceBlockStatusForm from './components/methods/TraceBlockStatusForm';
import SimulateForm from './components/methods/SimulateForm';
import TraceForm from './components/methods/TraceForm';

/**
 * Application Routes
 *
 * Defines all routes for the METHANE application
 * Including API method routes and 404 handling
 */
const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Home />
      },
      {
        path: 'api-methods/:methodId',
        element: <APIMethodPage />
      },
      // Documentation routes
      {
        path: 'docs/shadow-vout',
        element: <ShadowVoutDocs />
      },
      // Direct method routes
      {
        path: 'api-methods/trace',
        element: <APIMethodPage methodComponent={TraceForm} methodName="Trace" />
      },
      {
        path: 'api-methods/traceblockstatus',
        element: <APIMethodPage methodComponent={TraceBlockStatusForm} methodName="Trace Block Status" />
      },
      {
        path: 'api-methods/simulate',
        element: <APIMethodPage methodComponent={SimulateForm} methodName="Simulate Transaction" />
      },
      // Not found route
      {
        path: '*',
        element: <NotFound />
      }
    ]
  }
]);

export default router;
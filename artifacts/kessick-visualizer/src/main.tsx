import { createRoot } from 'react-dom/client';

import App from './App';
import { ErrorBoundary } from '@/components/error-boundary';
import { reportClientError } from '@/lib/client-logging';

import './index.css';

createRoot(document.getElementById('root')!, {
  // Keeps caught errors off reportError(), which would raise the dev overlay.
  onCaughtError: (error, errorInfo) => {
    reportClientError('Kessick could not display this page.', error, errorInfo.componentStack);
  },
  onUncaughtError: (error, errorInfo) => {
    reportClientError('Kessick encountered an unexpected display error.', error, errorInfo.componentStack);
  },
  onRecoverableError: (error, errorInfo) => {
    reportClientError('Kessick recovered from a display error.', error, errorInfo.componentStack);
  },
}).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);

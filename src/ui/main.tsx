import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { takeCaseFromUrl } from '../report/caseFile';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

// sdílený případ se z adresy přečte jednou, mimo React (bez vedlejších efektů v renderu)
const initialCase = takeCaseFromUrl();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App initialCase={initialCase} />
    </ErrorBoundary>
  </StrictMode>,
);

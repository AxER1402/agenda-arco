import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

import App from './App';
import { AuthProvider } from './context/AuthContext';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        {/* Los avisos heredan la tipografía del sistema; el radio y el material
            se los pone index.css, porque la hoja de sonner gana a las clases de
            utilidad. Los colores los sigue poniendo sonner con `richColors`. */}
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{
            classNames: {
              title: 'text-sm font-semibold',
              description: 'font-sans',
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

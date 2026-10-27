import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { queryClient } from './api/client';
import { ConfirmProvider } from './components/confirm';
import { AuthProvider } from './hooks/useAuth';
import './index.css';

// Installable, offline-capable app shell; updates apply automatically
registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ConfirmProvider>
          <App />
          <Toaster position="top-center" richColors closeButton theme="system" />
        </ConfirmProvider>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);

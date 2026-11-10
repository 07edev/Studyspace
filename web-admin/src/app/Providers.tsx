import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';
import { AuthProvider } from '../auth/AuthProvider';
import { createQueryClient } from '../lib/query';
import { ConfirmProvider, ToastProvider } from '../ui';

// Order matters: AuthProvider clears the query cache on sign-in/out, so it sits inside the client;
// the confirm dialog and toasts are available to everything, including the login page.
export function Providers({ children, client }: PropsWithChildren<{ client?: QueryClient }>) {
  const [queryClient] = useState(() => client ?? createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>{children}</AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

import { StrictMode, lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import App from './App.tsx';
import { ThemeProvider } from './components/shared/theme-provider';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { SternPlatformProvider } from './providers/SternPlatformProvider';
import './index.css';

// Register AG-Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

// Create a QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000, // 30 seconds
    },
  },
});

const PlatformProvider = lazy(() => import('./openfin/platform/OpenfinProvider'));
const DemoComponent = lazy(() => import('./components/DemoComponent'));
const SimpleBlotter = lazy(() => import('./components/widgets/blotters/simpleblotter/SimpleBlotter'));
const RenameViewDialog = lazy(() => import('./routes/RenameViewDialog'));
const ManageLayoutsDialog = lazy(() => import('./routes/dialogs/ManageLayoutsDialog'));

// Loading fallback component
const LoadingFallback = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
      <p className="mt-4 text-muted-foreground">Loading platform...</p>
    </div>
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <BrowserRouter>
            <div style={{ height: '100%', overflow: 'hidden' }}>
              <Routes>
                {/* Dialog routes - lightweight, no platform provider */}
                <Route
                  path="/dialogs/rename-view"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <RenameViewDialog />
                    </Suspense>
                  }
                />
                <Route
                  path="/dialogs/manage-layouts"
                  element={
                    <Suspense fallback={<LoadingFallback />}>
                      <ManageLayoutsDialog />
                    </Suspense>
                  }
                />

                {/* Application routes - wrapped with SternPlatformProvider */}
                <Route
                  path="/*"
                  element={
                    <SternPlatformProvider>
                      <Routes>
                        <Route path="/" element={<App />} />
                        <Route
                          path="/platform/provider"
                          element={
                            <Suspense fallback={<LoadingFallback />}>
                              <PlatformProvider />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/customcomponents"
                          element={
                            <Suspense fallback={<LoadingFallback />}>
                              <DemoComponent />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/blotters/simple"
                          element={
                            <Suspense fallback={<LoadingFallback />}>
                              <SimpleBlotter />
                            </Suspense>
                          }
                        />
                        <Route
                          path="/default"
                          element={
                            <Suspense fallback={<LoadingFallback />}>
                              <SimpleBlotter />
                            </Suspense>
                          }
                        />
                      </Routes>
                    </SternPlatformProvider>
                  }
                />
              </Routes>
            </div>
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>
);

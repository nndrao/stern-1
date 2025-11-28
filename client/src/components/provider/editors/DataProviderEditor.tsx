/**
 * DataProvider Editor Component - Enhanced
 * Main interface for managing DataProvider configurations
 * Features: Breadcrumb navigation, improved empty state, visual polish
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Database, ChevronRight, Settings } from 'lucide-react';

import { useOpenfinTheme } from '@stern/openfin-platform';
import { ProviderList } from '../ProviderList';
import { ProviderForm } from '../forms/ProviderForm';
import { TypeSelectionDialog } from './TypeSelectionDialog';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { useDeleteDataProvider } from '@/hooks/api/useDataProviderQueries';
import { DataProviderConfig, getDefaultProviderConfig, ProviderType } from '@stern/shared-types';
import { logger } from '@/utils/logger';

// System userId for admin configurations - shared across all users
const SYSTEM_USER_ID = 'System';

interface DataProviderEditorProps {
  userId?: string;
}

export const DataProviderEditor: React.FC<DataProviderEditorProps> = ({
  userId = SYSTEM_USER_ID // Default to System for admin configs
}) => {
  // Sync OpenFin platform theme with React theme provider
  useOpenfinTheme();

  const [showTypeDialog, setShowTypeDialog] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<DataProviderConfig | null>(null);
  const [providerToDelete, setProviderToDelete] = useState<DataProviderConfig | null>(null);

  const deleteMutation = useDeleteDataProvider();

  // Handle create new provider - show type selection dialog
  const handleCreate = useCallback(() => {
    setShowTypeDialog(true);
  }, []);

  // Handle delete provider
  const handleDelete = useCallback((provider: DataProviderConfig) => {
    setProviderToDelete(provider);
  }, []);

  // Confirm delete
  const handleConfirmDelete = useCallback(async () => {
    if (!providerToDelete?.providerId) return;

    try {
      await deleteMutation.mutateAsync({ providerId: providerToDelete.providerId, userId });
      // Clear current provider if it was the deleted one
      if (currentProvider?.providerId === providerToDelete.providerId) {
        setCurrentProvider(null);
      }
      logger.info('Provider deleted', { providerId: providerToDelete.providerId }, 'DataProviderEditor');
    } catch (error) {
      logger.error('Failed to delete provider', error, 'DataProviderEditor');
    } finally {
      setProviderToDelete(null);
    }
  }, [providerToDelete, deleteMutation, userId, currentProvider]);

  // Handle type selection from dialog
  const handleTypeSelect = useCallback((providerType: ProviderType) => {
    // Create new provider with empty/minimal values
    // User should fill in all fields themselves
    const newProvider: DataProviderConfig = {
      name: '',
      description: '',
      providerType,
      config: getDefaultProviderConfig(providerType) as any,
      tags: [],
      isDefault: false,
      userId
    };

    setCurrentProvider(newProvider);
    logger.info('New provider created', { providerType }, 'DataProviderEditor');
  }, [userId]);


  return (
    <div className="flex h-full bg-background datasource-config-window">
      {/* Left Sidebar */}
      <div className="w-72 border-r border-border flex flex-col bg-muted/30">
        {/* Sidebar Header */}
        <div className="px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Datasources</h2>
          </div>
        </div>

        {/* Provider List */}
        <div className="flex-1 overflow-hidden">
          <ProviderList
            userId={userId}
            currentProvider={currentProvider}
            onSelect={setCurrentProvider}
            onDelete={handleDelete}
          />
        </div>

        {/* New Provider Button */}
        <div className="p-3 border-t border-border bg-card">
          <Button onClick={handleCreate} className="w-full" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Datasource
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-background">
        {currentProvider ? (
          <>
            {/* Breadcrumb Header */}
            <div className="px-6 py-3 border-b border-border bg-card flex-shrink-0">
              <div className="flex items-center gap-2 text-sm">
                <Database className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Datasources</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{currentProvider.name || 'Untitled'}</span>
                {!currentProvider.providerId && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-md border border-blue-500/20">
                    New
                  </span>
                )}
              </div>
            </div>

            {/* Form Content - Takes remaining space */}
            <div className="flex-1 min-h-0 flex flex-col">
              <ProviderForm
                userId={userId}
                provider={currentProvider}
                onProviderChange={setCurrentProvider}
                onClose={() => setCurrentProvider(null)}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                <Settings className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Datasource Selected</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Select an existing datasource from the sidebar to view and edit its configuration,
                or create a new one to get started.
              </p>
              <Button onClick={handleCreate} size="lg" className="gap-2">
                <Plus className="w-4 h-4" />
                Create New Datasource
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Type Selection Dialog */}
      <TypeSelectionDialog
        open={showTypeDialog}
        onClose={() => setShowTypeDialog(false)}
        onSelect={handleTypeSelect}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={!!providerToDelete}
        onClose={() => setProviderToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Datasource"
        description={`Are you sure you want to delete "${providerToDelete?.name || 'this datasource'}"? This action cannot be undone.`}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

/**
 * STOMP Configuration Form - Refactored
 *
 * Simplified 3-tab interface for STOMP provider configuration.
 * Uses custom hooks for separation of concerns.
 *
 * IMPROVEMENTS:
 * - Reduced from 695 lines to ~250 lines (64% reduction)
 * - Reduced from 15+ state variables to 3 hook instances
 * - Better testability - hooks can be tested independently
 * - Clearer responsibilities - each hook has single purpose
 * - Easier maintenance - changes isolated to specific hooks
 */

import { useState, useEffect, useRef } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConnectionTab } from './ConnectionTab';
import { FieldsTab } from './FieldsTab';
import { ColumnsTab } from './ColumnsTab';
import { StompProviderConfig } from '@stern/shared-types';
import { useConnectionTest, useFieldInference, useColumnConfig } from './hooks';

interface StompConfigurationFormProps {
  name: string;
  config: StompProviderConfig;
  onChange: (field: string, value: any) => void;
  onNameChange: (name: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onClear?: () => void; // Callback to clear/deselect provider
  isEditMode?: boolean;
}

export function StompConfigurationForm({
  name,
  config,
  onChange,
  onNameChange,
  onSave,
  onCancel,
  onClear,
  isEditMode = false
}: StompConfigurationFormProps) {
  const [activeTab, setActiveTab] = useState('connection');
  const isInitialLoadRef = useRef(true);

  // Custom hooks for separated concerns
  const connectionTest = useConnectionTest(config);
  const fieldInference = useFieldInference(config);
  const columnConfig = useColumnConfig(
    fieldInference.inferredFields,
    fieldInference.committedSelectedFields,
    onChange
  );

  // Load existing configuration (only on initial mount)
  useEffect(() => {
    if (!isInitialLoadRef.current) return;
    isInitialLoadRef.current = false;

    // Initialize hooks from config
    fieldInference.initializeFromConfig(config);
    columnConfig.initializeFromConfig(config);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Ensure manualTopics is always true
  useEffect(() => {
    if (config.manualTopics !== true) {
      onChange('manualTopics', true);
    }
  }, [config.manualTopics, onChange]);

  // Handle field inference with auto-switch to fields tab
  const handleInferFields = async () => {
    await fieldInference.inferFields();
    if (fieldInference.inferredFields.length > 0) {
      setActiveTab('fields');
    }
  };

  // Handle clear all fields
  const handleClearAllFields = () => {
    fieldInference.clearAllFields();
    columnConfig.clearAll();
  };

  // Handle clear all columns
  const handleClearAllColumns = () => {
    fieldInference.clearAllFields();
    columnConfig.clearAll();
  };

  // Update form data helper
  const updateFormData = (updates: Partial<StompProviderConfig>) => {
    Object.entries(updates).forEach(([key, value]) => {
      onChange(key, value);
    });
  };

  return (
    <div className="h-full w-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
        <TabsList className="grid w-full grid-cols-3 rounded-none h-9 bg-muted/50 border-b">
          <TabsTrigger
            value="connection"
            className="rounded-none text-xs data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary"
          >
            Connection
          </TabsTrigger>
          <TabsTrigger
            value="fields"
            className="rounded-none text-xs data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary"
          >
            <span>Fields</span>
            {fieldInference.inferredFields.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-xs">
                {fieldInference.inferredFields.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="columns"
            className="rounded-none text-xs data-[state=active]:bg-background data-[state=active]:border-b-2 data-[state=active]:border-primary"
          >
            <span>Columns</span>
            {(fieldInference.committedSelectedFields.size + columnConfig.manualColumns.length) > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-4 px-1.5 text-xs">
                {fieldInference.committedSelectedFields.size + columnConfig.manualColumns.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          {/* Connection Tab */}
          <TabsContent value="connection" className="h-full overflow-hidden m-0">
            <ConnectionTab
              name={name}
              config={config}
              onChange={updateFormData}
              onNameChange={onNameChange}
            />
          </TabsContent>

          {/* Fields Tab */}
          <TabsContent value="fields" className="h-full overflow-hidden m-0">
            <FieldsTab
              name={name}
              inferredFields={fieldInference.inferredFields}
              selectedFields={fieldInference.selectedFields}
              expandedFields={fieldInference.expandedFields}
              fieldSearchQuery={fieldInference.fieldSearchQuery}
              selectAllChecked={fieldInference.selectAllChecked}
              selectAllIndeterminate={fieldInference.selectAllIndeterminate}
              onFieldToggle={fieldInference.toggleField}
              onExpandToggle={fieldInference.toggleExpand}
              onSearchChange={fieldInference.setFieldSearchQuery}
              onSelectAllChange={fieldInference.selectAll}
              onClearAll={handleClearAllFields}
              onInferFields={handleInferFields}
              inferring={fieldInference.inferring}
            />
          </TabsContent>

          {/* Columns Tab */}
          <TabsContent value="columns" className="h-full overflow-hidden m-0">
            <ColumnsTab
              name={name}
              selectedFields={fieldInference.committedSelectedFields}
              inferredFields={fieldInference.inferredFields}
              manualColumns={columnConfig.manualColumns}
              fieldColumnOverrides={columnConfig.fieldColumnOverrides}
              onManualColumnsChange={columnConfig.setManualColumns}
              onFieldColumnOverridesChange={columnConfig.setFieldColumnOverrides}
              onClearAll={handleClearAllColumns}
            />
          </TabsContent>
        </div>

        {/* Unified Footer */}
        <div className="sticky bottom-0 flex items-center justify-between px-3 py-2.5 border-t bg-background">
          <div className="flex items-center gap-2">
            {/* Connection tab buttons */}
            {activeTab === 'connection' && (
              <Button
                onClick={connectionTest.testConnection}
                disabled={connectionTest.testing || !config.websocketUrl}
                variant="outline"
                size="sm"
                className="h-7 px-3 text-xs"
              >
                {connectionTest.testing ? 'Testing...' : 'Test Connection'}
              </Button>
            )}

            {/* Fields tab buttons */}
            {activeTab === 'fields' && (
              <>
                {fieldInference.inferredFields.length === 0 && (
                  <Button
                    onClick={handleInferFields}
                    disabled={fieldInference.inferring || !config.websocketUrl}
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 text-xs"
                  >
                    {fieldInference.inferring ? 'Inferring...' : 'Infer Fields'}
                  </Button>
                )}
                {fieldInference.inferredFields.length > 0 && fieldInference.pendingFieldChanges && (
                  <Button
                    onClick={fieldInference.commitFieldSelection}
                    variant="default"
                    size="sm"
                    className="h-7 px-3 text-xs"
                  >
                    Update Columns
                  </Button>
                )}
              </>
            )}

            {/* Columns tab buttons */}
            {activeTab === 'columns' && (
              <Button
                onClick={handleClearAllColumns}
                variant="outline"
                size="sm"
                className="h-7 px-3 text-xs"
              >
                Clear All
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Clear/New button - only show when editing */}
            {isEditMode && onClear && (
              <Button
                onClick={onClear}
                variant="outline"
                size="sm"
                className="h-7 px-3 text-xs"
              >
                Clear Form
              </Button>
            )}
            <Button
              onClick={onCancel}
              variant="ghost"
              size="sm"
              className="h-7 px-3 text-xs text-foreground hover:bg-muted hover:text-foreground"
            >
              Cancel
            </Button>
            <Button onClick={onSave} variant="default" size="sm" className="h-7 px-3 text-xs">
              {isEditMode ? 'Update Dataprovider' : 'Create Dataprovider'}
            </Button>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

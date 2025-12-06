/**
 * useFieldInference
 *
 * Custom hook for inferring fields from STOMP data
 * Handles field inference, selection, and expansion state
 */

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/ui/use-toast';
import { StompProviderConfig } from '@stern/shared-types';
import {
  FieldNode,
  convertFieldInfoToNode,
  collectNonObjectLeaves,
  findFieldByPath
} from '../FieldSelector';

export interface UseFieldInferenceReturn {
  // State
  inferring: boolean;
  inferredFields: FieldNode[];
  selectedFields: Set<string>;
  expandedFields: Set<string>;
  fieldSearchQuery: string;
  selectAllChecked: boolean;
  selectAllIndeterminate: boolean;
  pendingFieldChanges: boolean;
  committedSelectedFields: Set<string>;

  // Actions
  inferFields: () => Promise<void>;
  toggleField: (path: string) => void;
  toggleExpand: (path: string) => void;
  setFieldSearchQuery: (query: string) => void;
  selectAll: (checked: boolean) => void;
  clearAllFields: () => void;
  commitFieldSelection: () => void;

  // Initialization
  initializeFromConfig: (config: StompProviderConfig) => void;
}

export function useFieldInference(config: StompProviderConfig): UseFieldInferenceReturn {
  const { toast } = useToast();

  // State
  const [inferring, setInferring] = useState(false);
  const [inferredFields, setInferredFields] = useState<FieldNode[]>([]);
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());
  const [fieldSearchQuery, setFieldSearchQuery] = useState('');
  const [selectAllChecked, setSelectAllChecked] = useState(false);
  const [selectAllIndeterminate, setSelectAllIndeterminate] = useState(false);
  const [pendingFieldChanges, setPendingFieldChanges] = useState(false);
  const [committedSelectedFields, setCommittedSelectedFields] = useState<Set<string>>(new Set());

  // Update select all checkbox state
  useEffect(() => {
    const allLeafPaths = new Set<string>();

    const collectAllLeafPaths = (fields: FieldNode[]) => {
      fields.forEach(field => {
        if (field.type !== 'object' || !field.children || field.children.length === 0) {
          allLeafPaths.add(field.path);
        }
        if (field.children) {
          collectAllLeafPaths(field.children);
        }
      });
    };

    collectAllLeafPaths(inferredFields);

    const selectedCount = Array.from(allLeafPaths).filter(path => selectedFields.has(path)).length;
    const totalCount = allLeafPaths.size;

    if (selectedCount === 0) {
      setSelectAllChecked(false);
      setSelectAllIndeterminate(false);
    } else if (selectedCount === totalCount) {
      setSelectAllChecked(true);
      setSelectAllIndeterminate(false);
    } else {
      setSelectAllChecked(false);
      setSelectAllIndeterminate(true);
    }
  }, [selectedFields, inferredFields]);

  const inferFields = useCallback(async () => {
    setInferring(true);

    if (!config.websocketUrl) {
      toast({
        title: 'Field Inference Failed',
        description: 'WebSocket URL is required',
        variant: 'destructive'
      });
      setInferring(false);
      return;
    }

    try {
      const { StompDataProvider } = await import('@/services/providers/StompDatasourceProvider');
      const { templateResolver } = await import('@/services/templateResolver');
      const { v4: uuidv4 } = await import('uuid');

      // Generate session ID for consistent UUID resolution
      const sessionId = uuidv4();

      // Resolve topics with templates
      let listenerTopic = config.listenerTopic || '';
      let requestMessage = config.requestMessage || '';

      listenerTopic = templateResolver.resolveTemplate(listenerTopic, sessionId);
      requestMessage = templateResolver.resolveTemplate(requestMessage, sessionId);

      // Create provider with resolved topics (only for snapshot inference)
      const provider = new StompDataProvider({
        websocketUrl: config.websocketUrl,
        listenerTopic,
        requestMessage,
        requestBody: config.requestBody || 'START',
        snapshotEndToken: config.snapshotEndToken || 'Success',
        keyColumn: config.keyColumn,
        messageRate: config.messageRate,
        snapshotTimeoutMs: config.snapshotTimeoutMs || 60000,
        dataType: config.dataType,
        batchSize: config.batchSize
      });

      // Fetch ONLY snapshot data (no real-time updates for performance)
      // fetchSnapshot creates its own client, fetches data, and auto-disconnects
      const result = await provider.fetchSnapshot(100);

      // Clean up session and provider instance
      templateResolver.clearSession(sessionId);
      // Provider instance will be garbage collected (no persistent connection)

      if (!result.success || !result.data || result.data.length === 0) {
        toast({
          title: 'Field Inference Failed',
          description: result.error || 'No data received from STOMP server',
          variant: 'destructive'
        });
        setInferring(false);
        return;
      }

      // Infer fields from data
      const inferredFieldsMap = StompDataProvider.inferFields(result.data);

      // Convert to FieldNode array
      const fieldNodes = Object.values(inferredFieldsMap).map(field => convertFieldInfoToNode(field));

      setInferredFields(fieldNodes);

      // Auto-expand object fields
      const objectPaths = new Set<string>();
      const findObjectFields = (fields: FieldNode[]) => {
        fields.forEach(field => {
          if (field.children) {
            objectPaths.add(field.path);
            findObjectFields(field.children);
          }
        });
      };
      findObjectFields(fieldNodes);
      setExpandedFields(objectPaths);

      toast({
        title: 'Fields Inferred',
        description: `Found ${fieldNodes.length} fields from ${result.data.length} sample rows`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to infer fields';
      toast({
        title: 'Field Inference Error',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setInferring(false);
    }
  }, [config, toast]);

  const toggleField = useCallback((path: string) => {
    const field = findFieldByPath(path, inferredFields);
    if (!field) return;

    setSelectedFields(prevSelected => {
      const newSelected = new Set(prevSelected);

      if (field.type === 'object') {
        // For object fields, toggle all non-object leaf children
        const leafPaths = collectNonObjectLeaves(field);
        const allLeavesSelected = leafPaths.every(leafPath => newSelected.has(leafPath));

        if (allLeavesSelected) {
          leafPaths.forEach(leafPath => newSelected.delete(leafPath));
        } else {
          leafPaths.forEach(leafPath => newSelected.add(leafPath));
        }
      } else {
        // For non-object fields, toggle normally
        if (newSelected.has(path)) {
          newSelected.delete(path);
        } else {
          newSelected.add(path);
        }
      }

      return newSelected;
    });

    setPendingFieldChanges(true);
  }, [inferredFields]);

  const toggleExpand = useCallback((path: string) => {
    setExpandedFields(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return newExpanded;
    });
  }, []);

  const selectAll = useCallback((checked: boolean) => {
    if (checked) {
      // Select all leaf fields
      const allLeafPaths = new Set<string>();
      const collectLeafPaths = (fields: FieldNode[]) => {
        fields.forEach(field => {
          if (field.type !== 'object' || !field.children || field.children.length === 0) {
            allLeafPaths.add(field.path);
          }
          if (field.children) {
            collectLeafPaths(field.children);
          }
        });
      };
      collectLeafPaths(inferredFields);
      setSelectedFields(allLeafPaths);
    } else {
      setSelectedFields(new Set());
    }
    setPendingFieldChanges(true);
  }, [inferredFields]);

  const clearAllFields = useCallback(() => {
    setInferredFields([]);
    setSelectedFields(new Set());
    setCommittedSelectedFields(new Set());
    setFieldSearchQuery('');
    setPendingFieldChanges(false);
  }, []);

  const commitFieldSelection = useCallback(() => {
    setCommittedSelectedFields(new Set(selectedFields));
    setPendingFieldChanges(false);
    toast({
      title: 'Columns Updated',
      description: `${selectedFields.size} field(s) will be used as columns`,
    });
  }, [selectedFields, toast]);

  const initializeFromConfig = useCallback((cfg: StompProviderConfig) => {
    if (cfg.inferredFields && cfg.inferredFields.length > 0) {
      const fieldNodes = cfg.inferredFields.map(convertFieldInfoToNode);
      setInferredFields(fieldNodes);

      // Auto-expand object fields
      const objectPaths = new Set<string>();
      const findObjectFields = (fields: FieldNode[]) => {
        fields.forEach(field => {
          if (field.children) {
            objectPaths.add(field.path);
            findObjectFields(field.children);
          }
        });
      };
      findObjectFields(fieldNodes);
      setExpandedFields(objectPaths);

      // Build selected fields set from column definitions
      if (cfg.columnDefinitions && cfg.columnDefinitions.length > 0) {
        const selected = new Set<string>();
        cfg.columnDefinitions.forEach(col => {
          if (cfg.inferredFields?.some(field => field.path === col.field)) {
            selected.add(col.field);
          }
        });
        setSelectedFields(selected);
        setCommittedSelectedFields(selected);
      }
    }
  }, []);

  return {
    inferring,
    inferredFields,
    selectedFields,
    expandedFields,
    fieldSearchQuery,
    selectAllChecked,
    selectAllIndeterminate,
    pendingFieldChanges,
    committedSelectedFields,
    inferFields,
    toggleField,
    toggleExpand,
    setFieldSearchQuery,
    selectAll,
    clearAllFields,
    commitFieldSelection,
    initializeFromConfig
  };
}

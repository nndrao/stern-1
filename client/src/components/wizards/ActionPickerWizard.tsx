/**
 * ActionPickerWizard
 *
 * A wizard dialog for selecting actions from the action registry.
 * Shows available actions organized by category with search functionality.
 * Supports configuring action parameters when applicable.
 */

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Check, ChevronLeft, Settings2 } from 'lucide-react';
import { useActionRegistry } from '@/hooks/useActionRegistry';
import { RegisteredAction, ActionParameter } from '@/registry/actionRegistry';
import { resolveIcon } from './IconPickerDialog';

// ============================================================================
// Types
// ============================================================================

export interface ActionPickerResult {
  /** Selected action ID */
  actionId: string;
  /** Configured action data (parameters) */
  actionData?: Record<string, unknown>;
}

export interface ActionPickerWizardProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Callback when an action is selected */
  onSelect: (result: ActionPickerResult) => void;
  /** Currently selected action ID (for editing) */
  currentActionId?: string;
  /** Current action data (for editing) */
  currentActionData?: Record<string, unknown>;
}

// ============================================================================
// Component
// ============================================================================

export const ActionPickerWizard: React.FC<ActionPickerWizardProps> = ({
  open,
  onClose,
  onSelect,
  currentActionId,
  currentActionData,
}) => {
  const { actions, categories, getByCategory } = useActionRegistry();

  // State
  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState<RegisteredAction | null>(
    currentActionId ? actions.find((a) => a.id === currentActionId) ?? null : null
  );
  const [parameterValues, setParameterValues] = useState<Record<string, unknown>>(
    currentActionData ?? {}
  );
  const [activeCategory, setActiveCategory] = useState<string>(
    categories[0] ?? 'Grid'
  );

  // Filter actions by search query
  const filteredActions = useMemo(() => {
    if (!searchQuery.trim()) return actions;
    const query = searchQuery.toLowerCase();
    return actions.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        a.description?.toLowerCase().includes(query) ||
        a.category.toLowerCase().includes(query) ||
        a.id.toLowerCase().includes(query)
    );
  }, [actions, searchQuery]);

  // Group filtered actions by category
  const actionsByCategory = useMemo(() => {
    const grouped: Record<string, RegisteredAction[]> = {};
    filteredActions.forEach((action) => {
      if (!grouped[action.category]) {
        grouped[action.category] = [];
      }
      grouped[action.category].push(action);
    });
    return grouped;
  }, [filteredActions]);

  // Available categories (from filtered results)
  const availableCategories = useMemo(() => {
    return Object.keys(actionsByCategory).sort();
  }, [actionsByCategory]);

  // Handle action selection
  const handleSelectAction = (action: RegisteredAction) => {
    setSelectedAction(action);

    // Initialize default parameter values
    if (action.parameters?.length) {
      const defaults: Record<string, unknown> = {};
      action.parameters.forEach((param) => {
        defaults[param.name] =
          currentActionId === action.id && currentActionData?.[param.name] !== undefined
            ? currentActionData[param.name]
            : param.default;
      });
      setParameterValues(defaults);
      setStep('configure');
    } else {
      // No parameters - select immediately
      onSelect({ actionId: action.id });
      handleClose();
    }
  };

  // Handle confirm (with parameters)
  const handleConfirm = () => {
    if (!selectedAction) return;

    onSelect({
      actionId: selectedAction.id,
      actionData:
        Object.keys(parameterValues).length > 0 ? parameterValues : undefined,
    });
    handleClose();
  };

  // Handle back to selection
  const handleBack = () => {
    setStep('select');
  };

  // Handle close and reset
  const handleClose = () => {
    setStep('select');
    setSearchQuery('');
    setSelectedAction(
      currentActionId ? actions.find((a) => a.id === currentActionId) ?? null : null
    );
    setParameterValues(currentActionData ?? {});
    onClose();
  };

  // Render parameter input based on type
  const renderParameterInput = (param: ActionParameter) => {
    const value = parameterValues[param.name];

    switch (param.type) {
      case 'boolean':
        return (
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor={param.name}>{param.label}</Label>
              {param.description && (
                <p className="text-xs text-muted-foreground">{param.description}</p>
              )}
            </div>
            <Switch
              id={param.name}
              checked={(value as boolean) ?? false}
              onCheckedChange={(checked) =>
                setParameterValues((prev) => ({ ...prev, [param.name]: checked }))
              }
            />
          </div>
        );

      case 'select':
        return (
          <div className="space-y-1.5">
            <Label htmlFor={param.name}>{param.label}</Label>
            <Select
              value={String(value ?? '')}
              onValueChange={(v) =>
                setParameterValues((prev) => ({ ...prev, [param.name]: v }))
              }
            >
              <SelectTrigger id={param.name}>
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                {param.options?.map((opt: { label: string; value: unknown }) => (
                  <SelectItem key={String(opt.value)} value={String(opt.value)}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {param.description && (
              <p className="text-xs text-muted-foreground">{param.description}</p>
            )}
          </div>
        );

      case 'number':
        return (
          <div className="space-y-1.5">
            <Label htmlFor={param.name}>{param.label}</Label>
            <Input
              id={param.name}
              type="number"
              value={(value as number) ?? ''}
              onChange={(e) =>
                setParameterValues((prev) => ({
                  ...prev,
                  [param.name]: e.target.value ? parseFloat(e.target.value) : undefined,
                }))
              }
              placeholder={param.default !== undefined ? String(param.default) : undefined}
            />
            {param.description && (
              <p className="text-xs text-muted-foreground">{param.description}</p>
            )}
          </div>
        );

      case 'string':
      default:
        return (
          <div className="space-y-1.5">
            <Label htmlFor={param.name}>{param.label}</Label>
            <Input
              id={param.name}
              value={(value as string) ?? ''}
              onChange={(e) =>
                setParameterValues((prev) => ({
                  ...prev,
                  [param.name]: e.target.value || undefined,
                }))
              }
              placeholder={param.default !== undefined ? String(param.default) : undefined}
            />
            {param.description && (
              <p className="text-xs text-muted-foreground">{param.description}</p>
            )}
          </div>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' ? 'Select Action' : `Configure: ${selectedAction?.name}`}
          </DialogTitle>
        </DialogHeader>

        {step === 'select' ? (
          <>
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search actions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Actions by Category */}
            <div className="flex-1 min-h-0">
              {availableCategories.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No actions found
                </div>
              ) : (
                <Tabs
                  value={activeCategory}
                  onValueChange={setActiveCategory}
                  className="h-full flex flex-col"
                >
                  <TabsList className="flex-wrap h-auto gap-1 p-1 justify-start">
                    {availableCategories.map((category) => (
                      <TabsTrigger key={category} value={category} className="text-xs">
                        {category}
                        <Badge variant="secondary" className="ml-1.5 text-xs px-1.5">
                          {actionsByCategory[category]?.length ?? 0}
                        </Badge>
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  <ScrollArea className="flex-1 mt-3">
                    {availableCategories.map((category) => (
                      <TabsContent
                        key={category}
                        value={category}
                        className="mt-0 space-y-2"
                      >
                        {actionsByCategory[category]?.map((action) => {
                          const Icon = resolveIcon(action.icon);
                          const isSelected = selectedAction?.id === action.id;
                          const hasParams = (action.parameters?.length ?? 0) > 0;

                          return (
                            <div
                              key={action.id}
                              onClick={() => handleSelectAction(action)}
                              className={`
                                p-3 rounded-lg border cursor-pointer transition-colors
                                hover:bg-accent hover:border-primary
                                ${isSelected ? 'bg-accent border-primary' : ''}
                              `}
                            >
                              <div className="flex items-start gap-3">
                                {Icon && (
                                  <Icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{action.name}</span>
                                    {hasParams && (
                                      <Badge variant="outline" className="text-xs">
                                        <Settings2 className="h-3 w-3 mr-1" />
                                        Configurable
                                      </Badge>
                                    )}
                                  </div>
                                  {action.description && (
                                    <p className="text-sm text-muted-foreground mt-0.5">
                                      {action.description}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground/70 mt-1 font-mono">
                                    {action.id}
                                  </p>
                                </div>
                                {isSelected && (
                                  <Check className="h-5 w-5 text-primary flex-shrink-0" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </TabsContent>
                    ))}
                  </ScrollArea>
                </Tabs>
              )}
            </div>
          </>
        ) : (
          /* Configuration Step */
          <div className="flex-1 space-y-4 overflow-auto">
            {/* Selected Action Info */}
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = resolveIcon(selectedAction?.icon);
                  return Icon ? <Icon className="h-5 w-5" /> : null;
                })()}
                <div>
                  <div className="font-medium">{selectedAction?.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedAction?.description}
                  </div>
                </div>
              </div>
            </div>

            {/* Parameters */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Configuration</h4>
              {selectedAction?.parameters?.map((param) => (
                <div key={param.name}>{renderParameterInput(param)}</div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="flex-shrink-0">
          {step === 'configure' && (
            <Button variant="outline" onClick={handleBack} className="mr-auto">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          )}
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          {step === 'configure' && (
            <Button onClick={handleConfirm}>Confirm</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ActionPickerWizard;

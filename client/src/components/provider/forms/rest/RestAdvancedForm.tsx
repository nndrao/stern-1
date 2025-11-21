/**
 * REST Provider Advanced Configuration Form
 * REFACTORED: Extracted from ProviderForm.tsx for better maintainability
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { RestProviderConfig } from '@stern/shared-types';
import { KeyValueEditor } from '../../editors/KeyValueEditor';

interface RestAdvancedFormProps {
  config: RestProviderConfig;
  onChange: (field: string, value: any) => void;
}

export const RestAdvancedForm: React.FC<RestAdvancedFormProps> = ({ config, onChange }) => (
  <div className="space-y-6">
    {/* Custom Headers */}
    <KeyValueEditor
      label="Custom Headers"
      description="HTTP headers to include with each request"
      value={config.headers || {}}
      onChange={(value) => onChange('headers', value)}
      keyPlaceholder="Header name"
      valuePlaceholder="Header value"
    />

    <Separator />

    <div className="space-y-2">
      <Label htmlFor="timeout">Request Timeout (ms)</Label>
      <Input
        id="timeout"
        type="number"
        value={config.timeout || 30000}
        onChange={(e) => onChange('timeout', parseInt(e.target.value))}
      />
      <p className="text-xs text-muted-foreground">
        Maximum time to wait for a response
      </p>
    </div>

    <Separator />

    <div className="space-y-2">
      <Label htmlFor="paginationMode">Pagination Mode</Label>
      <Select
        value={config.paginationMode || 'offset'}
        onValueChange={(value) => onChange('paginationMode', value)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="offset">Offset-based</SelectItem>
          <SelectItem value="cursor">Cursor-based</SelectItem>
          <SelectItem value="page">Page-based</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Strategy for paginating through large datasets
      </p>
    </div>

    <div className="space-y-2">
      <Label htmlFor="pageSize">Page Size</Label>
      <Input
        id="pageSize"
        type="number"
        value={config.pageSize || 100}
        onChange={(e) => onChange('pageSize', parseInt(e.target.value))}
      />
      <p className="text-xs text-muted-foreground">
        Number of records to fetch per page
      </p>
    </div>

    <Alert>
      <Info className="h-4 w-4" />
      <AlertDescription className="text-xs">
        Common headers: Content-Type, Accept, Authorization, X-API-Key
      </AlertDescription>
    </Alert>
  </div>
);

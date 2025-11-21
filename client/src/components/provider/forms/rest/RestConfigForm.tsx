/**
 * REST Provider Configuration Form
 * REFACTORED: Extracted from ProviderForm.tsx for better maintainability
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { RestProviderConfig } from '@stern/shared-types';
import { KeyValueEditor } from '../../editors/KeyValueEditor';

interface RestConfigFormProps {
  config: RestProviderConfig;
  onChange: (field: string, value: any) => void;
}

export const RestConfigForm: React.FC<RestConfigFormProps> = ({ config, onChange }) => (
  <div className="space-y-6">
    <div className="space-y-2">
      <Label htmlFor="baseUrl">Base URL *</Label>
      <Input
        id="baseUrl"
        value={config.baseUrl || ''}
        onChange={(e) => onChange('baseUrl', e.target.value)}
        placeholder="https://api.example.com"
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="endpoint">Endpoint *</Label>
      <Input
        id="endpoint"
        value={config.endpoint || ''}
        onChange={(e) => onChange('endpoint', e.target.value)}
        placeholder="/v1/positions"
      />
    </div>

    <div className="space-y-2">
      <Label htmlFor="method">HTTP Method</Label>
      <Select
        value={config.method}
        onValueChange={(value) => onChange('method', value)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="GET">GET</SelectItem>
          <SelectItem value="POST">POST</SelectItem>
        </SelectContent>
      </Select>
    </div>

    <Separator />

    {/* Query Parameters */}
    <KeyValueEditor
      label="Query Parameters"
      description="URL query string parameters (e.g., symbol, limit, filter)"
      value={config.queryParams || {}}
      onChange={(value) => onChange('queryParams', value)}
      keyPlaceholder="Parameter name"
      valuePlaceholder="Parameter value"
    />

    {/* POST Body - Only show for POST method */}
    {config.method === 'POST' && (
      <>
        <Separator />
        <div className="space-y-2">
          <Label htmlFor="body">Request Body (JSON)</Label>
          <Textarea
            id="body"
            value={config.body || ''}
            onChange={(e) => onChange('body', e.target.value)}
            placeholder='{"filter": "active", "sort": "desc"}'
            rows={6}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Enter valid JSON for the POST request body
          </p>
        </div>
      </>
    )}

    <Separator />

    <div className="space-y-2">
      <Label htmlFor="pollInterval">Poll Interval (ms)</Label>
      <Input
        id="pollInterval"
        type="number"
        value={config.pollInterval || 5000}
        onChange={(e) => onChange('pollInterval', parseInt(e.target.value))}
      />
      <p className="text-xs text-muted-foreground">
        How often to poll the API for updates
      </p>
    </div>
  </div>
);

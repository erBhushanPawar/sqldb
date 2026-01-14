'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Settings, Plus, Trash2, Save, Database } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface SchemaTable {
  name: string;
  columns: Array<{ name: string; type: string }>;
}

interface SearchFieldConfig {
  field: string;
  boost: number;
}

interface GeoConfig {
  enabled: boolean;
  latitudeField: string;
  longitudeField: string;
  locationNameField?: string;
}

interface TableSearchConfig {
  table: string;
  tokenizer: 'simple' | 'stemming' | 'ngram';
  minWordLength: number;
  searchableFields: SearchFieldConfig[];
  geo?: GeoConfig;
}

export function SearchConfigInterface() {
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [tableSchema, setTableSchema] = useState<SchemaTable | null>(null);
  const [config, setConfig] = useState<TableSearchConfig>({
    table: '',
    tokenizer: 'stemming',
    minWordLength: 3,
    searchableFields: [],
    geo: undefined,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchTableSchema(selectedTable);
      setConfig({
        table: selectedTable,
        tokenizer: 'stemming',
        minWordLength: 3,
        searchableFields: [],
        geo: undefined,
      });
    }
  }, [selectedTable]);

  const fetchTables = async () => {
    try {
      const response = await fetch('/api/schema');
      if (!response.ok) throw new Error('Failed to fetch tables');
      const data = await response.json();
      setTables(data.tables || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tables');
    }
  };

  const fetchTableSchema = async (table: string) => {
    try {
      const response = await fetch(`/api/schema/${table}`);
      if (!response.ok) throw new Error('Failed to fetch schema');
      const data = await response.json();

      // Transform the schema to match our interface
      if (data.success && data.schema) {
        let columnData: Array<{ name: string; type: string }> = [];

        // Check if schema has a 'columns' key (structured format)
        if (data.schema.columns && Array.isArray(data.schema.columns)) {
          // Schema columns is an array of column objects
          columnData = data.schema.columns.map((col: any) => ({
            name: col.columnName || col.name,
            type: col.columnType || col.dataType || col.type || 'unknown',
          }));
        } else if (data.schema.columns && typeof data.schema.columns === 'object') {
          // Schema columns is an object map
          columnData = Object.entries(data.schema.columns).map(([name, type]) => ({
            name,
            type: String(type),
          }));
        } else {
          // Fallback: filter out metadata fields from root level
          const metadataKeys = ['tableName', 'columns', 'primaryKey', 'indexes', 'foreignKeys', 'uniqueConstraints'];
          columnData = Object.entries(data.schema)
            .filter(([name]) => !metadataKeys.includes(name))
            .filter(([_, type]) => typeof type === 'string')
            .map(([name, type]) => ({
              name,
              type: String(type),
            }));
        }

        const transformedSchema: SchemaTable = {
          name: table,
          columns: columnData,
        };
        setTableSchema(transformedSchema);
      } else {
        throw new Error('Invalid schema format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch schema');
      setTableSchema(null);
    }
  };

  const addSearchableField = (field: string) => {
    if (config.searchableFields.find((f) => f.field === field)) {
      return; // Already added
    }
    setConfig({
      ...config,
      searchableFields: [
        ...config.searchableFields,
        { field, boost: 1.0 },
      ],
    });
  };

  const removeSearchableField = (field: string) => {
    setConfig({
      ...config,
      searchableFields: config.searchableFields.filter((f) => f.field !== field),
    });
  };

  const updateFieldBoost = (field: string, boost: number) => {
    setConfig({
      ...config,
      searchableFields: config.searchableFields.map((f) =>
        f.field === field ? { ...f, boost } : f
      ),
    });
  };

  const getProcessingDescription = (type: string, tokenizer: string) => {
    const typeLower = type.toLowerCase();

    // Determine field type description
    let baseDesc = 'Field';
    if (typeLower.includes('text') || typeLower.includes('longtext') || typeLower.includes('mediumtext')) {
      baseDesc = 'Long text content';
    } else if (typeLower.includes('varchar') || typeLower.includes('char')) {
      baseDesc = 'Short text field';
    } else if (typeLower.includes('int') || typeLower.includes('decimal') || typeLower.includes('float') || typeLower.includes('double')) {
      baseDesc = 'Numeric field (converted to text)';
    } else if (typeLower.includes('date') || typeLower.includes('time')) {
      baseDesc = 'Date/time field (converted to text)';
    } else if (typeLower.includes('json')) {
      baseDesc = 'JSON field (searchable as text)';
    } else if (typeLower.includes('enum')) {
      baseDesc = 'Enum field';
    }

    const tokenizerDesc = {
      simple: 'Split by spaces, case-insensitive',
      stemming: 'Word stemming (run/runs → run), ignores common words',
      ngram: 'Character sequences, fuzzy matching',
    }[tokenizer] || 'Standard text processing';

    return `${baseDesc} • ${tokenizerDesc}`;
  };

  const getBoostDescription = (boost: number) => {
    if (boost >= 3.0) return '🔥 Very High Priority';
    if (boost >= 2.0) return '⬆️ High Priority';
    if (boost >= 1.5) return '↗️ Medium-High Priority';
    if (boost > 1.0) return '→ Above Normal';
    if (boost === 1.0) return '• Normal';
    return '↓ Lower Priority';
  };

  const getColumnTypeIcon = (type: string) => {
    const typeLower = type.toLowerCase();
    if (typeLower.includes('text')) return '📝';
    if (typeLower.includes('varchar') || typeLower.includes('char')) return '📄';
    if (typeLower.includes('int') || typeLower.includes('decimal') || typeLower.includes('float')) return '🔢';
    if (typeLower.includes('date') || typeLower.includes('time')) return '📅';
    if (typeLower.includes('json')) return '{}';
    if (typeLower.includes('enum')) return '⚙️';
    return '📋';
  };

  const toggleGeo = (enabled: boolean) => {
    if (enabled) {
      // Find lat/lng columns
      const latCol = tableSchema?.columns.find(
        (c) => c.name.toLowerCase().includes('lat')
      );
      const lngCol = tableSchema?.columns.find(
        (c) => c.name.toLowerCase().includes('lng') || c.name.toLowerCase().includes('lon')
      );

      setConfig({
        ...config,
        geo: {
          enabled: true,
          latitudeField: latCol?.name || '',
          longitudeField: lngCol?.name || '',
        },
      });
    } else {
      setConfig({
        ...config,
        geo: undefined,
      });
    }
  };

  const saveConfiguration = async () => {
    if (config.searchableFields.length === 0) {
      setError('Please add at least one searchable field');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/search/${config.table}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save configuration');
      }

      setSuccess('Configuration saved successfully! You can now build the search index.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  // Show all columns - let SqlDB handle processing
  const allColumns = tableSchema?.columns || [];

  const numericColumns = tableSchema?.columns.filter(
    (c) => c.type.includes('int') || c.type.includes('float') || c.type.includes('double') || c.type.includes('decimal')
  ) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Search Configuration
        </CardTitle>
        <CardDescription>
          Configure full-text search and geo-location settings for your tables
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/10 text-green-700 dark:text-green-400 p-3 rounded-md text-sm">
            {success}
          </div>
        )}

        {/* Table Selection */}
        <div className="space-y-2">
          <Label>Select Table</Label>
          <Select value={selectedTable} onValueChange={setSelectedTable}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a table to configure..." />
            </SelectTrigger>
            <SelectContent>
              {tables.map((table) => (
                <SelectItem key={table.name} value={table.name}>
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    {table.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTable && tableSchema && (
          <>
            {/* Configuration Summary */}
            {config.searchableFields.length > 0 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Configuration Summary
                </h3>
                <div className="space-y-1 text-sm">
                  <p className="text-blue-800 dark:text-blue-200">
                    <strong>{config.searchableFields.length}</strong> field{config.searchableFields.length !== 1 ? 's' : ''} will be indexed with{' '}
                    <strong>{config.tokenizer}</strong> tokenization
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {config.searchableFields
                      .sort((a, b) => b.boost - a.boost)
                      .map((field) => (
                        <Badge key={field.field} variant="secondary" className="text-xs">
                          {field.field} ({field.boost}x)
                        </Badge>
                      ))}
                  </div>
                  {config.geo?.enabled && (
                    <p className="text-blue-800 dark:text-blue-200 pt-2 border-t border-blue-200 dark:border-blue-800 mt-2">
                      ✓ Geo-search enabled with {config.geo.latitudeField} / {config.geo.longitudeField}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Basic Configuration */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-medium">Basic Settings</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tokenizer">Tokenizer</Label>
                  <Select
                    value={config.tokenizer}
                    onValueChange={(v) =>
                      setConfig({ ...config, tokenizer: v as any })
                    }
                  >
                    <SelectTrigger id="tokenizer">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simple">Simple (word split)</SelectItem>
                      <SelectItem value="stemming">Stemming (recommended)</SelectItem>
                      <SelectItem value="ngram">N-gram (fuzzy)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minWordLength">Min Word Length</Label>
                  <Input
                    id="minWordLength"
                    type="number"
                    min="1"
                    max="10"
                    value={config.minWordLength}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        minWordLength: parseInt(e.target.value, 10),
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Searchable Fields */}
            <div className="space-y-4 p-4 border rounded-lg">
              <h3 className="font-medium">Searchable Fields</h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Select Columns to Index</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Select all columns with smart boosts
                        const newFields: SearchFieldConfig[] = allColumns.map((col) => {
                          // Smart boost based on common field names
                          let boost = 1.0;
                          const name = col.name.toLowerCase();
                          if (name.includes('title') || name.includes('name')) boost = 3.0;
                          else if (name.includes('summary') || name.includes('excerpt')) boost = 2.0;
                          else if (name.includes('description') || name.includes('content')) boost = 1.0;
                          else if (name.includes('tag') || name.includes('category')) boost = 2.5;

                          return { field: col.name, boost };
                        });
                        setConfig({ ...config, searchableFields: newFields });
                      }}
                    >
                      Select All
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfig({ ...config, searchableFields: [] })}
                      disabled={config.searchableFields.length === 0}
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
                {allColumns.length > 0 ? (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {allColumns.map((col) => {
                      const isSelected = !!config.searchableFields.find((f) => f.field === col.name);
                      const fieldConfig = config.searchableFields.find((f) => f.field === col.name);

                      return (
                        <div
                          key={col.name}
                          className={`p-3 border rounded-lg transition-colors ${
                            isSelected ? 'border-primary bg-primary/5' : 'hover:border-gray-400'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex items-center h-5 pt-1">
                              <input
                                type="checkbox"
                                id={`field-${col.name}`}
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    addSearchableField(col.name);
                                  } else {
                                    removeSearchableField(col.name);
                                  }
                                }}
                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                              />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg" title={col.type}>
                                  {getColumnTypeIcon(col.type)}
                                </span>
                                <label
                                  htmlFor={`field-${col.name}`}
                                  className="font-medium cursor-pointer"
                                >
                                  {col.name}
                                </label>
                                <Badge variant="outline" className="text-xs">
                                  {col.type}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mb-2">
                                {getProcessingDescription(col.type, config.tokenizer)}
                              </p>

                              {isSelected && (
                                <div className="flex items-center gap-2 mt-2">
                                  <Label className="text-xs whitespace-nowrap">Relevance Boost:</Label>
                                  <Input
                                    type="number"
                                    step="0.5"
                                    min="0.1"
                                    max="10"
                                    value={fieldConfig?.boost || 1.0}
                                    onChange={(e) =>
                                      updateFieldBoost(col.name, parseFloat(e.target.value))
                                    }
                                    className="w-20 h-8"
                                  />
                                  <span className="text-xs text-muted-foreground">
                                    {getBoostDescription(fieldConfig?.boost || 1.0)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground border rounded-lg">
                    No columns found in this table
                  </div>
                )}

                {config.searchableFields.length > 0 && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">
                      Selected {config.searchableFields.length} field{config.searchableFields.length !== 1 ? 's' : ''} for indexing
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Geo Configuration */}
            {numericColumns.length >= 2 && (
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Geo-Location Search</h3>
                    <p className="text-sm text-muted-foreground">
                      Enable location-based queries
                    </p>
                  </div>
                  <Switch
                    checked={!!config.geo?.enabled}
                    onCheckedChange={toggleGeo}
                  />
                </div>

                {config.geo?.enabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <Label>Latitude Field</Label>
                      <Select
                        value={config.geo.latitudeField}
                        onValueChange={(v) =>
                          setConfig({
                            ...config,
                            geo: { ...config.geo!, latitudeField: v },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {numericColumns.map((col) => (
                            <SelectItem key={col.name} value={col.name}>
                              {col.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Longitude Field</Label>
                      <Select
                        value={config.geo.longitudeField}
                        onValueChange={(v) =>
                          setConfig({
                            ...config,
                            geo: { ...config.geo!, longitudeField: v },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {numericColumns.map((col) => (
                            <SelectItem key={col.name} value={col.name}>
                              {col.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label>Location Name Field (optional)</Label>
                      <Select
                        value={config.geo.locationNameField || 'none'}
                        onValueChange={(v) =>
                          setConfig({
                            ...config,
                            geo: { ...config.geo!, locationNameField: v === 'none' ? undefined : v },
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a text column..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {allColumns.map((col) => (
                            <SelectItem key={col.name} value={col.name}>
                              {col.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Save Button */}
            <Button
              onClick={saveConfiguration}
              disabled={saving || config.searchableFields.length === 0}
              className="w-full"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Configuration'}
            </Button>

            {config.searchableFields.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                Add at least one searchable field to enable save
              </p>
            )}
          </>
        )}

        {!selectedTable && (
          <div className="text-center p-8 text-muted-foreground">
            Select a table to configure search settings
          </div>
        )}
      </CardContent>
    </Card>
  );
}

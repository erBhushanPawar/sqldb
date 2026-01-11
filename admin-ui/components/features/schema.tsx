'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Database, Key, Table as TableIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SchemaTable {
  name: string;
  rowCount?: number;
}

interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  extra?: string;
}

interface TableDetail {
  columns: TableColumn[];
  primaryKey?: string[];
  foreignKeys?: Array<{
    column: string;
    referencedTable: string;
    referencedColumn: string;
  }>;
  indexes?: Array<{
    name: string;
    columns: string[];
    unique: boolean;
  }>;
}

export function SchemaDiscovery() {
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableDetail, setTableDetail] = useState<TableDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      fetchTableDetail(selectedTable);
    }
  }, [selectedTable]);

  const fetchTables = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/schema');
      if (!response.ok) throw new Error('Failed to fetch schema');
      const data = await response.json();
      setTables(data.tables || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch schema');
    } finally {
      setLoading(false);
    }
  };

  const fetchTableDetail = async (tableName: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/schema/${tableName}`);
      if (!response.ok) throw new Error(`Failed to fetch details for ${tableName}`);
      const data = await response.json();
      setTableDetail(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to fetch details for ${tableName}`
      );
      setTableDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const getTypeColor = (type: string) => {
    const typeUpper = type.toUpperCase();
    if (typeUpper.includes('INT')) return 'bg-blue-500/10 text-blue-500';
    if (typeUpper.includes('VARCHAR') || typeUpper.includes('TEXT'))
      return 'bg-green-500/10 text-green-500';
    if (typeUpper.includes('DATE') || typeUpper.includes('TIME'))
      return 'bg-purple-500/10 text-purple-500';
    if (typeUpper.includes('DECIMAL') || typeUpper.includes('FLOAT'))
      return 'bg-orange-500/10 text-orange-500';
    return 'bg-gray-500/10 text-gray-500';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Tables List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              <CardTitle>Tables</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={fetchTables}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && !selectedTable && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : tables.length > 0 ? (
            <div className="space-y-1">
              {tables.map((table) => (
                <button
                  key={table.name}
                  onClick={() => setSelectedTable(table.name)}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                    selectedTable === table.name
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TableIcon className="h-4 w-4" />
                      <span className="font-medium">{table.name}</span>
                    </div>
                    {table.rowCount !== undefined && (
                      <Badge variant="outline" className="text-xs">
                        {table.rowCount.toLocaleString()}
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 text-muted-foreground">
              No tables found
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table Details */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>
            {selectedTable ? `Schema: ${selectedTable}` : 'Table Details'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedTable ? (
            <div className="text-center p-12 text-muted-foreground">
              <Database className="h-16 w-16 mx-auto mb-4 opacity-20" />
              <p>Select a table to view its schema</p>
            </div>
          ) : detailLoading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : error && selectedTable ? (
            <div className="bg-destructive/10 text-destructive p-3 rounded-md">
              {error}
            </div>
          ) : tableDetail ? (
            <div className="space-y-6">
              {/* Columns */}
              <div>
                <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                  <TableIcon className="h-5 w-5" />
                  Columns
                </h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Nullable</TableHead>
                        <TableHead>Default</TableHead>
                        <TableHead>Extra</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tableDetail.columns.map((column) => (
                        <TableRow key={column.name}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {column.name}
                              {tableDetail.primaryKey?.includes(column.name) && (
                                <Key className="h-3 w-3 text-yellow-500" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getTypeColor(column.type)}>
                              {column.type}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={column.nullable ? 'outline' : 'secondary'}>
                              {column.nullable ? 'YES' : 'NO'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {column.defaultValue !== undefined &&
                            column.defaultValue !== null
                              ? String(column.defaultValue)
                              : '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {column.extra || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Primary Key */}
              {tableDetail.primaryKey && tableDetail.primaryKey.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <Key className="h-5 w-5 text-yellow-500" />
                    Primary Key
                  </h3>
                  <div className="flex gap-2">
                    {tableDetail.primaryKey.map((key) => (
                      <Badge key={key} className="bg-yellow-500/10 text-yellow-500">
                        {key}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Foreign Keys */}
              {tableDetail.foreignKeys && tableDetail.foreignKeys.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Foreign Keys</h3>
                  <div className="space-y-2">
                    {tableDetail.foreignKeys.map((fk, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-3 bg-muted rounded-md"
                      >
                        <Badge>{fk.column}</Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge variant="outline">{fk.referencedTable}</Badge>
                        <span className="text-muted-foreground text-sm">
                          ({fk.referencedColumn})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Indexes */}
              {tableDetail.indexes && tableDetail.indexes.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Indexes</h3>
                  <div className="space-y-2">
                    {tableDetail.indexes.map((index, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-3 bg-muted rounded-md"
                      >
                        <Badge variant={index.unique ? 'default' : 'outline'}>
                          {index.name}
                        </Badge>
                        <span className="text-muted-foreground text-sm">
                          ({index.columns.join(', ')})
                        </span>
                        {index.unique && (
                          <Badge variant="secondary" className="text-xs">
                            UNIQUE
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

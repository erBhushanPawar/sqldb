'use client';

import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';

interface SchemaTable {
  name: string;
}

interface TableColumn {
  name: string;
  type: string;
}

interface TableRecord {
  [key: string]: any;
}

export function CrudInterface() {
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [records, setRecords] = useState<TableRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 10;

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<TableRecord | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});

  useEffect(() => {
    fetchTables();
  }, []);

  useEffect(() => {
    if (selectedTable) {
      // Reset columns when table changes
      setColumns([]);
      setCurrentPage(1);
      fetchTableData();
    }
  }, [selectedTable]);

  useEffect(() => {
    if (selectedTable && currentPage > 1) {
      fetchTableData();
    }
  }, [currentPage]);

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

  const fetchTableData = async () => {
    setLoading(true);
    try {
      // Fetch table schema first if we don't have columns yet
      if (columns.length === 0) {
        const schemaResponse = await fetch(`/api/schema/${selectedTable}`);
        if (schemaResponse.ok) {
          const schemaData = await schemaResponse.json();
          if (schemaData.success && schemaData.schema?.columns) {
            setColumns(schemaData.schema.columns.map((col: any) => ({
              name: col.name,
              type: col.type,
            })));
          }
        }
      }

      // Calculate offset from page number (pages are 1-indexed, offset is 0-indexed)
      const offset = (currentPage - 1) * pageSize;

      const response = await fetch(
        `/api/crud/${selectedTable}?offset=${offset}&limit=${pageSize}`
      );
      if (!response.ok) throw new Error('Failed to fetch table data');
      const data = await response.json();

      // API returns data.data for records, not data.records
      setRecords(data.data || []);
      setTotalPages(Math.ceil((data.pagination?.total || 0) / pageSize));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch table data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    const initialData: Record<string, any> = {};
    columns.forEach((col) => {
      initialData[col.name] = '';
    });
    setFormData(initialData);
    setIsCreateOpen(true);
  };

  const handleEdit = (record: TableRecord) => {
    setCurrentRecord(record);
    setFormData({ ...record });
    setIsEditOpen(true);
  };

  const handleDelete = (record: TableRecord) => {
    setCurrentRecord(record);
    setIsDeleteOpen(true);
  };

  const submitCreate = async () => {
    try {
      const response = await fetch(`/api/crud/${selectedTable}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create record');
      }

      setIsCreateOpen(false);
      fetchTableData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create record');
    }
  };

  const submitEdit = async () => {
    if (!currentRecord) return;

    try {
      // PUT endpoint expects { id, data } format
      const response = await fetch(`/api/crud/${selectedTable}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentRecord.id,
          data: formData,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update record');
      }

      setIsEditOpen(false);
      fetchTableData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update record');
    }
  };

  const submitDelete = async () => {
    if (!currentRecord) return;

    try {
      // DELETE endpoint expects id as query parameter, not in body
      const response = await fetch(`/api/crud/${selectedTable}?id=${currentRecord.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete record');
      }

      setIsDeleteOpen(false);
      fetchTableData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete record');
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle>CRUD Operations</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select table..." />
              </SelectTrigger>
              <SelectContent>
                {tables.map((table) => (
                  <SelectItem key={table.name} value={table.name}>
                    {table.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={handleCreate}
              disabled={!selectedTable}
              className="w-full sm:w-auto"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : selectedTable && records.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {columns.map((col) => (
                      <TableHead key={col.name}>{col.name}</TableHead>
                    ))}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record, idx) => (
                    <TableRow key={record.id || idx}>
                      {columns.map((col) => {
                        const value = record[col.name];
                        let displayValue = '';

                        if (value === null || value === undefined) {
                          displayValue = '';
                        } else if (typeof value === 'object') {
                          // Handle objects and arrays by JSON stringifying
                          displayValue = JSON.stringify(value);
                        } else if (typeof value === 'boolean') {
                          displayValue = value ? 'true' : 'false';
                        } else {
                          displayValue = String(value);
                        }

                        return (
                          <TableCell
                            key={col.name}
                            className="max-w-[200px] truncate"
                            title={displayValue} // Show full value on hover
                          >
                            {displayValue}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(record)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(record)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        ) : selectedTable ? (
          <div className="text-center p-8 text-muted-foreground">
            No records found
          </div>
        ) : (
          <div className="text-center p-8 text-muted-foreground">
            Select a table to begin
          </div>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Record</DialogTitle>
            <DialogDescription>Add a new record to {selectedTable}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {columns.map((col) => (
              <div key={col.name} className="space-y-2">
                <Label htmlFor={col.name}>
                  {col.name}
                  <span className="text-xs text-muted-foreground ml-2">({col.type})</span>
                </Label>
                <Input
                  id={col.name}
                  value={formData[col.name] || ''}
                  onChange={(e) => handleInputChange(col.name, e.target.value)}
                  placeholder={col.type}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitCreate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Record</DialogTitle>
            <DialogDescription>Update record in {selectedTable}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {columns.map((col) => {
              // Convert field value to string for display
              let fieldValue = formData[col.name];
              if (typeof fieldValue === 'object' && fieldValue !== null) {
                fieldValue = JSON.stringify(fieldValue);
              } else if (fieldValue === null || fieldValue === undefined) {
                fieldValue = '';
              } else {
                fieldValue = String(fieldValue);
              }

              return (
                <div key={col.name} className="space-y-2">
                  <Label htmlFor={`edit-${col.name}`}>
                    {col.name}
                    <span className="text-xs text-muted-foreground ml-2">({col.type})</span>
                  </Label>
                  <Input
                    id={`edit-${col.name}`}
                    value={fieldValue}
                    onChange={(e) => handleInputChange(col.name, e.target.value)}
                    placeholder={col.type}
                  />
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Record</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this record? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={submitDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

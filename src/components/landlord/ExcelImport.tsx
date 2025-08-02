import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet } from 'lucide-react';

interface ExcelImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface TenantData {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  property_address?: string;
  unit_number?: string;
  monthly_rent?: number;
  lease_start_date?: string;
  lease_end_date?: string;
  security_deposit?: number;
  notes?: string;
}

export default function ExcelImport({ open, onOpenChange, onImportComplete }: ExcelImportProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<TenantData[]>([]);
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      processFile(selectedFile);
    }
  };

  const processFile = async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      // Skip the header row and process data
      const headers = jsonData[0];
      const rows = jsonData.slice(1);
      
      const processedData: TenantData[] = rows.map(row => {
        const tenant: any = {};
        headers.forEach((header: string, index: number) => {
          const normalizedHeader = header.toLowerCase().replace(/\s+/g, '_');
          tenant[normalizedHeader] = row[index];
        });
        
        return {
          first_name: tenant.first_name || tenant.firstname || '',
          last_name: tenant.last_name || tenant.lastname || '',
          email: tenant.email || '',
          phone: tenant.phone || tenant.phone_number || '',
          property_address: tenant.property_address || tenant.address || '',
          unit_number: tenant.unit_number || tenant.unit || '',
          monthly_rent: tenant.monthly_rent ? parseFloat(tenant.monthly_rent) : undefined,
          lease_start_date: tenant.lease_start_date || tenant.start_date || '',
          lease_end_date: tenant.lease_end_date || tenant.end_date || '',
          security_deposit: tenant.security_deposit ? parseFloat(tenant.security_deposit) : undefined,
          notes: tenant.notes || ''
        };
      }).filter(tenant => tenant.first_name && tenant.last_name && tenant.email);

      setPreviewData(processedData);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process Excel file. Please check the format.",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (!previewData.length) return;

    setLoading(true);
    try {
      const tenantsToInsert = previewData.map(tenant => ({
        ...tenant,
        user_id: user?.id
      }));

      const { error } = await supabase
        .from('tenants')
        .insert(tenantsToInsert);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Successfully imported ${previewData.length} tenants!`,
      });

      onImportComplete();
      onOpenChange(false);
      setFile(null);
      setPreviewData([]);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to import tenants",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      ['first_name', 'last_name', 'email', 'phone', 'property_address', 'unit_number', 'monthly_rent', 'lease_start_date', 'lease_end_date', 'security_deposit', 'notes'],
      ['John', 'Doe', 'john.doe@example.com', '+1234567890', '123 Main St', 'A1', '1200', '2024-01-01', '2024-12-31', '1200', 'Good tenant']
    ];

    const ws = XLSX.utils.aoa_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tenants');
    XLSX.writeFile(wb, 'tenant_template.xlsx');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Tenants from Excel</DialogTitle>
          <DialogDescription>
            Upload an Excel file to import multiple tenants at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={downloadTemplate}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Download Template
            </Button>
            <div className="text-sm text-muted-foreground">
              Use this template to format your data correctly
            </div>
          </div>

          <div>
            <Label htmlFor="excel-file">Select Excel File</Label>
            <Input
              id="excel-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="mt-1"
            />
          </div>

          {previewData.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Preview ({previewData.length} tenants)</h3>
              <div className="max-h-96 overflow-y-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead>Rent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewData.slice(0, 10).map((tenant, index) => (
                      <TableRow key={index}>
                        <TableCell>{tenant.first_name} {tenant.last_name}</TableCell>
                        <TableCell>{tenant.email}</TableCell>
                        <TableCell>{tenant.phone || '-'}</TableCell>
                        <TableCell>{tenant.property_address || '-'}</TableCell>
                        <TableCell>{tenant.unit_number || '-'}</TableCell>
                        <TableCell>{tenant.monthly_rent ? `KSh ${tenant.monthly_rent}` : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {previewData.length > 10 && (
                  <div className="p-3 text-sm text-muted-foreground border-t">
                    And {previewData.length - 10} more tenants...
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-2 mt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={loading}>
                  {loading ? "Importing..." : `Import ${previewData.length} Tenants`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { exportReport } from '@/lib/exportXlsx';
import type { ReportType, ReportData } from '@/lib/exportXlsx';

interface Props {
  reportType: ReportType;
  data: ReportData;
  filename?: string;
}

export function ExportButton({ reportType, data, filename }: Props) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportReport(reportType, data, filename);
      toast.success('Excel gerado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar o arquivo Excel.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting || !data || (Array.isArray(data) && data.length === 0)}
    >
      {exporting ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Gerando...
        </>
      ) : (
        <>
          <Download className="mr-2 h-4 w-4" />
          Baixar Excel
        </>
      )}
    </Button>
  );
}

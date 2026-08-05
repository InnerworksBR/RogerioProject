'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { exportReport } from '@/lib/exportXlsx';
import type { ReportType, ReportData } from '@/lib/exportXlsx';
import { fetchReportExport } from '@/lib/client/reportApi';
import { useFilterStore } from '@/store/filterStore';
import { MAX_EXPORT_ROW_LIMIT, type ReportType as ApiReportType } from '@/types/reportApi';

interface Props {
  reportType: ReportType;
  data: ReportData;
  filename?: string;
}

export function ExportButton({ reportType, data, filename }: Props) {
  const [exporting, setExporting] = useState(false);
  const filters = useFilterStore();

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await fetchReportExport({
        report: reportType as ApiReportType,
        year: filters.selectedYear,
        years: filters.selectedYears,
        client: filters.selectedClient,
        product: filters.selectedProduct,
        semester: filters.selectedSemester,
        revenueType: filters.selectedRevenueType,
        limit: MAX_EXPORT_ROW_LIMIT,
      });
      await exportReport(reportType, result.rows as ReportData, filename);
      toast.success('Excel gerado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar o arquivo Excel.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting || filters.selectedYears.length === 0 || !data || (Array.isArray(data) && data.length === 0)}
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

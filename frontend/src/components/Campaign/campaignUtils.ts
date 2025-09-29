import { Campaign } from './types';
import * as XLSX from 'xlsx';

export function exportCampaignsToExcel(campaigns: Campaign[]): Blob {
  const ws = XLSX.utils.json_to_sheet(campaigns);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Campaigns');
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/octet-stream' });
}

export function importCampaignsFromExcel(file: File): Promise<Campaign[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const ws = workbook.Sheets[workbook.SheetNames[0]];
      const campaigns = XLSX.utils.sheet_to_json<Campaign>(ws);
      resolve(campaigns);
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

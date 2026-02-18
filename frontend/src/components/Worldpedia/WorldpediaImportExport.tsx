import { useCallback, useRef } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import { useTranslation } from 'react-i18next';
import { useCampaignId } from '../../hooks/useCampaignId';
import { exportAll, importData, type WorldpediaExportData } from '../../api/worldpedia/worldpediaApi';

interface Props {
  onRefresh: () => Promise<void>;
}

/**
 * Two small icon-buttons for exporting and importing the Worldpedia data.
 *
 * Export downloads a JSON file.  Import reads a JSON file and posts it.
 */
export default function WorldpediaImportExport({ onRefresh }: Props) {
  const { t } = useTranslation();
  const campaignId = useCampaignId();
  const inputRef = useRef<HTMLInputElement>(null);

  /* ── Export ─────────────────────────────────────────────────────── */

  const handleExport = useCallback(async () => {
    if (!campaignId) return;
    try {
      const data = await exportAll(campaignId);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `worldpedia-${campaignId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* silent */
    }
  }, [campaignId]);

  /* ── Import ─────────────────────────────────────────────────────── */

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !campaignId) return;

    try {
      const text = await file.text();
      const data: WorldpediaExportData = JSON.parse(text);
      const result = await importData(campaignId, data);
      alert(t('worldpedia_import_success', 'Imported {{folders}} folders and {{notes}} notes', {
        folders: result.foldersCreated,
        notes: result.notesCreated,
      }));
      await onRefresh();
    } catch {
      /* silent */
    } finally {
      // Reset file input
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [campaignId, onRefresh, t]);

  return (
    <>
      <Tooltip title={t('worldpedia_export', 'Export')}>
        <IconButton size="small" onClick={handleExport}>
          <FileDownloadIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title={t('worldpedia_import', 'Import')}>
        <IconButton size="small" onClick={() => inputRef.current?.click()}>
          <FileUploadIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <input ref={inputRef} type="file" accept=".json" hidden onChange={handleImport} />
    </>
  );
}

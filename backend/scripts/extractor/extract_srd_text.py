'''
Extraction script for the D&D 5e SRD 5.2 (2024) PDFs.
Usage:
    python extract_srd_text.py <pdf_path> <output_txt_path>

Extracts plain text from each page, prepending a page header so we can
locate sections later when generating structured JSON.
'''
import sys
import pdfplumber


def main(pdf_path, out_path):
    written_lines = 0
    with pdfplumber.open(pdf_path) as pdf:
        with open(out_path, 'w', encoding='utf-8') as fh:
            for page_idx, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ''
                cleaned = '\n'.join(line.rstrip() for line in text.splitlines())
                fh.write('\n===== PAGE ' + str(page_idx) + ' =====\n')
                fh.write(cleaned)
                fh.write('\n')
                written_lines += len(cleaned.splitlines())
    print('OK ' + pdf_path + ' -> ' + out_path + ' (' + str(written_lines) + ' lines of text)')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print('Usage: python extract_srd_text.py <pdf_path> <output_txt_path>')
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])

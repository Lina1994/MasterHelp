import { useCallback, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill';
import type QuillNamespace from 'quill';
import { Box } from '@mui/material';

import 'react-quill/dist/quill.snow.css';

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  minHeight?: number;
}

/**
 * Rich text editor wrapper.
 *
 * Features:
 * - Basic formatting (bold/italic/underline/strike)
 * - Size and colors
 * - Links
 * - Images inserted as data URLs (local file picker)
 */
export function RichTextEditor({
  value,
  onChange,
  readOnly = false,
  placeholder,
  minHeight = 160,
}: RichTextEditorProps) {
  const quillRef = useRef<ReactQuill | null>(null);

  const handleInsertImage = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const editor = quillRef.current?.getEditor();
        if (!editor) return;

        const range = editor.getSelection(true);
        const imageUrl = typeof reader.result === 'string' ? reader.result : '';
        if (!imageUrl) return;

        editor.insertEmbed(range ? range.index : 0, 'image', imageUrl, 'user');
      };
      reader.readAsDataURL(file);
    };

    input.click();
  }, []);

  const modules = useMemo(() => {
    return {
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          [{ size: ['small', false, 'large', 'huge'] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ color: [] }, { background: [] }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ align: [] }],
          ['link', 'image'],
          ['clean'],
        ],
        handlers: {
          image: handleInsertImage,
        },
      },
      clipboard: { matchVisual: false },
    };
  }, [handleInsertImage]);

  const formats = useMemo(() => {
    return [
      'header',
      'size',
      'bold',
      'italic',
      'underline',
      'strike',
      'color',
      'background',
      'list',
      'bullet',
      'align',
      'link',
      'image',
    ];
  }, []);

  return (
    <Box
      sx={{
        '& .ql-container': {
          minHeight,
        },
      }}
    >
      <ReactQuill
        ref={(r) => {
          quillRef.current = r;
        }}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        readOnly={readOnly}
        placeholder={placeholder}
      />
    </Box>
  );
}

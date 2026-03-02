import { useCallback, useMemo, useRef } from 'react';
import ReactQuill from 'react-quill';
import type QuillNamespace from 'quill';
import { Box } from '@mui/material';

import 'react-quill/dist/quill.snow.css';

/*
 * Allow the custom `worldpedia://` protocol inside Quill links.
 *
 * Quill's Link blot calls `Link.sanitize(url)` which rejects any protocol
 * not in `PROTOCOL_WHITELIST`, replacing the href with `about:blank`.
 * Patching the array alone is unreliable across bundled copies, so we
 * override the `sanitize` static method directly – the safest approach.
 */
const QuillStatic = ReactQuill.Quill;
const Link = QuillStatic.import('formats/link') as any;

const _originalSanitize: (url: string) => string = Link.sanitize.bind(Link);
Link.sanitize = function sanitize(url: string): string {
  if (typeof url === 'string' && url.startsWith('worldpedia://')) {
    return url;
  }
  return _originalSanitize(url);
};

/* Also keep the whitelist updated for any code path that checks it */
if (Array.isArray(Link.PROTOCOL_WHITELIST) && !Link.PROTOCOL_WHITELIST.includes('worldpedia')) {
  Link.PROTOCOL_WHITELIST = [...Link.PROTOCOL_WHITELIST, 'worldpedia'];
}

QuillStatic.register(Link, true);

export interface RichTextEditorProps {
  /**
   * Controlled value. When provided, ReactQuill re-syncs its content on
   * every render – suitable for small documents.
   *
   * For large documents use {@link defaultValue} instead to avoid the
   * expensive diff/update cycle.
   */
  value?: string;
  /**
   * Uncontrolled initial value. ReactQuill uses it only on mount and
   * never re-syncs, significantly improving performance for large content.
   *
   * When set, `value` is ignored.
   */
  defaultValue?: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  minHeight?: number;
  /**
   * Optional ref callback that receives the ReactQuill instance.
   * Allows parent components to access the underlying Quill editor
   * (e.g. to read the current selection or insert formatted text).
   */
  editorRef?: React.MutableRefObject<ReactQuill | null>;
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
  defaultValue,
  onChange,
  readOnly = false,
  placeholder,
  minHeight = 160,
  editorRef,
}: RichTextEditorProps) {
  const isUncontrolled = defaultValue !== undefined;
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
          if (editorRef) editorRef.current = r;
        }}
        theme="snow"
        {...(isUncontrolled ? { defaultValue } : { value })}
        onChange={onChange}
        modules={modules}
        formats={formats}
        readOnly={readOnly}
        placeholder={placeholder}
      />
    </Box>
  );
}

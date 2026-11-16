import React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Upload } from "./controls";

export default function RichEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: { openOnClick: false, autolink: false },
      }),
      Image.configure({ allowBase64: false }),
    ],
    content: value || "<p></p>",
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Article body",
        "aria-multiline": "true",
        class: "rich-body",
      },
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });
  if (!editor) return <p>Loading editor…</p>;
  const tools = [
    [
      "Paragraph",
      () => editor.chain().focus().setParagraph().run(),
      "paragraph",
    ],
    [
      "Heading 2",
      () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      "heading",
      { level: 2 },
    ],
    [
      "Heading 3",
      () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      "heading",
      { level: 3 },
    ],
    ["Bold", () => editor.chain().focus().toggleBold().run(), "bold"],
    ["Italic", () => editor.chain().focus().toggleItalic().run(), "italic"],
    [
      "Bullets",
      () => editor.chain().focus().toggleBulletList().run(),
      "bulletList",
    ],
    [
      "Numbered list",
      () => editor.chain().focus().toggleOrderedList().run(),
      "orderedList",
    ],
    [
      "Quote",
      () => editor.chain().focus().toggleBlockquote().run(),
      "blockquote",
    ],
  ];
  return (
    <section className="rich-editor">
      <h3>Article body</h3>
      <div className="tools" role="group" aria-label="Text formatting">
        {tools.map(([l, cmd, n, attrs]) => (
          <button
            type="button"
            key={l}
            aria-pressed={editor.isActive(n, attrs)}
            onClick={cmd}
          >
            {l}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            const url = window.prompt(
              "Link URL (https:// or a site-relative path)",
              editor.getAttributes("link").href || "",
            );
            if (url === null) return;
            if (!url) editor.chain().focus().unsetLink().run();
            else if (/^(https?:\/\/|\/(?!\/)|mailto:)/i.test(url))
              editor
                .chain()
                .focus()
                .extendMarkRange("link")
                .setLink({ href: url })
                .run();
          }}
        >
          Link
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
        >
          Undo
        </button>
      </div>
      <EditorContent editor={editor} />
      <Upload
        label="Insert body image"
        onChange={(url) => {
          const alt = window.prompt("Describe this image for readers", "");
          if (alt?.trim())
            editor
              .chain()
              .focus()
              .setImage({ src: url, alt: alt.trim() })
              .run();
        }}
      />
    </section>
  );
}

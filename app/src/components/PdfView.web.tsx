// Web: render the original PDF in an <iframe> (the browser's built-in viewer),
// with an "Open PDF" escape hatch in case the browser is set to download PDFs
// rather than display them inline.
export function PdfView({ url }: { url: string }) {
  const Div = 'div' as any;
  const Iframe = 'iframe' as any;
  const A = 'a' as any;
  return (
    <Div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <A
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: 'absolute',
          top: 12,
          right: 16,
          zIndex: 5,
          fontFamily: "'Hanken Grotesk', sans-serif",
          fontSize: 13,
          fontWeight: 600,
          color: '#5F6B44',
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,.12)',
          padding: '7px 13px',
          borderRadius: 999,
          textDecoration: 'none',
          boxShadow: '0 8px 20px -10px rgba(40,40,20,.4)',
        }}
      >
        Open PDF ↗
      </A>
      <Iframe
        src={url}
        title="PDF preview"
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </Div>
  );
}

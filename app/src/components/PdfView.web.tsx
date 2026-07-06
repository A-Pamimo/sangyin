// Web: render the original PDF in an <iframe> (the browser's built-in viewer).
export function PdfView({ url }: { url: string }) {
  const Iframe = 'iframe' as any;
  return (
    <Iframe
      src={url}
      title="PDF preview"
      style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
    />
  );
}

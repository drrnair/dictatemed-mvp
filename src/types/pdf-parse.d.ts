// Type declarations for pdf-parse
// pdf-parse doesn't ship with TypeScript types

declare module 'pdf-parse' {
  interface PdfParseInfo {
    PDFFormatVersion?: string;
    IsAcroFormPresent?: boolean;
    IsXFAPresent?: boolean;
    Title?: string;
    Author?: string;
    Subject?: string;
    Keywords?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: string;
    ModDate?: string;
    [key: string]: unknown;
  }

  interface PdfParseMetadata {
    info: PdfParseInfo;
    metadata: unknown;
  }

  interface PdfParseResult {
    numpages: number;
    numrender: number;
    info: PdfParseInfo;
    metadata: unknown;
    text: string;
    version: string;
  }

  interface PdfParseOptions {
    pagerender?: (pageData: unknown) => Promise<string>;
    max?: number;
    version?: string;
  }

  function pdfParse(
    dataBuffer: Buffer | Uint8Array,
    options?: PdfParseOptions
  ): Promise<PdfParseResult>;

  export default pdfParse;
}

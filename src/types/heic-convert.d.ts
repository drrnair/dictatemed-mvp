// Type declarations for heic-convert
// heic-convert doesn't ship with TypeScript types

declare module 'heic-convert' {
  interface HeicConvertOptions {
    /** Input HEIC/HEIF buffer */
    buffer: Buffer | ArrayBuffer | Uint8Array;
    /** Output format */
    format: 'JPEG' | 'PNG';
    /** Quality for JPEG output (0-1). Defaults to 0.92 */
    quality?: number;
  }

  /**
   * Convert HEIC/HEIF image to JPEG or PNG format.
   * @param options Conversion options
   * @returns Promise resolving to output image buffer
   */
  function heicConvert(options: HeicConvertOptions): Promise<ArrayBuffer>;

  export default heicConvert;
}

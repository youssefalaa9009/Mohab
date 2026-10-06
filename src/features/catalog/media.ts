/**
 * Uploaded images are stored once per width as WebP: `<key>-480.webp`, etc.
 * Shared by the uploader (server) and <ProductImage> (browser) so both agree
 * on which files exist.
 */
export const IMAGE_WIDTHS = [480, 960, 1600] as const;
export const DEFAULT_IMAGE_WIDTH = 960;

/**
 * Keys starting with "/" are site imagery shipped with the app (public/images/site);
 * every other key is an upload, served from the media origin.
 */
export const imageUrl = (mediaUrl: string, key: string, width: number = DEFAULT_IMAGE_WIDTH) =>
  key.startsWith("/") ? `${key}-${width}.webp` : `${mediaUrl}/${key}-${width}.webp`;

export const imageSrcSet = (mediaUrl: string, key: string) =>
  IMAGE_WIDTHS.map((width) => `${imageUrl(mediaUrl, key, width)} ${width}w`).join(", ");

import { createHmac, timingSafeEqual } from "node:crypto";
import type { File } from "@google-cloud/storage";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef, PDFStream } from "pdf-lib";
import sharp from "sharp";

export const PROJECT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const PROJECT_IMAGE_MAX_COUNT = 20;
export const PROJECT_IMAGE_MAX_PENDING_PER_ACCOUNT = 5;
export const PORTAL_RESOURCE_MAX_BYTES = 25 * 1024 * 1024;

export const projectImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
// New uploads intentionally exclude Office and ZIP containers: without an
// archive parser, macro/relationship inspection, and decompression limits they
// cannot be described as safe. Existing resources remain downloadable.
export const portalResourceTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
]);

export type ResourceUploadIntent = {
  accountId: string;
  objectPath: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  expiresAt: number;
};

export class UploadIntentConfigurationError extends Error {
  constructor() {
    super("Upload intent signing is unavailable. Configure SESSION_SECRET.");
    this.name = "UploadIntentConfigurationError";
  }
}

function uploadIntentSecret(): string {
  const secret = process.env.SESSION_SECRET ?? "";
  if (Buffer.byteLength(secret, "utf8") < 32) throw new UploadIntentConfigurationError();
  return secret;
}

export function issueResourceUploadIntent(intent: ResourceUploadIntent): string {
  const payload = Buffer.from(JSON.stringify({
    a: intent.accountId,
    p: intent.objectPath,
    n: intent.fileName,
    t: intent.contentType,
    s: intent.byteSize,
    e: intent.expiresAt,
  }), "utf8").toString("base64url");
  const signature = createHmac("sha256", uploadIntentSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyResourceUploadIntent(
  token: string,
  accountId: string,
  now: number = Date.now(),
): ResourceUploadIntent | null {
  if (!token || token.length > 4096) return null;
  const separator = token.indexOf(".");
  if (separator < 1 || separator !== token.lastIndexOf(".")) return null;
  const payload = token.slice(0, separator);
  const encodedSignature = token.slice(separator + 1);
  const supplied = Buffer.from(encodedSignature, "base64url");
  // Node accepts noncanonical base64url trailing bits. Reject alternate
  // encodings as well as changed bytes so signed intents have one encoding.
  if (supplied.toString("base64url") !== encodedSignature) return null;
  const expected = createHmac("sha256", uploadIntentSecret()).update(payload).digest();
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
    if (
      decoded.a !== accountId
      || typeof decoded.p !== "string"
      || !/^\/objects\/uploads\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(decoded.p)
      || !decoded.p.startsWith(`/objects/uploads/${accountId}/`)
      || typeof decoded.n !== "string"
      || decoded.n.length < 1
      || decoded.n.length > 255
      || typeof decoded.t !== "string"
      || !portalResourceTypes.has(decoded.t)
      || typeof decoded.s !== "number"
      || !Number.isSafeInteger(decoded.s)
      || decoded.s <= 0
      || decoded.s > PORTAL_RESOURCE_MAX_BYTES
      || typeof decoded.e !== "number"
      || !Number.isSafeInteger(decoded.e)
      || decoded.e <= now
      || decoded.e > now + 10 * 60_000
    ) return null;
    return {
      accountId: decoded.a,
      objectPath: decoded.p,
      fileName: decoded.n,
      contentType: decoded.t,
      byteSize: decoded.s,
      expiresAt: decoded.e,
    };
  } catch {
    return null;
  }
}

export function uploadHeadersMatch(
  contentTypeHeader: string | undefined,
  contentLengthHeader: string | undefined,
  expectedContentType: string,
  expectedSize: number,
): boolean {
  const contentType = contentTypeHeader?.split(";")[0].trim().toLowerCase();
  return contentType === expectedContentType
    && /^\d+$/.test(contentLengthHeader ?? "")
    && Number(contentLengthHeader) === expectedSize;
}

function isPng(data: Buffer): boolean {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const trailer = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
  return data.length >= 20
    && data.subarray(0, 8).equals(signature)
    && data.subarray(-12).equals(trailer);
}

function isJpeg(data: Buffer): boolean {
  return data.length >= 4
    && data[0] === 0xff
    && data[1] === 0xd8
    && data[data.length - 2] === 0xff
    && data[data.length - 1] === 0xd9;
}

function isWebp(data: Buffer): boolean {
  if (
    data.length < 12
    || data.subarray(0, 4).toString("ascii") !== "RIFF"
    || data.subarray(8, 12).toString("ascii") !== "WEBP"
  ) return false;
  return data.readUInt32LE(4) + 8 === data.length;
}

export function validateRasterBytes(data: Buffer, contentType: string): boolean {
  if (data.subarray(0, 2).toString("ascii") === "MZ" || data.subarray(0, 4).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46]))) return false;
  if (contentType === "image/png") return isPng(data);
  if (contentType === "image/jpeg") return isJpeg(data);
  return contentType === "image/webp" && isWebp(data);
}

export async function sanitizeRaster(
  file: File,
  contentType: string,
  expectedSize: number,
  maxOutputSize: number = PROJECT_IMAGE_MAX_BYTES,
): Promise<Buffer> {
  const [data] = await file.download();
  if (data.length !== expectedSize || !validateRasterBytes(data, contentType)) {
    throw new Error("Image bytes do not match the declared raster format.");
  }
  const decoder = sharp(data, {
    failOn: "error",
    limitInputPixels: 40_000_000,
    sequentialRead: true,
  }).rotate();
  const metadata = await decoder.metadata();
  if (!metadata.width || !metadata.height || metadata.pages && metadata.pages !== 1) {
    throw new Error("Image could not be decoded as a single raster frame.");
  }
  const sanitized = contentType === "image/jpeg"
    ? await decoder.jpeg({ quality: 90, mozjpeg: true }).toBuffer()
    : contentType === "image/png"
      ? await decoder.png({ compressionLevel: 9 }).toBuffer()
      : contentType === "image/webp"
        ? await decoder.webp({ quality: 90 }).toBuffer()
        : null;
  if (!sanitized || sanitized.length > maxOutputSize) {
    throw new Error("Sanitized image exceeds the allowed size.");
  }
  return sanitized;
}

const forbiddenPdfNames = new Set([
  "javascript", "js", "launch", "embeddedfile", "embeddedfiles",
  "openaction", "aa", "xfa", "richmedia", "richmediaactivation",
  "richmediadeactivation", "submitform", "importdata", "rendition",
  "movie", "sound", "3d", "gotoe",
  "uri", "goto", "gotor", "named", "setocgstate", "trans",
  "goto3dview", "hide", "thread", "resetform",
]);

function pdfNameValue(name: PDFName): string {
  return name.asString().replace(/^\//, "").toLowerCase();
}

function safePdfObject(object: unknown, seen: Set<object>): boolean {
  if (!object || typeof object !== "object" || object instanceof PDFRef) return true;
  if (seen.has(object)) return true;
  seen.add(object);
  if (object instanceof PDFName) return !forbiddenPdfNames.has(pdfNameValue(object));
  if (object instanceof PDFArray) {
    if (object.size() > 100_000) return false;
    for (let index = 0; index < object.size(); index++) {
      if (!safePdfObject(object.get(index), seen)) return false;
    }
    return true;
  }
  if (object instanceof PDFStream) {
    return safePdfObject(object.dict, seen);
  }
  if (object instanceof PDFDict) {
    for (const key of object.keys()) {
      if (forbiddenPdfNames.has(pdfNameValue(key))) return false;
      if (!safePdfObject(object.get(key), seen)) return false;
    }
  }
  return true;
}

export async function validatePdfBytes(data: Buffer): Promise<boolean> {
  if (!data.subarray(0, 5).equals(Buffer.from("%PDF-"))) return false;
  const eofMarker = Buffer.from("%%EOF");
  const eof = data.lastIndexOf(eofMarker);
  // A single terminal EOF deliberately rejects incremental updates. That is a
  // narrower policy, but avoids treating bytes appended after an earlier,
  // valid document as harmless.
  if (
    eof < 0
    || data.indexOf(eofMarker) !== eof
    || data.subarray(eof + eofMarker.length).toString("ascii").trim().length
  ) return false;
  try {
    const document = await PDFDocument.load(data, {
      ignoreEncryption: false,
      throwOnInvalidObject: true,
      updateMetadata: false,
    });
    if (document.isEncrypted || document.getPageCount() > 500) return false;
    const objects = document.context.enumerateIndirectObjects();
    if (objects.length > 50_000) return false;
    const seen = new Set<object>();
    return objects.every(([, object]) => safePdfObject(object, seen));
  } catch {
    return false;
  }
}

function validatePlainText(data: Buffer): boolean {
  if (data.includes(0)) return false;
  const decoded = data.toString("utf8");
  return Buffer.from(decoded, "utf8").equals(data) && !decoded.startsWith("#!");
}

// Run the exact same PDF policy in an isolated, time/memory-bounded extraction worker.
export const pdfPolicyWorkerSource = `
const { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef, PDFStream } = require("pdf-lib");
const forbiddenPdfNames = new Set(${JSON.stringify([...forbiddenPdfNames])});
function safePdfObject(object, seen) {
  if (!object || typeof object !== "object" || object instanceof PDFRef) return true;
  if (seen.has(object)) return true;
  if (seen.size > 100000) return false;
  seen.add(object);
  if (object instanceof PDFName) return !forbiddenPdfNames.has(object.asString().replace(/^\\//, "").toLowerCase());
  if (object instanceof PDFArray) {
    if (object.size() > 100000) return false;
    for (let i=0;i<object.size();i++) if (!safePdfObject(object.get(i),seen)) return false;
  }
  if (object instanceof PDFStream) return safePdfObject(object.dict,seen);
  if (object instanceof PDFDict) {
    for (const key of object.keys()) {
      if (!safePdfObject(key,seen) || !safePdfObject(object.get(key),seen)) return false;
    }
  }
  return true;
}
async function validatePdfBytes(data) {
  if (!data.subarray(0,5).equals(Buffer.from("%PDF-"))) return false;
  const marker = Buffer.from("%%EOF"), eof = data.lastIndexOf(marker);
  if (eof < 0 || data.indexOf(marker) !== eof || data.subarray(eof+marker.length).toString("ascii").trim().length) return false;
  try {
    const doc = await PDFDocument.load(data,{ignoreEncryption:false,throwOnInvalidObject:true,updateMetadata:false});
    if (doc.isEncrypted || doc.getPageCount() > 100) return false;
    const objects = doc.context.enumerateIndirectObjects();
    if (objects.length > 50000) return false;
    const seen = new Set();
    return objects.every(([,object]) => safePdfObject(object,seen));
  } catch { return false; }
}
`;

export async function validateUploadedFile(
  file: File,
  contentType: string,
  expectedSize: number,
): Promise<boolean> {
  if (expectedSize <= 0 || expectedSize > PORTAL_RESOURCE_MAX_BYTES) return false;
  const [data] = await file.download();
  if (data.length !== expectedSize) return false;
  if (projectImageTypes.has(contentType)) return validateRasterBytes(data, contentType);
  if (contentType === "application/pdf") return validatePdfBytes(data);
  if (contentType === "text/plain") return validatePlainText(data);
  return false;
}

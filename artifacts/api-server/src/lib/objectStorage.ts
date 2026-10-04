import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';
import { File, Storage } from '@google-cloud/storage';

import {
  canAccessObject,
  getObjectAclPolicy,
  ObjectAclPolicy,
  ObjectPermission,
  setObjectAclPolicy,
} from './objectAcl';

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

export const objectStorageClient = new Storage({
  credentials: {
    audience: 'replit',
    subject_token_type: 'access_token',
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: 'external_account',
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: 'json',
        subject_token_field_name: 'access_token',
      },
    },
    universe_domain: 'googleapis.com',
  },
  projectId: '',
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  getPublicObjectSearchPaths(): Array<string> {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || '';
    const paths = Array.from(
      new Set(
        pathsStr
          .split(',')
          .map((path) => path.trim())
          .filter((path) => path.length > 0),
      ),
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          'tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths).',
      );
    }
    return paths;
  }

  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || '';
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          'tool and set PRIVATE_OBJECT_DIR env var.',
      );
    }
    return dir;
  }

  async searchPublicObject(filePath: string): Promise<File | null> {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  async downloadObject(
    file: File,
    cacheTtlSec: number = 3600,
    contentTypeOverride?: string,
  ): Promise<Response> {
    const [metadata] = await file.getMetadata();
    const aclPolicy = await getObjectAclPolicy(file);
    const isPublic = aclPolicy?.visibility === 'public';

    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      'Content-Type':
        contentTypeOverride
        || (metadata.contentType as string)
        || 'application/octet-stream',
      'Cache-Control': isPublic
        ? `public, max-age=${cacheTtlSec}`
        : 'private, no-store, max-age=0',
    };
    if (!isPublic) {
      headers.Pragma = 'no-cache';
      headers.Expires = '0';
    }
    if (metadata.size) {
      headers['Content-Length'] = String(metadata.size);
    }

    return new Response(webStream, { headers });
  }

  createObjectEntityUploadPath(ownerId: string): string {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const safeOwner = ownerId.replace(/[^a-z0-9-]/gi, '');
    if (!safeOwner) throw new Error('A valid upload owner is required.');
    const fullPath = `${privateObjectDir}/uploads/${safeOwner}/${objectId}`;
    const { objectName } = parseObjectPath(fullPath);
    return `/objects/${objectName.split('/').slice(-3).join('/')}`;
  }

  async uploadBoundedObject(
    objectPath: string,
    source: NodeJS.ReadableStream,
    contentType: string,
    expectedSize: number,
  ): Promise<string> {
    if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0) {
      throw new Error('Invalid upload size.');
    }
    const privateObjectDir = this.getPrivateObjectDir().replace(/\/$/, '');
    if (!/^\/objects\/uploads\/[a-z0-9-]+\/[0-9a-f-]{36}$/i.test(objectPath)) {
      throw new Error('Invalid upload path.');
    }
    const { bucketName, objectName } = parseObjectPath(
      `${privateObjectDir}/${objectPath.slice('/objects/'.length)}`,
    );
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    let received = 0;
    const limiter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length;
        if (received > expectedSize) callback(new Error('Upload exceeded declared size.'));
        else callback(null, chunk);
      },
    });
    try {
      await pipeline(
        source,
        limiter,
        file.createWriteStream({
          resumable: false,
          metadata: { contentType, cacheControl: 'private, no-store, max-age=0' },
          preconditionOpts: { ifGenerationMatch: 0 },
          validation: 'crc32c',
        }),
      );
      if (received !== expectedSize) throw new Error('Upload size did not match declaration.');
      const [metadata] = await file.getMetadata();
      if (Number(metadata.size) !== expectedSize || !metadata.generation) {
        throw new Error('Stored upload did not match declaration.');
      }
      return String(metadata.generation);
    } catch (error) {
      await file.delete({ ignoreNotFound: true }).catch(() => undefined);
      throw error;
    }
  }

  async finalizeObjectEntityUpload(
    tempObjectPath: string,
    contentType: string,
    sourceGeneration: string,
    destinationFolder: string = 'project-images',
    sanitizedBytes?: Buffer,
  ): Promise<string> {
    const source = await this.getObjectEntityFile(tempObjectPath);
    const versionedSource = source.bucket.file(source.name, {
      generation: sourceGeneration,
    });
    const privateObjectDir = this.getPrivateObjectDir();
    const finalObjectId = randomUUID();
    const safeFolder = destinationFolder.replace(/[^a-z0-9-]/gi, '');
    if (!safeFolder) {
      throw new Error('A valid destination folder is required.');
    }
    const finalPath = `${privateObjectDir}/${safeFolder}/${finalObjectId}`;
    const { bucketName, objectName } = parseObjectPath(finalPath);
    const destination = objectStorageClient.bucket(bucketName).file(objectName);

    if (sanitizedBytes) {
      // Confirm the exact, generation-pinned source still exists before
      // publishing sanitized bytes derived from it.
      await versionedSource.getMetadata();
      await destination.save(sanitizedBytes, {
        resumable: false,
        contentType,
        metadata: { cacheControl: 'private, no-store, max-age=0' },
        preconditionOpts: { ifGenerationMatch: 0 },
        validation: 'crc32c',
      });
    } else {
      await versionedSource.copy(destination, {
        contentType,
        cacheControl: 'private, no-store, max-age=0',
        preconditionOpts: { ifGenerationMatch: 0 },
      });
    }
    await versionedSource.delete({ ignoreNotFound: true });
    return `/objects/${safeFolder}/${finalObjectId}`;
  }

  async deleteObjectEntity(objectPath: string): Promise<void> {
    const file = await this.getObjectEntityFile(objectPath);
    await file.delete({ ignoreNotFound: true });
  }

  async getObjectEntityFile(objectPath: string): Promise<File> {
    if (!objectPath.startsWith('/objects/')) {
      throw new ObjectNotFoundError();
    }

    const parts = objectPath.slice(1).split('/');
    if (parts.length < 2) {
      throw new ObjectNotFoundError();
    }

    const entityId = parts.slice(1).join('/');
    let entityDir = this.getPrivateObjectDir();
    if (!entityDir.endsWith('/')) {
      entityDir = `${entityDir}/`;
    }
    const objectEntityPath = `${entityDir}${entityId}`;
    const { bucketName, objectName } = parseObjectPath(objectEntityPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const objectFile = bucket.file(objectName);
    const [exists] = await objectFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return objectFile;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    if (!rawPath.startsWith('https://storage.googleapis.com/')) {
      return rawPath;
    }

    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;

    let objectEntityDir = this.getPrivateObjectDir();
    if (!objectEntityDir.endsWith('/')) {
      objectEntityDir = `${objectEntityDir}/`;
    }

    if (!rawObjectPath.startsWith(objectEntityDir)) {
      return rawObjectPath;
    }

    const entityId = rawObjectPath.slice(objectEntityDir.length);
    return `/objects/${entityId}`;
  }

  async trySetObjectEntityAclPolicy(
    rawPath: string,
    aclPolicy: ObjectAclPolicy,
  ): Promise<string> {
    const normalizedPath = this.normalizeObjectEntityPath(rawPath);
    if (!normalizedPath.startsWith('/')) {
      return normalizedPath;
    }

    const objectFile = await this.getObjectEntityFile(normalizedPath);
    await setObjectAclPolicy(objectFile, aclPolicy);
    return normalizedPath;
  }

  async canAccessObjectEntity({
    userId,
    objectFile,
    requestedPermission,
  }: {
    userId?: string;
    objectFile: File;
    requestedPermission?: ObjectPermission;
  }): Promise<boolean> {
    return canAccessObject({
      userId,
      objectFile,
      requestedPermission: requestedPermission ?? ObjectPermission.READ,
    });
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  const pathParts = path.split('/');
  if (pathParts.length < 3) {
    throw new Error('Invalid path: must contain at least a bucket name');
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join('/');

  return {
    bucketName,
    objectName,
  };
}

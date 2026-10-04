export interface ReferenceModelDimensions {
  widthIn: number;
  heightIn: number;
  depthIn: number;
}

export interface NormalizedProductImage {
  dataUrl: string;
  png: Blob;
  originalWidth: number;
  originalHeight: number;
  outputWidth: number;
  outputHeight: number;
  backgroundRemoved: boolean;
  transparentPixelRatio: number;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The normalized PNG could not be created.'));
    }, 'image/png');
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The selected image could not be opened.'));
    };
    image.src = url;
  });
}

export async function normalizeProductImage(
  file: File,
  backgroundTolerance = 48,
): Promise<NormalizedProductImage> {
  const image = await loadImage(file);
  const maxEdge = 1600;
  const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Image processing is unavailable in this browser.');
  context.drawImage(image, 0, 0, width, height);

  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  let alreadyTransparent = false;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 245) {
      alreadyTransparent = true;
      break;
    }
  }

  let removed = 0;
  if (!alreadyTransparent) {
    const corners = [
      0,
      (width - 1) * 4,
      (height - 1) * width * 4,
      ((height - 1) * width + width - 1) * 4,
    ];
    const background = corners.reduce(
      (sum, index) => ({
        r: sum.r + pixels[index],
        g: sum.g + pixels[index + 1],
        b: sum.b + pixels[index + 2],
      }),
      { r: 0, g: 0, b: 0 },
    );
    background.r /= corners.length;
    background.g /= corners.length;
    background.b /= corners.length;

    const featherStart = backgroundTolerance * 0.72;
    for (let index = 0; index < pixels.length; index += 4) {
      const distance = Math.sqrt(
        (pixels[index] - background.r) ** 2
        + (pixels[index + 1] - background.g) ** 2
        + (pixels[index + 2] - background.b) ** 2,
      );
      if (distance <= featherStart) {
        pixels[index + 3] = 0;
        removed += 1;
      } else if (distance < backgroundTolerance) {
        pixels[index + 3] = Math.round(
          255 * ((distance - featherStart) / (backgroundTolerance - featherStart)),
        );
        removed += 1;
      }
    }
    context.putImageData(imageData, 0, 0);
  }

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  let transparentPixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = pixels[(y * width + x) * 4 + 3];
      if (alpha < 245) transparentPixels += 1;
      if (alpha > 12) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  const usableForeground = maxX >= minX && maxY >= minY;
  const trimPadding = Math.max(4, Math.round(Math.max(width, height) * 0.02));
  const cropX = usableForeground ? Math.max(0, minX - trimPadding) : 0;
  const cropY = usableForeground ? Math.max(0, minY - trimPadding) : 0;
  const cropRight = usableForeground ? Math.min(width, maxX + trimPadding + 1) : width;
  const cropBottom = usableForeground ? Math.min(height, maxY + trimPadding + 1) : height;
  const output = document.createElement('canvas');
  output.width = cropRight - cropX;
  output.height = cropBottom - cropY;
  const outputContext = output.getContext('2d');
  if (!outputContext) throw new Error('Image processing is unavailable in this browser.');
  outputContext.drawImage(
    canvas,
    cropX,
    cropY,
    output.width,
    output.height,
    0,
    0,
    output.width,
    output.height,
  );

  const png = await canvasToBlob(output);
  const dataUrl = output.toDataURL('image/png');
  return {
    dataUrl,
    png,
    originalWidth: image.naturalWidth,
    originalHeight: image.naturalHeight,
    outputWidth: output.width,
    outputHeight: output.height,
    backgroundRemoved: !alreadyTransparent && removed > 0,
    transparentPixelRatio: transparentPixels / (width * height),
  };
}

function pad4(value: number): number {
  return (value + 3) & ~3;
}

function pushBytes(target: number[], bytes: Uint8Array): { offset: number; length: number } {
  const offset = target.length;
  for (let index = 0; index < bytes.byteLength; index += 1) {
    target.push(bytes[index]);
  }
  while (target.length % 4 !== 0) target.push(0);
  return { offset, length: bytes.byteLength };
}

function floatBytes(values: number[]): Uint8Array {
  return new Uint8Array(new Float32Array(values).buffer);
}

function ushortBytes(values: number[]): Uint8Array {
  return new Uint8Array(new Uint16Array(values).buffer);
}

export async function createReferenceGlb(
  png: Blob,
  dimensions: ReferenceModelDimensions,
): Promise<Blob> {
  const inchToMeter = 0.0254;
  const width = dimensions.widthIn * inchToMeter;
  const height = dimensions.heightIn * inchToMeter;
  const depth = Math.max(dimensions.depthIn * inchToMeter, 0.006);
  const x = width / 2;
  const y = height / 2;
  const z = depth / 2;
  const binary: number[] = [];

  const frontPositions = pushBytes(binary, floatBytes([
    -x, -y, z, x, -y, z, x, y, z, -x, y, z,
  ]));
  const frontNormals = pushBytes(binary, floatBytes([
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
  ]));
  const frontUvs = pushBytes(binary, floatBytes([0, 0, 1, 0, 1, 1, 0, 1]));
  const frontIndices = pushBytes(binary, ushortBytes([0, 1, 2, 0, 2, 3]));

  const shellPositions = pushBytes(binary, floatBytes([
    x, -y, -z, -x, -y, -z, -x, y, -z, x, y, -z,
    -x, -y, z, -x, y, z, -x, y, -z, -x, -y, -z,
    x, -y, -z, x, y, -z, x, y, z, x, -y, z,
    -x, y, z, x, y, z, x, y, -z, -x, y, -z,
    -x, -y, -z, x, -y, -z, x, -y, z, -x, -y, z,
  ]));
  const shellNormals = pushBytes(binary, floatBytes([
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
    1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0,
    0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0,
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
  ]));
  const shellUvs = pushBytes(binary, floatBytes([
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0, 1,
  ]));
  const shellIndices = pushBytes(binary, ushortBytes([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
  ]));
  const imageBytes = pushBytes(binary, new Uint8Array(await png.arrayBuffer()));

  const bufferViews = [
    frontPositions, frontNormals, frontUvs, frontIndices,
    shellPositions, shellNormals, shellUvs, shellIndices, imageBytes,
  ].map((view, index) => ({
    buffer: 0,
    byteOffset: view.offset,
    byteLength: view.length,
    ...(index === 3 || index === 7 ? { target: 34963 } : index < 8 ? { target: 34962 } : {}),
  }));
  const accessors = [
    { bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [-x, -y, z], max: [x, y, z] },
    { bufferView: 1, componentType: 5126, count: 4, type: 'VEC3' },
    { bufferView: 2, componentType: 5126, count: 4, type: 'VEC2' },
    { bufferView: 3, componentType: 5123, count: 6, type: 'SCALAR' },
    { bufferView: 4, componentType: 5126, count: 20, type: 'VEC3', min: [-x, -y, -z], max: [x, y, z] },
    { bufferView: 5, componentType: 5126, count: 20, type: 'VEC3' },
    { bufferView: 6, componentType: 5126, count: 20, type: 'VEC2' },
    { bufferView: 7, componentType: 5123, count: 30, type: 'SCALAR' },
  ];
  const gltf = {
    asset: { version: '2.0', generator: 'Kessick Visual Reference Studio' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'Visual reference - not verified CAD' }],
    meshes: [{
      name: 'Scale-aware visual envelope',
      primitives: [
        {
          attributes: { POSITION: 0, NORMAL: 1, TEXCOORD_0: 2 },
          indices: 3,
          material: 0,
        },
        {
          attributes: { POSITION: 4, NORMAL: 5, TEXCOORD_0: 6 },
          indices: 7,
          material: 1,
        },
      ],
    }],
    materials: [
      {
        name: 'Uploaded product elevation',
        pbrMetallicRoughness: {
          baseColorTexture: { index: 0 },
          metallicFactor: 0,
          roughnessFactor: 0.72,
        },
        alphaMode: 'MASK',
        alphaCutoff: 0.08,
        doubleSided: true,
      },
      {
        name: 'Unverified depth envelope',
        pbrMetallicRoughness: {
          baseColorFactor: [0.075, 0.063, 0.052, 1],
          metallicFactor: 0.1,
          roughnessFactor: 0.62,
        },
      },
    ],
    textures: [{ source: 0, sampler: 0 }],
    samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
    images: [{ bufferView: 8, mimeType: 'image/png', name: 'Normalized product elevation' }],
    buffers: [{ byteLength: binary.length }],
    bufferViews,
    accessors,
    extras: {
      classification: 'visual_reference',
      verifiedCad: false,
      dimensionsInches: dimensions,
      notice: 'Visual planning model only. Do not use for fabrication or construction documents.',
    },
  };

  const encoder = new TextEncoder();
  const json = encoder.encode(JSON.stringify(gltf));
  const jsonLength = pad4(json.byteLength);
  const binaryLength = pad4(binary.length);
  const output = new ArrayBuffer(12 + 8 + jsonLength + 8 + binaryLength);
  const view = new DataView(output);
  const bytes = new Uint8Array(output);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, output.byteLength, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.fill(0x20, 20, 20 + jsonLength);
  bytes.set(json, 20);
  const binaryHeader = 20 + jsonLength;
  view.setUint32(binaryHeader, binaryLength, true);
  view.setUint32(binaryHeader + 4, 0x004e4942, true);
  bytes.set(new Uint8Array(binary), binaryHeader + 8);
  return new Blob([output], { type: 'model/gltf-binary' });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
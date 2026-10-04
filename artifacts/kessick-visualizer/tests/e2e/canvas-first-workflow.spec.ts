import { expect, test, type Page } from '@playwright/test';

const updateLoopPattern =
  /maximum update depth exceeded|too many re-renders|infinite (?:render|update) loop/i;

function failOnUpdateLoops(page: Page) {
  const errors: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error' && updateLoopPattern.test(message.text())) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    if (updateLoopPattern.test(error.message)) errors.push(error.message);
  });

  return () => expect(errors, 'React update-loop errors in the browser console').toEqual([]);
}

async function readImageBounds(page: Page) {
  const container = page.getByTestId('canvas-container');
  await expect.poll(async () => Number(await container.getAttribute('data-image-width'))).toBeGreaterThan(0);
  const box = await container.boundingBox();
  expect(box).not.toBeNull();

  return {
    containerWidth: box!.width,
    containerHeight: box!.height,
    left: Number(await container.getAttribute('data-image-left')),
    top: Number(await container.getAttribute('data-image-top')),
    width: Number(await container.getAttribute('data-image-width')),
    height: Number(await container.getAttribute('data-image-height')),
  };
}

async function expectRoomContainedAndCentered(page: Page) {
  await expect.poll(async () => {
    const bounds = await readImageBounds(page);
    return {
      contained:
        bounds.left >= -1 &&
        bounds.top >= -1 &&
        bounds.left + bounds.width <= bounds.containerWidth + 1 &&
        bounds.top + bounds.height <= bounds.containerHeight + 1,
      centeredX:
        Math.abs(bounds.left + bounds.width / 2 - bounds.containerWidth / 2) < 2,
      centeredY:
        Math.abs(bounds.top + bounds.height / 2 - bounds.containerHeight / 2) < 2,
    };
  }).toEqual({ contained: true, centeredX: true, centeredY: true });
}

function roomSvgDataUrl(width: number, height: number, color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${color}"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function savedProject({
  id,
  name,
  roomImageId,
  canvasCoordinateVersion,
}: {
  id: string;
  name: string;
  roomImageId: string;
  canvasCoordinateVersion?: 2;
}) {
  return {
    project: {
      id,
      name,
      client: '',
      address: '',
      surveyor: '',
      surveyDate: '2026-09-09',
      notes: '',
    },
    entities: [
      { id: `${id}-wall`, type: 'wall', points: [{ x: 40, y: 60 }, { x: 240, y: 60 }] },
    ],
    options: [{
      id: `${id}-option`,
      name: 'Option 1',
      status: 'concept',
      instances: [],
      clientNotes: '',
      presentationSettings: {
        showDimensions: true,
        showClearances: true,
        showLighting: true,
      },
    }],
    activeOptionId: `${id}-option`,
    calibration: null,
    pixelsPerInch: 2,
    unit: 'in',
    roomImageId,
    ...(canvasCoordinateVersion ? { canvasCoordinateVersion } : {}),
    lastSaved: Date.now(),
  };
}

async function seedSavedProjects(
  page: Page,
  projects: ReturnType<typeof savedProject>[],
  images: Array<{ id: string; dataUrl: string }>,
) {
  await page.evaluate(async ({ projectsToSave, imagesToSave }) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('kessick_db', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('images')) {
          request.result.createObjectStore('images');
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('images', 'readwrite');
      const store = transaction.objectStore('images');
      for (const image of imagesToSave) store.put(image.dataUrl, image.id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    localStorage.setItem('kessick_projects', JSON.stringify(projectsToSave));
  }, { projectsToSave: projects, imagesToSave: images });
}

async function openSavedProject(page: Page, projectName: string) {
  await page
    .locator(
      '[data-testid="button-open-project"]:visible, [data-testid="button-open-project-mobile"]:visible',
    )
    .click();
  const projectRow = page.getByText(projectName, { exact: true }).locator('../..');
  await projectRow.getByRole('button', { name: 'Load' }).click();
}

async function expectPanelToggle(
  page: Page,
  isMobile: boolean,
  triggerTestId: string,
  closeTestId: string,
  heading: string,
) {
  const trigger = page.getByTestId(triggerTestId);
  const panelHeading = page.getByRole('heading', { name: heading, exact: true });

  await trigger.click();
  await expect(panelHeading).toBeVisible();
  await (isMobile ? page.getByTestId(closeTestId) : trigger).click();
  await expect(panelHeading).toBeHidden();
}

test('new-project canvas workflow keeps its primary actions reachable', async ({
  page,
  isMobile,
}) => {
  const assertNoUpdateLoops = failOnUpdateLoops(page);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Begin Site Survey' })).toBeVisible();
  await page.getByTestId('btn-demo-room').click();
  await expect(page.getByRole('button', { name: 'Photo View' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Calibrate Scale' })).toBeVisible();
  await expectRoomContainedAndCentered(page);
  await page.getByRole('button', { name: 'Cancel' }).click();

  const fitWidth = (await readImageBounds(page)).width;
  await page.getByTestId('canvas-zoom-in').click();
  await expect.poll(async () => (await readImageBounds(page)).width).toBeGreaterThan(fitWidth * 1.1);
  await page.getByTestId('canvas-fit').click();
  await expect.poll(async () => Math.abs((await readImageBounds(page)).width - fitWidth)).toBeLessThan(2);
  await expectRoomContainedAndCentered(page);

  await expectPanelToggle(
    page,
    isMobile,
    'toolrail-catalog',
    'close-catalog-panel',
    'Product Catalog',
  );
  await expectPanelToggle(
    page,
    isMobile,
    'toolrail-survey',
    'close-survey-panel',
    'Survey Elements',
  );
  await expectPanelToggle(
    page,
    isMobile,
    'toolrail-inspector',
    'close-inspector',
    'Properties',
  );

  await page.getByTestId('button-project-meta').click();
  const projectDialog = page.getByRole('dialog');
  await expect(projectDialog.getByText('Project Metadata', { exact: true })).toBeVisible();
  await page.getByTestId('close-project-meta').click();

  if (isMobile) {
    await page.getByTestId('button-mobile-workspaces').click();
    await page.getByRole('menuitem', { name: 'Estimating' }).click();
  } else {
    await page.getByTestId('button-estimating').click();
  }
  await expect(page.getByText('Estimating Hub', { exact: true })).toBeVisible();
  await page.getByTestId('close-estimating-hub').click();

  assertNoUpdateLoops();
});

test('phone placement keeps a fixed Tower dimensional and legible', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'This regression protects the phone-width canvas.');

  await page.goto('/__e2e/canvas');
  await page.getByTestId('close-composer-panel').click();
  await page.getByTestId('btn-demo-room').click();
  await expect(page.getByRole('heading', { name: 'Calibrate Scale' })).toBeVisible();
  await expect(page.getByTestId('btn-confirm-scale')).toBeEnabled();
  await page.getByTestId('btn-confirm-scale').click();

  await page.getByTestId('toolrail-catalog').click();
  await page.getByPlaceholder('Search SKUs, names...').fill('1877.ET.R-P');
  await page.getByTestId('btn-add-1877.ET.R-P').click();

  await expect.poll(async () => page.evaluate(() => {
    const inspect = (window as Window & {
      __kessickInspectCanvas?: () => Array<{
        sku: string;
        dimensions: { widthIn: number; heightIn: number };
        productBounds: { x: number; y: number; width: number; height: number };
        renderKind: string | null;
        imageDescendantCount: number;
        label: {
          visible: boolean;
          text: string;
          screenFontSize: number;
          bounds: { x: number; y: number; width: number; height: number };
        } | null;
        transformer: {
          visible: boolean;
          bounds: { x: number; y: number; width: number; height: number };
          anchors: Array<{
            name: string;
            bounds: { x: number; y: number; width: number; height: number };
          }>;
        } | null;
      }>;
    }).__kessickInspectCanvas;
    return inspect?.().find((entry) => entry.sku === '1877.ET.R-P') ?? null;
  })).not.toBeNull();
  const rendered = await page.evaluate(() => {
    const inspect = (window as Window & {
      __kessickInspectCanvas?: () => any[];
    }).__kessickInspectCanvas;
    return inspect?.().find((entry) => entry.sku === '1877.ET.R-P');
  });
  const canvasBox = await page.getByTestId('canvas-container').boundingBox();
  expect(canvasBox).not.toBeNull();

  expect(rendered.dimensions).toEqual({ widthIn: 18, heightIn: 77.25 });
  expect(rendered.renderKind).toBe('dimensional-elevation');
  expect(rendered.imageDescendantCount).toBe(0);
  expect(rendered.productBounds.width / rendered.productBounds.height).toBeCloseTo(18 / 77.25, 2);
  expect(rendered.label).toMatchObject({
    visible: true,
    text: '18.0" W × 77.3" H',
  });
  expect(rendered.label.screenFontSize).toBeGreaterThanOrEqual(12);
  expect(rendered.transformer.visible).toBe(true);
  expect(rendered.transformer.anchors).toHaveLength(1);
  expect(rendered.transformer.anchors[0].name).toBe('rotater');

  for (const bounds of [
    rendered.productBounds,
    rendered.label.bounds,
    rendered.transformer.bounds,
    ...rendered.transformer.anchors.map((anchor: { bounds: unknown }) => anchor.bounds),
  ]) {
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(canvasBox!.width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(canvasBox!.height);
  }
});

test('legacy calibrated layouts are never guessed or silently rewritten', async ({ page }) => {
  await page.goto('/');
  const legacy = savedProject({
    id: 'legacy-project',
    name: 'Legacy Room',
    roomImageId: 'legacy-image',
  });
  await seedSavedProjects(
    page,
    [legacy],
    [{ id: 'legacy-image', dataUrl: roomSvgDataUrl(600, 1200, '#8d794e') }],
  );
  await page.reload();
  await openSavedProject(page, 'Legacy Room');

  await expect(page.getByRole('heading', { name: 'Older room layout needs review' })).toBeVisible();
  const bounds = await readImageBounds(page);
  expect(bounds.height).toBeGreaterThan(bounds.width);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(1_200);

  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kessick_projects') || '[]')[0],
  );
  expect(persisted.canvasCoordinateVersion).toBeUndefined();
  expect(persisted.pixelsPerInch).toBe(2);
  expect(persisted.entities).toEqual(legacy.entities);
});

test('replacing a missing legacy photo still requires an explicit layout reset', async ({ page }) => {
  await page.goto('/');
  const legacy = savedProject({
    id: 'missing-photo-project',
    name: 'Missing Legacy Photo',
    roomImageId: 'missing-image',
  });
  await seedSavedProjects(page, [legacy], []);
  await page.reload();
  await openSavedProject(page, 'Missing Legacy Photo');

  await expect(page.getByRole('heading', { name: 'Room photo unavailable' })).toBeVisible();
  await page.getByRole('button', { name: 'Use Demo' }).click();
  await expect(page.getByRole('heading', { name: 'Older room layout needs review' })).toBeVisible();
  await page.waitForTimeout(1_200);

  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('kessick_projects') || '[]')[0],
  );
  expect(persisted.canvasCoordinateVersion).toBeUndefined();
  expect(persisted.roomImageId).toBe('missing-image');
  expect(persisted.pixelsPerInch).toBe(2);
  expect(persisted.entities).toEqual(legacy.entities);
});

test('switching projects waits for the incoming room photo', async ({ page }) => {
  await page.goto('/');
  const current = savedProject({
    id: 'current-project',
    name: 'Current Room',
    roomImageId: 'current-image',
    canvasCoordinateVersion: 2,
  });
  const legacy = savedProject({
    id: 'incoming-project',
    name: 'Incoming Legacy Room',
    roomImageId: 'incoming-image',
  });
  await seedSavedProjects(
    page,
    [current, legacy],
    [
      { id: 'current-image', dataUrl: roomSvgDataUrl(1200, 600, '#181818') },
      { id: 'incoming-image', dataUrl: roomSvgDataUrl(600, 1200, '#c4a574') },
    ],
  );
  await page.reload();
  await openSavedProject(page, 'Current Room');
  await expectRoomContainedAndCentered(page);

  await openSavedProject(page, 'Incoming Legacy Room');
  await expect(page.getByRole('heading', { name: 'Older room layout needs review' })).toBeVisible();
  const container = page.getByTestId('canvas-container');
  await expect(container).toHaveAttribute('data-project-image-id', 'incoming-image');
  await expect(container).toHaveAttribute('data-room-image-id', 'incoming-image');
  const bounds = await readImageBounds(page);
  expect(bounds.height).toBeGreaterThan(bounds.width);
});

test('portrait upload stays visible through resize and project reopen', async ({
  page,
}) => {
  const assertNoUpdateLoops = failOnUpdateLoops(page);
  const portraitRoom = `
    <svg xmlns="http://www.w3.org/2000/svg" width="600" height="1200" viewBox="0 0 600 1200">
      <rect width="600" height="1200" fill="#402a1f"/>
      <rect x="60" y="100" width="480" height="940" fill="#8d794e"/>
      <path d="M80 180h440M80 400h440M80 620h440M80 840h440" stroke="#f4efe7" stroke-width="20"/>
    </svg>
  `;

  await page.goto('/');
  await page.locator('input[type="file"][accept="image/*"]').setInputFiles({
    name: 'portrait-room.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(portraitRoom),
  });
  await expect(page.getByRole('heading', { name: 'Calibrate Scale' })).toBeVisible();
  await expectRoomContainedAndCentered(page);
  await page.getByRole('button', { name: 'Cancel' }).click();

  const currentViewport = page.viewportSize();
  expect(currentViewport).not.toBeNull();
  await page.setViewportSize({
    width: currentViewport!.height,
    height: currentViewport!.width,
  });
  await expectRoomContainedAndCentered(page);

  await page.waitForTimeout(1_200);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Begin Site Survey' })).toBeVisible();
  await page
    .locator(
      '[data-testid="button-open-project"]:visible, [data-testid="button-open-project-mobile"]:visible',
    )
    .click();
  await page.getByRole('button', { name: 'Load' }).first().click();
  await expect(page.getByRole('button', { name: 'Photo View' })).toBeVisible();
  await expectRoomContainedAndCentered(page);

  assertNoUpdateLoops();
});
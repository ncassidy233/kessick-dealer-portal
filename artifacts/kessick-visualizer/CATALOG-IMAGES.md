# Importing approved Kessick product images

The visualizer only renders local product images. Remote Kessick URLs are retained in the catalog as `source_image_url` for provenance, but they are never used as the browser image path.

## Import a catalog image release

1. Review and explicitly approve the original Kessick image files.
2. Put only those approved files in a temporary directory. Nested directories are allowed.
3. Update `public/data/kessick-products.json`. Each product must have:
   - `image_file`: the exact local filename to render.
   - `source_image_url`: the original Kessick URL for provenance.
4. From the workspace root, run:

   ```sh
   pnpm --filter @workspace/kessick-visualizer catalog:images -- --source ./path/to/approved-images
   ```

The command copies approved files into `public/assets/kessick-products/` and validates the complete catalog. Existing local files may satisfy products whose images did not change.

The import fails without changing the catalog when an image is missing, empty, unsupported, duplicated by filename, unreferenced, or mapped with an unsafe filename. Supported formats are JPG, JPEG, PNG, and WEBP. It never downloads or generates replacement imagery.

For validating a catalog before replacing the live one, pass `--catalog ./path/to/catalog.json`. The catalog is normalized in place only after all images pass validation.
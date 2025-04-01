import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Copy manifest and other assets
async function copyFiles() {
  try {
    // Copy manifest
    await fs.copy(
      path.join(rootDir, 'manifest.json'),
      path.join(rootDir, 'dist', 'manifest.json')
    );

    // Copy icons
    await fs.copy(
      path.join(rootDir, 'icons'),
      path.join(rootDir, 'dist', 'icons')
    );

    // Copy CSS files
    await fs.copy(
      path.join(rootDir, 'content.css'),
      path.join(rootDir, 'dist', 'content.css')
    );
    await fs.copy(
      path.join(rootDir, 'styles.css'),
      path.join(rootDir, 'dist', 'styles.css')
    );

    console.log('Post-build file copying completed successfully');
  } catch (err) {
    console.error('Error during post-build process:', err);
    process.exit(1);
  }
}

copyFiles();
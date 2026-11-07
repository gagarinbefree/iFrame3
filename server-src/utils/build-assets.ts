import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

/** BuildAssets. Copies static assets and creates the offline application manifest. */
export class BuildAssets {
  /**
   * write. Copies assets into the production directory and hashes the application shell.
   * @param projectRoot - Root directory of the application.
   */
  public static write(projectRoot: string): void {
    const files = [
      ['public/index.html', 'dist/index.html'],
      ['src/styles/style.css', 'dist/style.css'],
      ['node_modules/framework7/dist/css/framework7.ios.min.css', 'dist/framework7.css'],
    ];
    for (const [source, destination] of files)
      fs.copyFileSync(path.join(projectRoot, source), path.join(projectRoot, destination));
    const hash = crypto.createHash('sha256');
    for (const name of ['index.html', 'app.js', 'style.css', 'framework7.css'])
      hash.update(fs.readFileSync(path.join(projectRoot, 'dist', name)));
    const manifest =
      'CACHE MANIFEST\n# ' +
      hash.digest('hex') +
      '\nCACHE:\n/\n/app.js\n/style.css\n/framework7.css\nNETWORK:\n*\n';
    fs.writeFileSync(path.join(projectRoot, 'dist', 'app.manifest'), manifest);
  }
}
if (require.main === module) BuildAssets.write(path.resolve(__dirname, '../..'));

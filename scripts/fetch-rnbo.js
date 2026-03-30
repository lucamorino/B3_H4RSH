#!/usr/bin/env node

import https from 'https';
import fs from 'fs/promises';
import path from 'path';

const version = process.argv[2] || process.env.RNBO_VERSION;
if (!version) {
  console.error('Usage: npm run fetch-rnbo -- <version>  OR  RNBO_VERSION=1.4.2 npm run fetch-rnbo');
  process.exit(1);
}

const destDir = path.resolve('public', 'assets', 'rnbo', version);
const destFile = path.join(destDir, 'rnbo.min.js');
const encodedVersion = encodeURIComponent(version);
const url = `https://c74-public.nyc3.digitaloceanspaces.com/rnbo/${encodedVersion}/rnbo.min.js`;

async function fetchUrl(u) {
  return new Promise((resolve, reject) => {
    https.get(u, (res) => {
      // follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchUrl(res.headers.location));
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Request failed. Status code: ${res.statusCode}`));
      }

      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  try {
    await fs.mkdir(destDir, { recursive: true });
    console.log(`Downloading ${url} -> ${destFile}`);
    const data = await fetchUrl(url);
    await fs.writeFile(destFile, data);
    console.log('Downloaded and saved RNBO script.');
  } catch (err) {
    console.error('Failed to download RNBO:', err.message || err);
    process.exit(1);
  }
})();

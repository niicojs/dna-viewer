import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import { parseXdna } from '../src/lib/xdna.ts';

const inputPath = resolve(process.cwd(), process.argv[2] ?? 'data/example.xdna');
const data = readFileSync(inputPath);
const parsed = parseXdna(data);

writeFileSync('data/parsed-xdna.json', JSON.stringify(parsed, null, 2));

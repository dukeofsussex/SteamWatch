import {
  exists, readFile, readdir, writeFile,
} from 'fs';
import { promisify } from 'util';

const existsAsync = promisify(exists);
const readFileAsync = promisify(readFile);
const readdirAsync = promisify(readdir);
const writeFileAsync = promisify(writeFile);

export {
  existsAsync,
  readFileAsync,
  readdirAsync,
  writeFileAsync,
};

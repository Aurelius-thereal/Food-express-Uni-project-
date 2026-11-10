'use strict';

const fs = require('fs');
const path = require('path');
const buildSeed = require('./seed-data');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let state = null;

function seed() {
  state = buildSeed();
  persist();
  return state;
}

/**
 * Load the data store once per process. If the file is missing or unreadable
 * the store is (re)seeded with the demo catalogue from the project report.
 */
function load() {
  if (state) return state;

  if (fs.existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.restaurants)) {
        state = parsed;
        return state;
      }
      console.warn('[db] Data store is incomplete, reseeding.');
    } catch (err) {
      console.warn(`[db] Could not read data store (${err.message}), reseeding.`);
    }
  }

  return seed();
}

function persist() {
  if (!state) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(state, null, 2));
}

function save() {
  persist();
}

function reset() {
  state = null;
  if (fs.existsSync(DB_FILE)) fs.rmSync(DB_FILE);
  return seed();
}

function nextId(kind) {
  const store = load();
  store.counters[kind] = (store.counters[kind] || 0) + 1;
  return store.counters[kind];
}

module.exports = { load, save, reset, nextId, DB_FILE };

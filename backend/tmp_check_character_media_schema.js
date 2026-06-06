const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.DB_DATABASE || path.join(process.cwd(), 'data', 'dm_app.db');
const db = new sqlite3.Database(dbPath);

const folderIds = [
  '463bf10e-0b75-4d3a-ab7b-d566dfe623c9',
  '1afaf11a-df7f-4399-8bd6-68d495509ab4',
];

const qSchema = "PRAGMA table_info('character_media')";
const qSample = "SELECT * FROM character_media LIMIT 5";
const qByIds = `SELECT id, name, characterImageUrl, tokenImageUrl FROM character WHERE id IN (${folderIds.map(() => '?').join(',')})`;

console.log('DB', dbPath);

db.serialize(() => {
  db.all(qSchema, [], (e1, s) => {
    if (e1) { console.error(e1); process.exit(1); }
    console.log('character_media schema', JSON.stringify(s, null, 2));

    db.all(qSample, [], (e2, rows) => {
      if (e2) { console.error(e2); process.exit(1); }
      console.log('character_media sample', JSON.stringify(rows, null, 2));

      db.all(qByIds, folderIds, (e3, chars) => {
        if (e3) { console.error(e3); process.exit(1); }
        console.log('characters for folder IDs', JSON.stringify(chars, null, 2));
        db.close();
      });
    });
  });
});

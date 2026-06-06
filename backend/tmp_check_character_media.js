const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.DB_DATABASE || path.join(process.cwd(), 'data', 'dm_app.db');
const db = new sqlite3.Database(dbPath);

const q1 = "SELECT COUNT(*) as total FROM character_media";
const q2 = "SELECT id, name, characterImageUrl, tokenImageUrl FROM character ORDER BY updatedAt DESC LIMIT 12";
const q3 = "SELECT characterId, role, variant, storageKind, relativePath, createdAt FROM character_media ORDER BY createdAt DESC LIMIT 20";

db.serialize(() => {
  db.all(q1, [], (e, r1) => {
    if (e) {
      console.error('q1 error', e);
      process.exit(1);
    }

    console.log('DB', dbPath);
    console.log('character_media total', r1[0] ? r1[0].total : 0);

    db.all(q2, [], (e2, r2) => {
      if (e2) {
        console.error('q2 error', e2);
        process.exit(1);
      }

      console.log('characters latest', JSON.stringify(r2, null, 2));

      db.all(q3, [], (e3, r3) => {
        if (e3) {
          console.error('q3 error', e3);
          process.exit(1);
        }

        console.log('media latest', JSON.stringify(r3, null, 2));
        db.close();
      });
    });
  });
});

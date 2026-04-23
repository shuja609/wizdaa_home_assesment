const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

db.serialize(() => {
  db.run("CREATE TABLE test (info TEXT)");
  const stmt = db.prepare("INSERT INTO test VALUES (?)");
  for (let i = 0; i < 10; i++) {
    stmt.run("Ipsum " + i);
  }
  stmt.finalize();

  db.each("SELECT rowid AS id, info FROM test", (err, row) => {
    console.log(row.id + ": " + row.info);
  });
});

db.close();

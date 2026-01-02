
const db = require('better-sqlite3')('./database.sqlite');
const profileId = '145eff47-d3eb-4082-a846-a047b739e954';
const row = db.prepare('SELECT name, domain FROM profiles WHERE id = ?').get(profileId);
console.log("Profile:", row);

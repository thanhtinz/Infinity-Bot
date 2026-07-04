const { newDb } = require('pg-mem');

const db = newDb({ autoCreateForeignKeyIndices: true });

db.public.registerFunction({
    name: 'current_database',
    returns: 'text',
    implementation: () => 'main'
});

db.public.registerFunction({
    name: 'version',
    returns: 'text',
    implementation: () => 'PostgreSQL 16.0 pg-mem'
});

const pg = db.adapters.createPg();

module.exports = { db, pg };

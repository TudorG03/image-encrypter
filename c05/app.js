const express = require('express');
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const snmp = require('net-snmp');
const fs = require('fs');

const app = express()
let db;
let snmpCol;

// ── MySQL ────────────────────────────────────────────────────────────────────

const connectWithRetry = async () => {
    while (true) {
        try {
            db = await mysql.createConnection({
                socketPath: '/var/run/mysqld/mysqld.sock',
                user: 'root',
                multipleStatements: true
            });
            console.log('MySQL connected');
            break;
        } catch (err) {
            console.log('Waiting for MySQL... ', err.message);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

const runInitSql = async () => {
    const sql = fs.readFileSync('/init.sql', 'utf-8');
    await db.query(sql);
    console.log('DB initialized');
}

// ── MongoDB ──────────────────────────────────────────────────────────────────

const connectMongo = async () => {
    while (true) {
        try {
            const client = new MongoClient('mongodb://127.0.0.1:27017');
            await client.connect();
            const mdb = client.db('metricsdb');
            snmpCol = mdb.collection('snmp_metrics');
            await snmpCol.createIndex({ node: 1, timestamp: -1 });
            console.log('MongoDB connected');
            break;
        } catch (err) {
            console.log('Waiting for MongoDB... ', err.message);
            await new Promise(r => setTimeout(r, 2000));
        }
    }
}

// ── SNMP collector ───────────────────────────────────────────────────────────

const SNMP_NODES = ['c01', 'c02', 'c03', 'c04', 'c05'];
const SNMP_OIDS = [
    '1.3.6.1.2.1.1.1.0',       // sysDescr
    '1.3.6.1.4.1.2021.11.9.0', // ssCpuUser
    '1.3.6.1.4.1.2021.11.10.0',// ssCpuSystem
    '1.3.6.1.4.1.2021.4.5.0',  // memTotalReal (kB)
    '1.3.6.1.4.1.2021.4.6.0',  // memAvailReal (kB)
];

const pollNode = (node) => new Promise((resolve) => {
    const session = snmp.createSession(node, 'public', { version: snmp.Version2c, timeout: 3000 });
    session.get(SNMP_OIDS, (err, varbinds) => {
        session.close();
        const doc = { node, timestamp: new Date() };
        if (err) {
            doc.error = err.message;
        } else {
            const val = (i) => {
                const vb = varbinds[i];
                if (snmp.isVarbindError(vb)) return null;
                return vb.value instanceof Buffer ? vb.value.toString() : Number(vb.value);
            };
            doc.sysDescr    = val(0);
            doc.cpuUser     = val(1);
            doc.cpuSystem   = val(2);
            doc.memTotalKB  = val(3);
            doc.memAvailKB  = val(4);
        }
        resolve(doc);
    });
});

const collectSnmp = async () => {
    if (!snmpCol) return;
    const docs = await Promise.all(SNMP_NODES.map(pollNode));
    await snmpCol.insertMany(docs);
};

// ── Startup ──────────────────────────────────────────────────────────────────

const start = async () => {
    await Promise.all([connectWithRetry(), connectMongo()]);
    await runInitSql();

    // First poll immediately, then every 30s
    collectSnmp();
    setInterval(collectSnmp, 30_000);

    app.listen(3001, () => console.log('C05 listening on :3001'));
}

// ── Middleware ───────────────────────────────────────────────────────────────

app.use(express.raw({
    type: 'application/octet-stream',
    limit: '50mb'
}));
app.use(express.json());

// ── Image endpoints ──────────────────────────────────────────────────────────

app.post('/image', async (req, res) => {
    const { job_id, operation, mode, aes_key, iv } = req.query;

    if (!job_id || !operation || !mode || !aes_key) {
        return res.status(400).json({ error: 'Missing query params' });
    }

    if (!['encrypt', 'decrypt'].includes(operation)) {
        return res.status(400).json({ error: 'Invalid operation' });
    }

    if (!req.body || !req.body.length) {
        return res.status(400).json({ error: 'Missing image data' });
    }

    try {
        const [result] = await db.query(
            'INSERT INTO processed_images (job_id, operation, mode, iv, aes_key, image_data) VALUES (?, ?, ?, ?, ?, ?)',
            [job_id, operation, mode, iv, aes_key, req.body]
        );

        res.status(201).json({ id: result.insertId });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

app.get('/image/:id', async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM processed_images WHERE id = ?',
            [req.params.id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Image not found' });
        }

        res.set('Content-Type', 'image/bmp');
        res.send(rows[0].image_data);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
})

// ── SNMP endpoints ───────────────────────────────────────────────────────────

// GET /snmp?limit=100  — recent readings across all nodes (DB access)
app.get('/snmp', async (req, res) => {
    if (!snmpCol) return res.status(503).json({ error: 'MongoDB not ready' });
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    try {
        const docs = await snmpCol
            .find({}, { projection: { _id: 0 } })
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /snmp/latest  — most recent reading per node (web display)
app.get('/snmp/latest', async (req, res) => {
    if (!snmpCol) return res.status(503).json({ error: 'MongoDB not ready' });
    try {
        const docs = await snmpCol.aggregate([
            { $sort: { timestamp: -1 } },
            { $group: { _id: '$node', doc: { $first: '$$ROOT' } } },
            { $replaceRoot: { newRoot: '$doc' } },
            { $project: { _id: 0 } },
            { $sort: { node: 1 } }
        ]).toArray();
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
    res.status(200).send('OK');
})

// ── Internal-only endpoints ──────────────────────────────────────────────────

const requireInternalSecret = (req, res, next) => {
    if (req.headers['x-internal-secret'] !== process.env.INTERNAL_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    next();
};

app.post('/users', requireInternalSecret, async (req, res) => {
    const { username, passwordHash } = req.body;
    if (!username || !passwordHash) {
        return res.status(400).json({ error: 'Missing username or passwordHash' });
    }
    try {
        const [result] = await db.query(
            'INSERT INTO users (username, password_hash) VALUES (?, ?)',
            [username, passwordHash]
        );
        res.status(201).json({ id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.get('/users/:username', requireInternalSecret, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, username, password_hash AS passwordHash FROM users WHERE username = ?',
            [req.params.username]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/jobs', requireInternalSecret, async (req, res) => {
    const { jobId, userId, operation, mode, keyHex, ivHex } = req.body;
    if (!jobId || !userId || !operation || !mode || !keyHex) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        const [result] = await db.query(
            'INSERT INTO jobs (job_id, user_id, operation, mode, key_hex, iv_hex) VALUES (?, ?, ?, ?, ?, ?)',
            [jobId, userId, operation, mode, keyHex, ivHex ?? null]
        );
        res.status(201).json({ id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.patch('/jobs/:jobId', requireInternalSecret, async (req, res) => {
    const { status, downloadUrl } = req.body;
    if (!status) {
        return res.status(400).json({ error: 'Missing status' });
    }
    try {
        const [result] = await db.query(
            'UPDATE jobs SET status = ?, download_url = ? WHERE job_id = ?',
            [status, downloadUrl ?? null, req.params.jobId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Job not found' });
        }
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/jobs', requireInternalSecret, async (req, res) => {
    const { user_id } = req.query;
    if (!user_id) {
        return res.status(400).json({ error: 'Missing user_id' });
    }
    try {
        const [rows] = await db.query(
            'SELECT job_id AS jobId, user_id AS userId, operation, mode, key_hex AS keyHex, iv_hex AS ivHex, status, download_url AS downloadUrl, created_at AS createdAt FROM jobs WHERE user_id = ? ORDER BY created_at DESC',
            [user_id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

start();

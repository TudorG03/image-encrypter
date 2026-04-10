const express = require('express');
const mysql = require('mysql2/promise');
const fs = require('fs');

const app = express()
let db;

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

const start = async () => {
    await connectWithRetry();
    await runInitSql();
    app.listen(3001, () => console.log('C05 listening on :3001'));
}

app.use(express.raw({
    type: 'application/octet-stream',
    limit: '50mb'
}));
app.use(express.json());

app.post('/image', async (req, res) => {
    const { job_id, operation, mode, aes_key } = req.query;

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
            'INSERT INTO processed_images (job_id, operation, mode, aes_key, image_data) VALUES (?, ?, ?, ?, ?)',
            [job_id, operation, mode, aes_key, req.body]
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

app.get('/health', (req, res) => {
    res.status(200).send('OK');
})

start();

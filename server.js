const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/media', express.static('media'));

// Database connection
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/dj_grey_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// GET all mixes
app.get('/api/mixes', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM mixes ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST to increment likes
app.post('/api/mixes/:id/like', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'UPDATE mixes SET likes_count = likes_count + 1 WHERE id = $1 RETURNING likes_count',
            [id]
        );
        res.json({ success: true, newLikes: result.rows[0].likes_count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST to increment downloads
app.post('/api/mixes/:id/download', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'UPDATE mixes SET downloads_count = downloads_count + 1 WHERE id = $1 RETURNING downloads_count',
            [id]
        );
        res.json({ success: true, newDownloads: result.rows[0].downloads_count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// 1. ADD A NEW MIX (Admin)
app.post('/api/mixes', async (req, res) => {
    let { title, audio_url, artwork_url } = req.body;

    if (!title || !audio_url) {
        return res.status(400).json({ error: 'Title and Audio URL are required.' });
    }

    // Smart link converter: Auto-convert Dropbox ?dl=0 or &dl=0 to &raw=1
    audio_url = audio_url.replace('dl=0', 'raw=1');
    artwork_url = artwork_url ? artwork_url.replace('dl=0', 'raw=1') : 'https://www.dropbox.com/scl/fi/sn5sapl4pr1uzc98kcpez/dj_grey.jpeg?rlkey=72jldl168nvtccasr0ekk2qy2&st=3yyulxhl&raw=1';

    try {
        const result = await pool.query(
            'INSERT INTO mixes (title, audio_url, artwork_url) VALUES ($1, $2, $3) RETURNING *',
            [title, audio_url, artwork_url]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error("Error adding mix:", err);
        res.status(500).json({ error: 'Database insert failed' });
    }
});

// 2. DELETE A MIX (Admin)
app.delete('/api/mixes/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM mixes WHERE id = $1', [id]);
        res.json({ message: 'Mix deleted successfully' });
    } catch (err) {
        console.error("Error deleting mix:", err);
        res.status(500).json({ error: 'Failed to delete mix' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🔥 DJ Grey Backend running on http://localhost:${PORT}`);
});
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/media', express.static('media'));

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/dj_grey_db',
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

const JWT_SECRET = process.env.JWT_SECRET || 'dj-grey-super-secret-key-2026';

// ---------------------------------------------------------
// 🔒 AUTHENTICATION MIDDLEWARE
// ---------------------------------------------------------
function authenticateAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 
    
    if (!token) return res.status(401).json({ error: 'Access denied. Please log in.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired login token.' });
        if (user.role !== 'admin') return res.status(403).json({ error: 'Admin privileges required.' });
        
        req.user = user;
        next(); 
    });
}

function authenticateUser(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Please log in to perform this action.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired login token.' });
        req.user = user;
        next(); 
    });
}

// ---------------------------------------------------------
// 🔑 AUTHENTICATION ROUTES (LOGIN / REGISTER)
// ---------------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Username, email, and password required.' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
            [username, email, hashedPassword, 'user'] // Now registers as standard fan
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: 'Username or Email might already exist.' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, username: user.username, role: user.role });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// 🌍 PUBLIC MUSIC ROUTES (Streaming is open)
// ---------------------------------------------------------
app.get('/api/mixes', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM mixes ORDER BY id ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🔒 PROTECTED FAN ROUTES (Likes & Downloads)
app.post('/api/mixes/:id/like', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('UPDATE mixes SET likes_count = likes_count + 1 WHERE id = $1 RETURNING likes_count', [id]);
        res.json({ success: true, newLikes: result.rows[0].likes_count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/mixes/:id/download', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('UPDATE mixes SET downloads_count = downloads_count + 1 WHERE id = $1 RETURNING downloads_count', [id]);
        res.json({ success: true, newDownloads: result.rows[0].downloads_count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// 🛡️ PROTECTED ADMIN ROUTES (Requires Admin Token)
// ---------------------------------------------------------
app.post('/api/mixes', authenticateAdmin, async (req, res) => {
    let { title, audio_url, artwork_url } = req.body;

    if (!title || !audio_url) return res.status(400).json({ error: 'Title and Audio URL are required.' });

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

app.delete('/api/mixes/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM mixes WHERE id = $1', [id]);
        res.json({ message: 'Mix deleted successfully' });
    } catch (err) {
        console.error("Error deleting mix:", err);
        res.status(500).json({ error: 'Failed to delete mix' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔥 Secure DJ Grey Backend running on port ${PORT}`);
});
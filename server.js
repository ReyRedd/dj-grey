const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const nodemailer = require('nodemailer');

// 📧 SECURE EMAIL SETUP (Pulls from Render Environment Variables)
const nodemailer = require('nodemailer');

// 📧 SECURE EMAIL SETUP (Bypasses Render Firewalls)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER, 
        pass: process.env.EMAIL_PASS  
    }
});

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
// 🔑 AUTHENTICATION ROUTES
// ---------------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields required.' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        // Create an email verification token
        const verificationToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' });

        const result = await pool.query(
            "INSERT INTO users (username, email, password_hash, role, status) VALUES ($1, $2, $3, 'user', 'pending') RETURNING id, username, email",
            [username, email, hashedPassword]
        );

        // 📧 SEND VERIFICATION EMAIL
        const verifyLink = `https://dj-grey.onrender.com/api/auth/verify/${verificationToken}`;
        const mailOptions = {
            from: `"DJ Grey Vault" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Verify your Fan Account - DJ Grey',
            html: `<h3>Welcome to the VIP Vault, ${username}!</h3><p>Click the link below to verify your account and gain access:</p><a href="${verifyLink}">Verify My Account</a>`
        };
        
        // Use AWAIT so if Google blocks it, it throws an error to the frontend!
        await transporter.sendMail(mailOptions);

        res.status(201).json({ message: "Registration successful. Please check your email to verify your account!" });
    } catch (err) {
        // This will now catch Gmail errors and send them to your console
        console.error("REGISTER ERROR:", err);
        res.status(500).json({ error: err.message || 'Registration failed.' });
    }
});

// 📧 VERIFY EMAIL ROUTE
app.get('/api/auth/verify/:token', async (req, res) => {
    try {
        const decoded = jwt.verify(req.params.token, JWT_SECRET);
        await pool.query("UPDATE users SET status = 'approved' WHERE email = $1", [decoded.email]);
        res.send("<h1>Account Verified!</h1><p>You can now close this tab and log in to the DJ Grey platform.</p>");
    } catch (err) {
        res.status(400).send("<h1>Verification Link Expired or Invalid.</h1>");
    }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        // 🛑 NEW: Check if account is approved by DJ Grey
        if (user.status !== 'approved') {
            return res.status(403).json({ error: 'Your account is pending Admin approval.' });
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

// 🔒 UPDATED: Track Download for Fan Vault
app.post('/api/mixes/:id/download', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        // 1. Increment total downloads on the mix
        const result = await pool.query('UPDATE mixes SET downloads_count = downloads_count + 1 WHERE id = $1 RETURNING downloads_count', [id]);
        
        // 2. Add to user's personal vault (ON CONFLICT DO NOTHING prevents duplicates)
        await pool.query('INSERT INTO user_downloads (user_id, mix_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, id]);

        res.json({ success: true, newDownloads: result.rows[0].downloads_count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 📂 NEW: Fetch logged-in user's downloaded mixes
app.get('/api/users/me/downloads', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const query = `
            SELECT m.*, ud.downloaded_at 
            FROM user_downloads ud
            JOIN mixes m ON ud.mix_id = m.id
            WHERE ud.user_id = $1
            ORDER BY ud.downloaded_at DESC
        `;
        const result = await pool.query(query, [userId]);
        res.json(result.rows);
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

// ---------------------------------------------------------
// 👥 ADMIN USER MANAGEMENT ROUTES
// ---------------------------------------------------------
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        // Fetch users, putting 'pending' accounts at the very top
        const result = await pool.query(`
            SELECT id, username, email, role, status 
            FROM users 
            ORDER BY CASE WHEN status = 'pending' THEN 1 ELSE 2 END, id DESC
        `);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/users/:id/approve', authenticateAdmin, async (req, res) => {
    try {
        await pool.query("UPDATE users SET status = 'approved' WHERE id = $1", [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/admin/users/:id', authenticateAdmin, async (req, res) => {
    try {
        await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
// ---------------------------------------------------------
// 💬 COMMENT & REPLY ROUTES
// ---------------------------------------------------------

// Fetch all comments and replies for a specific mix with like counts
app.get('/api/mixes/:mixId/comments', async (req, res) => {
    const { mixId } = req.params;
    try {
        const query = `
            SELECT 
                c.id, c.mix_id, c.parent_id, c.content, c.created_at,
                u.username,
                COUNT(cl.id)::int AS likes_count
            FROM comments c
            JOIN users u ON c.user_id = u.id
            LEFT JOIN comment_likes cl ON c.id = cl.comment_id
            WHERE c.mix_id = $1
            GROUP BY c.id, u.username
            ORDER BY c.created_at ASC;
        `;
        const result = await pool.query(query, [mixId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Post a new comment or reply (Requires logged-in user)
app.post('/api/mixes/:mixId/comments', authenticateUser, async (req, res) => {
    const { mixId } = req.params;
    const { content, parent_id } = req.body;
    const userId = req.user.id;

    if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Comment content cannot be empty.' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO comments (mix_id, user_id, parent_id, content) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id, mix_id, parent_id, content, created_at`,
            [mixId, userId, parent_id || null, content.trim()]
        );
        res.status(201).json({ ...result.rows[0], username: req.user.username, likes_count: 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle like on a comment (Requires logged-in user)
app.post('/api/comments/:commentId/like', authenticateUser, async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.id;

    try {
        // Check if user already liked this comment
        const existingLike = await pool.query(
            'SELECT * FROM comment_likes WHERE comment_id = $1 AND user_id = $2',
            [commentId, userId]
        );

        if (existingLike.rows.length > 0) {
            // Unlike
            await pool.query('DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);
        } else {
            // Like
            await pool.query('INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)', [commentId, userId]);
        }

        // Get updated like count
        const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM comment_likes WHERE comment_id = $1', [commentId]);
        res.json({ success: true, likes_count: countRes.rows[0].count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------------------------------------------------------
// 💬 COMMENTS (Add Delete Route)
// ---------------------------------------------------------
app.delete('/api/comments/:id', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        // Ensure the user deleting is the owner of the comment, OR is an admin
        const comment = await pool.query('SELECT user_id FROM comments WHERE id = $1', [id]);
        
        if (comment.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
        if (comment.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized to delete this comment' });
        }

        await pool.query('DELETE FROM comments WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 📊 ADMIN ANALYTICS ROUTE
app.get('/api/admin/analytics', authenticateAdmin, async (req, res) => {
    try {
        // Bulletproof query that forces nulls to become 0 using COALESCE
        const mixesRes = await pool.query(`
            SELECT 
                COUNT(*) as count, 
                COALESCE(SUM(plays_count), 0) as plays, 
                COALESCE(SUM(likes_count), 0) as likes, 
                COALESCE(SUM(downloads_count), 0) as downloads 
            FROM mixes
        `);
        const commentsRes = await pool.query('SELECT COUNT(*) as count FROM comments');

        const data = {
            totalMixes: parseInt(mixesRes.rows[0].count) || 0,
            totalPlays: parseInt(mixesRes.rows[0].plays) || 0,
            totalLikes: parseInt(mixesRes.rows[0].likes) || 0,
            totalDownloads: parseInt(mixesRes.rows[0].downloads) || 0,
            totalComments: parseInt(commentsRes.rows[0].count) || 0
        };
        
        res.json(data);
    } catch (err) {
        console.error("🚨 ANALYTICS ERROR:", err);
        res.status(500).json({ error: 'Failed to load analytics' });
    }
});
// 🎵 NEW: Track a play (Public route, anyone can play a mix)
app.post('/api/mixes/:id/play', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('UPDATE mixes SET plays_count = plays_count + 1 WHERE id = $1 RETURNING plays_count', [id]);
        res.json({ success: true, newPlays: result.rows[0].plays_count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 📊 UPDATED: Admin Analytics Route
app.get('/api/admin/analytics', authenticateAdmin, async (req, res) => {
    try {
        const mixesCount = await pool.query('SELECT COUNT(*)::int FROM mixes');
        const likesCount = await pool.query('SELECT COALESCE(SUM(likes_count), 0)::int AS total FROM mixes');
        const downloadsCount = await pool.query('SELECT COALESCE(SUM(downloads_count), 0)::int AS total FROM mixes');
        const commentsCount = await pool.query('SELECT COUNT(*)::int FROM comments');
        
        // NEW: Fetch Total Plays
        const playsCount = await pool.query('SELECT COALESCE(SUM(plays_count), 0)::int AS total FROM mixes');

        res.json({
            totalMixes: mixesCount.rows[0].count,
            totalLikes: likesCount.rows[0].total,
            totalDownloads: downloadsCount.rows[0].total,
            totalComments: commentsCount.rows[0].count,
            totalPlays: playsCount.rows[0].total // Added to response
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔥 Secure DJ Grey Backend running on port ${PORT}`);
});
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/media', express.static('media'));

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

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
// 🔑 AUTHENTICATION ROUTES (Powered by Resend)
// ---------------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'All fields required.' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' });

        await pool.query(
            "INSERT INTO users (username, email, password_hash, role, status) VALUES ($1, $2, $3, 'user', 'pending')",
            [username, email, hashedPassword]
        );

        const verifyLink = `https://dj-grey.onrender.com/api/auth/verify/${verificationToken}`;
        
        // 🚀 Send email via Resend API
        const { data, error } = await resend.emails.send({
            from: 'DJ Grey Vault <vip@djgrey.wezer.me>',
            to: email, 
            subject: 'Verify your Fan Account - DJ Grey',
            html: `<div style="font-family: sans-serif; text-align: center; padding: 20px; background: #0a0a0c; color: #fff;">
                    <h2 style="color: #00a8ff;">Welcome to the VIP Vault, ${username}!</h2>
                    <p style="color: #a0a0a0;">Click the button below to verify your account and gain access to exclusive mixes.</p>
                    <a href="${verifyLink}" style="display: inline-block; padding: 12px 24px; background: #00a8ff; color: #fff; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px;">Verify My Account</a>
                   </div>`
        });

        if (error) throw new Error(error.message);

        res.status(201).json({ message: "Registration successful! Please check your email to verify your account." });
    } catch (err) {
        console.error("REGISTER ERROR:", err);
        res.status(500).json({ error: 'Registration failed. Email may already exist or API error.' });
    }
});

// ---------------------------------------------------------
// 📧 VERIFY EMAIL ROUTE
// ---------------------------------------------------------
app.get('/api/auth/verify/:token', async (req, res) => {
    try {
        const decoded = jwt.verify(req.params.token, JWT_SECRET);
        
        await pool.query("UPDATE users SET status = 'approved' WHERE email = $1", [decoded.email]);
        
        res.send(`
            <body style="background-color: #0a0a0c; color: #ffffff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
                <div style="text-align: center; padding: 40px; background: #1a1a20; border-radius: 12px; border-top: 4px solid #00a8ff; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    <h1 style="color: #00a8ff; margin-top: 0;">Account Verified! 🎉</h1>
                    <p style="color: #a0a0a0; font-size: 1.1rem;">Welcome to the VIP Vault. Your email has been successfully verified.</p>
                    <p style="margin-top: 30px;">
                        <a href="https://djgrey.wezer.me/login.html" style="background: #00a8ff; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Log In Now</a>
                    </p>
                </div>
            </body>
        `);
    } catch (err) {
        res.status(400).send(`
            <body style="background-color: #0a0a0c; color: #ffffff; font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
                <div style="text-align: center; padding: 40px; background: #1a1a20; border-radius: 12px; border-top: 4px solid #ff4d4d; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    <h1 style="color: #ff4d4d; margin-top: 0;">Verification Failed</h1>
                    <p style="color: #a0a0a0; font-size: 1.1rem;">This verification link is invalid or has expired.</p>
                </div>
            </body>
        `);
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

        if (user.status !== 'approved') {
            return res.status(403).json({ error: 'Your account is pending verification. Please check your email for a verification link.' });
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

app.post('/api/mixes/:id/play', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('UPDATE mixes SET plays_count = plays_count + 1 WHERE id = $1 RETURNING plays_count', [id]);
        res.json({ success: true, newPlays: result.rows[0].plays_count });
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
        const userId = req.user.id;

        const result = await pool.query('UPDATE mixes SET downloads_count = downloads_count + 1 WHERE id = $1 RETURNING downloads_count', [id]);
        await pool.query('INSERT INTO user_downloads (user_id, mix_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, id]);

        res.json({ success: true, newDownloads: result.rows[0].downloads_count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

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
        res.status(500).json({ error: 'Database insert failed' });
    }
});

app.delete('/api/mixes/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM mixes WHERE id = $1', [id]);
        res.json({ message: 'Mix deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete mix' });
    }
});

// ---------------------------------------------------------
// 👥 ADMIN USER MANAGEMENT ROUTES
// ---------------------------------------------------------
app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
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

// ---------------------------------------------------------
// 🎧 HEARTHIS.AT INTEGRATION ROUTE (AUTO-IMPORT TO DB)
// ---------------------------------------------------------
app.get("/api/hearthis/sync/:username", async (req, res) => {
  try {
    const hearthisUsername = req.params.username || "grey-george"; 
    
    // 1. Fetch RSS feed with custom User-Agent
    const response = await fetch(`https://hearthis.at/${hearthisUsername}/podcast/`, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    });
    
    if (!response.ok) {
      return res.status(500).json({ error: "Failed to fetch from Hearthis.at RSS" });
    }

    const xmlText = await response.text();
    const items = xmlText.match(/<item>[\s\S]*?<\/item>/gi) || [];
    
    // 2. Parse RSS items
    const parsedItems = items.map((item) => {
      let title = "Unknown Mix";
      const cdataMatch = item.match(/<title>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/title>/i);
      const plainMatch = item.match(/<title>\s*([\s\S]*?)\s*<\/title>/i);
      
      if (cdataMatch) title = cdataMatch[1].trim();
      else if (plainMatch) title = plainMatch[1].trim();

      const urlMatch = item.match(/<enclosure[^>]*url="([^"]+)"/i);
      const artMatch = item.match(/<itunes:image[^>]*href="([^"]+)"/i);

      return {
        title: title,
        audio_url: urlMatch ? urlMatch[1] : "",
        artwork_url: artMatch ? artMatch[1] : "https://www.dropbox.com/scl/fi/sn5sapl4pr1uzc98kcpez/dj_grey.jpeg?rlkey=72jldl168nvtccasr0ekk2qy2&st=3yyulxhl&raw=1"
      };
    }).filter(mix => mix.audio_url);

    // 3. Auto-Insert into database if not already present
    const syncedMixes = [];
    for (const mix of parsedItems) {
      // 🚨 FIX: Replaced db.query with pool.query
      let dbCheck = await pool.query(
        "SELECT * FROM mixes WHERE title = $1 OR audio_url = $2", 
        [mix.title, mix.audio_url]
      );

      if (dbCheck.rows.length === 0) {
        // 🚨 FIX: Replaced db.query with pool.query
        const inserted = await pool.query(
          "INSERT INTO mixes (title, audio_url, artwork_url, likes_count, downloads_count, created_at) VALUES ($1, $2, $3, 0, 0, NOW()) RETURNING *",
          [mix.title, mix.audio_url, mix.artwork_url]
        );
        syncedMixes.push(inserted.rows[0]);
      } else {
        syncedMixes.push(dbCheck.rows[0]);
      }
    }

    res.json({ success: true, count: syncedMixes.length, mixes: syncedMixes });
  } catch (err) {
    console.error("Hearthis sync error:", err);
    res.status(500).json({ error: "Internal server error syncing Hearthis.at" });
  }
});

// ---------------------------------------------------------
// 🎧 SPOTIFY LIVE SYNC ROUTE (DYNAMIC IFRAME BYPASS)
// ---------------------------------------------------------
app.get("/api/spotify/sync", async (req, res) => {
  try {
    // Take URL from frontend query, fallback to a guaranteed public playlist
    const spotifyUrl = req.query.url || "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"; 
    const mixTitle = req.query.title || "DJ Grey - Spotify Drop";
    
    // Parse the URL to dynamically generate the correct embed type (playlist, track, album)
    const urlParts = spotifyUrl.split('/');
    const typeIndex = urlParts.findIndex(p => p === 'playlist' || p === 'track' || p === 'album' || p === 'artist');
    
    if (typeIndex === -1 || typeIndex + 1 >= urlParts.length) {
        return res.status(400).json({ error: "Invalid Spotify URL. Must contain track, album, artist, or playlist." });
    }

    const embedType = urlParts[typeIndex];
    const embedId = urlParts[typeIndex + 1].split('?')[0]; 
    
    const artwork = "https://www.dropbox.com/scl/fi/sn5sapl4pr1uzc98kcpez/dj_grey.jpeg?rlkey=72jldl168nvtccasr0ekk2qy2&st=3yyulxhl&raw=1";
    
    // Official Spotify Embed Code
    const embed_html = `<iframe style="border-radius:12px; box-shadow: 0 15px 35px rgba(0,0,0,0.5);" src="https://open.spotify.com/embed/${embedType}/${embedId}?utm_source=generator&theme=0" width="100%" height="400" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;

    // Auto-check and insert into Postgres DB so actions like comments & likes work locally
    let dbCheck = await pool.query("SELECT * FROM mixes WHERE audio_url = $1", [spotifyUrl]);
    let spotifyMix;

    if (dbCheck.rows.length === 0) {
      const inserted = await pool.query(
        "INSERT INTO mixes (title, audio_url, artwork_url, likes_count, downloads_count, created_at) VALUES ($1, $2, $3, 0, 0, NOW()) RETURNING *",
        [mixTitle, spotifyUrl, artwork]
      );
      spotifyMix = inserted.rows[0];
    } else {
      // Pulls the up-to-date likes and comments from YOUR database!
      spotifyMix = dbCheck.rows[0];
    }

    res.json({
      success: true,
      mix: spotifyMix,
      embed_html: embed_html,
      provider: "spotify"
    });
  } catch (err) {
    console.error("Spotify sync error:", err);
    res.status(500).json({ error: "Internal server error syncing Spotify" });
  }
});

// ---------------------------------------------------------
// 💬 COMMENT & REPLY ROUTES
// ---------------------------------------------------------
app.get('/api/mixes/:mixId/comments', async (req, res) => {
    const { mixId } = req.params;
    try {
        const query = `
            SELECT c.id, c.mix_id, c.parent_id, c.content, c.created_at, u.username, COUNT(cl.id)::int AS likes_count
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

app.post('/api/mixes/:mixId/comments', authenticateUser, async (req, res) => {
    const { mixId } = req.params;
    const { content, parent_id } = req.body;
    const userId = req.user.id;

    if (!content || !content.trim()) return res.status(400).json({ error: 'Comment content cannot be empty.' });

    try {
        const result = await pool.query(
            `INSERT INTO comments (mix_id, user_id, parent_id, content) VALUES ($1, $2, $3, $4) RETURNING id, mix_id, parent_id, content, created_at`,
            [mixId, userId, parent_id || null, content.trim()]
        );
        res.status(201).json({ ...result.rows[0], username: req.user.username, likes_count: 0 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/comments/:commentId/like', authenticateUser, async (req, res) => {
    const { commentId } = req.params;
    const userId = req.user.id;

    try {
        const existingLike = await pool.query('SELECT * FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);

        if (existingLike.rows.length > 0) {
            await pool.query('DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2', [commentId, userId]);
        } else {
            await pool.query('INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)', [commentId, userId]);
        }

        const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM comment_likes WHERE comment_id = $1', [commentId]);
        res.json({ success: true, likes_count: countRes.rows[0].count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/comments/:id', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const comment = await pool.query('SELECT user_id FROM comments WHERE id = $1', [id]);
        
        if (comment.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
        if (comment.rows[0].user_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        await pool.query('DELETE FROM comments WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ensure submissions table exists
pool.query(`
    CREATE TABLE IF NOT EXISTS mix_submissions (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        dj_name VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        audio_url TEXT NOT NULL,
        artwork_url TEXT,
        spotify_url TEXT,
        fee_paid NUMERIC(5,2) DEFAULT 0.50,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`);

// 🎧 Submit Mix Endpoint ($0.50 Upload Request)
app.post('/api/submissions/upload', authenticateUser, async (req, res) => {
    const { title, audio_url, artwork_url, spotify_url } = req.body;
    if (!title || (!audio_url && !spotify_url)) {
        return res.status(400).json({ error: "Mix title and audio or Spotify link are required." });
    }

    try {
        const result = await pool.query(
            `INSERT INTO mix_submissions (user_id, dj_name, title, audio_url, artwork_url, spotify_url, fee_paid, status)
             VALUES ($1, $2, $3, $4, $5, $6, 0.50, 'pending') RETURNING *`,
            [req.user.id, req.user.username, title, audio_url || '', artwork_url || '', spotify_url || '']
        );
        res.status(201).json({ success: true, message: "Mix submitted for review! $0.50 USD fee recorded.", submission: result.rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 🛡️ Admin Fetch Submissions & Approve
app.get('/api/admin/submissions', authenticateAdmin, async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM mix_submissions ORDER BY id DESC");
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/submissions/:id/approve', authenticateAdmin, async (req, res) => {
    try {
        const subRes = await pool.query("SELECT * FROM mix_submissions WHERE id = $1", [req.params.id]);
        if (subRes.rows.length === 0) return res.status(404).json({ error: "Submission not found" });

        const sub = subRes.rows[0];
        // Insert approved mix into main catalog
        await pool.query(
            "INSERT INTO mixes (title, audio_url, artwork_url, likes_count, downloads_count) VALUES ($1, $2, $3, 0, 0)",
            [`${sub.title} (by DJ ${sub.dj_name})`, sub.audio_url || sub.spotify_url, sub.artwork_url || "https://www.dropbox.com/scl/fi/sn5sapl4pr1uzc98kcpez/dj_grey.jpeg?rlkey=72jldl168nvtccasr0ekk2qy2&st=3yyulxhl&raw=1"]
        );

        await pool.query("UPDATE mix_submissions SET status = 'approved' WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "Mix published to live platform!" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Ensure livestream tables exist
pool.query(`
    CREATE TABLE IF NOT EXISTS livestreams (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) DEFAULT 'DJ GREY LIVE SESSION',
        stream_url TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS live_chat (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`);

// Get active livestream
app.get('/api/livestream/active', async (req, res) => {
    try {
        const stream = await pool.query("SELECT * FROM livestreams WHERE is_active = true ORDER BY id DESC LIMIT 1");
        res.json({ active: stream.rows.length > 0, stream: stream.rows[0] || null });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get live chat messages
app.get('/api/livestream/chat', async (req, res) => {
    try {
        const messages = await pool.query("SELECT * FROM live_chat ORDER BY id DESC LIMIT 50");
        res.json(messages.rows.reverse());
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Post live chat message
app.post('/api/livestream/chat', authenticateUser, async (req, res) => {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: "Message cannot be empty." });

    try {
        const result = await pool.query(
            "INSERT INTO live_chat (user_id, username, message) VALUES ($1, $2, $3) RETURNING *",
            [req.user.id, req.user.username, message.trim()]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// Admin toggle livestream
app.post('/api/admin/livestream', authenticateAdmin, async (req, res) => {
    const { title, stream_url, is_active } = req.body;
    try {
        await pool.query("UPDATE livestreams SET is_active = false"); // Deactivate previous streams
        if (is_active) {
            await pool.query(
                "INSERT INTO livestreams (title, stream_url, is_active) VALUES ($1, $2, true)",
                [title || 'DJ GREY LIVE SESSION', stream_url]
            );
        }
        res.json({ success: true, message: is_active ? "Livestream launched!" : "Livestream ended." });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------------------------------------------------------
// 📊 BULLETPROOF ADMIN ANALYTICS ROUTE
// ---------------------------------------------------------
app.get('/api/admin/analytics', authenticateAdmin, async (req, res) => {
    try {
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔥 Secure DJ Grey Backend running on port ${PORT}`);
});
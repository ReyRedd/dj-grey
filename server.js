const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());
app.use('/media', express.static('media'));

const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_dummy_key_for_now');

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

function authenticateDJOrAdmin(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; 
    if (!token) return res.status(401).json({ error: 'Access denied. Please log in.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired login token.' });
        if (user.role !== 'admin' && user.role !== 'dj') return res.status(403).json({ error: 'DJ privileges required.' });
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
        const verificationToken = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1h' });

        await pool.query(
            "INSERT INTO users (username, email, password_hash, role, status) VALUES ($1, $2, $3, 'user', 'pending')",
            [username, email, hashedPassword]
        );

        const verifyLink = `https://dj-grey.onrender.com/api/auth/verify/${verificationToken}`;

        const { error } = await resend.emails.send({
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
        res.status(500).json({ error: 'Registration failed. Email may already exist or API error.' });
    }
});

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
        res.status(400).send(`<h1 style="color:red;text-align:center;margin-top:20%">Verification Failed</h1>`);
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
        const user = result.rows[0];

        if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: 'Invalid username or password' });
        if (user.status !== 'approved') return res.status(403).json({ error: 'Your account is pending verification. Please check your email.' });

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, username: user.username, role: user.role });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------------------------------------------------------
// 🌍 PUBLIC MUSIC ROUTES & LIKES
// ---------------------------------------------------------
app.get('/api/mixes', async (req, res) => {
    try { res.json((await pool.query('SELECT * FROM mixes ORDER BY id ASC')).rows); } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/mixes/:id/play', async (req, res) => {
    try {
        const result = await pool.query('UPDATE mixes SET plays_count = plays_count + 1 WHERE id = $1 RETURNING plays_count', [req.params.id]);
        res.json({ success: true, newPlays: result.rows[0].plays_count });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/mixes/:id/like', authenticateUser, async (req, res) => {
    try {
        const mixId = req.params.id;
        const userId = req.user.id;

        await pool.query(`CREATE TABLE IF NOT EXISTS mix_likes (id SERIAL PRIMARY KEY, mix_id INT REFERENCES mixes(id) ON DELETE CASCADE, user_id INT REFERENCES users(id) ON DELETE CASCADE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE(mix_id, user_id));`);

        const existingLike = await pool.query('SELECT * FROM mix_likes WHERE mix_id = $1 AND user_id = $2', [mixId, userId]);
        let liked = false;
        if (existingLike.rows.length > 0) {
            await pool.query('DELETE FROM mix_likes WHERE mix_id = $1 AND user_id = $2', [mixId, userId]);
            await pool.query('UPDATE mixes SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = $1', [mixId]);
        } else {
            await pool.query('INSERT INTO mix_likes (mix_id, user_id) VALUES ($1, $2)', [mixId, userId]);
            await pool.query('UPDATE mixes SET likes_count = likes_count + 1 WHERE id = $1', [mixId]);
            liked = true;
        }

        const updatedMix = await pool.query('SELECT likes_count FROM mixes WHERE id = $1', [mixId]);
        res.json({ success: true, newLikes: updatedMix.rows[0].likes_count, liked });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/mixes/:id/download', authenticateUser, async (req, res) => {
    try {
        const result = await pool.query('UPDATE mixes SET downloads_count = downloads_count + 1 WHERE id = $1 RETURNING downloads_count', [req.params.id]);
        await pool.query('INSERT INTO user_downloads (user_id, mix_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, req.params.id]);
        res.json({ success: true, newDownloads: result.rows[0].downloads_count });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/users/me/downloads', authenticateUser, async (req, res) => {
    try {
        const query = `SELECT m.*, ud.downloaded_at FROM user_downloads ud JOIN mixes m ON ud.mix_id = m.id WHERE ud.user_id = $1 ORDER BY ud.downloaded_at DESC`;
        res.json((await pool.query(query, [req.user.id])).rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ---------------------------------------------------------
// 💸 DJ UPLOADS & PAYMENT INTEGRATION (STRIPE / PAYPAL)
// ---------------------------------------------------------
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
        status VARCHAR(20) DEFAULT 'awaiting_payment',
        stripe_session_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`);

app.post('/api/submissions/checkout', authenticateUser, async (req, res) => {
    const { title, audio_url, artwork_url, spotify_url } = req.body;
    try {
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price_data: { currency: 'usd', product_data: { name: 'Premium DJ Mix Upload', description: `Submission for: ${title}` }, unit_amount: 50 }, quantity: 1 }],
            mode: 'payment',
            success_url: `https://dj-grey.onrender.com/api/submissions/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `https://djgrey.wezer.me/#`,
        });

        await pool.query(
            `INSERT INTO mix_submissions (user_id, dj_name, title, audio_url, artwork_url, spotify_url, fee_paid, status, stripe_session_id) VALUES ($1, $2, $3, $4, $5, $6, 0.50, 'awaiting_payment', $7)`,
            [req.user.id, req.user.username, title, audio_url || '', artwork_url || '', spotify_url || '', session.id]
        );
        res.json({ url: session.url });
    } catch (err) { res.status(500).json({ error: "Stripe error." }); }
});

app.get('/api/submissions/success', async (req, res) => {
    try {
        await pool.query("UPDATE mix_submissions SET status = 'pending' WHERE stripe_session_id = $1", [req.query.session_id]);
        await pool.query(`UPDATE users SET role = 'dj' WHERE id = (SELECT user_id FROM mix_submissions WHERE stripe_session_id = $1)`, [req.query.session_id]);
        res.redirect('https://djgrey.wezer.me/?upload=success');
    } catch (err) { res.status(500).send("Payment verification failed."); }
});

const PAYPAL_API = process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
async function generatePayPalToken() {
    const auth = Buffer.from((process.env.PAYPAL_CLIENT_ID || 'AWdummy') + ':' + (process.env.PAYPAL_SECRET || 'EEPdummy')).toString('base64');
    const res = await fetch(`${PAYPAL_API}/v1/oauth2/token`, { method: 'POST', body: 'grant_type=client_credentials', headers: { Authorization: `Basic ${auth}` } });
    return (await res.json()).access_token;
}

app.post('/api/submissions/paypal/create', authenticateUser, async (req, res) => {
    const { title, audio_url, artwork_url, spotify_url } = req.body;
    try {
        const token = await generatePayPalToken();
        const orderData = { intent: 'CAPTURE', purchase_units: [{ amount: { currency_code: 'USD', value: '0.50' }, description: `DJ Upload: ${title}` }], application_context: { return_url: `https://dj-grey.onrender.com/api/submissions/paypal/capture`, cancel_url: `https://djgrey.wezer.me/#` } };
        const response = await fetch(`${PAYPAL_API}/v2/checkout/orders`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(orderData) });
        const order = await response.json();
        await pool.query(`INSERT INTO mix_submissions (user_id, dj_name, title, audio_url, artwork_url, spotify_url, fee_paid, status, stripe_session_id) VALUES ($1, $2, $3, $4, $5, $6, 0.50, 'awaiting_payment', $7)`, [req.user.id, req.user.username, title, audio_url || '', artwork_url || '', spotify_url || '', order.id]);
        res.json({ url: order.links.find(l => l.rel === 'approve').href });
    } catch (err) { res.status(500).json({ error: "PayPal gateway error." }); }
});

app.get('/api/submissions/paypal/capture', async (req, res) => {
    try {
        const token = await generatePayPalToken();
        const response = await fetch(`${PAYPAL_API}/v2/checkout/orders/${req.query.token}/capture`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
        if ((await response.json()).status === 'COMPLETED') {
            await pool.query("UPDATE mix_submissions SET status = 'pending' WHERE stripe_session_id = $1", [req.query.token]);
            await pool.query(`UPDATE users SET role = 'dj' WHERE id = (SELECT user_id FROM mix_submissions WHERE stripe_session_id = $1)`, [req.query.token]);
            res.redirect('https://djgrey.wezer.me/?upload=success');
        } else res.redirect('https://djgrey.wezer.me/?upload=failed');
    } catch (err) { res.status(500).send("PayPal Capture Error."); }
});

// ---------------------------------------------------------
// 🔴 FREE WEBRTC BROWSER LIVESTREAM CENTER
// ---------------------------------------------------------
pool.query(`
    CREATE TABLE IF NOT EXISTS livestreams (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) DEFAULT 'DJ GREY LIVE SESSION',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS live_chat (
        id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE,
        username VARCHAR(100) NOT NULL, message TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`);

app.post('/api/admin/livestream', authenticateDJOrAdmin, async (req, res) => {
    const { title, is_active } = req.body;
    try {
        await pool.query("UPDATE livestreams SET is_active = false");
        if (is_active) {
            await pool.query("INSERT INTO livestreams (title, is_active) VALUES ($1, true)", [title || 'LIVE SESSION']);
        }
        res.json({ success: true, message: is_active ? "Livestream launched!" : "Livestream ended." });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/livestream/active', async (req, res) => {
    try {
        const stream = await pool.query("SELECT * FROM livestreams WHERE is_active = true ORDER BY id DESC LIMIT 1");
        res.json({ active: stream.rows.length > 0, stream: stream.rows[0] || null });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/livestream/chat', async (req, res) => {
    try { res.json((await pool.query("SELECT * FROM live_chat ORDER BY id DESC LIMIT 50")).rows.reverse()); } catch (err) {}
});

app.post('/api/livestream/chat', authenticateUser, async (req, res) => {
    if (!req.body.message || !req.body.message.trim()) return res.status(400).json({ error: "Empty message." });
    try { res.status(201).json((await pool.query("INSERT INTO live_chat (user_id, username, message) VALUES ($1, $2, $3) RETURNING *", [req.user.id, req.user.username, req.body.message.trim()])).rows[0]); } catch (err) {}
});

// 📡 WEBRTC SIGNALING SERVER LOGIC
let broadcaster = null;
io.on("connection", (socket) => {
    socket.on("broadcaster", () => {
        broadcaster = socket.id;
        socket.broadcast.emit("broadcaster");
    });
    socket.on("watcher", () => {
        if (broadcaster) {
            socket.to(broadcaster).emit("watcher", socket.id);
        }
    });
    socket.on("offer", (id, message) => {
        socket.to(id).emit("offer", socket.id, message);
    });
    socket.on("answer", (id, message) => {
        socket.to(id).emit("answer", socket.id, message);
    });
    socket.on("candidate", (id, message) => {
        socket.to(id).emit("candidate", socket.id, message);
    });
    socket.on("disconnect", () => {
        socket.broadcast.emit("disconnectPeer", socket.id);
        if (socket.id === broadcaster) broadcaster = null;
    });
});

// 🛡️ ADMIN GENERAL ROUTES
app.post('/api/mixes', authenticateAdmin, async (req, res) => {
    let { title, audio_url, artwork_url } = req.body;
    audio_url = audio_url.replace('dl=0', 'raw=1');
    artwork_url = artwork_url ? artwork_url.replace('dl=0', 'raw=1') : 'https://www.dropbox.com/scl/fi/sn5sapl4pr1uzc98kcpez/dj_grey.jpeg?rlkey=72jldl168nvtccasr0ekk2qy2&st=3yyulxhl&raw=1';
    try { res.status(201).json((await pool.query('INSERT INTO mixes (title, audio_url, artwork_url) VALUES ($1, $2, $3) RETURNING *', [title, audio_url, artwork_url])).rows[0]); } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/mixes/:id', authenticateAdmin, async (req, res) => {
    try { await pool.query('DELETE FROM mixes WHERE id = $1', [req.params.id]); res.json({ success: true }); } catch (err) {}
});

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try { res.json((await pool.query("SELECT id, username, email, role, status FROM users ORDER BY CASE WHEN status = 'pending' THEN 1 ELSE 2 END, id DESC")).rows); } catch (err) {}
});

app.delete('/api/admin/users/:id', authenticateAdmin, async (req, res) => {
    try { await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]); res.json({ success: true }); } catch (err) {}
});

app.get('/api/admin/submissions', authenticateAdmin, async (req, res) => {
    try { res.json((await pool.query("SELECT * FROM mix_submissions ORDER BY id DESC")).rows); } catch (err) {}
});

app.post('/api/admin/submissions/:id/approve', authenticateAdmin, async (req, res) => {
    try {
        const sub = (await pool.query("SELECT * FROM mix_submissions WHERE id = $1", [req.params.id])).rows[0];
        await pool.query("INSERT INTO mixes (title, audio_url, artwork_url, likes_count, downloads_count) VALUES ($1, $2, $3, 0, 0)", [`${sub.title} (by DJ ${sub.dj_name})`, sub.audio_url || sub.spotify_url, sub.artwork_url || ""]);
        await pool.query("UPDATE mix_submissions SET status = 'approved' WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "Mix published!" });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/analytics', authenticateAdmin, async (req, res) => {
    try {
        const mixesRes = await pool.query(`SELECT COUNT(*) as count, COALESCE(SUM(plays_count), 0) as plays, COALESCE(SUM(likes_count), 0) as likes, COALESCE(SUM(downloads_count), 0) as downloads FROM mixes`);
        res.json({ totalMixes: parseInt(mixesRes.rows[0].count), totalPlays: parseInt(mixesRes.rows[0].plays), totalLikes: parseInt(mixesRes.rows[0].likes), totalDownloads: parseInt(mixesRes.rows[0].downloads) });
    } catch (err) {}
});

// 🎧 HEARTHIS & SPOTIFY ROUTES
app.get("/api/hearthis/sync/:username", async (req, res) => {
  try {
    const response = await fetch(`https://hearthis.at/${req.params.username || "grey-george"}/podcast/`, { headers: { "User-Agent": "Mozilla/5.0" } });
    const items = (await response.text()).match(/<item>[\s\S]*?<\/item>/gi) || [];
    
    const syncedMixes = [];
    for (const item of items) {
      let title = (item.match(/<title>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/title>/i) || item.match(/<title>\s*([\s\S]*?)\s*<\/title>/i) || [])[1]?.trim() || "Unknown";
      let audio_url = (item.match(/<enclosure[^>]*url="([^"]+)"/i) || [])[1] || "";
      if (!audio_url) continue;

      let dbCheck = await pool.query("SELECT * FROM mixes WHERE title = $1 OR audio_url = $2", [title, audio_url]);
      if (dbCheck.rows.length === 0) {
        syncedMixes.push((await pool.query("INSERT INTO mixes (title, audio_url, artwork_url, likes_count, downloads_count) VALUES ($1, $2, $3, 0, 0) RETURNING *", [title, audio_url, ""])).rows[0]);
      } else syncedMixes.push(dbCheck.rows[0]);
    }
    res.json({ success: true, mixes: syncedMixes });
  } catch (err) { res.status(500).json({ error: "Hearthis sync error" }); }
});

app.get("/api/spotify/sync", async (req, res) => {
  try {
    const spotifyUrl = req.query.url || "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"; 
    const urlParts = spotifyUrl.split('/');
    const typeIndex = urlParts.findIndex(p => p === 'playlist' || p === 'track' || p === 'album');
    const embed_html = `<iframe style="border-radius:12px; box-shadow: 0 15px 35px rgba(0,0,0,0.5);" src="https://open.spotify.com/embed/${urlParts[typeIndex]}/${urlParts[typeIndex + 1].split('?')[0]}?utm_source=generator&theme=0" width="100%" height="400" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
    
    let dbCheck = await pool.query("SELECT * FROM mixes WHERE audio_url = $1", [spotifyUrl]);
    let spotifyMix = dbCheck.rows.length === 0 ? (await pool.query("INSERT INTO mixes (title, audio_url, artwork_url, likes_count, downloads_count) VALUES ($1, $2, $3, 0, 0) RETURNING *", [req.query.title || "DJ Grey - Spotify Drop", spotifyUrl, ""])).rows[0] : dbCheck.rows[0];
    res.json({ success: true, mix: spotifyMix, embed_html });
  } catch (err) { res.status(500).json({ error: "Spotify sync error" }); }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🔥 Free WebRTC Server running on port ${PORT}`));
let currentTab = "home";

async function loadMixes() {
  try {
    const res = await fetch(`${API_URL}/mixes`);
    playlist = await res.json();
    renderGrid(playlist);
  } catch (error) {
    console.error("Error loading mixes:", error);
  }
}

function renderGrid(mixes) {
  const grid = document.getElementById("mixes-grid");
  grid.innerHTML = "";

  if (mixes.length === 0) {
    grid.innerHTML = `<p style="color: var(--text-muted);">No mixes found in this section.</p>`;
    return;
  }

  mixes.forEach((mix, index) => {
    const art = DEFAULT_ARTWORK;
    grid.innerHTML += `
        <div class="card">
            <img src="${art}" class="card-img" alt="Artwork" onerror="this.src='${DEFAULT_ARTWORK}'">
            <div class="card-content">
                <h3 class="card-title">${mix.title}</h3>
                <div class="card-actions">
                    <button class="btn-play" onclick="playMix(${index})">
                        <i class="fa-solid fa-play"></i> PLAY
                    </button>
                    <div class="stats">
                        <span onclick="likeMix(${mix.id}, this)" title="Like"><i class="fa-solid fa-heart"></i> ${mix.likes_count || 0}</span>
                        <span onclick="downloadMix(${mix.id}, '${mix.audio_url}')" title="Download"><i class="fa-solid fa-download"></i> ${mix.downloads_count || 0}</span>
                        <span onclick="openShareModal('${mix.title.replace(/'/g, "\\'")}', 'https://djgrey.wezer.me?mix=${mix.id}')" title="Share Mix"><i class="fa-solid fa-share-nodes"></i></span>
                    </div>
                </div>
                <div style="margin-top: 15px; border-top: 1px solid var(--border-color); padding-top: 15px;">
                    <button class="comments-toggle-btn" onclick="openCommentsSidebar(${mix.id}, '${mix.title.replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-comments"></i> View Comments
                    </button>
                </div>
            </div>
        </div>
    `;
  });
}

function switchTab(tab) {
  currentTab = tab;
  const titleEl = document.getElementById("page-section-title");

  // Highlight active nav item
  document.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));
  event?.currentTarget?.classList?.add("active");

  if (tab === "home") {
    titleEl.innerText = "LATEST DROPS";
    renderGrid(playlist);
  } else if (tab === "trending") {
    titleEl.innerText = "🔥 TRENDING DROPS";
    const sorted = [...playlist].sort((a, b) => (b.likes_count + b.downloads_count) - (a.likes_count + a.downloads_count));
    renderGrid(sorted);
  } else if (tab === "liked") {
    titleEl.innerText = "❤️ LIKED MIXES";
    const liked = playlist.filter((m) => m.likes_count > 0);
    renderGrid(liked);
  } else if (tab === "history") {
    titleEl.innerText = "🕒 WATCH & LISTEN HISTORY";
    renderGrid(playlist);
  } else if (tab === "hearthis") {
    titleEl.innerText = "💿 DJ GREY'S HEARTHIS HUB";
    fetchHearthisMixes(); // Triggers the live API sync
  }

  // Auto-close menu on mobile after clicking a tab
  if (window.innerWidth <= 768) {
      const leftNav = document.getElementById("left-nav");
      if(leftNav) leftNav.classList.remove("open");
  }
}

// Direct Hearthis.at API Sync
async function fetchHearthisMixes() {
    const grid = document.getElementById("mixes-grid");
    grid.innerHTML = `<p style="font-size: 1.1rem; color: var(--primary);"><i class="fa-solid fa-spinner fa-spin"></i> Syncing directly with DJ Grey's Hearthis.at account...</p>`;
    try {
        // 🚨 FIX: Pass the exact profile handle with the hyphen!
        const res = await fetch(`${API_URL}/hearthis/sync/grey-george`); 
        const data = await res.json();
        if(data.success && data.mixes.length > 0) {
            renderGrid(data.mixes);
        } else {
            grid.innerHTML = `<p style="color: var(--text-muted);">No public mixes found on Hearthis.at.</p>`;
        }
    } catch(e) {
        console.error(e);
        grid.innerHTML = `<p style="color: #ff4d4d;">Failed to establish connection to Hearthis.at. Is the backend running?</p>`;
    }
}

async function likeMix(id, element) {
  if (!token) return alert("Please login or create a free fan account to like tracks.");
  try {
    const res = await fetch(`${API_URL}/mixes/${id}/like`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (data.success) {
      element.innerHTML = `<i class="fa-solid fa-heart" style="color: var(--primary);"></i> ${data.newLikes}`;
    }
  } catch (err) {
    console.error("Error liking mix:", err);
  }
}

async function downloadMix(id, url) {
  if (!token) return alert("Please login or create a free fan account to download tracks.");
  try {
    const res = await fetch(`${API_URL}/mixes/${id}/download`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      alert("Mix saved to your Vault!");
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = url.replace("dl=0", "dl=1").replace("raw=1", "dl=1");
      document.body.appendChild(iframe);
      setTimeout(() => document.body.removeChild(iframe), 10000);
    }
  } catch (err) {
    console.error("Error downloading mix:", err);
  }
}

// --- HAMBURGER MENU TOGGLE ---
const menuToggle = document.getElementById("menu-toggle");
const leftNav = document.getElementById("left-nav");

if (menuToggle && leftNav) {
    menuToggle.addEventListener("click", () => {
        if (window.innerWidth > 768) {
            // Desktop behavior: shrink to 0
            leftNav.classList.toggle("collapsed");
        } else {
            // Mobile behavior: slide in from left
            leftNav.classList.toggle("open");
        }
    });
}

// Close mobile nav when clicking outside of it (Only affects mobile)
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768 && leftNav && leftNav.classList.contains('open')) {
        if (!leftNav.contains(e.target) && !menuToggle.contains(e.target)) {
            leftNav.classList.remove('open');
        }
    }
});

window.onload = loadMixes;
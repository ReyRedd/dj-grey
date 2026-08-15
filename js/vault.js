async function toggleVault() {
  const vault = document.getElementById("vault-sidebar");
  vault.classList.toggle("open");

  if (vault.classList.contains("open")) {
    const list = document.getElementById("vault-list");
    try {
      const res = await fetch(`${API_URL}/users/me/downloads`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to load vault");
      const downloads = await res.json();

      if (downloads.length === 0) {
        list.innerHTML = `<p style="color: var(--text-muted); padding: 15px 0;">You haven't downloaded any mixes yet!</p>`;
        return;
      }

      list.innerHTML = "";
      downloads.forEach((mix) => {
        const art = mix.artwork_url || DEFAULT_ARTWORK;
        const downloadedDate = mix.downloaded_at 
          ? new Date(mix.downloaded_at).toLocaleDateString() 
          : new Date().toLocaleDateString();

        list.innerHTML += `
            <div class="vault-item" style="display: flex; align-items: center; gap: 15px; padding: 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); border-radius: 12px; margin-bottom: 12px;">
                <img src="${art}" alt="${mix.title}" onerror="this.src='${DEFAULT_ARTWORK}'" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; flex-shrink: 0;">
                <div class="vault-info" style="flex: 1; min-width: 0;">
                    <h4 style="font-size: 0.95rem; margin: 0 0 4px 0; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${mix.title}</h4>
                    <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">Downloaded: ${downloadedDate}</p>
                </div>
                <button class="vault-play-btn" onclick="playVaultMix('${mix.audio_url}', '${mix.title.replace(/'/g, "\\'")}', '${art}')" style="background: var(--primary); color: #fff; border: none; width: 38px; height: 38px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: transform 0.2s;">
                    <i class="fa-solid fa-play"></i>
                </button>
            </div>
        `;
      });
    } catch (err) {
      console.error("Playlist error:", err);
      list.innerHTML = `<p style="color: #ff4d4d; padding: 15px 0;">Error loading your playlist. Please log in again.</p>`;
    }
  }
}

function playVaultMix(url, title, art) {
  const artUrl = art || DEFAULT_ARTWORK;

  document.getElementById("np-title").innerText = title;
  document.getElementById("np-art").src = artUrl;
  
  // 🪄 Reveal bottom player bar on play
  const playerUI = document.getElementById("player-ui");
  if (playerUI) playerUI.classList.add("active");

  // Set Fullscreen Backdrop
  const backdrop = document.getElementById("fullscreen-backdrop");
  if (backdrop) backdrop.style.backgroundImage = `url('${artUrl}')`;

  audioPlayer.src = url;
  audioPlayer.play();
}
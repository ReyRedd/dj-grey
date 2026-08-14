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
        list.innerHTML = `<p style="color: var(--text-muted);">You haven't downloaded any mixes yet!</p>`;
        return;
      }

      list.innerHTML = "";
      downloads.forEach((mix) => {
        const art = DEFAULT_ARTWORK;
        list.innerHTML += `
            <div class="vault-item">
                <img src="${art}" onerror="this.src='${DEFAULT_ARTWORK}'">
                <div class="vault-info">
                    <h4>${mix.title}</h4>
                    <p>Downloaded: ${new Date(mix.downloaded_at).toLocaleDateString()}</p>
                </div>
                <button class="vault-play-btn" onclick="playVaultMix('${mix.audio_url}', '${mix.title.replace(/'/g, "\\'")}', '${art}')">
                    <i class="fa-solid fa-play"></i>
                </button>
            </div>
        `;
      });
    } catch (err) {
      console.error("Playlist error:", err);
      list.innerHTML = `<p style="color: var(--primary);">Error loading your playlist. Please log in again.</p>`;
    }
  }
}

function playVaultMix(url, title, art) {
  document.getElementById("np-title").innerText = title;
  document.getElementById("np-art").src = art || DEFAULT_ARTWORK;
  audioPlayer.src = url;
  audioPlayer.play();
}
const audioPlayer = document.getElementById("audio-player");
const customPlayBtn = document.getElementById("custom-play-btn");

let currentTrackIndex = -1;
let isShuffle = false;
let repeatState = 0;

function playMix(index) {
  // Sync the player's playlist with whatever tab you are currently viewing
  const playlist = window.djCatalog || [];
  
  if (index < 0 || index >= playlist.length) return;
  currentTrackIndex = index;
  const mix = playlist[currentTrackIndex];

  document.getElementById("np-title").innerText = mix.title;
  
  // Use the actual mix artwork, or fallback to the default
  const artwork = mix.artwork_url || window.DJ_DEFAULT_ARTWORK;
  document.getElementById("np-art").src = artwork;
  
  // 🪄 MAGIC: Reveal the player sliding up from the bottom!
  document.getElementById("player-ui").classList.add("active");

  // Set Fullscreen Backdrop Image
  const backdrop = document.getElementById("fullscreen-backdrop");
  if (backdrop) backdrop.style.backgroundImage = `url('${artwork}')`;

  audioPlayer.src = mix.audio_url;
  audioPlayer.play();

  // Fix API URL reference and push play count to the database
  fetch(`${window.DJ_API_URL}/mixes/${mix.id}/play`, { 
      method: "POST" 
  }).catch(console.error);
}

function playNext() {
  const playlist = window.djCatalog || [];
  if (playlist.length === 0) return;
  let nextIndex = isShuffle
    ? Math.floor(Math.random() * playlist.length)
    : (currentTrackIndex + 1) % playlist.length;
  playMix(nextIndex);
}

function playPrev() {
  const playlist = window.djCatalog || [];
  if (playlist.length === 0) return;
  let prevIndex = currentTrackIndex - 1 < 0 ? playlist.length - 1 : currentTrackIndex - 1;
  playMix(prevIndex);
}

audioPlayer.addEventListener("ended", () => {
  const playlist = window.djCatalog || [];
  if (audioPlayer.loop) return;
  if (repeatState === 1 || currentTrackIndex < playlist.length - 1) playNext();
});

function togglePlay() {
  if (audioPlayer.paused && audioPlayer.src) audioPlayer.play();
  else if (!audioPlayer.paused) audioPlayer.pause();
}

function stopAudio() {
  audioPlayer.pause();
  audioPlayer.currentTime = 0;
}

function toggleLoop() {
  repeatState = (repeatState + 1) % 3;
  const loopBtn = document.getElementById("loop-btn");
  if (repeatState === 0) {
    loopBtn.innerHTML = '<i class="fa-solid fa-repeat"></i>';
    loopBtn.style.color = "var(--text-main)";
    audioPlayer.loop = false;
  } else if (repeatState === 1) {
    loopBtn.innerHTML = '<i class="fa-solid fa-repeat"></i>';
    loopBtn.style.color = "var(--primary)";
    audioPlayer.loop = false;
  } else {
    loopBtn.innerHTML = '<i class="fa-solid fa-repeat"></i><sup style="font-size:0.6em;">1</sup>';
    loopBtn.style.color = "var(--primary)";
    audioPlayer.loop = true;
  }
}

function toggleShuffle() {
  isShuffle = !isShuffle;
  document.getElementById("shuffle-btn").style.color = isShuffle ? "var(--primary)" : "var(--text-main)";
}

audioPlayer.addEventListener("play", () => (customPlayBtn.innerHTML = '<i class="fa-solid fa-circle-pause"></i>'));
audioPlayer.addEventListener("pause", () => (customPlayBtn.innerHTML = '<i class="fa-solid fa-circle-play"></i>'));

function toggleFullScreen() {
  const playerUI = document.getElementById("player-ui");
  if (!document.fullscreenElement) {
    playerUI.requestFullscreen().catch((err) => alert(`Error: ${err.message}`));
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
}

document.addEventListener("fullscreenchange", function () {
  const playerUI = document.getElementById("player-ui");
  if (document.fullscreenElement) {
    playerUI.classList.add("is-fullscreen");
  } else {
    playerUI.classList.remove("is-fullscreen");
  }
});

function scrollToPlaylist() {
  if (document.fullscreenElement) document.exitFullscreen();
  document.getElementById("mixes-grid").scrollIntoView({ behavior: "smooth" });
}

function showEQMessage() {
  alert("Advanced Equalizer controls coming in the next platform update!");
}

const volumeSlider = document.getElementById("volume-slider");
const muteIcon = document.getElementById("mute-icon");

if (volumeSlider) {
  volumeSlider.addEventListener("input", (e) => {
    audioPlayer.volume = e.target.value;
    updateMuteIcon(audioPlayer.volume);
  });
}

function toggleMute() {
  audioPlayer.muted = !audioPlayer.muted;
  updateMuteIcon(audioPlayer.muted ? 0 : audioPlayer.volume);
}

function updateMuteIcon(vol) {
  if (vol == 0 || audioPlayer.muted) muteIcon.className = "fa-solid fa-volume-xmark";
  else if (vol < 0.5) muteIcon.className = "fa-solid fa-volume-low";
  else muteIcon.className = "fa-solid fa-volume-high";
}

// 🚨 BIND ALL FUNCTIONS TO THE GLOBAL WINDOW
window.playMix = playMix;
window.playNext = playNext;
window.playPrev = playPrev;
window.togglePlay = togglePlay;
window.stopAudio = stopAudio;
window.toggleLoop = toggleLoop;
window.toggleShuffle = toggleShuffle;
window.toggleFullScreen = toggleFullScreen;
window.scrollToPlaylist = scrollToPlaylist;
window.showEQMessage = showEQMessage;
window.toggleMute = toggleMute;
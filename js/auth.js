const API_URL = "https://dj-grey.onrender.com/api";
const DEFAULT_ARTWORK =
  "https://www.dropbox.com/scl/fi/sn5sapl4pr1uzc98kcpez/dj_grey.jpeg?rlkey=72jldl168nvtccasr0ekk2qy2&st=3yyulxhl&raw=1";

const token = localStorage.getItem("dj_grey_token");
const username = localStorage.getItem("dj_grey_user");
const role = localStorage.getItem("dj_grey_role");
const authSection = document.getElementById("auth-section");

const getAuthHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

// Initialize Auth Navigation UI
if (token && username) {
  const adminButton =
    role === "admin"
      ? `<a href="/admin.html" class="auth-btn" style="background: var(--primary); color: #fff; border-color: var(--primary);"><i class="fa-solid fa-chart-pie"></i> Dashboard</a>`
      : `<button onclick="toggleVault()" class="auth-btn"><i class="fa-solid fa-vault"></i> My Playlist</button>`;

  authSection.innerHTML = `
      <span class="user-greeting">Welcome, ${username}</span>
      ${adminButton}
      <button class="auth-btn" onclick="logout()">Logout</button>
  `;
} else {
  authSection.innerHTML = `<a href="/login.html" class="auth-btn">Login / Fan Registration</a>`;
}

function logout() {
  localStorage.clear();
  window.location.reload();
}

// Theme Toggle Logic
const themeToggleBtn = document.getElementById("theme-toggle");
const currentTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", currentTheme);
updateThemeIcon(currentTheme);

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    let theme = document.documentElement.getAttribute("data-theme");
    let newTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    updateThemeIcon(newTheme);
  });
}

function updateThemeIcon(theme) {
  if (themeToggleBtn) {
    themeToggleBtn.innerHTML =
      theme === "dark"
        ? '<i class="fa-solid fa-sun"></i>'
        : '<i class="fa-solid fa-moon"></i>';
  }
}
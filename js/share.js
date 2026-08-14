function openShareModal(mixTitle, mixUrl) {
  const modal = document.getElementById("shareModal");
  const shareInput = document.getElementById("shareInput");
  const fullUrl = mixUrl || window.location.href;

  shareInput.value = fullUrl;

  const text = encodeURIComponent(
    `Check out this mix by DJ Grey: ${mixTitle}`,
  );
  const url = encodeURIComponent(fullUrl);

  document.getElementById("shareWhatsApp").href =
    `https://api.whatsapp.com/send?text=${text}%20${url}`;
  document.getElementById("shareTwitter").href =
    `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
  document.getElementById("shareTelegram").href =
    `https://t.me/share/url?url=${url}&text=${text}`;
  document.getElementById("sharePinterest").href =
    `https://pinterest.com/pin/create/button/?url=${url}&description=${text}`;
  document.getElementById("shareLinkedIn").href =
    `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
  document.getElementById("shareEmail").href =
    `mailto:?subject=${encodeURIComponent(mixTitle)}&body=${text}%20${url}`;

  document.getElementById("shareInstagram").onclick = (e) => {
    e.preventDefault();
    copyShareLink();
    alert(
      "Link copied to clipboard! You can paste it into Instagram messages or bio.",
    );
  };

  modal.classList.add("open");
}

function closeShareModal() {
  document.getElementById("shareModal").classList.remove("open");
}

function copyShareLink() {
  const shareInput = document.getElementById("shareInput");
  shareInput.select();
  navigator.clipboard.writeText(shareInput.value);

  const btn = document.getElementById("copyShareBtn");
  btn.innerText = "Copied!";
  setTimeout(() => {
    btn.innerText = "Copy";
  }, 2000);
}
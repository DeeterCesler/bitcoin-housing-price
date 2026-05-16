const rateEl = document.getElementById("rate");
const subEl = document.getElementById("sub");
const refreshBtn = document.getElementById("refresh");

function fmtTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function render(resp) {
  if (!resp || !resp.price) {
    rateEl.textContent = "-";
    subEl.textContent = "Could not load rate.";
    return;
  }
  rateEl.textContent =
    "$" + Math.round(resp.price).toLocaleString() + " / ₿";
  let note;
  if (resp.fallback) note = "Using fallback rate, network blocked.";
  else if (resp.stale) note = "Stale cache (refresh failed) · " + fmtTime(resp.fetchedAt);
  else if (resp.cached) note = "Cached · " + fmtTime(resp.fetchedAt);
  else note = "Live · " + fmtTime(resp.fetchedAt);
  subEl.textContent = note;
}

async function load() {
  const resp = await chrome.runtime.sendMessage({ type: "getBtcUsd" });
  render(resp);
}

async function refresh() {
  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing…";
  try {
    const resp = await chrome.runtime.sendMessage({ type: "refreshBtcUsd" });
    render(resp);
    const tabs = await chrome.tabs.query({ url: "https://www.zillow.com/*" });
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { type: "priceUpdated", price: resp.price }).catch(() => {});
    }
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = "Refresh";
  }
}

refreshBtn.addEventListener("click", refresh);

load();

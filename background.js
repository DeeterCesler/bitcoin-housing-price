const CACHE_TTL_MS = 5 * 60 * 1000;
const FALLBACK_PRICE = 65000;

async function fetchBtcUsd() {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
  );
  if (!res.ok) throw new Error("CoinGecko " + res.status);
  const data = await res.json();
  const price = data?.bitcoin?.usd;
  if (typeof price !== "number" || !isFinite(price) || price <= 0) {
    throw new Error("Invalid price response");
  }
  return price;
}

async function getBtcUsd() {
  const stored = await chrome.storage.local.get(["btcUsd", "fetchedAt"]);
  const now = Date.now();
  if (
    stored.btcUsd &&
    stored.fetchedAt &&
    now - stored.fetchedAt < CACHE_TTL_MS
  ) {
    return { price: stored.btcUsd, fetchedAt: stored.fetchedAt, cached: true };
  }
  try {
    const price = await fetchBtcUsd();
    await chrome.storage.local.set({ btcUsd: price, fetchedAt: now });
    return { price, fetchedAt: now, cached: false };
  } catch (err) {
    if (stored.btcUsd) {
      return { price: stored.btcUsd, fetchedAt: stored.fetchedAt, cached: true, stale: true };
    }
    return { price: FALLBACK_PRICE, fetchedAt: now, cached: false, fallback: true };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "getBtcUsd") {
    getBtcUsd().then(sendResponse);
    return true;
  }
  if (msg?.type === "refreshBtcUsd") {
    chrome.storage.local.remove(["btcUsd", "fetchedAt"]).then(() => {
      getBtcUsd().then(sendResponse);
    });
    return true;
  }
});

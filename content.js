(() => {
  const PRICE_REGEX = /(\$\s?\d{1,3}(?:,\d{3})+(?:\.\d+)?|\$\s?\d+(?:\.\d+)?\s?[KkMmBb]\b|\$\s?\d+(?:\.\d+)?)((?:\s*(?:\/\s*mo|\+\s*\d+\s*bds?))*)/g;
  const MODE_KEY = "zbtc-mode";
  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEXTAREA",
    "INPUT",
    "SELECT",
    "OPTION",
    "CODE",
    "PRE",
    "IFRAME",
    "SVG",
    "PATH",
  ]);

  let btcUsd = null;
  let mode = localStorage.getItem(MODE_KEY) || "btc";
  let scanScheduled = false;
  let observer = null;
  const pendingRoots = new Set();

  function parseUsd(raw) {
    const cleaned = raw.replace(/[\s$,]/g, "");
    const m = cleaned.match(/^([\d.]+)([KkMmBb]?)$/);
    if (!m) return null;
    const n = parseFloat(m[1]);
    if (!isFinite(n)) return null;
    const mult = { k: 1e3, m: 1e6, b: 1e9 }[m[2].toLowerCase()] || 1;
    return n * mult;
  }

  function formatUsd(n) {
    if (n >= 1e6) {
      const v = n / 1e6;
      return "$" + (v % 1 === 0 ? v.toFixed(0) : v.toFixed(v < 10 ? 2 : 1)) + "M";
    }
    if (n >= 1e3) {
      return "$" + Math.round(n).toLocaleString();
    }
    return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function formatBtc(n) {
    let digits;
    if (n >= 1) digits = 2;
    else if (n >= 0.01) digits = 4;
    else if (n >= 0.0001) digits = 6;
    else digits = 8;
    return "₿" + n.toFixed(digits);
  }

  function shouldSkipNode(node) {
    let el = node.parentElement;
    while (el) {
      if (SKIP_TAGS.has(el.tagName)) return true;
      if (el.classList && el.classList.contains("zbtc-wrap")) return true;
      if (el.isContentEditable) return true;
      el = el.parentElement;
    }
    return false;
  }

  function makeWrap(usdRaw, usdVal, suffix) {
    const btcVal = usdVal / btcUsd;
    const usdStr = formatUsd(usdVal);
    const btcStr = formatBtc(btcVal);

    const wrap = document.createElement("span");
    wrap.className = "zbtc-wrap";
    wrap.dataset.usd = usdVal;

    const value = document.createElement("span");
    value.className = "zbtc-value";
    wrap.appendChild(value);

    if (suffix) {
      wrap.appendChild(document.createTextNode(suffix));
    }

    const toggle = document.createElement("a");
    toggle.className = "zbtc-toggle";
    toggle.setAttribute("role", "button");
    toggle.setAttribute("tabindex", "0");
    toggle.href = "#";
    wrap.appendChild(toggle);

    wrap.dataset.usdStr = usdStr;
    wrap.dataset.btcStr = btcStr;

    applyModeToWrap(wrap);

    const flip = (e) => {
      e.preventDefault();
      e.stopPropagation();
      mode = mode === "btc" ? "usd" : "btc";
      try {
        localStorage.setItem(MODE_KEY, mode);
      } catch (_) {}
      applyAll();
    };
    toggle.addEventListener("click", flip);
    toggle.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") flip(e);
    });

    return wrap;
  }

  function applyModeToWrap(wrap) {
    const value = wrap.querySelector(".zbtc-value");
    const toggle = wrap.querySelector(".zbtc-toggle");
    if (!value || !toggle) return;
    const usdStr = wrap.dataset.usdStr;
    const btcStr = wrap.dataset.btcStr;
    if (mode === "btc") {
      value.textContent = btcStr;
      toggle.textContent = "$";
      toggle.title = "Show " + usdStr;
    } else {
      value.textContent = usdStr;
      toggle.textContent = "₿";
      toggle.title = "Show " + btcStr;
    }
  }

  function applyAll() {
    document.querySelectorAll(".zbtc-wrap").forEach(applyModeToWrap);
  }

  function processTextNode(node) {
    const text = node.nodeValue;
    if (!text || text.length < 2) return false;
    if (!text.includes("$")) return false;
    PRICE_REGEX.lastIndex = 0;
    if (!PRICE_REGEX.test(text)) return false;
    if (shouldSkipNode(node)) return false;

    PRICE_REGEX.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let lastIndex = 0;
    let m;
    let changed = false;
    while ((m = PRICE_REGEX.exec(text)) !== null) {
      const priceRaw = m[1];
      const suffix = m[2] || "";
      const tail = text.slice(m.index + m[0].length);
      if (/^\s*\/\s*(?:sq\s?ft|sqft|sf\b|psf\b)/i.test(tail)) continue;
      const usdVal = parseUsd(priceRaw);
      if (usdVal === null || usdVal < 10) continue;
      if (m.index > lastIndex) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
      }
      frag.appendChild(makeWrap(priceRaw, usdVal, suffix));
      lastIndex = m.index + m[0].length;
      changed = true;
    }
    if (!changed) return false;
    if (lastIndex < text.length) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    node.parentNode.replaceChild(frag, node);
    return true;
  }

  function scan(root) {
    if (!btcUsd) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.includes("$")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const toProcess = [];
    let cur;
    while ((cur = walker.nextNode())) toProcess.push(cur);
    for (const n of toProcess) processTextNode(n);
  }

  function queueRoot(node) {
    if (!node) return;
    const root = node.nodeType === 1 ? node : node.parentElement;
    if (!root || !document.body.contains(root)) return;
    pendingRoots.add(root);
  }

  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      scanScheduled = false;
      if (pendingRoots.size === 0) return;
      const roots = Array.from(pendingRoots);
      pendingRoots.clear();
      const final = roots.filter(
        (r) => !roots.some((other) => other !== r && other.contains(r))
      );
      for (const r of final) scan(r);
    });
  }

  function startObserver() {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      let queued = false;
      for (const mut of mutations) {
        if (mut.type === "childList") {
          for (const node of mut.addedNodes) {
            if (node.nodeType === 3) {
              if (node.nodeValue && node.nodeValue.includes("$")) {
                queueRoot(node);
                queued = true;
              }
            } else if (node.nodeType === 1) {
              if (node.classList && node.classList.contains("zbtc-wrap")) continue;
              if (node.textContent && node.textContent.includes("$")) {
                queueRoot(node);
                queued = true;
              }
            }
          }
        } else if (mut.type === "characterData") {
          if (mut.target.nodeValue && mut.target.nodeValue.includes("$")) {
            queueRoot(mut.target);
            queued = true;
          }
        }
      }
      if (queued) scheduleScan();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }

  function sendMessageWithTimeout(msg, ms) {
    return Promise.race([
      chrome.runtime.sendMessage(msg),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("sendMessage timeout")), ms)
      ),
    ]);
  }

  async function init() {
    try {
      const resp = await sendMessageWithTimeout({ type: "getBtcUsd" }, 4000);
      if (resp && resp.price) btcUsd = resp.price;
    } catch (_) {}
    if (!btcUsd) return;
    scan(document.body);
    startObserver();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === "priceUpdated" && msg.price) {
      const firstTime = !btcUsd;
      btcUsd = msg.price;
      if (firstTime) {
        scan(document.body);
        startObserver();
      } else {
        document.querySelectorAll(".zbtc-wrap").forEach((wrap) => {
          const usd = parseFloat(wrap.dataset.usd);
          if (!isFinite(usd)) return;
          wrap.dataset.btcStr = formatBtc(usd / btcUsd);
          applyModeToWrap(wrap);
        });
      }
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

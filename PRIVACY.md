# Privacy Policy

**Extension:** Home Prices in Bitcoin
**Last updated:** 2026-05-26

This extension does not collect, store, transmit, or sell any personal information.

## What the extension does

Home Prices in Bitcoin runs only on pages under `https://www.zillow.com/`. It scans the visible text on those pages for USD prices and displays a Bitcoin equivalent next to each one. A small badge lets you toggle individual prices between USD and BTC.

## Data the extension stores

The extension uses Chrome's local `storage` API to cache two values on your own device:

- The most recent BTC/USD exchange rate (a number)
- The timestamp of when that rate was fetched

These values never leave your device. The cache expires after 5 minutes and is overwritten on the next fetch. You can clear it any time by removing the extension or using the Refresh button in the popup.

The extension also uses the page's own `localStorage` to remember whether you last viewed prices in BTC or USD. This is a single string value (`"btc"` or `"usd"`) scoped to the Zillow domain.

## Data sent to third parties

To get the current Bitcoin price, the extension makes one HTTP request to:

`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd`

This request contains no information about you, your browsing, or the pages you visit. It is the same request anyone could make from a browser address bar. CoinGecko's privacy policy governs that request: https://www.coingecko.com/en/privacy

No request is ever sent to Zillow, to the author, or to any analytics or advertising service.

## What the extension does NOT do

- No analytics, telemetry, or usage tracking
- No advertising or ad networks
- No remote code execution (no `eval`, no remotely loaded scripts)
- No reading or transmitting page content, URLs, form data, or search history
- No account, login, or identifier of any kind
- No selling, sharing, or transferring of data to any third party

## Permissions explained

- `storage`: cache the BTC/USD rate locally so the extension does not hit CoinGecko on every page
- `host_permissions` for `https://www.zillow.com/*`: inject the content script that converts visible prices
- `host_permissions` for `https://api.coingecko.com/*`: fetch the Bitcoin price

## Children

The extension is not directed at children and does not knowingly collect information from anyone.

## Changes

If this policy ever changes, the new version will replace this file in the repository and the "Last updated" date above will change.

## Contact

Questions or concerns: me@deetercesler.com

Source code: https://github.com/DeeterCesler/bitcoin-housing-price

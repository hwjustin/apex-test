// Prebid.js helper — wraps window.pbjs for use in React

const pbjs = window.pbjs || {};
pbjs.que = pbjs.que || [];

const AD_UNITS = [
  {
    code: "div-banner-300x250",
    mediaTypes: { banner: { sizes: [[300, 250]] } },
    bids: [
      { bidder: "appnexus", params: { placementId: 13144370 } },
    ],
  },
  {
    code: "div-banner-728x90",
    mediaTypes: { banner: { sizes: [[728, 90]] } },
    bids: [
      { bidder: "appnexus", params: { placementId: 13144370 } },
    ],
  },
];

let initialized = false;

export function initPrebid({ onBidRequested, onBidResponse, onNoBid, onAuctionEnd }) {
  if (initialized) return;
  initialized = true;

  pbjs.que.push(() => {
    pbjs.setConfig({
      debug: false,
      bidderTimeout: 3000,
      enableSendAllBids: true,
      priceGranularity: "medium",
      currency: { adServerCurrency: "USD" },
    });

    pbjs.addAdUnits(AD_UNITS);

    pbjs.onEvent("bidRequested", (data) => onBidRequested?.(data));
    pbjs.onEvent("bidResponse", (bid) => onBidResponse?.(bid));
    pbjs.onEvent("noBid", (bid) => onNoBid?.(bid));
    pbjs.onEvent("auctionEnd", (data) => onAuctionEnd?.(data));
  });
}

export function requestBids() {
  pbjs.que.push(() => {
    pbjs.removeAdUnit([]);
    pbjs.addAdUnits(AD_UNITS);
    pbjs.requestBids({ bidsBackHandler: () => {} });
  });
}

export function getHighestCpmBids() {
  return pbjs.getHighestCpmBids?.() || [];
}

export function renderAdInIframe(containerId, bid) {
  const container = document.getElementById(containerId);
  if (!container || !bid.ad) return;

  container.innerHTML = "";
  const iframe = document.createElement("iframe");
  iframe.style.border = "none";
  iframe.style.width = bid.width + "px";
  iframe.style.height = bid.height + "px";
  iframe.style.maxWidth = "100%";
  iframe.setAttribute("scrolling", "no");
  container.appendChild(iframe);
  iframe.contentDocument.open();
  iframe.contentDocument.write(bid.ad);
  iframe.contentDocument.close();
}

export { AD_UNITS };

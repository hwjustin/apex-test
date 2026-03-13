import { useState, useEffect, useRef, useCallback } from "react";
import {
  initPrebid,
  requestBids,
  getHighestCpmBids,
  renderAdInIframe,
  AD_UNITS,
} from "./prebid";
import "./App.css";

function AdSlot({ id, label, size, status }) {
  const labels = {
    waiting: "Waiting",
    bidding: "Bidding...",
    won: "Ad Served",
    nobid: "No Bid",
  };
  return (
    <div className="ad-slot-wrapper">
      <div className="slot-meta">
        <span className="slot-name">{label}</span>
        <span className={`slot-status ${status}`}>{labels[status]}</span>
      </div>
      <div className="ad-container" id={id}>
        <div className="ad-placeholder">
          <div className="size-label">{size}</div>
          <div>Hit &quot;Run Auction&quot; to fill</div>
        </div>
      </div>
    </div>
  );
}

function BidEntry({ bid, isNoBid, isWinner }) {
  return (
    <div className={`bid-entry${isWinner ? " winner" : ""}`}>
      <span className="bidder">
        {bid.bidderCode || bid.bidder || "?"}
      </span>
      <span className="slot-lbl">{bid.adUnitCode || "-"}</span>
      <span className={`cpm${isNoBid ? " nobid" : ""}`}>
        {isNoBid ? "no bid" : `$${bid.cpm.toFixed(3)}`}
      </span>
      <span className="time">{bid.elapsed || "-"}</span>
    </div>
  );
}

export default function App() {
  const [status, setStatus] = useState("idle");
  const [slotStatus, setSlotStatus] = useState({
    slot1: "waiting",
    slot2: "waiting",
  });
  const [bids, setBids] = useState([]);
  const [auctionCount, setAuctionCount] = useState(0);
  const [winningCpm, setWinningCpm] = useState(null);
  const [elapsed, setElapsed] = useState(null);
  const [activeTab, setActiveTab] = useState("config");
  const [timerDisplay, setTimerDisplay] = useState(null);

  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const winnersRef = useRef([]);
  const handlersRef = useRef({});

  handlersRef.current.onBidRequested = () => {
    setSlotStatus({ slot1: "bidding", slot2: "bidding" });
    setStatus("requesting");
  };

  handlersRef.current.onBidResponse = (bid) => {
    const el = startTimeRef.current
      ? `${Date.now() - startTimeRef.current}ms`
      : "-";
    setBids((prev) => [...prev, { ...bid, elapsed: el, isNoBid: false }]);
  };

  handlersRef.current.onNoBid = (bid) => {
    const el = startTimeRef.current
      ? `${Date.now() - startTimeRef.current}ms`
      : "-";
    setBids((prev) => [
      ...prev,
      {
        bidderCode: bid.bidder,
        adUnitCode: bid.adUnitCode,
        cpm: 0,
        elapsed: el,
        isNoBid: true,
      },
    ]);
  };

  handlersRef.current.onAuctionEnd = () => {
    const ms = Date.now() - startTimeRef.current;
    clearInterval(timerRef.current);
    setElapsed(ms);
    setTimerDisplay(ms);

    const winners = getHighestCpmBids();
    winnersRef.current = winners;

    if (winners.length > 0) {
      const top = Math.max(...winners.map((b) => b.cpm));
      setWinningCpm(top);
      setStatus("complete");

      const newSlotStatus = { slot1: "nobid", slot2: "nobid" };
      winners.forEach((bid) => {
        if (bid.adUnitCode === "div-banner-300x250")
          newSlotStatus.slot1 = "won";
        if (bid.adUnitCode === "div-banner-728x90") newSlotStatus.slot2 = "won";
        renderAdInIframe(bid.adUnitCode, bid);
      });
      setSlotStatus(newSlotStatus);
    } else {
      setStatus("nobids");
      setSlotStatus({ slot1: "nobid", slot2: "nobid" });
    }
  };

  useEffect(() => {
    initPrebid({
      onBidRequested: (d) => handlersRef.current.onBidRequested(d),
      onBidResponse: (b) => handlersRef.current.onBidResponse(b),
      onNoBid: (b) => handlersRef.current.onNoBid(b),
      onAuctionEnd: (d) => handlersRef.current.onAuctionEnd(d),
    });
  }, []);

  function runAuction() {
    setStatus("running");
    setBids([]);
    setWinningCpm(null);
    setElapsed(null);
    setTimerDisplay(null);
    setSlotStatus({ slot1: "bidding", slot2: "bidding" });
    setAuctionCount((c) => c + 1);
    winnersRef.current = [];

    // Reset ad containers
    ["div-banner-300x250", "div-banner-728x90"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        const size = id === "div-banner-300x250" ? "300x250" : "728x90";
        el.innerHTML = `<div class="ad-placeholder"><div class="size-label">${size}</div><div>Bidding...</div></div>`;
      }
    });

    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setTimerDisplay(Date.now() - startTimeRef.current);
    }, 50);

    requestBids();
  }

  const isRunning = status === "running" || status === "requesting";
  const bidCount = bids.filter((b) => !b.isNoBid).length;
  const winnerKeys = winnersRef.current.map(
    (w) => `${w.bidderCode}:${w.adUnitCode}`
  );

  const statusLabels = {
    idle: "-",
    running: "Starting...",
    requesting: "Requesting bids...",
    complete: "Complete",
    nobids: "Complete - no bids",
  };

  let codeDisplay;
  if (activeTab === "config") {
    codeDisplay = JSON.stringify(AD_UNITS, null, 2);
  } else if (activeTab === "bids" && bids.length > 0) {
    codeDisplay = JSON.stringify(
      bids.map((b) => ({
        bidder: b.bidderCode || b.bidder,
        adUnit: b.adUnitCode,
        cpm: b.cpm,
        size: b.width && b.height ? `${b.width}x${b.height}` : null,
        creativeId: b.creativeId,
        noBid: b.isNoBid || false,
      })),
      null,
      2
    );
  } else {
    codeDisplay = "// Run an auction to see bid data";
  }

  return (
    <div className="app">
      <header>
        <h1>Prebid.js Live Auction</h1>
        <span className="badge">DEMO</span>
      </header>

      <div className="run-bar">
        <button className="run-btn" disabled={isRunning} onClick={runAuction}>
          {isRunning
            ? "Running..."
            : auctionCount > 0
              ? "Run Again"
              : "Run Auction"}
        </button>
        <span className="run-desc">
          Fires real bid requests to AppNexus test endpoints via Prebid.js
        </span>
        {timerDisplay != null && (
          <span className="timer">{timerDisplay}ms</span>
        )}
      </div>

      <div className="layout">
        <div className="ad-panel">
          <h2>Ad Inventory</h2>
          <AdSlot
            id="div-banner-300x250"
            label="Banner 300x250"
            size="300x250"
            status={slotStatus.slot1}
          />
          <AdSlot
            id="div-banner-728x90"
            label="Leaderboard 728x90"
            size="728x90"
            status={slotStatus.slot2}
          />
        </div>

        <div className="log-panel">
          <h2>Auction Summary</h2>
          <div className="auction-summary">
            <div className="summary-row">
              <span className="label">Status</span>
              <span className="value">{statusLabels[status]}</span>
            </div>
            <div className="summary-row">
              <span className="label">Auctions fired</span>
              <span className="value">{auctionCount}</span>
            </div>
            <div className="summary-row">
              <span className="label">Bids received</span>
              <span className="value yellow">{bidCount}</span>
            </div>
            <div className="summary-row">
              <span className="label">Winning CPM</span>
              <span className="value green">
                {winningCpm != null ? `$${winningCpm.toFixed(3)}` : "-"}
              </span>
            </div>
            <div className="summary-row">
              <span className="label">Elapsed</span>
              <span className="value">
                {elapsed != null ? `${elapsed}ms` : "-"}
              </span>
            </div>
          </div>

          <div className="bid-log">
            <div className="bid-log-header">
              <span>Bid Responses</span>
              <span className="live-tag">live stream</span>
            </div>
            <div className="bid-entries">
              {bids.length === 0 ? (
                <div className="bid-empty">Waiting for auction...</div>
              ) : (
                bids.map((bid, i) => (
                  <BidEntry
                    key={i}
                    bid={bid}
                    isNoBid={bid.isNoBid}
                    isWinner={winnerKeys.includes(
                      `${bid.bidderCode || bid.bidder}:${bid.adUnitCode}`
                    )}
                  />
                ))
              )}
            </div>
          </div>

          <div className="code-viewer">
            <div className="code-tabs">
              <button
                className={activeTab === "config" ? "active" : ""}
                onClick={() => setActiveTab("config")}
              >
                Ad Unit Config
              </button>
              <button
                className={activeTab === "bids" ? "active" : ""}
                onClick={() => setActiveTab("bids")}
              >
                Bid Data
              </button>
            </div>
            <pre className="code-view">{codeDisplay}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

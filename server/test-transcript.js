// server/test-transcript.js
// CLI test for /api/srt — the server must be running on port 3001 before executing this.
// Usage: node server/test-transcript.js
// Exit code: 0 if all methods pass, 1 if any fail.

const fs = require("fs");
const path = require("path");

const BASE_URL = "http://localhost:3001";
const VIDEO_ID = "dQw4w9WgXcQ";
const LANG     = "en";
const LOG_FILE = path.join(__dirname, "test-results.log");

async function testMethod(methodNum) {
  const url = `${BASE_URL}/api/srt?videoId=${VIDEO_ID}&lang=${LANG}&method=${methodNum}`;
  const t0 = Date.now();
  let status, bodyText, ok, note;

  try {
    const res = await fetch(url);
    status    = res.status;
    bodyText  = await res.text();
    ok        = status === 200 && bodyText.trim().length > 0;
    note      = ok ? "non-empty SRT received" : `HTTP ${status} or empty body`;
  } catch (err) {
    status   = null;
    bodyText = "";
    ok       = false;
    note     = err.message;
  }

  const elapsed = Date.now() - t0;
  const label   = ok ? "[PASS]" : "[FAIL]";
  const preview = bodyText.slice(0, 300);
  const ts      = new Date().toISOString();

  const consoleLine = `${label} method=${methodNum} | HTTP ${status ?? "ERR"} | ${elapsed}ms | ${note}`;
  const logEntry    = [
    `--- Run at ${ts} ---`,
    `method:  ${methodNum}`,
    `status:  ${ok ? "PASS" : "FAIL"}`,
    `http:    ${status ?? "network error"}`,
    `elapsed: ${elapsed}ms`,
    `note:    ${note}`,
    `preview: ${preview || "(empty)"}`,
    "",
  ].join("\n");

  return { ok, consoleLine, logEntry };
}

(async () => {
  console.log(`\nYouTube Transcript CLI Test`);
  console.log(`Target video : ${VIDEO_ID}`);
  console.log(`Server       : ${BASE_URL}`);
  console.log(`Log file     : ${LOG_FILE}`);
  console.log("─".repeat(60));

  const results = await Promise.all([testMethod(1), testMethod(2)]);

  let logBlock = "";
  let allPass  = true;

  for (const r of results) {
    console.log(r.consoleLine);
    logBlock += r.logEntry;
    if (!r.ok) allPass = false;
  }

  const summary = `Overall: ${allPass ? "ALL PASS" : "SOME FAILED"}\n\n`;
  console.log("─".repeat(60));
  console.log(summary.trim());

  fs.appendFileSync(LOG_FILE, summary + logBlock, "utf-8");

  process.exit(allPass ? 0 : 1);
})();

const banks = {
  sbi: {
    name: "State Bank of India",
    sampleHeaders: ["SBIINB", "SBICRD", "SBIUPI", "SBISMS"],
    domains: ["sbi.co.in", "onlinesbi.sbi", "bank.sbi"],
    aliases: ["sbi", "state bank"]
  },
  hdfc: {
    name: "HDFC Bank",
    sampleHeaders: ["HDFCBK", "HDFCBN", "HDFCSM"],
    domains: ["hdfcbank.com"],
    aliases: ["hdfc", "hdfc bank"]
  },
  icici: {
    name: "ICICI Bank",
    sampleHeaders: ["ICICIB", "ICICIN", "ICICIT"],
    domains: ["icicibank.com"],
    aliases: ["icici", "icici bank"]
  },
  axis: {
    name: "Axis Bank",
    sampleHeaders: ["AXISBK", "AXISBN", "AXISIT"],
    domains: ["axisbank.com"],
    aliases: ["axis", "axis bank"]
  },
  kotak: {
    name: "Kotak Mahindra Bank",
    sampleHeaders: ["KOTAKB", "KOTAKM", "KOTBNK"],
    domains: ["kotak.com"],
    aliases: ["kotak", "kotak mahindra"]
  },
  yes: {
    name: "Yes Bank",
    sampleHeaders: ["YESBNK", "YESBNK"],
    domains: ["yesbank.in"],
    aliases: ["yes bank", "yesbnk"]
  },
  pnb: {
    name: "Punjab National Bank",
    sampleHeaders: ["PNBBNK", "PNBSMS", "PNBIND"],
    domains: ["pnbindia.in"],
    aliases: ["pnb", "punjab national"]
  },
  bob: {
    name: "Bank of Baroda",
    sampleHeaders: ["BOBBNK", "BOBIND", "BOBSMS"],
    domains: ["bankofbaroda.in"],
    aliases: ["bank of baroda", "baroda"]
  },
  union: {
    name: "Union Bank of India",
    sampleHeaders: ["UNIONB", "UBIIND", "UNIBNK"],
    domains: ["unionbankofindia.co.in"],
    aliases: ["union bank", "union bank of india"]
  },
  canara: {
    name: "Canara Bank",
    sampleHeaders: ["CANBNK", "CANARA", "CANBNK"],
    domains: ["canarabank.com"],
    aliases: ["canara", "canara bank"]
  }
};

const shorteners = [
  "bit.ly",
  "tinyurl.com",
  "goo.gl",
  "t.co",
  "cutt.ly",
  "is.gd",
  "rebrand.ly",
  "shorturl.at",
  "t.ly"
];

const examples = {
  safe: {
    sender: "VM-HDFCBK",
    bank: "hdfc",
    message: "Rs 450.00 debited from your HDFC Bank card at STORE. If this was not you, contact the bank using the number shown in your official app."
  },
  phish: {
    sender: "AX-SBIKYC",
    bank: "sbi",
    message: "Dear SBI user, your account KYC expires today. Click http://sbi-kyc-verify.in now or your account will be blocked. Share OTP to continue."
  },
  phone: {
    sender: "+91 98765 43210",
    bank: "icici",
    message: "ICICI customer, your netbanking is suspended. Install the security app from https://tinyurl.com/bank-help-apk and update PAN immediately."
  }
};

const headerToBank = new Map();
Object.entries(banks).forEach(([key, bank]) => {
  bank.sampleHeaders.forEach((header) => {
    headerToBank.set(header, { key, bank });
  });
});

const form = document.querySelector("#checkerForm");
const senderInput = document.querySelector("#senderInput");
const bankSelect = document.querySelector("#bankSelect");
const messageInput = document.querySelector("#messageInput");
const clearButton = document.querySelector("#clearButton");
const copyReportButton = document.querySelector("#copyReportButton");
const resultPanel = document.querySelector(".result-panel");
const verdictTitle = document.querySelector("#verdictTitle");
const verdictSummary = document.querySelector("#verdictSummary");
const scoreText = document.querySelector("#scoreText");
const scoreFill = document.querySelector("#scoreFill");
const evidenceList = document.querySelector("#evidenceList");
const previewSender = document.querySelector("#previewSender");
const previewText = document.querySelector("#previewText");

let lastResult = null;

function normalizeSender(rawSender) {
  const raw = rawSender.trim();
  const upper = raw.toUpperCase().replace(/\s+/g, "");
  const digits = upper.replace(/\D/g, "");
  const withoutCountry = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  const prefixedHeader = upper.match(/^[A-Z]{2}-([A-Z0-9]{3,8})$/);

  if (prefixedHeader) {
    return {
      type: "header",
      raw,
      value: prefixedHeader[1],
      display: `${upper} -> ${prefixedHeader[1]}`
    };
  }

  if (/^[A-Z0-9]{3,8}$/.test(upper) && /[A-Z]/.test(upper)) {
    return {
      type: "header",
      raw,
      value: upper,
      display: upper
    };
  }

  if (withoutCountry.length === 10) {
    return {
      type: "mobile",
      raw,
      value: withoutCountry,
      display: `+91 ${withoutCountry}`
    };
  }

  if (digits.length >= 5 && digits.length <= 8) {
    return {
      type: "shortcode",
      raw,
      value: digits,
      display: digits
    };
  }

  return {
    type: "unknown",
    raw,
    value: upper || raw,
    display: raw || "Unknown sender"
  };
}

function extractLinks(text) {
  const matches = text.match(/((https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,})(\/[^\s]*)?/gi) || [];
  return matches.map((match) => {
    const cleaned = match.replace(/[),.;]+$/, "");
    const withProtocol = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`;
    try {
      return {
        original: cleaned,
        host: new URL(withProtocol).hostname.toLowerCase().replace(/^www\./, "")
      };
    } catch {
      return {
        original: cleaned,
        host: cleaned.toLowerCase().replace(/^www\./, "")
      };
    }
  });
}

function domainBelongsTo(host, domains) {
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function findClaimedBank(message) {
  const lower = message.toLowerCase();

  return Object.entries(banks).find(([, bank]) => {
    return bank.aliases.some((alias) => lower.includes(alias));
  });
}

function addFinding(findings, type, text, points) {
  findings.push({ type, text, points });
}

function analyzeSms(sender, bankKey, message) {
  const normalized = normalizeSender(sender);
  const selectedBank = bankKey ? banks[bankKey] : null;
  const detectedByMessage = message ? findClaimedBank(message) : null;
  const claimedKey = bankKey || (detectedByMessage ? detectedByMessage[0] : "");
  const claimedBank = claimedKey ? banks[claimedKey] : null;
  const registryMatch = normalized.type === "header" ? headerToBank.get(normalized.value) : null;
  const links = extractLinks(message);
  const findings = [];
  let risk = 18;

  if (!sender.trim()) {
    addFinding(findings, "warn", "No sender was entered.", 25);
    risk += 25;
  }

  if (normalized.type === "header") {
    addFinding(findings, "good", `Detected Indian-style SMS header: ${normalized.display}.`, -6);
    risk -= 6;
  } else if (normalized.type === "mobile") {
    addFinding(findings, "bad", "The sender is a normal 10-digit mobile number. Treat it as unverified for bank SMS unless your bank publishes it.", 32);
    risk += 32;
  } else if (normalized.type === "shortcode") {
    addFinding(findings, "warn", "The sender looks like a short code. Verify it with the bank or TRAI before trusting it.", 14);
    risk += 14;
  } else {
    addFinding(findings, "warn", "The sender format is unusual, so the site cannot verify it confidently.", 18);
    risk += 18;
  }

  if (registryMatch) {
    addFinding(findings, "good", `Header matches the prototype trusted registry for ${registryMatch.bank.name}. Confirm with TRAI for official validation.`, -22);
    risk -= 22;

    if (selectedBank && registryMatch.key !== bankKey) {
      addFinding(findings, "bad", `The selected bank is ${selectedBank.name}, but the sender matches ${registryMatch.bank.name}.`, 35);
      risk += 35;
    }
  } else if (normalized.type === "header") {
    addFinding(findings, "warn", "This header is not in the prototype registry. Check it on TRAI Header Information Portal.", 18);
    risk += 18;
  }

  if (claimedBank && detectedByMessage && detectedByMessage[0] !== claimedKey) {
    addFinding(findings, "warn", `Message text mentions ${detectedByMessage[1].name}, which differs from the selected bank.`, 18);
    risk += 18;
  }

  if (!message.trim()) {
    addFinding(findings, "warn", "No SMS text was provided, so link and language checks were skipped.", 10);
    risk += 10;
  }

  if (links.length > 0) {
    const officialDomains = claimedBank ? claimedBank.domains : [];
    const untrustedLinks = links.filter((link) => !domainBelongsTo(link.host, officialDomains));
    const officialLinks = links.filter((link) => domainBelongsTo(link.host, officialDomains));
    const shortLinks = links.filter((link) => shorteners.includes(link.host));

    if (officialLinks.length > 0) {
      addFinding(findings, "good", `Found link on expected domain: ${officialLinks.map((link) => link.host).join(", ")}.`, -5);
      risk -= 5;
    }

    if (untrustedLinks.length > 0) {
      addFinding(findings, "bad", `Found link outside the selected bank's official domains: ${untrustedLinks.map((link) => link.host).join(", ")}.`, 36);
      risk += 36;
    }

    if (shortLinks.length > 0) {
      addFinding(findings, "bad", "Shortened links hide the real destination and are high risk in bank SMSes.", 28);
      risk += 28;
    }
  }

  const lowerMessage = message.toLowerCase();
  const asksForSecrets = /(share|send|enter|submit|verify).{0,24}(otp|pin|cvv|password|upi pin|netbanking password)/i.test(message);
  const urgentKyc = /(kyc|pan|aadhaar|aadhar).{0,40}(expire|expired|block|blocked|suspend|suspended|deactivat|update|verify)/i.test(message);
  const remoteApp = /(apk|anydesk|quick support|screen share|remote access|install app)/i.test(message);
  const threatLanguage = /(today|immediately|urgent|last chance|within 24|account will be blocked|account blocked|legal action)/i.test(message);
  const prizeLanguage = /(reward|cashback|lottery|bonus|free loan|instant loan)/i.test(message);

  if (asksForSecrets) {
    addFinding(findings, "bad", "The SMS appears to ask for OTP, PIN, CVV, password, or UPI PIN. Banks should not ask for these.", 45);
    risk += 45;
  }

  if (urgentKyc) {
    addFinding(findings, "bad", "KYC/PAN/Aadhaar urgency is a common bank-fraud pattern. Confirm only through the official bank app or branch.", 30);
    risk += 30;
  }

  if (remoteApp) {
    addFinding(findings, "bad", "The SMS mentions installing an app, APK, or remote-support tool. That is a severe fraud signal.", 42);
    risk += 42;
  }

  if (threatLanguage) {
    addFinding(findings, "warn", "The message uses urgency or account-blocking pressure.", 14);
    risk += 14;
  }

  if (prizeLanguage) {
    addFinding(findings, "warn", "Reward, lottery, cashback, or instant-loan language increases risk.", 16);
    risk += 16;
  }

  if (lowerMessage.includes("1930") || lowerMessage.includes("cybercrime.gov.in")) {
    addFinding(findings, "good", "The message references official cybercrime reporting channels, but still verify the sender and links.", -3);
    risk -= 3;
  }

  risk = Math.max(0, Math.min(100, Math.round(risk)));

  let level = "medium";
  let title = "Needs manual verification";
  let summary = "Do not click links yet. Verify the sender on TRAI Header Information Portal and contact your bank through the official app, website, or branch.";

  if (risk >= 65) {
    level = "high";
    title = "High fraud risk";
    summary = "Do not click the link, do not call numbers from the SMS, and do not share OTP, PIN, CVV, passwords, or remote-access permissions.";
  } else if (risk <= 28 && registryMatch) {
    level = "low";
    title = "Verified-looking sender";
    summary = "The sender matches this prototype's trusted header registry and no severe fraud patterns were found. Still use your bank app or official website for any action.";
  }

  if (findings.length === 0) {
    addFinding(findings, "warn", "Not enough information to judge the SMS.", 12);
  }

  return {
    normalized,
    selectedBank,
    claimedBank,
    registryMatch,
    findings,
    links,
    level,
    title,
    summary,
    risk
  };
}

function renderResult(result) {
  lastResult = result;
  resultPanel.classList.remove("is-low", "is-medium", "is-high");
  resultPanel.classList.add(`is-${result.level}`);

  verdictTitle.textContent = result.title;
  verdictSummary.textContent = result.summary;
  scoreText.textContent = `${result.risk} / 100`;
  scoreFill.style.width = `${result.risk}%`;
  scoreFill.style.background = result.level === "high" ? "var(--red)" : result.level === "medium" ? "var(--amber)" : "var(--green)";

  evidenceList.replaceChildren();
  result.findings.forEach((finding) => {
    const item = document.createElement("li");
    item.className = finding.type;
    item.textContent = finding.text;
    evidenceList.appendChild(item);
  });

  previewSender.textContent = result.normalized.raw || "BANK-SMS";
  previewText.textContent = messageInput.value.trim() || "No SMS text provided.";
}

function resetResult() {
  lastResult = null;
  resultPanel.classList.remove("is-low", "is-medium", "is-high");
  verdictTitle.textContent = "Ready to check";
  verdictSummary.textContent = "This tool compares the sender and message against defensive rules for SMS bank fraud in India.";
  scoreText.textContent = "0 / 100";
  scoreFill.style.width = "0";
  evidenceList.innerHTML = "<li>Enter a sender to start.</li>";
  previewSender.textContent = "BANK-SMS";
  previewText.textContent = "Paste a sender and message to see the risk analysis.";
}

function getReportText() {
  if (!lastResult) {
    return "No SMS risk check has been run yet.";
  }

  const bank = lastResult.claimedBank ? lastResult.claimedBank.name : "Not sure";
  const evidence = lastResult.findings.map((finding) => `- ${finding.text}`).join("\n");
  const messageSnippet = messageInput.value.trim().slice(0, 280) || "No SMS text pasted.";

  return [
    "Suspected bank SMS fraud check",
    `Sender: ${senderInput.value.trim() || "Not provided"}`,
    `Claimed bank: ${bank}`,
    `Verdict: ${lastResult.title}`,
    `Risk score: ${lastResult.risk}/100`,
    "",
    "Evidence:",
    evidence,
    "",
    "SMS snippet with secrets removed:",
    messageSnippet,
    "",
    "If money was lost, report at cybercrime.gov.in or call 1930 immediately."
  ].join("\n");
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const result = analyzeSms(senderInput.value, bankSelect.value, messageInput.value);
  renderResult(result);
});

clearButton.addEventListener("click", () => {
  form.reset();
  resetResult();
  senderInput.focus();
});

document.querySelectorAll("[data-example]").forEach((button) => {
  button.addEventListener("click", () => {
    const example = examples[button.dataset.example];
    senderInput.value = example.sender;
    bankSelect.value = example.bank;
    messageInput.value = example.message;
    renderResult(analyzeSms(example.sender, example.bank, example.message));
  });
});

copyReportButton.addEventListener("click", async () => {
  const report = getReportText();

  try {
    await navigator.clipboard.writeText(report);
    copyReportButton.querySelector("span").textContent = "Report summary copied.";
    window.setTimeout(() => {
      copyReportButton.querySelector("span").textContent = "Create a short report summary from the current check.";
    }, 1800);
  } catch {
    window.prompt("Copy this report summary:", report);
  }
});

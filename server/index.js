import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const BLYNK_BASE_URL = "https://blynk.cloud/external/api";
const BLYNK_TOKEN = process.env.BLYNK_AUTH_TOKEN;

// Optional but recommended.
// Set this in Render and Arduino to protect telemetry/command endpoints.
const DEVICE_API_KEY = process.env.DEVICE_API_KEY || "";

const PINS = {
  pm25: "v0",
  fanStatus: "v1",
  fanControl: "v2",
  modeSelect: "v3",
  aqi: "v4",

  pm25Chart: "v5",
  pm25History: "v6",
  customThreshold: "v7",

  alertLimit: "v8",
  filterHealth: "v9",
  resetFilter: "v10",
  airStatus: "v11",
  systemStatus: "v12",
  sensorStatus: "v13",

  efficiency: "v14",
  timeToSafe: "v15",
  removalRate: "v16",
  safeTarget: "v17",
  cleaningStatus: "v18",

  energyUsed: "v19",
  energySaved: "v20",
  fanPowerW: "v21",
  roomVolume: "v22",
  cadrEstimate: "v23",
  resetStats: "v24",

  pm25Pred5m: "v25",
  predTrend: "v26",
  predStatus: "v27",
};

const DEFAULT_TELEMETRY = {
  apiHealth: "waiting",
  warnings: [],

  pm25: 0,
  fanStatus: 0,
  fanControl: 0,
  modeSelect: 0,
  aqi: 0,

  pm25Chart: 0,
  pm25History: 0,
  customThreshold: 20,

  alertLimit: 20,
  filterHealth: 100,
  airStatus: "WAITING",
  systemStatus: "Waiting Sensor",
  sensorStatus: "WAITING",

  efficiency: 0,
  timeToSafe: 0,
  removalRate: 0,
  safeTarget: 25,
  cleaningStatus: "WAITING",

  energyUsed: 0,
  energySaved: 0,
  fanPowerW: 2.16,
  roomVolume: 30,
  cadrEstimate: 0,

  pm25Pred5m: 0,
  predTrend: "NO DATA",
  predStatus: "INSUFFICIENT DATA",

  servedFrom: "backend-memory",
  deviceOnline: false,
  lastUpdated: null,
  ageSeconds: null,

  raw: {},
  modeMapping: {
    0: "Auto",
    1: "Manual",
    2: "Custom",
  },
};

let latestTelemetry = { ...DEFAULT_TELEMETRY };

let deviceCommand = {
  version: 0,

  fanControl: 0,
  modeSelect: 0,
  customThreshold: 20,

  alertLimit: 20,
  safeTarget: 25,
  fanPowerW: 2.16,
  roomVolume: 30,

  resetFilter: 0,
  resetStats: 0,

  updatedAt: null,
};

function toNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function toInteger(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.round(numberValue) : fallback;
}

function normalizeText(value, fallback = "WAITING") {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value);
}

function isDeviceAuthorized(req) {
  if (!DEVICE_API_KEY) return true;

  const headerKey = req.headers["x-device-key"];
  const queryKey = req.query.key;

  return headerKey === DEVICE_API_KEY || queryKey === DEVICE_API_KEY;
}

function requireToken() {
  if (!BLYNK_TOKEN) {
    throw new Error("Missing BLYNK_AUTH_TOKEN in Render/Local environment");
  }
}

function extractBlynkError(text) {
  try {
    const parsed = JSON.parse(text);

    if (parsed?.error?.message) return parsed.error.message;
    if (parsed?.message) return parsed.message;

    if (parsed?.error) {
      return typeof parsed.error === "string"
        ? parsed.error
        : JSON.stringify(parsed.error);
    }

    return text;
  } catch {
    return text;
  }
}

function isBlynkApiErrorText(text) {
  if (!text) return false;

  const lowerText = String(text).toLowerCase().trim();

  return (
    lowerText.includes("limit reached") ||
    lowerText.includes("invalid token") ||
    lowerText.includes("device is offline") ||
    lowerText.startsWith('{"error"')
  );
}

async function updateBlynkValue(pin, value) {
  requireToken();

  const url = `${BLYNK_BASE_URL}/update?token=${BLYNK_TOKEN}&${pin}=${encodeURIComponent(
    value
  )}`;

  const response = await fetch(url);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      extractBlynkError(text) || `Blynk UPDATE failed for ${pin}`
    );
  }

  if (isBlynkApiErrorText(text)) {
    throw new Error(
      extractBlynkError(text) || `Blynk returned error while updating ${pin}`
    );
  }

  return text;
}

async function trySyncBlynk(pin, value) {
  try {
    await updateBlynkValue(pin, value);

    return {
      ok: true,
      warning: null,
    };
  } catch (error) {
    return {
      ok: false,
      warning: `Blynk sync failed for ${pin}: ${error.message}`,
    };
  }
}

function bumpCommandVersion() {
  deviceCommand.version += 1;
  deviceCommand.updatedAt = new Date().toISOString();
}

function updateLatestTelemetry(partial) {
  const merged = {
    ...latestTelemetry,
    ...partial,
  };

  const lastUpdated = partial.lastUpdated || new Date().toISOString();
  const ageSeconds = 0;

  latestTelemetry = {
    ...merged,
    apiHealth: "ok",
    warnings: [],
    deviceOnline: true,
    servedFrom: "device-telemetry",
    lastUpdated,
    ageSeconds,
    modeMapping: {
      0: "Auto",
      1: "Manual",
      2: "Custom",
    },
  };
}

function getTelemetryWithAge() {
  const now = Date.now();

  if (!latestTelemetry.lastUpdated) {
    return {
      ...latestTelemetry,
      deviceOnline: false,
      ageSeconds: null,
      apiHealth: "waiting",
      warnings: ["Waiting for Arduino telemetry"],
    };
  }

  const lastUpdatedMs = new Date(latestTelemetry.lastUpdated).getTime();
  const ageSeconds = Math.round((now - lastUpdatedMs) / 1000);
  const deviceOnline = ageSeconds <= 60;

  return {
    ...latestTelemetry,
    ageSeconds,
    deviceOnline,
    apiHealth: deviceOnline ? latestTelemetry.apiHealth : "degraded",
    warnings: deviceOnline
      ? latestTelemetry.warnings || []
      : ["No recent telemetry from Arduino"],
  };
}

function normalizeTelemetry(body) {
  return {
    pm25: toNumber(body.pm25, latestTelemetry.pm25),
    fanStatus: toInteger(body.fanStatus, latestTelemetry.fanStatus),
    fanControl: toInteger(body.fanControl, latestTelemetry.fanControl),
    modeSelect: toInteger(body.modeSelect, latestTelemetry.modeSelect),
    aqi: toNumber(body.aqi, latestTelemetry.aqi),

    pm25Chart: toNumber(body.pm25Chart, body.pm25 ?? latestTelemetry.pm25),
    pm25History: toNumber(body.pm25History, body.pm25 ?? latestTelemetry.pm25),
    customThreshold: toNumber(
      body.customThreshold,
      latestTelemetry.customThreshold
    ),

    alertLimit: toNumber(body.alertLimit, latestTelemetry.alertLimit),
    filterHealth: toNumber(body.filterHealth, latestTelemetry.filterHealth),
    airStatus: normalizeText(body.airStatus, latestTelemetry.airStatus),
    systemStatus: normalizeText(
      body.systemStatus,
      latestTelemetry.systemStatus
    ),
    sensorStatus: normalizeText(
      body.sensorStatus,
      latestTelemetry.sensorStatus
    ),

    efficiency: toNumber(body.efficiency, latestTelemetry.efficiency),
    timeToSafe: toNumber(body.timeToSafe, latestTelemetry.timeToSafe),
    removalRate: toNumber(body.removalRate, latestTelemetry.removalRate),
    safeTarget: toNumber(body.safeTarget, latestTelemetry.safeTarget),
    cleaningStatus: normalizeText(
      body.cleaningStatus,
      latestTelemetry.cleaningStatus
    ),

    energyUsed: toNumber(body.energyUsed, latestTelemetry.energyUsed),
    energySaved: toNumber(body.energySaved, latestTelemetry.energySaved),
    fanPowerW: toNumber(body.fanPowerW, latestTelemetry.fanPowerW),
    roomVolume: toNumber(body.roomVolume, latestTelemetry.roomVolume),
    cadrEstimate: toNumber(body.cadrEstimate, latestTelemetry.cadrEstimate),

    pm25Pred5m: toNumber(body.pm25Pred5m, latestTelemetry.pm25Pred5m),
    predTrend: normalizeText(body.predTrend, latestTelemetry.predTrend),
    predStatus: normalizeText(body.predStatus, latestTelemetry.predStatus),

    raw: body,
  };
}

app.get("/", (req, res) => {
  res.json({
    message: "CleverAero backend is running",
    apiStatus: "ok",
    dataLayer: "Arduino direct telemetry",
    controlLayer: "Backend command queue with optional Blynk sync",
    endpoints: {
      latest: "/api/device/latest",
      telemetry: "POST /api/device/telemetry",
      command: "/api/device/command",
      dashboardCompatibility: "/api/blynk/status",
    },
    pins: PINS,
  });
});

// New primary data source for the web dashboard.
app.get("/api/device/latest", (req, res) => {
  res.json(getTelemetryWithAge());
});

// Backward-compatible endpoint.
// Your current App.jsx can continue calling /api/blynk/status,
// but this no longer reads every Blynk virtual pin.
app.get("/api/blynk/status", (req, res) => {
  res.json(getTelemetryWithAge());
});

// Arduino sends telemetry here.
app.post("/api/device/telemetry", (req, res) => {
  if (!isDeviceAuthorized(req)) {
    return res.status(401).json({
      error: "Unauthorized device",
    });
  }

  const telemetry = normalizeTelemetry(req.body);
  updateLatestTelemetry(telemetry);

  return res.json({
    success: true,
    message: "Telemetry received",
    lastUpdated: latestTelemetry.lastUpdated,
  });
});

// Arduino polls this endpoint to receive latest commands.
// This makes web control work even if Blynk message limit is reached.
app.get("/api/device/command", (req, res) => {
  if (!isDeviceAuthorized(req)) {
    return res.status(401).json({
      error: "Unauthorized device",
    });
  }

  return res.json({
    success: true,
    ...deviceCommand,
  });
});

app.post("/api/blynk/fan", async (req, res) => {
  const { value } = req.body;

  if (value !== 0 && value !== 1) {
    return res.status(400).json({
      error: "Fan value must be 0 or 1",
    });
  }

  deviceCommand.fanControl = value;
  bumpCommandVersion();

  updateLatestTelemetry({
    fanControl: value,
    fanStatus:
      latestTelemetry.modeSelect === 1 ? value : latestTelemetry.fanStatus,
    systemStatus:
      latestTelemetry.modeSelect === 1
        ? `MANUAL / FAN ${value === 1 ? "ON" : "OFF"}`
        : latestTelemetry.systemStatus,
  });

  const blynkSync = await trySyncBlynk(PINS.fanControl, value);

  return res.json({
    success: true,
    pin: PINS.fanControl,
    fanControl: value,
    directCommandQueued: true,
    commandVersion: deviceCommand.version,
    blynkSync,
    message:
      value === 1
        ? "Fan ON command queued"
        : "Fan OFF command queued",
  });
});

app.post("/api/blynk/mode", async (req, res) => {
  const { value } = req.body;

  if (![0, 1, 2].includes(value)) {
    return res.status(400).json({
      error: "Mode value must be 0, 1, or 2",
    });
  }

  deviceCommand.modeSelect = value;
  bumpCommandVersion();

  const modeText = value === 0 ? "Auto" : value === 1 ? "Manual" : "Custom";

  updateLatestTelemetry({
    modeSelect: value,
    systemStatus: `${modeText.toUpperCase()} MODE`,
  });

  const blynkSync = await trySyncBlynk(PINS.modeSelect, value);

  return res.json({
    success: true,
    pin: PINS.modeSelect,
    modeSelect: value,
    modeText,
    directCommandQueued: true,
    commandVersion: deviceCommand.version,
    blynkSync,
    message: `Mode command queued: ${modeText}`,
  });
});

app.post("/api/blynk/threshold", async (req, res) => {
  const { value } = req.body;
  const threshold = Number(value);

  if (!Number.isFinite(threshold)) {
    return res.status(400).json({
      error: "Threshold must be a number",
    });
  }

  if (threshold < 1 || threshold > 300) {
    return res.status(400).json({
      error: "Threshold must be between 1 and 300 µg/m³",
    });
  }

  deviceCommand.customThreshold = threshold;
  bumpCommandVersion();

  updateLatestTelemetry({
    customThreshold: threshold,
  });

  const blynkSync = await trySyncBlynk(PINS.customThreshold, threshold);

  return res.json({
    success: true,
    pin: PINS.customThreshold,
    customThreshold: threshold,
    directCommandQueued: true,
    commandVersion: deviceCommand.version,
    blynkSync,
    message: `Custom threshold command queued: ${threshold} µg/m³`,
  });
});

app.post("/api/blynk/setting", async (req, res) => {
  const { key, value } = req.body;

  const allowedSettings = {
    alertLimit: {
      pin: PINS.alertLimit,
      min: 5,
      max: 300,
      label: "Alert Limit",
      commandKey: "alertLimit",
      telemetryKey: "alertLimit",
    },
    safeTarget: {
      pin: PINS.safeTarget,
      min: 5,
      max: 100,
      label: "Safe PM Target",
      commandKey: "safeTarget",
      telemetryKey: "safeTarget",
    },
    fanPowerW: {
      pin: PINS.fanPowerW,
      min: 0.1,
      max: 50,
      label: "Fan Power",
      commandKey: "fanPowerW",
      telemetryKey: "fanPowerW",
    },
    roomVolume: {
      pin: PINS.roomVolume,
      min: 5,
      max: 200,
      label: "Room Volume",
      commandKey: "roomVolume",
      telemetryKey: "roomVolume",
    },
  };

  if (!allowedSettings[key]) {
    return res.status(400).json({
      error: "Invalid setting key",
    });
  }

  const setting = allowedSettings[key];
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return res.status(400).json({
      error: `${setting.label} must be a number`,
    });
  }

  if (numericValue < setting.min || numericValue > setting.max) {
    return res.status(400).json({
      error: `${setting.label} must be between ${setting.min} and ${setting.max}`,
    });
  }

  deviceCommand[setting.commandKey] = numericValue;
  bumpCommandVersion();

  updateLatestTelemetry({
    [setting.telemetryKey]: numericValue,
  });

  const blynkSync = await trySyncBlynk(setting.pin, numericValue);

  return res.json({
    success: true,
    key,
    pin: setting.pin,
    value: numericValue,
    directCommandQueued: true,
    commandVersion: deviceCommand.version,
    blynkSync,
    message: `${setting.label} command queued: ${numericValue}`,
  });
});

app.post("/api/blynk/reset", async (req, res) => {
  const { type } = req.body;

  const resetMap = {
    filter: {
      pin: PINS.resetFilter,
      commandKey: "resetFilter",
      label: "Filter",
    },
    stats: {
      pin: PINS.resetStats,
      commandKey: "resetStats",
      label: "Stats",
    },
  };

  if (!resetMap[type]) {
    return res.status(400).json({
      error: "Reset type must be 'filter' or 'stats'",
    });
  }

  const resetConfig = resetMap[type];

  deviceCommand[resetConfig.commandKey] = 1;
  bumpCommandVersion();

  const blynkSync = await trySyncBlynk(resetConfig.pin, 1);

  // Auto-clear reset command after a short delay.
  setTimeout(() => {
    deviceCommand[resetConfig.commandKey] = 0;
    bumpCommandVersion();

    trySyncBlynk(resetConfig.pin, 0);
  }, 3000);

  return res.json({
    success: true,
    type,
    pin: resetConfig.pin,
    directCommandQueued: true,
    commandVersion: deviceCommand.version,
    blynkSync,
    message: `${resetConfig.label} reset command queued`,
  });
});

app.listen(PORT, () => {
  console.log(`CleverAero backend running on port ${PORT}`);
});
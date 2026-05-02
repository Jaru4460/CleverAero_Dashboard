import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const BLYNK_BASE_URL = "https://blynk.cloud/external/api";
const BLYNK_TOKEN = process.env.BLYNK_AUTH_TOKEN;

// CleverAero Blynk Virtual Pin Mapping
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

// Latest valid values. Used as fallback if Blynk API temporarily fails.
const lastGoodRaw = {
  pm25: "0",
  fanStatus: "0",
  modeSelect: "0",
  aqi: "0",

  pm25Chart: "0",
  pm25History: "0",
  customThreshold: "20",

  alertLimit: "20",
  filterHealth: "100",
  airStatus: "WAITING",
  systemStatus: "Waiting Sensor",
  sensorStatus: "WAITING",

  efficiency: "0",
  timeToSafe: "0",
  removalRate: "0",
  safeTarget: "25",
  cleaningStatus: "WAITING",

  energyUsed: "0",
  energySaved: "0",
  fanPowerW: "2.16",
  roomVolume: "30",
  cadrEstimate: "0",

  pm25Pred5m: "0",
  predTrend: "NO DATA",
  predStatus: "INSUFFICIENT DATA",
};

// Backend cache to reduce Blynk API requests.
let cachedStatusPayload = null;
let cachedStatusTime = 0;
const STATUS_CACHE_TTL_MS = 20000;

function requireToken() {
  if (!BLYNK_TOKEN) {
    throw new Error("Missing BLYNK_AUTH_TOKEN in Render/Local environment");
  }
}

function extractBlynkError(text) {
  try {
    const parsed = JSON.parse(text);

    if (parsed?.error?.message) {
      return parsed.error.message;
    }

    if (parsed?.message) {
      return parsed.message;
    }

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

async function getBlynkValue(pin) {
  requireToken();

  const url = `${BLYNK_BASE_URL}/get?token=${BLYNK_TOKEN}&${pin}`;
  const response = await fetch(url);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(extractBlynkError(text) || `Blynk GET failed for ${pin}`);
  }

  if (isBlynkApiErrorText(text)) {
    throw new Error(
      extractBlynkError(text) || `Blynk returned error for ${pin}`
    );
  }

  return text;
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

function toNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

async function getPinWithFallback(key, pin) {
  try {
    const value = await getBlynkValue(pin);
    lastGoodRaw[key] = value;

    return {
      key,
      value,
      ok: true,
      warning: null,
    };
  } catch (error) {
    return {
      key,
      value: lastGoodRaw[key],
      ok: false,
      warning: `${key} (${pin}): ${error.message}`,
    };
  }
}

async function getManyPinsWithFallback(pinMap) {
  const entries = Object.entries(pinMap);

  const results = await Promise.all(
    entries.map(([key, pin]) => getPinWithFallback(key, pin))
  );

  const raw = {};
  const warnings = [];

  for (const result of results) {
    raw[result.key] = result.value;

    if (!result.ok && result.warning) {
      warnings.push(result.warning);
    }
  }

  return {
    raw,
    warnings,
  };
}

function clearStatusCache() {
  cachedStatusPayload = null;
  cachedStatusTime = 0;
}

app.get("/", (req, res) => {
  res.json({
    message: "CleverAero backend is running",
    apiStatus: "ok",
    pins: PINS,
    modeMapping: {
      0: "Auto",
      1: "Manual",
      2: "Custom",
    },
  });
});

app.get("/api/blynk/status", async (req, res) => {
  try {
    const now = Date.now();

    if (cachedStatusPayload && now - cachedStatusTime < STATUS_CACHE_TTL_MS) {
      return res.json({
        ...cachedStatusPayload,
        servedFromCache: true,
        cacheAgeMs: now - cachedStatusTime,
      });
    }

    const { raw, warnings } = await getManyPinsWithFallback({
      pm25: PINS.pm25,
      fanStatus: PINS.fanStatus,
      modeSelect: PINS.modeSelect,
      aqi: PINS.aqi,

      pm25Chart: PINS.pm25Chart,
      pm25History: PINS.pm25History,
      customThreshold: PINS.customThreshold,

      alertLimit: PINS.alertLimit,
      filterHealth: PINS.filterHealth,
      airStatus: PINS.airStatus,
      systemStatus: PINS.systemStatus,
      sensorStatus: PINS.sensorStatus,

      efficiency: PINS.efficiency,
      timeToSafe: PINS.timeToSafe,
      removalRate: PINS.removalRate,
      safeTarget: PINS.safeTarget,
      cleaningStatus: PINS.cleaningStatus,

      energyUsed: PINS.energyUsed,
      energySaved: PINS.energySaved,
      fanPowerW: PINS.fanPowerW,
      roomVolume: PINS.roomVolume,
      cadrEstimate: PINS.cadrEstimate,

      pm25Pred5m: PINS.pm25Pred5m,
      predTrend: PINS.predTrend,
      predStatus: PINS.predStatus,
    });

    const payload = {
      apiHealth: warnings.length === 0 ? "ok" : "degraded",
      warnings,

      // Core data
      pm25: toNumber(raw.pm25),
      fanStatus: toNumber(raw.fanStatus),
      modeSelect: toNumber(raw.modeSelect),
      aqi: toNumber(raw.aqi),

      // Chart / threshold data
      pm25Chart: toNumber(raw.pm25Chart),
      pm25History: toNumber(raw.pm25History),
      customThreshold: toNumber(raw.customThreshold, 20),
      alertLimit: toNumber(raw.alertLimit, 20),

      // Status strings
      filterHealth: toNumber(raw.filterHealth, 0),
      airStatus: raw.airStatus || "WAITING",
      systemStatus: raw.systemStatus || "Waiting Sensor",
      sensorStatus: raw.sensorStatus || "WAITING",

      // Performance insights
      efficiency: toNumber(raw.efficiency),
      timeToSafe: toNumber(raw.timeToSafe),
      removalRate: toNumber(raw.removalRate),
      safeTarget: toNumber(raw.safeTarget, 25),
      cleaningStatus: raw.cleaningStatus || "WAITING",

      // Energy / configuration insights
      energyUsed: toNumber(raw.energyUsed),
      energySaved: toNumber(raw.energySaved),
      fanPowerW: toNumber(raw.fanPowerW, 2.16),
      roomVolume: toNumber(raw.roomVolume, 30),
      cadrEstimate: toNumber(raw.cadrEstimate),

      // Prediction insights
      pm25Pred5m: toNumber(raw.pm25Pred5m),
      predTrend: raw.predTrend || "NO DATA",
      predStatus: raw.predStatus || "INSUFFICIENT DATA",

      raw,
      servedFromCache: false,
      cacheAgeMs: 0,
      modeMapping: {
        0: "Auto",
        1: "Manual",
        2: "Custom",
      },
    };

    cachedStatusPayload = payload;
    cachedStatusTime = Date.now();

    return res.json(payload);
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/api/blynk/fan", async (req, res) => {
  try {
    const { value } = req.body;

    if (value !== 0 && value !== 1) {
      return res.status(400).json({
        error: "Fan value must be 0 or 1",
      });
    }

    await updateBlynkValue(PINS.fanControl, value);
    lastGoodRaw.fanControl = String(value);
    clearStatusCache();

    return res.json({
      success: true,
      pin: PINS.fanControl,
      fanControl: value,
      message: value === 1 ? "Fan control set to ON" : "Fan control set to OFF",
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/api/blynk/mode", async (req, res) => {
  try {
    const { value } = req.body;

    if (![0, 1, 2].includes(value)) {
      return res.status(400).json({
        error: "Mode value must be 0, 1, or 2",
      });
    }

    await updateBlynkValue(PINS.modeSelect, value);
    lastGoodRaw.modeSelect = String(value);
    clearStatusCache();

    const modeText =
      value === 0 ? "Auto" : value === 1 ? "Manual" : "Custom";

    return res.json({
      success: true,
      pin: PINS.modeSelect,
      modeSelect: value,
      modeText,
      message: `Mode changed to ${modeText}`,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/api/blynk/threshold", async (req, res) => {
  try {
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

    await updateBlynkValue(PINS.customThreshold, threshold);
    lastGoodRaw.customThreshold = String(threshold);
    clearStatusCache();

    return res.json({
      success: true,
      pin: PINS.customThreshold,
      customThreshold: threshold,
      message: `Custom threshold updated to ${threshold} µg/m³ on V7`,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/api/blynk/setting", async (req, res) => {
  try {
    const { key, value } = req.body;

    const allowedSettings = {
      alertLimit: {
        pin: PINS.alertLimit,
        min: 5,
        max: 300,
        label: "Alert Limit",
        cacheKey: "alertLimit",
      },
      safeTarget: {
        pin: PINS.safeTarget,
        min: 5,
        max: 100,
        label: "Safe PM Target",
        cacheKey: "safeTarget",
      },
      fanPowerW: {
        pin: PINS.fanPowerW,
        min: 0.1,
        max: 50,
        label: "Fan Power",
        cacheKey: "fanPowerW",
      },
      roomVolume: {
        pin: PINS.roomVolume,
        min: 5,
        max: 200,
        label: "Room Volume",
        cacheKey: "roomVolume",
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

    await updateBlynkValue(setting.pin, numericValue);
    lastGoodRaw[setting.cacheKey] = String(numericValue);
    clearStatusCache();

    return res.json({
      success: true,
      key,
      pin: setting.pin,
      value: numericValue,
      message: `${setting.label} updated to ${numericValue}`,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

app.post("/api/blynk/reset", async (req, res) => {
  try {
    const { type } = req.body;

    const resetMap = {
      filter: PINS.resetFilter,
      stats: PINS.resetStats,
    };

    if (!resetMap[type]) {
      return res.status(400).json({
        error: "Reset type must be 'filter' or 'stats'",
      });
    }

    const pin = resetMap[type];

    await updateBlynkValue(pin, 1);
    await new Promise((resolve) => setTimeout(resolve, 400));
    await updateBlynkValue(pin, 0);
    clearStatusCache();

    return res.json({
      success: true,
      type,
      pin,
      message: `${type} reset command sent`,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`CleverAero backend running on port ${PORT}`);
});
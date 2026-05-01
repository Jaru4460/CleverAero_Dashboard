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

function requireToken() {
  if (!BLYNK_TOKEN) {
    throw new Error("Missing BLYNK_AUTH_TOKEN in .env file");
  }
}

async function getBlynkValue(pin) {
  requireToken();

  const url = `${BLYNK_BASE_URL}/get?token=${BLYNK_TOKEN}&${pin}`;
  const response = await fetch(url);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Blynk GET failed for ${pin}`);
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
    throw new Error(text || `Blynk UPDATE failed for ${pin}`);
  }

  return text;
}

function toNumber(value, fallback = 0) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

async function getManyPins(pinMap) {
  const entries = Object.entries(pinMap);

  const values = await Promise.all(
    entries.map(async ([key, pin]) => {
      const value = await getBlynkValue(pin);
      return [key, value];
    })
  );

  return Object.fromEntries(values);
}

app.get("/", (req, res) => {
  res.json({
    message: "CleverAero backend is running",
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
    const raw = await getManyPins({
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

    res.json({
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
      airStatus: raw.airStatus,
      systemStatus: raw.systemStatus,
      sensorStatus: raw.sensorStatus,

      // Performance insights
      efficiency: toNumber(raw.efficiency),
      timeToSafe: toNumber(raw.timeToSafe),
      removalRate: toNumber(raw.removalRate),
      safeTarget: toNumber(raw.safeTarget, 25),
      cleaningStatus: raw.cleaningStatus,

      // Energy / configuration insights
      energyUsed: toNumber(raw.energyUsed),
      energySaved: toNumber(raw.energySaved),
      fanPowerW: toNumber(raw.fanPowerW, 2.16),
      roomVolume: toNumber(raw.roomVolume, 30),
      cadrEstimate: toNumber(raw.cadrEstimate),

      // Prediction insights
      pm25Pred5m: toNumber(raw.pm25Pred5m),
      predTrend: raw.predTrend,
      predStatus: raw.predStatus,

      raw,
      modeMapping: {
        0: "Auto",
        1: "Manual",
        2: "Custom",
      },
    });
  } catch (error) {
    res.status(500).json({
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

    res.json({
      success: true,
      pin: PINS.fanControl,
      fanControl: value,
      message: value === 1 ? "Fan control set to ON" : "Fan control set to OFF",
    });
  } catch (error) {
    res.status(500).json({
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

    const modeText =
      value === 0 ? "Auto" : value === 1 ? "Manual" : "Custom";

    res.json({
      success: true,
      pin: PINS.modeSelect,
      modeSelect: value,
      modeText,
      message: `Mode changed to ${modeText}`,
    });
  } catch (error) {
    res.status(500).json({
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

    res.json({
      success: true,
      pin: PINS.customThreshold,
      customThreshold: threshold,
      message: `Custom threshold updated to ${threshold} µg/m³ on V7`,
    });
  } catch (error) {
    res.status(500).json({
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
      },
      safeTarget: {
        pin: PINS.safeTarget,
        min: 5,
        max: 100,
        label: "Safe PM Target",
      },
      fanPowerW: {
        pin: PINS.fanPowerW,
        min: 0.1,
        max: 50,
        label: "Fan Power",
      },
      roomVolume: {
        pin: PINS.roomVolume,
        min: 5,
        max: 200,
        label: "Room Volume",
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

    res.json({
      success: true,
      key,
      pin: setting.pin,
      value: numericValue,
      message: `${setting.label} updated to ${numericValue}`,
    });
  } catch (error) {
    res.status(500).json({
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

    // Pulse reset: send 1 then return to 0
    await updateBlynkValue(pin, 1);
    await new Promise((resolve) => setTimeout(resolve, 400));
    await updateBlynkValue(pin, 0);

    res.json({
      success: true,
      type,
      pin,
      message: `${type} reset command sent`,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`CleverAero backend running at http://localhost:${PORT}`);
});
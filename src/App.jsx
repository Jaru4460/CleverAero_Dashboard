import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
const MAX_LOG_ROWS = 80;

function getAirQuality(pm25) {
  if (pm25 <= 12) {
    return {
      label: "Good",
      color: "#22c55e",
      description: "Clean and healthy air",
    };
  }

  if (pm25 <= 35) {
    return {
      label: "Moderate",
      color: "#facc15",
      description: "Acceptable air quality",
    };
  }

  if (pm25 <= 55) {
    return {
      label: "Sensitive",
      color: "#fb923c",
      description: "Unhealthy for sensitive groups",
    };
  }

  return {
    label: "Unhealthy",
    color: "#ef4444",
    description: "Poor air quality",
  };
}

function getModeText(modeSelect) {
  if (modeSelect === 0) return "Auto";
  if (modeSelect === 1) return "Manual";
  if (modeSelect === 2) return "Custom";
  return "Unknown";
}

function getCurrentTime() {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatNumber(value, digits = 1) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return "0";
  return numberValue.toFixed(digits);
}

function getTrendColor(trend) {
  if (trend === "FALLING" || trend === "Improving") return "#22c55e";
  if (trend === "RISING" || trend === "Increasing") return "#ef4444";
  return "#facc15";
}

function StatCard({ title, value, subtitle, color }) {
  return (
    <div style={styles.statCard}>
      <p style={styles.cardLabel}>{title}</p>
      <h2 style={{ ...styles.cardValue, color: color || "#ffffff" }}>
        {value}
      </h2>
      <p style={styles.cardSubtitle}>{subtitle}</p>
    </div>
  );
}

function MiniInsight({ title, value, description, color }) {
  return (
    <div style={styles.miniInsight}>
      <p style={styles.cardLabel}>{title}</p>
      <h3 style={{ ...styles.miniValue, color: color || "#ffffff" }}>
        {value}
      </h3>
      <p style={styles.cardSubtitle}>{description}</p>
    </div>
  );
}

function AlertCenter({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return (
      <section style={styles.alertCenterSafe}>
        <div>
          <p style={styles.cardLabel}>Alert Center</p>
          <h3 style={styles.alertSafeTitle}>All systems normal</h3>
          <p style={styles.cardSubtitle}>
            No dashboard warning is currently active.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section style={styles.alertCenter}>
      <div style={styles.alertHeader}>
        <div>
          <p style={styles.cardLabel}>Alert Center</p>
          <h3 style={styles.alertTitle}>Active Dashboard Alerts</h3>
        </div>

        <span style={styles.alertCount}>{alerts.length}</span>
      </div>

      <div style={styles.alertList}>
        {alerts.map((alert, index) => (
          <div
            key={`${alert.title}-${index}`}
            style={{
              ...styles.alertItem,
              borderColor: alert.color,
              backgroundColor: alert.background,
            }}
          >
            <div style={{ ...styles.alertIcon, backgroundColor: alert.color }}>
              !
            </div>

            <div>
              <h4 style={styles.alertItemTitle}>{alert.title}</h4>
              <p style={styles.alertMessage}>{alert.message}</p>
              <p style={styles.alertMeta}>{alert.meta}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div style={styles.sectionHeadingBlock}>
      <h2 style={styles.sectionTitle}>{title}</h2>
      <p style={styles.sectionSubtitle}>{subtitle}</p>
    </div>
  );
}

function SettingControl({
  title,
  subtitle,
  value,
  unit,
  min,
  max,
  step,
  onChange,
  onSave,
  disabled,
}) {
  return (
    <div style={styles.settingCard}>
      <div>
        <p style={styles.cardLabel}>{title}</p>
        <h3 style={styles.settingValue}>
          {value} <span style={styles.settingUnit}>{unit}</span>
        </h3>
        <p style={styles.cardSubtitle}>{subtitle}</p>
      </div>

      <input
        className="tech-slider"
        style={styles.rangeInput}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />

      <div style={styles.settingFooter}>
        <span>{min}</span>
        <button style={styles.smallBlueButton} onClick={onSave} disabled={disabled}>
          Save
        </button>
        <span>{max}</span>
      </div>
    </div>
  );
}

function LineChart({ data, maxPoints }) {
  const displayData = data.slice(-maxPoints);
  const width = 900;
  const height = 300;
  const paddingX = 42;
  const paddingY = 34;

  const maxPM = Math.max(60, ...displayData.map((item) => item.pm25 || 0));
  const minPM = 0;

  const points = displayData.map((item, index) => {
    const x =
      displayData.length <= 1
        ? paddingX
        : paddingX +
          (index / (displayData.length - 1)) * (width - paddingX * 2);

    const y =
      height -
      paddingY -
      ((item.pm25 - minPM) / (maxPM - minPM)) * (height - paddingY * 2);

    return {
      x,
      y,
      pm25: item.pm25,
      time: item.time,
    };
  });

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${path} L ${points[points.length - 1].x} ${height - paddingY} L ${
          points[0].x
        } ${height - paddingY} Z`
      : "";

  const yTicks = [0, Math.round(maxPM * 0.25), Math.round(maxPM * 0.5), Math.round(maxPM * 0.75), maxPM];

  return (
    <div style={styles.lineChartWrapper}>
      {displayData.length === 0 ? (
        <p style={styles.sectionSubtitle}>Waiting for data...</p>
      ) : (
        <svg viewBox={`0 0 ${width} ${height}`} style={styles.lineChart}>
          <defs>
            <linearGradient id="pmLineGradient" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#93c5fd" />
              <stop offset="50%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#facc15" />
            </linearGradient>

            <linearGradient id="pmAreaGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(56, 189, 248, 0.34)" />
              <stop offset="100%" stopColor="rgba(56, 189, 248, 0.02)" />
            </linearGradient>
          </defs>

          {yTicks.map((tick) => {
            const y =
              height -
              paddingY -
              ((tick - minPM) / (maxPM - minPM)) * (height - paddingY * 2);

            return (
              <g key={tick}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth="1"
                />
                <text
                  x="8"
                  y={y + 4}
                  fill="#bfdbfe"
                  fontSize="12"
                  fontWeight="700"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill="url(#pmAreaGradient)" />
          <path
            d={path}
            fill="none"
            stroke="url(#pmLineGradient)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((point, index) => {
            const isLatest = index === points.length - 1;

            return (
              <g key={`${point.time}-${index}`}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isLatest ? 6 : 4}
                  fill={isLatest ? "#facc15" : "#e0f2fe"}
                  stroke={isLatest ? "#fb923c" : "#2563eb"}
                  strokeWidth="2"
                />
                {isLatest && (
                  <text
                    x={point.x - 18}
                    y={point.y - 12}
                    fill="#ffffff"
                    fontSize="13"
                    fontWeight="800"
                  >
                    {point.pm25}
                  </text>
                )}
              </g>
            );
          })}

          <text
            x={width - 150}
            y={height - 8}
            fill="#bfdbfe"
            fontSize="12"
            fontWeight="700"
          >
            Latest {displayData.length} readings
          </text>
        </svg>
      )}
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState("overview");
  const [data, setData] = useState([]);
  const [latestStatus, setLatestStatus] = useState(null);

  const [isLive, setIsLive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Connecting");
  const [errorMessage, setErrorMessage] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [settingStatus, setSettingStatus] = useState("");

  const [graphPointCount, setGraphPointCount] = useState(30);

  const [customThreshold, setCustomThreshold] = useState(20);
  const [thresholdDraft, setThresholdDraft] = useState(20);
  const [thresholdStatus, setThresholdStatus] = useState("");

  const [safeTargetDraft, setSafeTargetDraft] = useState(25);
  const [fanPowerDraft, setFanPowerDraft] = useState(2.16);
  const [roomVolumeDraft, setRoomVolumeDraft] = useState(30);
  const [alertLimitDraft, setAlertLimitDraft] = useState(20);

  const [experimentActive, setExperimentActive] = useState(false);
  const [experimentData, setExperimentData] = useState([]);
  const [experimentStartTime, setExperimentStartTime] = useState(null);
  const [experimentEndTime, setExperimentEndTime] = useState(null);

  const experimentActiveRef = useRef(false);
  const hasLoadedInitialSettingsRef = useRef(false);

  async function fetchBlynkStatus(options = {}) {
    try {
      setIsLoading(true);

      const forceRefresh = options.force === true ? "?refresh=1" : "";
      const response = await fetch(`${API_BASE_URL}/api/device/latest`);

      if (!response.ok) {
        throw new Error(result.error || "Failed to fetch Blynk data");
      }

      const thresholdFromBlynk = Number(result.customThreshold);
      const isValidThreshold =
        Number.isFinite(thresholdFromBlynk) &&
        thresholdFromBlynk >= 1 &&
        thresholdFromBlynk <= 300;

      if (isValidThreshold) {
        setCustomThreshold(thresholdFromBlynk);

        if (!hasLoadedInitialSettingsRef.current) {
          setThresholdDraft(thresholdFromBlynk);
        }
      }

      if (!hasLoadedInitialSettingsRef.current) {
        setSafeTargetDraft(Number(result.safeTarget) || 25);
        setFanPowerDraft(Number(result.fanPowerW) || 2.16);
        setRoomVolumeDraft(Number(result.roomVolume) || 30);
        setAlertLimitDraft(Number(result.alertLimit) || 20);
        hasLoadedInitialSettingsRef.current = true;
      }

      const reading = {
        time: getCurrentTime(),

        apiHealth: result.apiHealth || "ok",
        warnings: Array.isArray(result.warnings) ? result.warnings : [],

        pm25: Number(result.pm25),
        fanStatus: Number(result.fanStatus),
        modeSelect: Number(result.modeSelect),
        aqi: Number(result.aqi),

        pm25Chart: Number(result.pm25Chart),
        pm25History: Number(result.pm25History),

        customThreshold: isValidThreshold
          ? thresholdFromBlynk
          : customThreshold,

        alertLimit: Number(result.alertLimit),
        filterHealth: Number(result.filterHealth),
        airStatus: result.airStatus || "WAITING",
        systemStatus: result.systemStatus || "Waiting Sensor",
        sensorStatus: result.sensorStatus || "WAITING",

        efficiency: Number(result.efficiency),
        timeToSafe: Number(result.timeToSafe),
        removalRate: Number(result.removalRate),
        safeTarget: Number(result.safeTarget),
        cleaningStatus: result.cleaningStatus || "WAITING",

        energyUsed: Number(result.energyUsed),
        energySaved: Number(result.energySaved),
        fanPowerW: Number(result.fanPowerW),
        roomVolume: Number(result.roomVolume),
        cadrEstimate: Number(result.cadrEstimate),

        pm25Pred5m: Number(result.pm25Pred5m),
        predTrend: result.predTrend || "NO DATA",
        predStatus: result.predStatus || "INSUFFICIENT DATA",
      };

      setLatestStatus(reading);
      setConnectionStatus("Connected");
      setErrorMessage("");

      setData((previousData) => {
        return [...previousData, reading].slice(-MAX_LOG_ROWS);
      });

      if (experimentActiveRef.current) {
        setExperimentData((previousData) => [...previousData, reading]);
      }
    } catch (error) {
      setConnectionStatus("Disconnected");
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchBlynkStatus();
  }, []);

  useEffect(() => {
    if (!isLive) return;

    const intervalId = setInterval(() => {
      fetchBlynkStatus();
    }, 15000);

    return () => clearInterval(intervalId);
  }, [isLive]);

  const currentPM25 = latestStatus?.pm25 ?? 0;
  const currentAQI = latestStatus?.aqi ?? 0;
  const fanStatusText = latestStatus?.fanStatus === 1 ? "ON" : "OFF";
  const modeSelect = latestStatus?.modeSelect;
  const modeText = getModeText(modeSelect);
  const isManualMode = modeSelect === 1;
  const isCustomMode = modeSelect === 2;

  const blynkAlertLimit = latestStatus?.alertLimit ?? 20;
  const blynkFilterHealth = latestStatus?.filterHealth ?? 0;
  const blynkAirStatus = latestStatus?.airStatus ?? "WAITING";
  const blynkSystemStatus = latestStatus?.systemStatus ?? "Waiting Sensor";
  const blynkSensorStatus = latestStatus?.sensorStatus ?? "WAITING";

  const blynkEfficiency = latestStatus?.efficiency ?? 0;
  const blynkTimeToSafe = latestStatus?.timeToSafe ?? 0;
  const blynkRemovalRate = latestStatus?.removalRate ?? 0;
  const blynkSafeTarget = latestStatus?.safeTarget ?? 25;
  const blynkCleaningStatus = latestStatus?.cleaningStatus ?? "WAITING";

  const blynkEnergyUsed = latestStatus?.energyUsed ?? 0;
  const blynkEnergySaved = latestStatus?.energySaved ?? 0;
  const blynkFanPowerW = latestStatus?.fanPowerW ?? 2.16;
  const blynkRoomVolume = latestStatus?.roomVolume ?? 30;
  const blynkCADR = latestStatus?.cadrEstimate ?? 0;

  const blynkPredPM5m = latestStatus?.pm25Pred5m ?? 0;
  const blynkPredTrend = latestStatus?.predTrend ?? "NO DATA";
  const blynkPredStatus = latestStatus?.predStatus ?? "INSUFFICIENT DATA";
  
  const apiHealth = latestStatus?.apiHealth ?? "ok";
  const apiWarnings = latestStatus?.warnings ?? [];

  const initialPM25 = data.length > 0 ? data[0].pm25 : currentPM25;
  const totalReduction = Math.max(initialPM25 - currentPM25, 0);

  const sessionEfficiencyNumber =
    initialPM25 > 0 ? (totalReduction / initialPM25) * 100 : 0;

  const sessionEfficiency = sessionEfficiencyNumber.toFixed(1);
  const airQuality = getAirQuality(currentPM25);

  const averagePM25 = useMemo(() => {
    if (data.length === 0) return "0.0";
    const total = data.reduce((sum, item) => sum + item.pm25, 0);
    return (total / data.length).toFixed(1);
  }, [data]);

  const highestPM25 = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.max(...data.map((item) => item.pm25));
  }, [data]);

  const lowestPM25 = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.min(...data.map((item) => item.pm25));
  }, [data]);

  const trendText = useMemo(() => {
    if (data.length < 2) return "Waiting for more data";

    const previous = data[data.length - 2].pm25;
    const latest = data[data.length - 1].pm25;

    if (latest < previous) return "Improving";
    if (latest > previous) return "Increasing";
    return "Stable";
  }, [data]);

  const systemDecision = useMemo(() => {
    if (modeSelect === 0) {
      return currentPM25 > 20
        ? "Auto Mode recommends Fan ON because PM2.5 is above 20 µg/m³."
        : "Auto Mode can keep Fan OFF because PM2.5 is within the target level.";
    }

    if (modeSelect === 1) {
      return "Manual Mode is active. The user controls Fan ON/OFF directly.";
    }

    if (modeSelect === 2) {
      return currentPM25 > customThreshold
        ? `Custom Mode recommends Fan ON because PM2.5 is above ${customThreshold} µg/m³.`
        : `Custom Mode can keep Fan OFF because PM2.5 is below or equal to ${customThreshold} µg/m³.`;
    }

    return "Waiting for system mode data.";
  }, [modeSelect, currentPM25, customThreshold]);

  const dashboardAlerts = useMemo(() => {
    const alerts = [];

    if (apiHealth === "degraded" || apiWarnings.length > 0) {
      alerts.push({
        title: "Blynk API warning",
        message:
          "Some Blynk values could not be updated, so the dashboard may be using the latest cached data.",
        meta: apiWarnings.slice(0, 2).join(" | ") || "Backend degraded mode",
        color: "#facc15",
        background: "rgba(250, 204, 21, 0.13)",
      });
    }

    if (currentPM25 > blynkAlertLimit) {
      alerts.push({
        title: "High PM2.5 detected",
        message: `Current PM2.5 is ${currentPM25} µg/m³, which is above the alert limit of ${blynkAlertLimit} µg/m³.`,
        meta: "Recommended action: keep purification active and avoid unnecessary exposure.",
        color: "#ef4444",
        background: "rgba(239, 68, 68, 0.16)",
      });
    }

    if (
      typeof blynkPredStatus === "string" &&
      blynkPredStatus.toUpperCase().includes("RISK")
    ) {
      alerts.push({
        title: "Prediction risk",
        message: `The PM2.5 prediction system reports: ${blynkPredStatus}.`,
        meta: `Predicted PM2.5 in 5 minutes: ${formatNumber(
          blynkPredPM5m,
          1
        )} µg/m³`,
        color: "#fb923c",
        background: "rgba(251, 146, 60, 0.15)",
      });
    }

    if (blynkFilterHealth > 0 && blynkFilterHealth <= 30) {
      alerts.push({
        title: "Filter health is low",
        message: `Filter health is currently ${blynkFilterHealth}%.`,
        meta: "Recommended action: inspect or replace the filter soon.",
        color: "#ef4444",
        background: "rgba(239, 68, 68, 0.16)",
      });
    } else if (blynkFilterHealth > 30 && blynkFilterHealth <= 50) {
      alerts.push({
        title: "Filter should be monitored",
        message: `Filter health is currently ${blynkFilterHealth}%.`,
        meta: "The filter is still usable, but maintenance should be planned.",
        color: "#facc15",
        background: "rgba(250, 204, 21, 0.13)",
      });
    }

    if (
      blynkSensorStatus &&
      blynkSensorStatus !== "OK" &&
      blynkSensorStatus !== "WAITING"
    ) {
      alerts.push({
        title: "Sensor status warning",
        message: `PMS5003 sensor status: ${blynkSensorStatus}.`,
        meta: "Check sensor wiring, power, and serial communication.",
        color: "#ef4444",
        background: "rgba(239, 68, 68, 0.16)",
      });
    }

    if (
      blynkSystemStatus &&
      typeof blynkSystemStatus === "string" &&
      blynkSystemStatus.toUpperCase().includes("ERROR")
    ) {
      alerts.push({
        title: "System status error",
        message: `System status: ${blynkSystemStatus}.`,
        meta: "Check Arduino serial monitor and Blynk datastream status.",
        color: "#ef4444",
        background: "rgba(239, 68, 68, 0.16)",
      });
    }

    return alerts;
  }, [
    apiHealth,
    apiWarnings,
    currentPM25,
    blynkAlertLimit,
    blynkPredStatus,
    blynkPredPM5m,
    blynkFilterHealth,
    blynkSensorStatus,
    blynkSystemStatus,
  ]);

  const experimentSummary = useMemo(() => {
    if (experimentData.length === 0) {
      return {
        initial: 0,
        final: 0,
        reduction: 0,
        efficiency: "0.0",
        average: "0.0",
        highest: 0,
        lowest: 0,
        dataPoints: 0,
      };
    }

    const initial = experimentData[0].pm25;
    const final = experimentData[experimentData.length - 1].pm25;
    const reduction = Math.max(initial - final, 0);
    const efficiency =
      initial > 0 ? ((reduction / initial) * 100).toFixed(1) : "0.0";
    const total = experimentData.reduce((sum, item) => sum + item.pm25, 0);
    const highest = Math.max(...experimentData.map((item) => item.pm25));
    const lowest = Math.min(...experimentData.map((item) => item.pm25));

    return {
      initial,
      final,
      reduction,
      efficiency,
      average: (total / experimentData.length).toFixed(1),
      highest,
      lowest,
      dataPoints: experimentData.length,
    };
  }, [experimentData]);

  const judgeSummary = useMemo(() => {
    return `CleverAero is a smart PM2.5 air purification system connected to Blynk and monitored through a custom web dashboard. The current PM2.5 concentration is ${currentPM25} µg/m³, the AQI is ${currentAQI}, the fan status is ${fanStatusText}, and the current operation mode is ${modeText}. The system currently reports ${blynkEfficiency}% cleaning efficiency, an estimated CADR of ${formatNumber(
      blynkCADR,
      1
    )} m³/h, a removal rate of ${formatNumber(
      blynkRemovalRate,
      2
    )} µg/m³/min, and ${formatNumber(
      blynkEnergySaved,
      0
    )}% estimated energy saving compared with an always-on baseline. The predicted PM2.5 value in the next 5 minutes is ${formatNumber(
      blynkPredPM5m,
      1
    )} µg/m³ with the trend classified as ${blynkPredTrend}.`;
  }, [
    currentPM25,
    currentAQI,
    fanStatusText,
    modeText,
    blynkEfficiency,
    blynkCADR,
    blynkRemovalRate,
    blynkEnergySaved,
    blynkPredPM5m,
    blynkPredTrend,
  ]);

  async function updateFan(value) {
    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/blynk/fan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update fan");
      }

      setLatestStatus((previousStatus) => {
        if (!previousStatus) return previousStatus;

      return {
        ...previousStatus,
        fanStatus: value,
      };
    });

await new Promise((resolve) => setTimeout(resolve, 800));
await fetchBlynkStatus({ force: true });

      await fetchBlynkStatus();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function updateMode(value) {
    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/api/blynk/mode`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update mode");
      }

      setLatestStatus((previousStatus) => {
        if (!previousStatus) return previousStatus;

        return {
          ...previousStatus,
          modeSelect: value,
        };
      });

      await new Promise((resolve) => setTimeout(resolve, 800));
      await fetchBlynkStatus({ force: true });

    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function updateThreshold(value) {
    try {
      setIsLoading(true);
      setThresholdStatus("");
      setErrorMessage("");

      const safeValue = Math.max(1, Math.min(300, Number(value)));

      const response = await fetch(`${API_BASE_URL}/api/blynk/threshold`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value: safeValue }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update threshold");
      }

      setCustomThreshold(safeValue);
      setThresholdDraft(safeValue);
      setThresholdStatus(`Saved ${safeValue} µg/m³ to Blynk V7`);

      await fetchBlynkStatus();
    } catch (error) {
      setThresholdStatus("");
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function updateSetting(key, value) {
    try {
      setIsLoading(true);
      setErrorMessage("");
      setSettingStatus("");

      const response = await fetch(`${API_BASE_URL}/api/blynk/setting`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key, value }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update setting");
      }

      setSettingStatus(result.message || "Setting updated");
      await fetchBlynkStatus();
    } catch (error) {
      setSettingStatus("");
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function resetBlynkCounter(type) {
    try {
      setIsLoading(true);
      setErrorMessage("");

      const response = await fetch(`${API_BASE_URL}/api/blynk/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to reset");
      }

      await fetchBlynkStatus();
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  function startExperiment() {
    experimentActiveRef.current = true;
    setExperimentActive(true);
    setExperimentData([]);
    setExperimentStartTime(getCurrentTime());
    setExperimentEndTime(null);

    if (latestStatus) {
      setExperimentData([latestStatus]);
    }
  }

  function endExperiment() {
    experimentActiveRef.current = false;
    setExperimentActive(false);
    setExperimentEndTime(getCurrentTime());
  }

  function resetExperiment() {
    experimentActiveRef.current = false;
    setExperimentActive(false);
    setExperimentData([]);
    setExperimentStartTime(null);
    setExperimentEndTime(null);
  }

  function resetLog() {
    setData([]);
    setCopyStatus("");
  }

  function copyJudgeSummary() {
    navigator.clipboard.writeText(judgeSummary);
    setCopyStatus("Copied summary");
  }

  function exportCSV() {
    const header = [
      "Time",
      "PM2.5",
      "AQI",
      "Fan Status",
      "Mode",
      "Custom Threshold",
      "Filter Health",
      "Cleaning Efficiency",
      "Time to Safe",
      "Removal Rate",
      "Energy Used",
      "Energy Saved",
      "CADR",
      "Predicted PM2.5",
      "Prediction Trend",
      "Prediction Status",
    ];

    const rows = data.map((item) => {
      return [
        item.time,
        `${item.pm25} µg/m³`,
        item.aqi,
        item.fanStatus === 1 ? "ON" : "OFF",
        getModeText(item.modeSelect),
        `${item.customThreshold ?? customThreshold} µg/m³`,
        `${item.filterHealth ?? 0}%`,
        `${item.efficiency ?? 0}%`,
        `${item.timeToSafe ?? 0} min`,
        `${formatNumber(item.removalRate ?? 0, 2)} µg/m³/min`,
        `${formatNumber(item.energyUsed ?? 0, 3)} Wh`,
        `${formatNumber(item.energySaved ?? 0, 0)}%`,
        `${formatNumber(item.cadrEstimate ?? 0, 1)} m³/h`,
        `${formatNumber(item.pm25Pred5m ?? 0, 1)} µg/m³`,
        item.predTrend ?? "NO DATA",
        item.predStatus ?? "INSUFFICIENT DATA",
      ];
    });

    const csvContent = [header, ...rows]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "cleveraero-advanced-dashboard-data.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.topHeader}>
          <div>
            <h1 style={styles.logo}>CleverAero</h1>
            <p style={styles.tagline}>
              A Smart Air Purification System Capable of Predicting and
              Monitoring Its Own Performance for Sustainability
            </p>
          </div>

          <div
            style={{
              ...styles.connectionPill,
              borderColor:
                connectionStatus === "Connected" ? "#86efac" : "#fca5a5",
            }}
          >
            <span
              style={{
                ...styles.statusDot,
                backgroundColor:
                  connectionStatus === "Connected" ? "#22c55e" : "#ef4444",
              }}
            />
            {connectionStatus}
          </div>
        </header>

        <nav style={styles.tabs}>
          {[
            ["overview", "Overview"],
            ["control", "Controlling"],
            ["advanced", "Advanced Data"],
            ["experiment", "Experiment Mode"],
            ["judge", "Judge View"],
          ].map(([key, label]) => (
            <button
              key={key}
              style={{
                ...styles.tabButton,
                ...(activePage === key ? styles.activeTab : {}),
              }}
              onClick={() => setActivePage(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        {errorMessage && (
          <div style={styles.errorBox}>
            <strong>Error:</strong> {errorMessage}
          </div>
        )}

        <AlertCenter alerts={dashboardAlerts} />

        {activePage === "overview" && (
          <main style={styles.content}>
            <section style={styles.heroGrid}>
              <div style={styles.heroCard}>
                <p style={styles.cardLabel}>Current PM2.5</p>
                <h2 style={styles.heroNumber}>{currentPM25}</h2>
                <p style={styles.unit}>µg/m³</p>
                <p style={styles.cardSubtitle}>Real-time value from Blynk V0</p>
              </div>

              <div style={styles.statusPanel}>
                <StatCard
                  title="AQI"
                  value={currentAQI}
                  subtitle="Air quality index from Blynk V4"
                />

                <StatCard
                  title="Air Status"
                  value={blynkAirStatus || airQuality.label}
                  subtitle={airQuality.description}
                  color={airQuality.color}
                />

                <StatCard
                  title="Fan Status"
                  value={fanStatusText}
                  subtitle="Real fan status from Blynk V1"
                  color={fanStatusText === "ON" ? "#22c55e" : "#facc15"}
                />

                <StatCard
                  title="Mode"
                  value={modeText}
                  subtitle="0 Auto / 1 Manual / 2 Custom"
                  color={
                    modeSelect === 0
                      ? "#38bdf8"
                      : modeSelect === 1
                      ? "#c084fc"
                      : "#fb923c"
                  }
                />
              </div>
            </section>

            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>Live PM2.5 Line Graph</h2>
                  <p style={styles.sectionSubtitle}>
                    Readings are fetched from Blynk every 15 seconds through the
                    local backend.
                  </p>
                </div>

                <div style={styles.liveControls}>
                  <button
                    style={styles.smallBlueButton}
                    onClick={() => setIsLive(true)}
                  >
                    Start Live
                  </button>

                  <button
                    style={styles.smallDarkButton}
                    onClick={() => setIsLive(false)}
                  >
                    Pause
                  </button>

                  <button
                    style={styles.smallDarkButton}
                    onClick={fetchBlynkStatus}
                    disabled={isLoading}
                  >
                    Refresh
                  </button>
                </div>
              </div>

              <LineChart data={data} maxPoints={graphPointCount} />

              <div style={styles.graphSliderBox}>
                <div>
                  <p style={styles.cardLabel}>Graph Window</p>
                  <p style={styles.cardSubtitle}>
                    Showing latest {graphPointCount} readings
                  </p>
                </div>

                <input
                  className="tech-slider"
                  style={styles.graphSlider}
                  type="range"
                  min="5"
                  max="80"
                  value={graphPointCount}
                  onChange={(event) =>
                    setGraphPointCount(Number(event.target.value))
                  }
                />
              </div>
            </section>

            <section style={styles.overviewBottomGrid}>
              <MiniInsight
                title="Average PM2.5"
                value={`${averagePM25} µg/m³`}
                description="Average from current session log"
              />

              <MiniInsight
                title="Trend"
                value={trendText}
                description="Compared with the previous reading"
                color={getTrendColor(trendText)}
              />

              <MiniInsight
                title="System Status"
                value={blynkSystemStatus}
                description="Overall Arduino operating status"
              />

              <MiniInsight
                title="Sensor Status"
                value={blynkSensorStatus}
                description="PMS5003 sensor connection status"
                color={blynkSensorStatus === "OK" ? "#22c55e" : "#ef4444"}
              />

              <MiniInsight
                title="Cleaning Status"
                value={blynkCleaningStatus}
                description="Current purification state"
                color={
                  blynkCleaningStatus === "SAFE"
                    ? "#22c55e"
                    : blynkCleaningStatus.includes("CLEANING")
                    ? "#38bdf8"
                    : "#facc15"
                }
              />

              <MiniInsight
                title="Custom Threshold"
                value={`${customThreshold} µg/m³`}
                description="Customized Minimum from Blynk V7"
                color="#38bdf8"
              />
            </section>
          </main>
        )}

        {activePage === "control" && (
          <main style={styles.content}>
            <section style={styles.controlHero}>
              <div>
                <p style={styles.cardLabel}>Current Operation</p>
                <h2 style={styles.controlTitle}>{modeText} Mode</h2>
                <p style={styles.sectionSubtitle}>
                  Fan status: <strong>{fanStatusText}</strong> | PM2.5:{" "}
                  <strong>{currentPM25} µg/m³</strong>
                </p>
              </div>

              <div style={styles.decisionBox}>{systemDecision}</div>
            </section>

            <section style={styles.modeGrid}>
              <button
                style={{
                  ...styles.modeCard,
                  ...(modeSelect === 0 ? styles.selectedModeCard : {}),
                }}
                onClick={() => updateMode(0)}
                disabled={isLoading}
              >
                <span style={styles.modeIcon}>AUTO</span>
                <h3 style={styles.modeTitle}>Auto Mode</h3>
                <p style={styles.modeText}>
                  Arduino automatically controls the fan using the default PM2.5
                  threshold.
                </p>
                <p style={styles.modePin}>Send 0 to V3</p>
              </button>

              <button
                style={{
                  ...styles.modeCard,
                  ...(modeSelect === 1 ? styles.selectedModeCard : {}),
                }}
                onClick={() => updateMode(1)}
                disabled={isLoading}
              >
                <span style={styles.modeIcon}>MANUAL</span>
                <h3 style={styles.modeTitle}>Manual Mode</h3>
                <p style={styles.modeText}>
                  The user directly controls Fan ON/OFF from the dashboard.
                </p>
                <p style={styles.modePin}>Send 1 to V3</p>
              </button>

              <button
                style={{
                  ...styles.modeCard,
                  ...(modeSelect === 2 ? styles.selectedModeCard : {}),
                }}
                onClick={() => updateMode(2)}
                disabled={isLoading}
              >
                <span style={styles.modeIcon}>CUSTOM</span>
                <h3 style={styles.modeTitle}>Custom Mode</h3>
                <p style={styles.modeText}>
                  Uses the Customized Minimum value from Blynk V7.
                </p>
                <p style={styles.modePin}>Send 2 to V3</p>
              </button>
            </section>

            <section style={styles.controlGrid}>
              <div style={styles.panel}>
                <h2 style={styles.sectionTitle}>Fan Control</h2>
                <p style={styles.sectionSubtitle}>
                  Fan ON/OFF is enabled only in Manual Mode.
                </p>

                <div style={styles.fanButtonRow}>
                  <button
                    style={{
                      ...styles.fanButton,
                      backgroundColor: isManualMode ? "#16a34a" : "#64748b",
                      cursor: isManualMode ? "pointer" : "not-allowed",
                      opacity: isManualMode ? 1 : 0.65,
                    }}
                    onClick={() => updateFan(1)}
                    disabled={isLoading || !isManualMode}
                  >
                    Fan ON
                  </button>

                  <button
                    style={{
                      ...styles.fanButton,
                      backgroundColor: isManualMode ? "#dc2626" : "#64748b",
                      cursor: isManualMode ? "pointer" : "not-allowed",
                      opacity: isManualMode ? 1 : 0.65,
                    }}
                    onClick={() => updateFan(0)}
                    disabled={isLoading || !isManualMode}
                  >
                    Fan OFF
                  </button>
                </div>

                <div style={styles.noteBox}>
                  <strong>Why disabled in Auto / Custom Mode?</strong>
                  <br />
                  In Auto or Custom Mode, Arduino controls the fan automatically
                  based on PM2.5 and threshold logic. Manual fan control should
                  only be used in Manual Mode.
                </div>
              </div>

              <div style={styles.panel}>
                <h2 style={styles.sectionTitle}>Custom Threshold</h2>
                <p style={styles.sectionSubtitle}>
                  This value is sent to Blynk V7 and will be used by Arduino
                  when Custom Mode is active.
                </p>

                <div style={styles.thresholdBox}>
                  <div style={styles.thresholdColumn}>
                    <p style={styles.cardLabel}>Saved Threshold</p>
                    <p style={styles.thresholdValue}>{customThreshold}</p>
                    <p style={styles.unit}>µg/m³</p>
                  </div>

                  <div style={styles.thresholdPreviewBox}>
                    <p style={styles.cardLabel}>New Threshold</p>
                    <h3 style={styles.thresholdPreviewValue}>
                      {thresholdDraft} µg/m³
                    </h3>
                    <p style={styles.cardSubtitle}>
                      Adjust the slider, then press Save Threshold.
                    </p>
                  </div>
                </div>

                <input
                  className="tech-slider"
                  style={styles.rangeInput}
                  type="range"
                  min="1"
                  max="300"
                  value={thresholdDraft}
                  onChange={(event) =>
                    setThresholdDraft(Number(event.target.value))
                  }
                />

                <div style={styles.thresholdLabels}>
                  <span>1</span>
                  <span>300</span>
                </div>

                <div style={styles.thresholdActionRow}>
                  <button
                    style={styles.saveThresholdButton}
                    onClick={() => updateThreshold(thresholdDraft)}
                    disabled={isLoading}
                  >
                    Save Threshold to V7
                  </button>

                  <button
                    style={styles.smallDarkButton}
                    onClick={() => setThresholdDraft(customThreshold)}
                    disabled={isLoading}
                  >
                    Reset Draft
                  </button>
                </div>

                {thresholdStatus && (
                  <p style={styles.thresholdStatus}>{thresholdStatus}</p>
                )}
              </div>
            </section>

            <section style={styles.panel}>
              <SectionTitle
                title="Performance Configuration"
                subtitle="Adjust the parameters used by Arduino for safe-air target, energy estimation, and CADR calculation."
              />

              <div style={styles.settingGrid}>
                <SettingControl
                  title="Safe PM Target"
                  subtitle={`Current Blynk V17 value: ${blynkSafeTarget} µg/m³`}
                  value={safeTargetDraft}
                  unit="µg/m³"
                  min={5}
                  max={100}
                  step={1}
                  onChange={setSafeTargetDraft}
                  onSave={() => updateSetting("safeTarget", safeTargetDraft)}
                  disabled={isLoading}
                />

                <SettingControl
                  title="Fan Power"
                  subtitle={`Current Blynk V21 value: ${formatNumber(
                    blynkFanPowerW,
                    2
                  )} W`}
                  value={fanPowerDraft}
                  unit="W"
                  min={0.1}
                  max={50}
                  step={0.1}
                  onChange={setFanPowerDraft}
                  onSave={() => updateSetting("fanPowerW", fanPowerDraft)}
                  disabled={isLoading}
                />

                <SettingControl
                  title="Room Volume"
                  subtitle={`Current Blynk V22 value: ${formatNumber(
                    blynkRoomVolume,
                    1
                  )} m³`}
                  value={roomVolumeDraft}
                  unit="m³"
                  min={5}
                  max={200}
                  step={1}
                  onChange={setRoomVolumeDraft}
                  onSave={() => updateSetting("roomVolume", roomVolumeDraft)}
                  disabled={isLoading}
                />

                <SettingControl
                  title="Alert Limit"
                  subtitle={`Current Blynk V8 value: ${blynkAlertLimit} µg/m³`}
                  value={alertLimitDraft}
                  unit="µg/m³"
                  min={5}
                  max={300}
                  step={1}
                  onChange={setAlertLimitDraft}
                  onSave={() => updateSetting("alertLimit", alertLimitDraft)}
                  disabled={isLoading}
                />
              </div>

              {settingStatus && (
                <p style={styles.thresholdStatus}>{settingStatus}</p>
              )}
            </section>
          </main>
        )}

        {activePage === "advanced" && (
          <main style={styles.content}>
            <section style={styles.categoryPanel}>
              <SectionTitle
                title="Performance"
                subtitle="Cleaning performance metrics calculated by Arduino during a cleaning session."
              />

              <div style={styles.categoryGrid}>
                <MiniInsight
                  title="Cleaning Efficiency"
                  value={`${blynkEfficiency}%`}
                  description="Reduction efficiency from Arduino cleaning session"
                  color="#22c55e"
                />

                <MiniInsight
                  title="CADR Estimate"
                  value={`${formatNumber(blynkCADR, 1)} m³/h`}
                  description="Estimated clean air delivery rate from room model"
                  color="#38bdf8"
                />

                <MiniInsight
                  title="Removal Rate"
                  value={`${formatNumber(blynkRemovalRate, 2)} µg/m³/min`}
                  description="Average PM2.5 removal speed"
                  color="#facc15"
                />

                <MiniInsight
                  title="Time to Safe Air"
                  value={`${blynkTimeToSafe} min`}
                  description="Actual or estimated time to reach safe target"
                />

                <MiniInsight
                  title="Safe Target"
                  value={`${blynkSafeTarget} µg/m³`}
                  description="Target PM2.5 level used by the cleaning algorithm"
                />

                <MiniInsight
                  title="Cleaning Status"
                  value={blynkCleaningStatus}
                  description="Current purification state from Arduino"
                  color={
                    blynkCleaningStatus === "SAFE"
                      ? "#22c55e"
                      : blynkCleaningStatus.includes("CLEANING")
                      ? "#38bdf8"
                      : "#facc15"
                  }
                />
              </div>
            </section>

            <section style={styles.categoryPanel}>
              <SectionTitle
                title="Energy"
                subtitle="Energy estimation and sustainability-related indicators."
              />

              <div style={styles.categoryGrid}>
                <MiniInsight
                  title="Energy Used"
                  value={`${formatNumber(blynkEnergyUsed, 3)} Wh`}
                  description="Estimated energy used in current stats window"
                />

                <MiniInsight
                  title="Energy Saved"
                  value={`${formatNumber(blynkEnergySaved, 0)}%`}
                  description="Energy saving compared with always-on baseline"
                  color="#22c55e"
                />

                <MiniInsight
                  title="Fan Power"
                  value={`${formatNumber(blynkFanPowerW, 2)} W`}
                  description="Fan power setting from Blynk V21"
                />

                <MiniInsight
                  title="Room Volume"
                  value={`${formatNumber(blynkRoomVolume, 1)} m³`}
                  description="Room volume used for CADR estimation"
                />
              </div>
            </section>

            <section style={styles.categoryPanel}>
              <SectionTitle
                title="Prediction"
                subtitle="Short-term PM2.5 prediction calculated from recent sensor history."
              />

              <div style={styles.categoryGrid}>
                <MiniInsight
                  title="Predicted PM2.5"
                  value={`${formatNumber(blynkPredPM5m, 1)} µg/m³`}
                  description="Short-term PM2.5 prediction in 5 minutes"
                  color="#38bdf8"
                />

                <MiniInsight
                  title="Prediction Trend"
                  value={blynkPredTrend}
                  description="Rising, falling, or stable trend prediction"
                  color={getTrendColor(blynkPredTrend)}
                />

                <MiniInsight
                  title="Prediction Status"
                  value={blynkPredStatus}
                  description="Short-term risk status from Arduino"
                  color={
                    blynkPredStatus === "LIKELY SAFE" ||
                    blynkPredStatus === "IMPROVING"
                      ? "#22c55e"
                      : blynkPredStatus.includes("RISK")
                      ? "#ef4444"
                      : "#facc15"
                  }
                />
              </div>
            </section>

            <section style={styles.categoryPanel}>
              <SectionTitle
                title="System Health"
                subtitle="Status values used to verify sensor, filter, fan, and overall system state."
              />

              <div style={styles.categoryGrid}>
                <MiniInsight
                  title="Filter Health"
                  value={`${blynkFilterHealth}%`}
                  description="Remaining filter health based on fan runtime"
                  color={
                    blynkFilterHealth >= 70
                      ? "#22c55e"
                      : blynkFilterHealth >= 40
                      ? "#facc15"
                      : "#ef4444"
                  }
                />

                <MiniInsight
                  title="Sensor Status"
                  value={blynkSensorStatus}
                  description="PMS5003 sensor connection status"
                  color={blynkSensorStatus === "OK" ? "#22c55e" : "#ef4444"}
                />

                <MiniInsight
                  title="System Status"
                  value={blynkSystemStatus}
                  description="Overall operating status from Arduino"
                />

                <MiniInsight
                  title="Alert Limit"
                  value={`${blynkAlertLimit} µg/m³`}
                  description="PM2.5 level used for alert triggering"
                />

                <MiniInsight
                  title="Custom Mode"
                  value={isCustomMode ? "Active" : "Inactive"}
                  description="Shows whether Arduino is using V7 threshold logic"
                  color={isCustomMode ? "#22c55e" : "#facc15"}
                />
              </div>
            </section>

            <section style={styles.panel}>
              <div style={styles.panelHeader}>
                <div>
                  <h2 style={styles.sectionTitle}>
                    Advanced Performance Summary
                  </h2>
                  <p style={styles.sectionSubtitle}>
                    This section contains insights that are more advanced than a
                    typical air purifier display.
                  </p>
                </div>

                <div style={styles.liveControls}>
                  <button style={styles.smallDarkButton} onClick={resetLog}>
                    Reset Log
                  </button>

                  <button
                    style={styles.smallDarkButton}
                    onClick={() => resetBlynkCounter("stats")}
                    disabled={isLoading}
                  >
                    Reset Stats
                  </button>

                  <button
                    style={styles.smallDarkButton}
                    onClick={() => resetBlynkCounter("filter")}
                    disabled={isLoading}
                  >
                    Reset Filter
                  </button>

                  <button style={styles.smallBlueButton} onClick={exportCSV}>
                    Export CSV
                  </button>
                </div>
              </div>

              <div style={styles.summaryTextBox}>
                <p>{judgeSummary}</p>
              </div>

              <button style={styles.copyButton} onClick={copyJudgeSummary}>
                Copy Judge Summary
              </button>

              {copyStatus && (
                <span style={styles.copyStatus}>{copyStatus}</span>
              )}
            </section>

            <section style={styles.panel}>
              <h2 style={styles.sectionTitle}>Blynk Sensor Log</h2>
              <p style={styles.sectionSubtitle}>
                Latest PM2.5, AQI, fan status, operating mode, performance
                metrics, energy data, and prediction status.
              </p>

              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Time</th>
                      <th style={styles.th}>PM2.5</th>
                      <th style={styles.th}>AQI</th>
                      <th style={styles.th}>Fan</th>
                      <th style={styles.th}>Mode</th>
                      <th style={styles.th}>V7 Threshold</th>
                      <th style={styles.th}>Efficiency</th>
                      <th style={styles.th}>CADR</th>
                      <th style={styles.th}>Removal Rate</th>
                      <th style={styles.th}>Energy Saved</th>
                      <th style={styles.th}>Prediction</th>
                    </tr>
                  </thead>

                  <tbody>
                    {[...data].reverse().map((item, index) => {
                      return (
                        <tr key={`${item.time}-${index}`}>
                          <td style={styles.td}>{item.time}</td>
                          <td style={styles.td}>{item.pm25} µg/m³</td>
                          <td style={styles.td}>{item.aqi}</td>
                          <td style={styles.td}>
                            {item.fanStatus === 1 ? "ON" : "OFF"}
                          </td>
                          <td style={styles.td}>
                            {getModeText(item.modeSelect)}
                          </td>
                          <td style={styles.td}>
                            {item.customThreshold ?? customThreshold} µg/m³
                          </td>
                          <td style={styles.td}>{item.efficiency ?? 0}%</td>
                          <td style={styles.td}>
                            {formatNumber(item.cadrEstimate ?? 0, 1)} m³/h
                          </td>
                          <td style={styles.td}>
                            {formatNumber(item.removalRate ?? 0, 2)} µg/m³/min
                          </td>
                          <td style={styles.td}>
                            {formatNumber(item.energySaved ?? 0, 0)}%
                          </td>
                          <td style={styles.td}>
                            {item.predTrend ?? "NO DATA"} /{" "}
                            {item.predStatus ?? "INSUFFICIENT DATA"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        )}

        {activePage === "experiment" && (
          <main style={styles.content}>
            <section style={styles.controlHero}>
              <div>
                <p style={styles.cardLabel}>Experiment Mode</p>
                <h2 style={styles.controlTitle}>
                  {experimentActive ? "Recording" : "Ready"}
                </h2>
                <p style={styles.sectionSubtitle}>
                  Start an experiment, let the dashboard collect readings, then
                  end it to generate a summary.
                </p>
              </div>

              <div style={styles.liveControls}>
                <button
                  style={styles.smallBlueButton}
                  onClick={startExperiment}
                  disabled={experimentActive}
                >
                  Start Experiment
                </button>

                <button
                  style={styles.smallDarkButton}
                  onClick={endExperiment}
                  disabled={!experimentActive}
                >
                  End Experiment
                </button>

                <button style={styles.smallDarkButton} onClick={resetExperiment}>
                  Reset
                </button>
              </div>
            </section>

            <section style={styles.overviewBottomGrid}>
              <MiniInsight
                title="Start Time"
                value={experimentStartTime || "-"}
                description="Time when experiment started"
              />

              <MiniInsight
                title="End Time"
                value={experimentEndTime || "-"}
                description="Time when experiment ended"
              />

              <MiniInsight
                title="Data Points"
                value={experimentSummary.dataPoints}
                description="Readings recorded in this experiment"
              />

              <MiniInsight
                title="Initial PM2.5"
                value={`${experimentSummary.initial} µg/m³`}
                description="First recorded PM2.5 value"
              />

              <MiniInsight
                title="Final PM2.5"
                value={`${experimentSummary.final} µg/m³`}
                description="Latest or final PM2.5 value"
              />

              <MiniInsight
                title="Experiment Efficiency"
                value={`${experimentSummary.efficiency}%`}
                description="Calculated from initial and final PM2.5"
                color="#22c55e"
              />
            </section>

            <section style={styles.panel}>
              <SectionTitle
                title="Experiment Graph"
                subtitle="Line graph based only on readings collected during this experiment."
              />

              <LineChart data={experimentData} maxPoints={80} />
            </section>

            <section style={styles.panel}>
              <SectionTitle
                title="Experiment Auto Summary"
                subtitle="Use this section for reports or presentation explanation."
              />

              <div style={styles.summaryTextBox}>
                <p>
                  CleverAero reduced PM2.5 from {experimentSummary.initial} µg/m³
                  to {experimentSummary.final} µg/m³ during this experiment,
                  achieving an estimated experiment efficiency of{" "}
                  {experimentSummary.efficiency}%. The highest PM2.5 recorded was{" "}
                  {experimentSummary.highest} µg/m³, the lowest was{" "}
                  {experimentSummary.lowest} µg/m³, and the average PM2.5 was{" "}
                  {experimentSummary.average} µg/m³.
                </p>
              </div>
            </section>
          </main>
        )}

        {activePage === "judge" && (
          <main style={styles.judgePage}>
            <section style={styles.judgeHero}>
              <div>
                <p style={styles.cardLabel}>Judge View</p>
                <h2 style={styles.judgeTitle}>CleverAero Insight Dashboard</h2>
                <p style={styles.judgeSubtitle}>
                  Real-time air quality monitoring, intelligent control, energy
                  analytics, CADR estimation, and short-term PM2.5 prediction.
                </p>
              </div>

              <div style={styles.judgePmCard}>
                <p style={styles.cardLabel}>Current PM2.5</p>
                <h3 style={styles.judgePmValue}>{currentPM25}</h3>
                <span>µg/m³</span>
              </div>
            </section>

            <section style={styles.judgeGrid}>
              <MiniInsight
                title="Air Status"
                value={blynkAirStatus}
                description={`AQI ${currentAQI}`}
                color={airQuality.color}
              />

              <MiniInsight
                title="Mode / Fan"
                value={`${modeText} / ${fanStatusText}`}
                description={blynkSystemStatus}
              />

              <MiniInsight
                title="Efficiency"
                value={`${blynkEfficiency}%`}
                description="Arduino cleaning session"
                color="#22c55e"
              />

              <MiniInsight
                title="CADR"
                value={`${formatNumber(blynkCADR, 1)} m³/h`}
                description="Estimated clean air delivery rate"
                color="#38bdf8"
              />

              <MiniInsight
                title="Energy Saved"
                value={`${formatNumber(blynkEnergySaved, 0)}%`}
                description="Compared with always-on baseline"
                color="#22c55e"
              />

              <MiniInsight
                title="Prediction"
                value={blynkPredTrend}
                description={blynkPredStatus}
                color={getTrendColor(blynkPredTrend)}
              />
            </section>

            <section style={styles.panel}>
              <LineChart data={data} maxPoints={graphPointCount} />
            </section>

            <section style={styles.summaryTextBox}>
              <p>{judgeSummary}</p>
            </section>
          </main>
        )}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #092c78 0%, #315ca8 48%, #6aa2ff 100%)",
    color: "#ffffff",
    fontFamily: '"Space Grotesk", Arial, Helvetica, sans-serif',
  },

  shell: {
    width: "90%",
    maxWidth: "1180px",
    margin: "0 auto",
    padding: "32px 0 48px",
  },

  topHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "24px",
    borderBottom: "3px solid rgba(255,255,255,0.95)",
    paddingBottom: "8px",
  },

  logo: {
    margin: 0,
    fontFamily: '"Orbitron", "Space Grotesk", sans-serif',
    fontSize: "38px",
    fontWeight: 800,
    letterSpacing: "0.5px",
  },

  tagline: {
    margin: "2px 0 0",
    maxWidth: "520px",
    fontSize: "14px",
    lineHeight: 1.3,
    fontWeight: 700,
  },

  connectionPill: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "9px 14px",
    border: "1px solid #ffffff",
    borderRadius: "999px",
    backgroundColor: "rgba(255,255,255,0.12)",
    fontWeight: 700,
    fontSize: "13px",
  },

  statusDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
  },

  tabs: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    width: "100%",
    margin: "0 auto 32px",
  },

  tabButton: {
    height: "46px",
    border: "none",
    backgroundColor: "#0058b8",
    color: "#ffffff",
    fontFamily: '"Space Grotesk", Arial, sans-serif',
    fontSize: "14px",
    fontWeight: 700,
    cursor: "pointer",
    transition: "all 0.22s ease",
  },

  activeTab: {
    backgroundColor: "#ffffff",
    color: "#064197",
  },

  content: {
    animation: "fadeIn 0.2s ease",
  },

  errorBox: {
    marginBottom: "18px",
    backgroundColor: "rgba(127, 29, 29, 0.65)",
    border: "1px solid rgba(248, 113, 113, 0.6)",
    borderRadius: "18px",
    padding: "14px",
    color: "#fecaca",
  },

  alertCenter: {
    marginBottom: "18px",
    backgroundColor: "rgba(8, 33, 94, 0.74)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: "24px",
    padding: "18px",
    boxShadow: "0 24px 70px rgba(0,0,0,0.18)",
  },

  alertCenterSafe: {
    marginBottom: "18px",
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    border: "1px solid rgba(134, 239, 172, 0.35)",
    borderRadius: "24px",
    padding: "18px",
    boxShadow: "0 24px 70px rgba(0,0,0,0.12)",
  },

  alertHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    marginBottom: "14px",
  },

  alertTitle: {
    margin: "6px 0 0",
    fontSize: "22px",
    fontWeight: 900,
  },

  alertSafeTitle: {
    margin: "6px 0",
    fontSize: "22px",
    fontWeight: 900,
    color: "#86efac",
  },

  alertCount: {
    width: "38px",
    height: "38px",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    backgroundColor: "#ef4444",
    color: "#ffffff",
    fontWeight: 900,
    boxShadow: "0 0 18px rgba(239, 68, 68, 0.6)",
  },

  alertList: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "12px",
  },

  alertItem: {
    display: "grid",
    gridTemplateColumns: "34px 1fr",
    gap: "12px",
    alignItems: "start",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: "18px",
   padding: "14px",
  },

  alertIcon: {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    display: "grid",
    placeItems: "center",
    color: "#ffffff",
    fontWeight: 900,
  },

  alertItemTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 900,
  },

  alertMessage: {
    margin: "6px 0",
    color: "#ffffff",
    lineHeight: 1.45,
  },

  alertMeta: {
    margin: 0,
    color: "#dbeafe",
    fontSize: "13px",
    lineHeight: 1.4,
  },

  heroGrid: {
    display: "grid",
    gridTemplateColumns: "1.05fr 1.8fr",
    gap: "18px",
    marginBottom: "18px",
  },

  heroCard: {
    backgroundColor: "rgba(8, 33, 94, 0.78)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: "26px",
    padding: "28px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.22)",
  },

  heroNumber: {
    margin: "10px 0 0",
    fontFamily: '"Orbitron", "Space Grotesk", sans-serif',
    fontSize: "86px",
    lineHeight: 0.9,
    fontWeight: 800,
    letterSpacing: "1px",
  },

  unit: {
    margin: "4px 0 0",
    color: "#dbeafe",
    fontSize: "18px",
    fontWeight: 700,
  },

  statusPanel: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "14px",
  },

  statCard: {
    backgroundColor: "rgba(8, 33, 94, 0.72)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: "22px",
    padding: "22px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
    transition: "transform 0.18s ease, border-color 0.18s ease",
  },

  cardLabel: {
    margin: 0,
    color: "#bfdbfe",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "1.2px",
  },

  cardValue: {
    margin: "10px 0 6px",
    fontFamily: '"Space Grotesk", Arial, sans-serif',
    fontSize: "34px",
    fontWeight: 700,
    letterSpacing: "-0.5px",
  },

  cardSubtitle: {
    margin: 0,
    color: "#dbeafe",
    fontSize: "14px",
    lineHeight: 1.4,
  },

  panel: {
    backgroundColor: "rgba(8, 33, 94, 0.74)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: "26px",
    padding: "24px",
    marginBottom: "18px",
    boxShadow: "0 24px 70px rgba(0,0,0,0.2)",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "18px",
  },

  sectionHeadingBlock: {
    marginBottom: "18px",
  },

  sectionTitle: {
    margin: 0,
    fontSize: "24px",
    fontWeight: 900,
  },

  sectionSubtitle: {
    margin: "7px 0 0",
    color: "#dbeafe",
    lineHeight: 1.5,
  },

  liveControls: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  smallBlueButton: {
    border: "none",
    borderRadius: "14px",
    backgroundColor: "#0ea5e9",
    color: "#ffffff",
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  smallDarkButton: {
    border: "none",
    borderRadius: "14px",
    backgroundColor: "rgba(15, 23, 42, 0.72)",
    color: "#ffffff",
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  lineChartWrapper: {
    width: "100%",
    minHeight: "310px",
    marginTop: "18px",
    backgroundColor: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: "22px",
    padding: "14px",
    overflow: "hidden",
  },

  lineChart: {
    width: "100%",
    display: "block",
  },

  graphSliderBox: {
    marginTop: "18px",
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    gap: "18px",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.09)",
    border: "1px solid rgba(255,255,255,0.18)",
    borderRadius: "18px",
    padding: "16px",
  },

  graphSlider: {
    width: "100%",
    accentColor: "#38bdf8",
  },

  overviewBottomGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "18px",
  },

  miniInsight: {
    backgroundColor: "rgba(8, 33, 94, 0.72)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: "22px",
    padding: "22px",
    boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
    transition: "transform 0.18s ease, border-color 0.18s ease",
  },

  miniValue: {
    margin: "10px 0 6px",
    fontSize: "28px",
    fontWeight: 900,
  },

  controlHero: {
    display: "flex",
    justifyContent: "space-between",
    gap: "18px",
    alignItems: "center",
    backgroundColor: "rgba(8, 33, 94, 0.76)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: "26px",
    padding: "26px",
    marginBottom: "18px",
    boxShadow: "0 24px 70px rgba(0,0,0,0.2)",
  },

  controlTitle: {
    margin: "8px 0",
    fontSize: "42px",
    fontWeight: 900,
  },

  decisionBox: {
    maxWidth: "420px",
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: "20px",
    padding: "18px",
    color: "#ffffff",
    fontWeight: 800,
    lineHeight: 1.5,
  },

  modeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "18px",
    marginBottom: "18px",
  },

  modeCard: {
    textAlign: "left",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: "24px",
    backgroundColor: "rgba(8, 33, 94, 0.74)",
    color: "#ffffff",
    padding: "24px",
    cursor: "pointer",
    boxShadow: "0 20px 55px rgba(0,0,0,0.18)",
    transition: "all 0.22s ease",
  },

  selectedModeCard: {
    backgroundColor: "rgba(255,255,255,0.96)",
    color: "#064197",
    border: "2px solid #ffffff",
    transform: "translateY(-2px)",
  },

  modeIcon: {
    display: "inline-block",
    padding: "7px 10px",
    borderRadius: "999px",
    backgroundColor: "rgba(14, 165, 233, 0.22)",
    fontSize: "12px",
    fontWeight: 900,
    marginBottom: "12px",
  },

  modeTitle: {
    margin: "0 0 8px",
    fontSize: "24px",
    fontWeight: 900,
  },

  modeText: {
    margin: 0,
    lineHeight: 1.45,
    fontWeight: 700,
  },

  modePin: {
    margin: "14px 0 0",
    fontSize: "13px",
    fontWeight: 900,
    opacity: 0.8,
  },

  controlGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "18px",
  },

  fanButtonRow: {
    display: "flex",
    gap: "14px",
    marginTop: "22px",
  },

  fanButton: {
    flex: 1,
    border: "none",
    borderRadius: "18px",
    padding: "18px",
    color: "#ffffff",
    fontSize: "18px",
    fontWeight: 900,
    transition: "all 0.2s ease",
  },

  noteBox: {
    marginTop: "18px",
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: "18px",
    padding: "16px",
    lineHeight: 1.5,
  },

  thresholdBox: {
    display: "flex",
    alignItems: "stretch",
    gap: "18px",
    marginTop: "18px",
  },

  thresholdColumn: {
    minWidth: "150px",
  },

  thresholdValue: {
    margin: "8px 0 0",
    fontSize: "64px",
    fontWeight: 900,
  },

  thresholdPreviewBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: "18px",
    padding: "16px",
  },

  thresholdPreviewValue: {
    margin: "8px 0",
    fontSize: "28px",
    fontWeight: 900,
  },

  rangeInput: {
    width: "100%",
    marginTop: "18px",
    accentColor: "#38bdf8",
  },

  thresholdLabels: {
    display: "flex",
    justifyContent: "space-between",
    color: "#dbeafe",
    fontWeight: 800,
  },

  thresholdActionRow: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    marginTop: "18px",
  },

  saveThresholdButton: {
    border: "none",
    borderRadius: "14px",
    backgroundColor: "#0ea5e9",
    color: "#ffffff",
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  thresholdStatus: {
    color: "#bbf7d0",
    fontWeight: 900,
    marginTop: "12px",
  },

  settingGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
  },

  settingCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.22)",
    borderRadius: "20px",
    padding: "18px",
  },

  settingValue: {
    margin: "10px 0 4px",
    fontSize: "30px",
    fontWeight: 900,
  },

  settingUnit: {
    fontSize: "15px",
    color: "#dbeafe",
  },

  settingFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "10px",
    marginTop: "10px",
    fontWeight: 800,
    color: "#dbeafe",
  },

  categoryPanel: {
    backgroundColor: "rgba(8, 33, 94, 0.74)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: "26px",
    padding: "24px",
    marginBottom: "18px",
    boxShadow: "0 24px 70px rgba(0,0,0,0.2)",
  },

  categoryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "18px",
  },

  summaryTextBox: {
    marginTop: "18px",
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: "20px",
    padding: "18px",
    lineHeight: 1.7,
  },

  copyButton: {
    marginTop: "14px",
    border: "none",
    borderRadius: "14px",
    backgroundColor: "#0ea5e9",
    color: "#ffffff",
    padding: "12px 16px",
    fontWeight: 900,
    cursor: "pointer",
    transition: "all 0.2s ease",
  },

  copyStatus: {
    marginLeft: "12px",
    color: "#bbf7d0",
    fontWeight: 900,
  },

  tableWrapper: {
    marginTop: "18px",
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: "1180px",
  },

  th: {
    textAlign: "left",
    padding: "14px",
    color: "#ffffff",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderBottom: "1px solid rgba(255,255,255,0.25)",
  },

  td: {
    padding: "14px",
    color: "#eaf2ff",
    borderBottom: "1px solid rgba(255,255,255,0.12)",
  },

  judgePage: {
    animation: "fadeIn 0.2s ease",
  },

  judgeHero: {
    display: "grid",
    gridTemplateColumns: "1.8fr 0.9fr",
    gap: "18px",
    backgroundColor: "rgba(8, 33, 94, 0.78)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: "30px",
    padding: "30px",
    marginBottom: "18px",
    boxShadow: "0 28px 80px rgba(0,0,0,0.24)",
  },

  judgeTitle: {
    margin: "8px 0",
    fontSize: "46px",
    fontWeight: 900,
  },

  judgeSubtitle: {
    maxWidth: "680px",
    color: "#dbeafe",
    lineHeight: 1.6,
    fontSize: "17px",
  },

  judgePmCard: {
    backgroundColor: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: "24px",
    padding: "24px",
    textAlign: "center",
  },

  judgePmValue: {
    margin: "10px 0",
    fontSize: "78px",
    fontWeight: 900,
  },

  judgeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "18px",
    marginBottom: "18px",
  },
};

export default App;
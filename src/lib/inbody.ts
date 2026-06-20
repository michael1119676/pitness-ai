import type { BodyComposition, InBodyTrendSummary } from "@/lib/daily-types";

type CsvRow = Record<string, string>;

const headerAliases = {
  date: ["날짜", "측정일", "측정일시", "검사일", "검사일시", "date", "test date", "measurement date", "measured at", "datetime"],
  device: ["측정장비", "장비", "device", "model", "machine"],
  weightKg: ["체중(kg)", "체중", "weight", "weight(kg)", "weight [kg]"],
  skeletalMuscleMassKg: [
    "골격근량(kg)",
    "골격근량",
    "skeletal muscle mass",
    "skeletal muscle mass(kg)",
    "smm",
    "smm(kg)"
  ],
  muscleMassKg: ["근육량(kg)", "근육량", "muscle mass", "muscle mass(kg)", "soft lean mass"],
  bodyFatMassKg: ["체지방량(kg)", "체지방량", "body fat mass", "body fat mass(kg)", "bfm", "fat mass"],
  bmi: ["bmi(kg/m²)", "bmi(kg/m2)", "bmi"],
  bodyFatPercentage: ["체지방률(%)", "체지방률", "percent body fat", "body fat percentage", "body fat %", "pbf", "pbf(%)"],
  basalMetabolicRateKcal: ["기초대사량(kcal)", "기초대사량", "basal metabolic rate", "bmr", "bmr(kcal)"],
  inBodyScore: ["인바디점수", "인바디 점수", "inbody score", "score"],
  rightArmMuscleKg: ["오른팔 근육량(kg)", "오른팔근육량", "right arm muscle", "right arm muscle mass"],
  leftArmMuscleKg: ["왼팔 근육량(kg)", "왼팔근육량", "left arm muscle", "left arm muscle mass"],
  trunkMuscleKg: ["몸통 근육량(kg)", "몸통근육량", "trunk muscle", "trunk muscle mass"],
  rightLegMuscleKg: ["오른다리 근육량(kg)", "오른다리근육량", "right leg muscle", "right leg muscle mass"],
  leftLegMuscleKg: ["왼다리 근육량(kg)", "왼다리근육량", "left leg muscle", "left leg muscle mass"],
  totalBodyWaterL: ["체수분(l)", "체수분", "total body water", "tbw", "tbw(l)"],
  intracellularWaterL: ["세포내수분(l)", "세포내수분", "intracellular water", "icw", "icw(l)"],
  extracellularWaterL: ["세포외수분(l)", "세포외수분", "extracellular water", "ecw", "ecw(l)"],
  extracellularWaterRatio: ["세포외수분비", "ecw/tbw", "ecw ratio", "extracellular water ratio"],
  waistCircumferenceCm: ["허리둘레(cm)", "허리둘레", "waist circumference", "waist"],
  visceralFatAreaCm2: ["내장지방단면적(cm²)", "내장지방단면적(cm2)", "visceral fat area", "vfa"],
  visceralFatLevel: ["내장지방레벨(level)", "내장지방레벨", "visceral fat level", "vfl"]
} as const;

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, "");
}

function normalizeHeader(value: string) {
  return stripBom(value)
    .trim()
    .toLowerCase()
    .replace(/[＿_]/g, "")
    .replace(/\s+/g, "")
    .replace(/[［\[\]］]/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/㎏/g, "kg")
    .replace(/ℓ/g, "l");
}

function splitCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function hasHeader(cells: string[], aliases: readonly string[]) {
  const normalizedCells = new Set(cells.map(normalizeHeader));
  return aliases.some((alias) => normalizedCells.has(normalizeHeader(alias)));
}

function looksLikeHeader(cells: string[]) {
  const hasDate = hasHeader(cells, headerAliases.date);
  const hasBodyMetric =
    hasHeader(cells, headerAliases.weightKg) ||
    hasHeader(cells, headerAliases.skeletalMuscleMassKg) ||
    hasHeader(cells, headerAliases.bodyFatMassKg) ||
    hasHeader(cells, headerAliases.bodyFatPercentage);
  return hasDate && hasBodyMetric;
}

function parseCsv(text: string): CsvRow[] {
  const lines = stripBom(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const parsedLines = lines.map(splitCsvLine);
  const headerIndex = parsedLines.findIndex(looksLikeHeader);
  if (headerIndex === -1 || headerIndex === parsedLines.length - 1) return [];

  const headers = parsedLines[headerIndex].map(stripBom);
  return parsedLines.slice(headerIndex + 1).map((cells) => {
    return headers.reduce<CsvRow>((row, header, index) => {
      const cell = cells[index] ?? "";
      row[header] = cell;
      row[normalizeHeader(header)] = cell;
      return row;
    }, {});
  });
}

export function parseInBodyDate(value: string) {
  const raw = value.trim();
  if (!raw) return "";

  const compact = raw.replace(/\D/g, "");
  if (/^\d{8}(\d{4}|\d{6})?$/.test(compact)) {
    const year = compact.slice(0, 4);
    const month = compact.slice(4, 6);
    const day = compact.slice(6, 8);
    const hour = compact.slice(8, 10) || "00";
    const minute = compact.slice(10, 12) || "00";
    const second = compact.slice(12, 14) || "00";
    return formatInBodyDate(year, month, day, hour, minute, second);
  }

  const matched = raw.match(
    /(\d{4})\D+(\d{1,2})\D+(\d{1,2})(?:\D+(\d{1,2})\D+(\d{1,2})(?:\D+(\d{1,2}))?)?/
  );
  if (!matched) return "";

  const [, year, month, day, hour = "00", minute = "00", second = "00"] = matched;
  return formatInBodyDate(year, month, day, hour, minute, second);
}

function formatInBodyDate(
  year: string,
  month: string,
  day: string,
  hour: string,
  minute: string,
  second: string
) {
  const dateParts = [year, month, day, hour, minute, second].map(Number);
  if (dateParts.some((part) => !Number.isFinite(part))) return "";
  const [, monthNumber, dayNumber, hourNumber, minuteNumber, secondNumber] = dateParts;
  if (
    monthNumber < 1 ||
    monthNumber > 12 ||
    dayNumber < 1 ||
    dayNumber > 31 ||
    hourNumber > 23 ||
    minuteNumber > 59 ||
    secondNumber > 59
  ) {
    return "";
  }

  const monthPadded = month.padStart(2, "0");
  const dayPadded = day.padStart(2, "0");
  const hourPadded = hour.padStart(2, "0");
  const minutePadded = minute.padStart(2, "0");
  const secondPadded = second.padStart(2, "0");
  return `${year}-${monthPadded}-${dayPadded}T${hourPadded}:${minutePadded}:${secondPadded}+09:00`;
}

export function normalizeInBodyValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-") return null;
  const matched = trimmed.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/);
  if (!matched) return null;
  const normalized = Number(matched[0]);
  return Number.isFinite(normalized) ? normalized : null;
}

function cell(row: CsvRow, aliases: readonly string[]) {
  for (const alias of aliases) {
    const direct = row[alias];
    if (direct !== undefined) return direct;
    const normalized = row[normalizeHeader(alias)];
    if (normalized !== undefined) return normalized;
  }
  return "";
}

function value(row: CsvRow, aliases: readonly string[]) {
  return normalizeInBodyValue(cell(row, aliases));
}

export function mapInBodyRowToBodyComposition(row: CsvRow): BodyComposition | null {
  const measuredAt = parseInBodyDate(cell(row, headerAliases.date));
  if (!measuredAt) return null;

  return {
    measuredAt,
    device: cell(row, headerAliases.device) || null,
    weightKg: value(row, headerAliases.weightKg),
    skeletalMuscleMassKg: value(row, headerAliases.skeletalMuscleMassKg),
    muscleMassKg: value(row, headerAliases.muscleMassKg),
    bodyFatMassKg: value(row, headerAliases.bodyFatMassKg),
    bmi: value(row, headerAliases.bmi),
    bodyFatPercentage: value(row, headerAliases.bodyFatPercentage),
    basalMetabolicRateKcal: value(row, headerAliases.basalMetabolicRateKcal),
    inBodyScore: value(row, headerAliases.inBodyScore),
    rightArmMuscleKg: value(row, headerAliases.rightArmMuscleKg),
    leftArmMuscleKg: value(row, headerAliases.leftArmMuscleKg),
    trunkMuscleKg: value(row, headerAliases.trunkMuscleKg),
    rightLegMuscleKg: value(row, headerAliases.rightLegMuscleKg),
    leftLegMuscleKg: value(row, headerAliases.leftLegMuscleKg),
    totalBodyWaterL: value(row, headerAliases.totalBodyWaterL),
    intracellularWaterL: value(row, headerAliases.intracellularWaterL),
    extracellularWaterL: value(row, headerAliases.extracellularWaterL),
    extracellularWaterRatio: value(row, headerAliases.extracellularWaterRatio),
    waistCircumferenceCm: value(row, headerAliases.waistCircumferenceCm),
    visceralFatAreaCm2: value(row, headerAliases.visceralFatAreaCm2),
    visceralFatLevel: value(row, headerAliases.visceralFatLevel),
    raw: row
  };
}

export function parseInBodyCsv(text: string) {
  const rows = parseCsv(text);
  const records: BodyComposition[] = [];
  const failedRows: number[] = [];

  rows.forEach((row, index) => {
    const mapped = mapInBodyRowToBodyComposition(row);
    if (mapped) {
      records.push(mapped);
    } else {
      failedRows.push(index + 2);
    }
  });

  return { records, failedRows };
}

export function upsertBodyCompositions(existing: BodyComposition[], incoming: BodyComposition[]) {
  const byMeasuredAt = new Map(existing.map((record) => [record.measuredAt, record]));
  let inserted = 0;
  let duplicate = 0;

  incoming.forEach((record) => {
    if (byMeasuredAt.has(record.measuredAt)) {
      duplicate += 1;
    } else {
      byMeasuredAt.set(record.measuredAt, record);
      inserted += 1;
    }
  });

  return {
    records: Array.from(byMeasuredAt.values()).sort((a, b) =>
      a.measuredAt.localeCompare(b.measuredAt)
    ),
    inserted,
    duplicate
  };
}

function average(values: Array<number | null>) {
  const valid = values.filter((item): item is number => item !== null);
  if (valid.length === 0) return null;
  return valid.reduce((sum, item) => sum + item, 0) / valid.length;
}

function diff(latest: number | null, previous: number | null) {
  if (latest === null || previous === null) return null;
  return Math.round((latest - previous) * 100) / 100;
}

export function getInBodyTrendSummary(records: BodyComposition[]): InBodyTrendSummary {
  const sorted = [...records].sort((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const latest = sorted.at(-1) ?? null;
  const previous = sorted.at(-2) ?? null;
  const recent = sorted.slice(-12);
  const recordCount = sorted.length;
  const status = recordCount >= 3 ? "ok" : "insufficient_data";
  const confidence = recordCount >= 8 ? "high" : recordCount >= 3 ? "medium" : "low";

  const armMuscleImbalanceKg =
    latest?.rightArmMuscleKg !== null &&
    latest?.rightArmMuscleKg !== undefined &&
    latest.leftArmMuscleKg !== null
      ? Math.round(Math.abs(latest.rightArmMuscleKg - latest.leftArmMuscleKg) * 100) / 100
      : null;

  const legMuscleImbalanceKg =
    latest?.rightLegMuscleKg !== null &&
    latest?.rightLegMuscleKg !== undefined &&
    latest.leftLegMuscleKg !== null
      ? Math.round(Math.abs(latest.rightLegMuscleKg - latest.leftLegMuscleKg) * 100) / 100
      : null;

  const summary =
    status === "insufficient_data"
      ? ["인바디 기록이 부족해 2~4주 추세 판단은 보류합니다."]
      : [
          "최근 여러 기록의 평균과 최신 변화를 함께 봅니다.",
          "세부 부위 선택은 인바디 단일 값이 아니라 목표와 운동 볼륨을 우선합니다."
        ];

  return {
    status,
    recordCount,
    latest,
    previous,
    confidence,
    weightChangeKg: diff(latest?.weightKg ?? null, previous?.weightKg ?? null),
    skeletalMuscleMassChangeKg: diff(
      latest?.skeletalMuscleMassKg ?? null,
      previous?.skeletalMuscleMassKg ?? null
    ),
    bodyFatMassChangeKg: diff(latest?.bodyFatMassKg ?? null, previous?.bodyFatMassKg ?? null),
    bodyFatPercentageChange: diff(
      latest?.bodyFatPercentage ?? null,
      previous?.bodyFatPercentage ?? null
    ),
    fourWeekAverages: {
      weightKg: average(recent.map((record) => record.weightKg)),
      skeletalMuscleMassKg: average(recent.map((record) => record.skeletalMuscleMassKg)),
      bodyFatMassKg: average(recent.map((record) => record.bodyFatMassKg)),
      bodyFatPercentage: average(recent.map((record) => record.bodyFatPercentage))
    },
    armMuscleImbalanceKg,
    legMuscleImbalanceKg,
    hydrationNote:
      latest?.extracellularWaterRatio === null || latest?.extracellularWaterRatio === undefined
        ? "수분 지표가 없어 해석하지 않았습니다."
        : "수분 지표는 운동 부위 결정의 보조 정보로만 사용합니다.",
    summary
  };
}

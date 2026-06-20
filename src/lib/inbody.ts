import type { BodyComposition, InBodyTrendSummary } from "@/lib/daily-types";

type CsvRow = Record<string, string>;

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, "");
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

function parseCsv(text: string): CsvRow[] {
  const lines = stripBom(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]).map(stripBom);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return headers.reduce<CsvRow>((row, header, index) => {
      row[header] = cells[index] ?? "";
      return row;
    }, {});
  });
}

export function parseInBodyDate(value: string) {
  const compact = value.trim();
  if (!/^\d{14}$/.test(compact)) return "";
  const year = compact.slice(0, 4);
  const month = compact.slice(4, 6);
  const day = compact.slice(6, 8);
  const hour = compact.slice(8, 10);
  const minute = compact.slice(10, 12);
  const second = compact.slice(12, 14);
  return `${year}-${month}-${day}T${hour}:${minute}:${second}+09:00`;
}

export function normalizeInBodyValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-") return null;
  const normalized = Number(trimmed.replaceAll(",", ""));
  return Number.isFinite(normalized) ? normalized : null;
}

function value(row: CsvRow, header: string) {
  return normalizeInBodyValue(row[header] ?? "");
}

export function mapInBodyRowToBodyComposition(row: CsvRow): BodyComposition | null {
  const measuredAt = parseInBodyDate(row["날짜"] ?? "");
  if (!measuredAt) return null;

  return {
    measuredAt,
    device: row["측정장비"] || null,
    weightKg: value(row, "체중(kg)"),
    skeletalMuscleMassKg: value(row, "골격근량(kg)"),
    muscleMassKg: value(row, "근육량(kg)"),
    bodyFatMassKg: value(row, "체지방량(kg)"),
    bmi: value(row, "BMI(kg/m²)"),
    bodyFatPercentage: value(row, "체지방률(%)"),
    basalMetabolicRateKcal: value(row, "기초대사량(kcal)"),
    inBodyScore: value(row, "인바디점수"),
    rightArmMuscleKg: value(row, "오른팔 근육량(kg)"),
    leftArmMuscleKg: value(row, "왼팔 근육량(kg)"),
    trunkMuscleKg: value(row, "몸통 근육량(kg)"),
    rightLegMuscleKg: value(row, "오른다리 근육량(kg)"),
    leftLegMuscleKg: value(row, "왼다리 근육량(kg)"),
    totalBodyWaterL: value(row, "체수분(L)"),
    intracellularWaterL: value(row, "세포내수분(L)"),
    extracellularWaterL: value(row, "세포외수분(L)"),
    extracellularWaterRatio: value(row, "세포외수분비"),
    waistCircumferenceCm: value(row, "허리둘레(cm)"),
    visceralFatAreaCm2: value(row, "내장지방단면적(cm²)"),
    visceralFatLevel: value(row, "내장지방레벨(Level)"),
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

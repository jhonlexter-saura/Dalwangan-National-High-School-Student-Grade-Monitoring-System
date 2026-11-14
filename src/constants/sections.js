export const GRADE_SECTIONS = {
  7: [
    "Rizal",
    "Bonifacio",
    "Mabini",
    "Luna",
    "Del Pilar",
    "Aguinaldo",
    "Blue",
    "Gold",
  ],
  8: [
    "Silang",
    "Jacinto",
    "Dagohoy",
    "Lapu-Lapu",
    "Burgos",
    "Roar",
  ],
  9: [
    "Quezon",
    "Osmeña",
    "Roxas",
    "Quirino",
    "Magsaysay",
    "Mona",
    "SHINE",
  ],
  10: [
    "Rizal",
    "Bonifacio",
    "Luna",
    "Lunar",
    "Emerald",
    "Ruby",
    "Diamond",
    "Sapphire",
    "Pearl",
    "Datu Puti",
  ],
  11: [
    "STEM",
    "STEM - A",
    "STEM - B",
    "ABM",
    "HUMSS - A",
    "HUMSS - B",
    "TVL - ICT",
    "TVL - HE",
    "GAS",
  ],
  12: [
    "STEM",
    "STEM - A",
    "STEM - B",
    "ABM",
    "HUMSS - A",
    "HUMSS - B",
    "TVL - ICT",
    "TVL - HE",
    "GAS",
    "Gold",
    "Luna",
  ],
};

export function getSectionsForGrade(gradeLevel, existingClasses = []) {
  if (!gradeLevel) return [];
  const g = String(gradeLevel).replace(/\D/g, "");
  const defaultList = GRADE_SECTIONS[g] || [];

  const extra = (existingClasses || [])
    .filter((c) => String(c?.gradeLevel).replace(/\D/g, "") === g && c?.section)
    .map((c) => c.section.trim());

  return Array.from(new Set([...defaultList, ...extra]));
}

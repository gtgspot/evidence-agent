export const CORE_STATUTORY_GATES = [
  "s 55 relevance",
  "s 56 admissibility of relevant evidence",
  "s 57 provisional relevance",
  "s 59 hearsay",
  "s 76 opinion",
  "s 97 tendency",
  "s 98 coincidence",
  "s 101 prosecution tendency/coincidence in criminal proceedings",
  "s 135 discretionary exclusion",
  "s 137 mandatory exclusion of prejudicial prosecution evidence",
  "s 138 improperly or illegally obtained evidence",
  "s 189 preliminary questions / voir dire",
] as const;

export const ADMISSIBILITY_STATUSES = [
  "admissible on current material",
  "conditionally admissible",
  "limited purpose only",
  "contested",
  "requires foundation",
  "requires notice",
  "requires leave",
  "potential s 135 issue",
  "potential s 137 issue",
  "potential s 138 issue",
  "inadmissible on current material",
] as const;

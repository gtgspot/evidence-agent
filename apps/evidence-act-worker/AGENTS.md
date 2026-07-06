# Evidence Life-Cycle Dashboard Instructions

This project is a Cloudflare Workers + React + Vite dashboard.

The purpose is to manage evidentiary material by:
- registering evidence items;
- mapping each item to facts in issue;
- mapping each item to provisions of the Evidence Act 2008 (Vic);
- identifying admissibility, exclusion, foundation, notice, and continuity issues;
- generating court-ready issue summaries.

Do not describe evidence as finally admissible unless all required checks are complete.
Prefer statuses such as:
- admissible on current material;
- conditionally admissible;
- limited purpose only;
- contested;
- requires foundation;
- requires notice;
- requires leave;
- potential s 135 issue;
- potential s 137 issue;
- potential s 138 issue;
- inadmissible on current material.

Core statutory gates:
- s 55 relevance;
- s 56 admissibility of relevant evidence;
- s 57 provisional relevance;
- s 59 hearsay;
- s 76 opinion;
- s 97 tendency;
- s 98 coincidence;
- s 101 prosecution tendency/coincidence in criminal proceedings;
- s 135 discretionary exclusion;
- s 137 mandatory exclusion of prejudicial prosecution evidence;
- s 138 improperly or illegally obtained evidence;
- s 189 preliminary questions / voir dire.

Build with:
- React;
- TypeScript;
- Tailwind;
- shadcn/ui;
- Cloudflare Workers API;
- D1-compatible schema;
- R2-compatible file references.

Every evidence item must have:
- title;
- source;
- date;
- item type;
- tender purpose;
- linked fact in issue;
- linked statutory rules;
- admissibility status;
- identified defects;
- next action.

## Best Build Order

Build it in this order:

1. Static UI shell
2. Evidence Register table
3. Add Evidence Item form
4. Facts in Issue module
5. Statutory Rule library
6. Evidence-to-fact mapping
7. Evidence-to-section mapping
8. Admissibility validator
9. Defect tracker
10. Timeline
11. Exhibit register
12. Export to Markdown / PDF bundle
13. Cloudflare D1 persistence
14. R2 file storage
15. Authentication

The first useful version does not need file upload. It only needs structured data entry and statutory mapping.

The minimum viable dashboard is:

Evidence item
-> Fact in issue
-> Statutory rule
-> Defect
-> Status
-> Next action

## Statutory Analysis Method

When interpreting or mapping any statutory provision (see
docs/superpowers/2026-07-06-methodology-audit-statutory-interpretation.md
for the audit these rules come from):

1. For any provision that references "prescribed" anything, ALWAYS resolve
   the relevant regulations — the prescribed procedure/device IS the
   compliance standard, and it lives in subordinate instruments, not the Act.
2. Enumerate every external reference in the provision (cross-sections,
   defined terms, delegations) and resolve each one, even if only to note
   its function. An interpretation that stops at the Act text is incomplete.
3. Identify ALL compliance points, not just the most legally interesting
   one. Each independent mandatory requirement is a potential defect.
4. Record version assumptions with every interpretation: Act version,
   regulation version, and date checked. Flag unverified currency as a risk.
5. Distinguish the objective fact (what a device/record shows) from an
   opinion about that fact. Proof of the opinion is not proof of the fact.

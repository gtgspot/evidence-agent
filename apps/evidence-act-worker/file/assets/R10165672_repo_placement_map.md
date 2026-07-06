# R10165672 — Document-to-System Placement Map

**Scope:** Five uploaded documents mapped line-by-line to (a) the Python `evidence_agent` matter database (SQLite, via the CLI), and (b) the Cloudflare `evidence-act-worker` (D1 tables, R2/Vectorize authority corpus, markdown file areas).

**How to read this:** each row gives the source line range, what the content is, and the exact destination table/module/file. Where content belongs in both systems, both are listed. Destinations reference real schema:

- **Python CLI (matter DB):** `artefacts` (classes: Original / Derivative / Analysis / Submission-Ready), `evidence_anchors`, `custody_events`, `linked_issues`, `discovery_requests`, `receipt_checks`, `redaction_schedule`, `hypothesis_nodes`, `chain_views`, `decision_log`
- **Worker (D1):** `matters`, `charges`, `facts_in_issue`, `evidence_items`, `admissibility_reports`, `objections`, `ledger_entries`, `instruments`, `legal_rules`, `rule_edges`, `authority_sources` / `authority_sections` / `authority_chunks` / `authority_links`, `context_files`
- **Worker file areas:** `file/context/case_context.md` (dashboard context panel), `file/assets/*.md` (markdown reference uploads, pre-ingestion)

---

## 0. Whole-document placement (register each file first)

| Document | Python `artefacts.cls` | Worker file area |
|---|---|---|
| Source Integration Note (11 Jun 2026) | **Analysis** | `file/assets/R10165672_Source_Integration_Note_20260611.md` |
| Methodological Audit (expertgradetest1output) | not a case artefact — repo docs (see §2) | `file/assets/` only if you want it queryable; better in repo `docs/` |
| Causal Nexus Architecture | **Analysis** | `file/assets/R10165672_Causal_Nexus_Architecture.md` |
| Integrated Synthesis | **Analysis** | `file/assets/R10165672_Integrated_Synthesis.md` |
| Brief to Counsel | **Submission-Ready** | `file/assets/Brief_to_Counsel_Garrard_County_Court_Appeal.md` |

Register with the new CLI: `evidence-agent ingest --db matter.db --matter R10165672 --source <folder>` then reclassify analyses via `add_artefact` (the ingest default is Original; these five are work product, so Analysis/Submission-Ready via the library API, with `parent_id` pointing at the underlying Original scans).

Matter row (worker): `matters` → id `R10165672`, title "Garrard v Deneka", jurisdiction Victoria, court "County Court (de novo appeal from Magistrates' Court Melbourne)", posture "s 255 CPA appeal, first return 19 June 2026".

---

## 1. Source Integration Note (SRC-14–17) — 73 lines

| Lines | Content | Python destination | Worker destination |
|---|---|---|---|
| 1–5 | Header; dedup note (9 uploads → 4 unique), TIFF masters vs PDF working copies | `artefacts`: TIFFs as **Original**, PDFs as **Derivative** with `parent_id` → TIFF; dedup is exactly `governance.manifest.duplicate_report` | `ledger_entries` (event: sources deduplicated) |
| 8–16 | SRC-14 RASL receipt face: date received 10/6/26, "Funbi", seal S0118696 intact, $250 CARD, contact details | `artefacts` (Original scan) + `evidence_anchors` for each face detail (kind=page, locator=receipt face, quote="seal intact") | `evidence_items`: title "RASL Receipt — independent analysis delivery", source_type document, timestamp 2026-06-10, fact_asserted "defence sample portion sealed/intact at delivery" |
| 13–14 | Certification: seal S0118696 delivered intact | `custody_events` on the defence-portion artefact: event "delivered to RASL, seal intact", actor "T. Garrard / RASL (Funbi)", timestamp 2026-06-10 — this **closes the defence side of the custody spine** | `evidence_items.notes` |
| 18–20 | What it proves (20-month seal continuity; independent analysis pending) | `hypothesis_nodes`: node "defence sample continuity intact"; SRC-14 in `supporting_artefacts` | `admissibility_reports.legal_effect_json` on the RASL item |
| 22–24 | What it leaves open (analyst recognition; 20-month degradation) | `hypothesis_nodes.unknowns` + `next_test` = "obtain RASL method/accreditation docs" | `admissibility_reports.missing_proof_json` |
| 26–29 | Strategic function: s.57B(4) "absence of evidence to the contrary"; asymmetric option; CPA s.50 notice; chase RASL | `chain_views` (defence-chain position for the certificate node); action items → `decision_log` entries on the node | `legal_rules`: RSA s.57B(4) + CPA s.50; `rule_edges`: RASL-result —"displaces"→ s.57B(4); deadline notes → `file/context/case_context.md` action list |
| 33–39 | SRC-15 Notice of Order, Charge 1 (s.18(1)(a)): conviction, $2,500 aggregate, 18-month disqualification eff. 15/05/2026, appeal lodged | `artefacts` (Original) | `charges`: Charge 1, statute RSA, provision 18(1)(a), status "convicted below — under appeal", elements_json incl. sentence detail; notice doc → `evidence_items` |
| 41–45 | SRC-17 Notice of Order, Charge 3 (s.49(1)(h)); register-descriptor mismatch ("FAIL ORAL FLUID TEST" wording) | `artefacts` (Original); mismatch → `hypothesis_nodes` (minor node, claim "register descriptor ≠ charged offence"), `evidence_anchors` quoting descriptor | `charges`: Charge 3 s.49(1)(h) same status; mismatch → `objections` (kind: characterisation risk) |
| 47–52 | SRC-16 Charge 2 (s.49(1)(bb)) STRUCK OUT — withdrawn; certificate now supports only s.49(1)(h) | `artefacts` (Original); charge-architecture point → `hypothesis_nodes.supporting_artefacts` on the Node-5 master node | `charges`: Charge 2 status "struck out — withdrawn"; `facts_in_issue`: "s.57B(4) certificate has no remaining vehicle if s.55E gateway fails" |
| 56–58 | Aggregate sentence structure — partial success unravels whole order | — (submission point) | `matters.posture` note + `case_context.md` |
| 59 | **Stay status unverified — CPA s.264 text not in project knowledge; treat as not stayed** | `discovery_requests`-style tracking doesn't fit (not a disclosure item); track as `hypothesis_nodes.unknowns` + `decision_log` "treat as not stayed until verified" | **`authority_sources` gap**: ingest CPA 2009 Part 6.1 operative text into the authority corpus (currently TOC only). Priority ingest. |
| 60 | Fines Victoria referral live | — | `case_context.md` action list |
| 61 | Custody spine closed both ends; Crown-side gap 09/10 11:52 → 14/10 08:32 remains | `custody_events`: full chain on sample artefact (collection → refrigerator → **GAP** → Lambert → VIFM); the gap is the absent event | `evidence_items.notes` on sample item; `facts_in_issue`: "identity of analysed sample" |
| 63–71 | Action register (5 rows, deadlines) | `decision_log` entries (actor, timestamp, reason) per action | `case_context.md` — the dashboard context panel is the right surface for live deadlines |
| 73 | Epistemic note (lead-to-verify vs holding) | `decision_log.reason` convention | `case_context.md` |

---

## 2. Methodological Audit (expertgradetest1output.md) — 345 lines

This document is two different things stitched together. **Lines 1–120 are not case material at all** — they are agent-methodology findings and belong in the repo as engineering guidance, not in any matter database.

| Lines | Content | Destination |
|---|---|---|
| 1–33 | Run 1 vs Run 2 process comparison table | Repo `docs/` — e.g. `docs/superpowers/plans/` alongside the other agent plans, as a lessons-learned note |
| 36–55 | Flaw 1: premature closure on Act text — "follow delegations to subordinate instruments" | **`apps/evidence-act-worker/AGENTS.md` / `CLAUDE.md`**: add rule "for any provision referencing 'prescribed' anything, always resolve the regulations"; same rule belongs in the analyst prompt contract of `src/evidence_agent/reasoning/engine.py` (the injected-LLM analyst) |
| 57–75 | Flaw 2: confirmation bias in search; bundled-reference approach wins | Same as above — this is the design argument **for** the worker's authority-corpus-in-D1 approach (`authority_sources`/`authority_sections`); cite it in `apps/evidence-act-worker/README.md` rationale |
| 77–98 | Flaw 3: single-issue anchoring; enumerate ALL compliance points | Reasoning-engine guidance (`reasoning/engine.py` analyst contract; `chains.py` runs multi-perspective chains for exactly this reason) |
| 100–119 | Flaw 4: no completeness check; external-reference resolution list for s.55E | The unresolved refs (s.55E(11), (12), (13)–(21), s.59) → worker `authority_links` TODOs + `rule_edges` to create; the method → reasoning-engine guidance |
| **123–345** | **Part 3: expert-grade s.55E interpretation — this IS case/authority material** | ↓ |
| 128–143 | Three-stage pipeline s.55D → s.55E → s.57B → s.49 | `rule_edges`: (s55D)—gateway→(s55E)—produces→(s57B)—proves→(s49(1)(h)); Python: `chain_views` structure for the gateway hypothesis |
| 147–161 | Verbatim s.55E(2), s.55E(4) text (RSA V233) | `authority_sources` (RSA 1986, version 233) + `authority_sections` (citation "s 55E(2)", "s 55E(4)") + `legal_rules` rows; chunks → `authority_chunks` → Vectorize |
| 163–183 | Regs 15(1), 15(2), 16, 17, 18 operative text (Road Safety (General) Regulations 2019 V021), device names | `instruments` row (Regs 2019 V021) + `legal_rules` per regulation + `rule_edges` (s55E(4)—prescribes→Reg 17, s55D—prescribes→Reg 15(1)/16, s55E(8)—prescribes→Reg 15(2), post-collection→Reg 18); device names into `legal_rules.text` |
| 185–190 | ILA 1984 s.35(a)-(b) purposive construction | `instruments` + `legal_rules` (interpretive overlay), `rule_edges` "construes" edges |
| 192–212 | Assumptions 1–3 (V233 vs V234 currency; reg currency; single-provision scope) | Python `hypothesis_nodes.unknowns` / `decision_log`; worker `authority_sources.version` + `version_date` fields exist precisely for this — record V233 and flag verification against V234 |
| 214–248 | Defect 1: s.55E(2)(a) opinion standard, Reading A vs Reading B | Python: one `hypothesis_nodes` row (claim: "gateway opinion must be about what the test indicates"), Reading A/B → `chain_views` (defence/prosecution positions); Worker: `facts_in_issue` ("validity of s.55E(2)(a) opinion") + `objections` |
| 250–264 | Defect 2: mandatory vs directory non-compliance | `hypothesis_nodes.unknowns` ("no case law analysed"); worker `facts_in_issue` |
| 266–276 | Defect 3: device-variant prescription risk | `hypothesis_nodes.next_test` = "prove which device used"; worker `admissibility_reports.missing_proof_json` |
| 278–288 | Defect 4: ss.55E(10)–(22) not analysed | `authority_sections` ingestion TODO + `hypothesis_nodes.unknowns` |
| 290–337 | Best interpretation: 8-step compliance pipeline | Worker: this is the checklist for `assessment.ts` gate logic → encode as `legal_rules.cluster_id` = "s55E-pipeline" with `rule_edges` ordering; Python: the master gateway `hypothesis_nodes.required_legal_elements` |
| 339–345 | What is missing (case law, Charter s.32(1), EM, version check) | `hypothesis_nodes.unknowns` + authority-corpus ingestion queue (`case_context.md` action list) |

---

## 3. Causal Nexus Architecture — 231 lines

The reasoning subsystem (`hypothesis_nodes` / `chain_views` / `decision_log`) was built for exactly this document's structure. Each Flow = one hypothesis node; the "discourse" paragraphs = chain views; Part C = the master node.

| Lines | Content | Python destination | Worker destination |
|---|---|---|---|
| 1–17 | Header + structural proposition (Parts A/B/C) | `artefacts` (Analysis) | `file/assets/`; summary → `case_context.md` "Defence theory" |
| 27–35 | **Flow 1**: pre-intercept targeting (MDT profile, CAD "SUBJECT STOP / PRIORITY 2", dashcam 09:20 vs intercept ~09:25) → opinion contamination | `hypothesis_nodes` F1 (claim: "opinion formed through pre-existing expectation"); CAD report, dashcam, intercept-notes header → `supporting_artefacts`; `evidence_anchors` per timestamp | `evidence_items`: CAD Event Report, dashcam files, MDT/intercept notes header (fact_asserted per line 35's three contradictions); `facts_in_issue`: "routine check vs intelligence-led stop" |
| 41–47 | **Flow 2**: no objective POFT record (BWC redacted 09:24:37–10:15:32; no SOP — prosecution concession; no photo) → gateway unproven | `hypothesis_nodes` F2 = **the master Node-5 node**; redaction row → `redaction_schedule` (timestamp_range "09:24:37–10:15:32", content_type_removed "visual — POFT administration/readout", asserted_basis "law enforcement data security standards", authoriser "SC Deneka (self)", challenge_status "Challenged") | `facts_in_issue`: "what the device objectively displayed" — the keystone issue; `objections`: no-case foundation |
| 53–59 | **Flow 3**: BWC suppression + Ferry statement contradiction (claims activation at intercept; metadata 09:32) — either-horn dilemma | `hypothesis_nodes` F3; Ferry statement in `contrary_artefacts` of its own credibility node; BWC metadata → `evidence_anchors` | `evidence_items`: Ferry statement + Ferry BWC metadata; `objections`: s.138(3)(d)/(e) weighting + Jones v Dunkel |
| 65–71 | **Flow 4**: gateway failure → unlawful detention (~38–50 min), keys retained without power, Charter s.21(3) | `hypothesis_nodes` F4; `linked_issues` (detention artefacts → issue "Charter s21(3) arbitrary detention") | `facts_in_issue`: lawfulness of detention; `legal_rules`: Charter s.21(1)/(3) into authority corpus |
| 77–83 | **Flow 5**: coercive warning (departure from Q.13 pro forma; CCO reference) → involuntary compliance → uncautioned admissions Q.17–Q.21 (caution only at Q.28) | `hypothesis_nodes` F5; intercept notes Q.13/Q.17–21/Q.28 → `evidence_anchors` (kind=question-number) | `evidence_items`: intercept notes proforma; `objections`: EA s.139(1) exclusion of Q.17–21; `legal_rules`: EA s.139 |
| 89–95 | **Flow 6**: reconstruction brief (statements 404/363 days post-offence, no contemporaneous notes) → weight degradation; internal contradictions with objective records | `hypothesis_nodes` F6; statement dates → `evidence_anchors`; Lambert reconstruction → custody-chain weakness note on `custody_events` | `evidence_items.notes` (weight) per statement; `admissibility_reports.counsel_priority` |
| 101–105 | Convergence: all flows meet at "what the POFT device objectively displayed" | `chain_views` linking F1–F6 to the master node (relied_on arrays) | `facts_in_issue` keystone row (already created); `case_context.md` "Key statutory issues" |
| 111–119 | B.1 Prejudice (concrete: can't cross-examine redacted frame, no SOP standard, Ferry corroboration untestable, LEAP refused) | `chain_views` (court-chain position, weaknesses) | `objections.grounds`; LEAP refusal → **`discovery_requests`** row (item_sought "LEAP narrative/MDT logs", result refused, outstanding, prejudice_impact = this paragraph) |
| 121–139 | B.2 Fairness (Charter s.24(1), items a–f) | `chain_views` court-chain | `legal_rules`: Charter s.24(1); submission text → `case_context.md` or keep in the Analysis artefact only |
| 141–149 | B.3 Reasonableness (criminal standard unreachable on officer opinion alone) | `chain_views` | `admissibility_reports.final_status` reasoning for certificate/sample items |
| 155–159 | C.1 foundational proposition (objective record precedes compliance claims) | Master `hypothesis_nodes` claim text, verbatim | `facts_in_issue` (framing row); `case_context.md` defence theory |
| 163–174 | C.2.1 s.55D(1) "indicated" = device function; the four absent records | Anchors already mapped (Flow 2); the textual argument → master node `required_legal_elements` | `legal_rules` s.55D(1) + `rule_edges`; `admissibility_reports.missing_proof_json` on POFT-opinion evidence item |
| 176–180 | C.2.2 "in accordance with s.55E" compliance chain | `rule_edges` s.49(1)(h)—requires→s.55E chain | `assessment.ts` gate order; `facts_in_issue` |
| 182–186 | C.2.3 Reg 23 self-certification vs evidence of compliance; Deneka's formulaic ¶10 | `evidence_anchors` (Deneka email stmt ¶10 quote) | `legal_rules`: Reg 23; `objections`: self-certification challenge |
| 188–192 | C.2.4 authority card "PROVISION" vs statement "TAKING" variance | `hypothesis_nodes` (Ground-5 node); authority card exhibit → `artefacts` Original + anchor | `evidence_items`: authority card (Exhibit 5); `facts_in_issue`: officer authorisation scope |
| 194–213 | C.3–C.4 anchor as principle; standalone operation | Master node claim + `chain_views` (independent-route position) | `case_context.md` |
| 217–227 | Deployment note: Part A = cross-exam/closing framework; sequential remedies (no-case → s.138 → Jones v Dunkel → weight) | `decision_log` (strategy decisions); remedy sequence → `hypothesis_nodes.next_test` on master node | `admissibility_reports.counsel_priority` + `case_context.md` hearing-strategy section |
| 231 | Privilege footer | Keep on every derived artefact (`artefacts.custody_notes`) | Do **not** strip when copying into `file/assets/` |

---

## 4. Integrated Synthesis — 308 lines

| Lines | Content | Python destination | Worker destination |
|---|---|---|---|
| 1–21 | Header, prefatory assessment, the confirmed spine quote | `artefacts` (Analysis); spine quote → master node claim (dup of Causal Nexus — keep one canonical node) | `case_context.md` defence theory (the two-sentence spine) |
| 26–47 | **Precondition chain table, Nodes 1–10** (s.59 stop → s.57B(4) certificate, with status ✅/⚠️/❌) | This is the canonical `hypothesis_nodes` seed: one row per node, `claim` = "what must be established", `supporting_artefacts`/`contrary_artefacts` from the "what the evidence shows" column, status → confidence in `decision_log` | `facts_in_issue` one row per node keyed to `charges` 2/3; the legal-foundation column → `legal_rules` links (`authority_links`) |
| 51–61 | Node 5 prosecution evidence (Deneka ¶6, intercept notes p.5, SOAF — all opinion) | `evidence_anchors` (three quotes, one per document) attached to each Original | `evidence_items` for each (fact_asserted "officer opinion of positive indication"); `admissibility_reports.gate_results_json` noting opinion-only |
| 63–67 | Node 5 absences (unredacted BWC, SOP, photo, test-line record) | `redaction_schedule` (BWC) + `discovery_requests` (SOP request → concession) | `admissibility_reports.missing_proof_json` |
| 69–76 | Manufacturer reading rule (control line / test line semantics); redaction begins at POFT moment | Manufacturer instructions → `artefacts` Original + `evidence_anchors` (reading-rule quote); NB **lines 72–75 here contradict the Brief's Ground 1 wording — see §6 Conflicts** | `evidence_items`: DrugWipe II Twin instructions; reading rule → item.fact_asserted |
| 80–86 | Contest mention concession transcript ("There's no such document") | Transcript → `artefacts` Original; quote → `evidence_anchors` | `evidence_items`: contest mention transcript (6 Jan 2026) |
| 90–130 | Caution/admissions argument: s.59 scope, conversion point, Q.17–21 verbatim with answers, Q.28 caution, s.49(4)/Element 9 trade-off, RSA s.58 | Q&A pairs → `evidence_anchors` on intercept notes; trade-off analysis → `chain_views` (defence chain, weaknesses field holds the Q.21 loss); s.58 → authority link | `objections` (EA s.139, targets Q.17–21); `facts_in_issue`: Element 9 / currency of use; `legal_rules`: RSA s.58, EA s.139, RSA s.49(4) |
| 133–153 | Contamination argument (licence + device same hand) with 4 cross-exam questions | `hypothesis_nodes` (minor node, Vector 1/2); the four questions → `next_test` verbatim | `objections` (device integrity, cumulative); Reg 16(b) → `legal_rules` |
| 156–182 | Charter ss.13/20/21 detention analysis; key retention; deployment sequence | F4 node (already mapped); key-retention → separate `hypothesis_nodes` row (no statutory power identified) | `facts_in_issue`; Charter ss.20/21 → authority corpus |
| 185–203 | Caution trigger doctrine (court-palatable version) | Merge into F5 node — same argument as Part 3, keep one node with two `chain_views` | `objections` ground text |
| 207–229 | Disclosure certificate defects → Node 5 consequence; Arguments A (Jones v Dunkel) / B (no-case) / C (s.138) | D37 email → `artefacts` Original + anchor ("I authorised the redactions"); Arguments A–C → `chain_views` on master node (three court-route positions) | `objections`: three rows (adverse inference / no-case / s.138), each `report_id` → certificate & sample `admissibility_reports` |
| 232–251 | **Consolidated defect register D1–D39 + NEW-1–7** | `linked_issues`: one row per defect — `artefact_id` = source doc, `issue_ref` = "D10", "D37", "NEW-3"… (the table's Source column tells you which artefact); vectors → issue_ref suffix or `hypothesis_nodes` linkage | `objections` for the hearing-actionable ones; the register as a whole → `file/assets/` (it is an analysis grid, not raw data) |
| 255–265 | Two-sentence opener + legitimacy frame | Master node `claim` (already); verbatim text → `decision_log` (adopted strategy) | `case_context.md` — top of Defence theory |
| 269–289 | Sequential remedy architecture Steps 1–4 with grounds | `chain_views` per remedy (court chain, position field); Step grounds text stays in the Analysis artefact | `admissibility_reports.counsel_priority` ordering; `case_context.md` hearing plan |
| 293–304 | Digitisation certificate (counts, flags, hearing date) | `governance.manifest.export_manifest` reproduces this — don't hand-store; verify counts against manifest | `ledger_entries` (synthesis produced, defect counts) |
| 308 | Disclaimer ("verify statutory references") | `decision_log` convention | Footer stays in asset file |

---

## 5. Brief to Counsel — 277 lines

| Lines | Content | Python destination | Worker destination |
|---|---|---|---|
| 1–24 | Court, parties, case numbers, return date 19 Jun 2026, DOB/address/contact | `artefacts` (**Submission-Ready**, parent = the analyses) | `matters` row fields (court, posture); parties/contact → `case_context.md`. **PII note:** DOB/address/phone should live only in the matter DB / private context, never in repo-committed markdown |
| 27–34 | Nature of brief (s 255 CPA, self-represented below) | — | `matters.posture`; CPA s.255 → authority corpus |
| 37–53 | Charges table + outcomes below + sentence detail (18 mo / 6 mo consecutive from 15 Sep 2026, Count 2 alternative status TBC) | — | `charges` rows (update Charge 2 with "alternative to Count 3 — confirm status from record" note; sentence into elements_json) |
| 56–61 | Appeal lodged (CP112-11), undertaking executed, return date | Appeal form → `artefacts` Original (Tab A) | `matters` fields; date → `case_context.md` deadlines |
| 64–70 | Witnesses Deneka (45089) & Ferry (44781) | — | `evidence_items.tendering_party` = prosecution on their statements; witness list → `case_context.md` |
| 73–88 | Factual narrative (timeline 09:24–11:52, sample S0118696 / bag T300511170, Lambert 14 Oct, Chu analysis 15 Oct, s 84(1) certificate, 63-day-late brief) | Timeline events → `custody_events` on the sample artefact (each timestamped step); S0118696/T300511170 identifiers → artefact `metadata` | `evidence_items` per narrative step; timeline feeds the dashboard timeline module |
| 95–113 | **Ground 1** — s 55D precondition failure; device reading rule; BWC gap (Deneka starts 09:32; Ferry redacted 09:24:37–10:15:32); Collins "I imagine" concession; Batth "no such document"; s 138 consequence | Master Node-5 node (`hypothesis_nodes`) — Ground 1 is its Submission-Ready expression; each cited exhibit → `evidence_anchors`. **Reading-rule wording here conflicts with Integrated Synthesis — see §6** | `facts_in_issue` + `objections` (s 138) + `admissibility_reports` on SOFT/VIFM items; authorities line 113 → `authority_links` |
| 117–129 | **Ground 2** — Count 1 residency exemption (reg 12/13(1)(a)); s 84(1) certificate silent on residency; Deneka ¶15 bare assertion; BWC 09:49 "all good" | New `hypothesis_nodes` (claim: "prosecution cannot negative reg 12 exemption"); BWC 09:49 → `evidence_anchors` (timestamp anchor) | `charges` Charge 1 elements_json gains residency element; `facts_in_issue`: "residence > 6 months"; `legal_rules`: Road Safety Drivers Regs 2019 regs 12, 13(1)(a) — **new instrument to ingest** |
| 133–143 | **Ground 3** — custody gap 4 d 20 h (11:52 09/10 → 08:32 14/10); blank continuity proforma p.CD 9; Lambert statement 363 days late | `custody_events`: the two bracketing events; blank proforma → `evidence_anchors` (page CD 9); gap itself → `hypothesis_nodes` (claim: sample identity unproven) | `facts_in_issue`; `evidence_items` (Lambert statement, proforma p.9); `objections` (EA ss 55/135/137) |
| 147–157 | **Ground 4** — defective s 41A certificate; three permitted withholding grounds vs "data security standards"; "I authorised the redactions" | `redaction_schedule` (already seeded from Causal Nexus — Ground 4 is its submission form); s 41A certificate → `artefacts` Original; `receipt_checks` row for the certificate (completeness=0, redactions_present=1) | `objections` (Jones v Dunkel + s 138); CPA s 41A(1)(a)(i)–(iii) → `legal_rules` |
| 161–163 | **Ground 5** — "PROVISION" vs "TAKING" authority variance | Same node as Causal Nexus C.2.4 (one node, two expressions) | `facts_in_issue` (officer authorisation) |
| 167–169 | **Ground 6** — late service (ordered 15 Sep 2025; served 17 Nov 2025, 63 days late; Lambert 46 days late) | **`discovery_requests`** — one row per ordered item: due_date 2025-09-15, response_date actuals, outstanding history; `build_escalation_queue` output = this ground's evidence base. Court order → `artefacts` Original (Tab E) | `evidence_items` (order + certificates); weight point → `admissibility_reports.notes` |
| 173–181 | Sentence grounds 1–4 (CCO-compelled presence, valid QLD licence, hardship, parity) | `hypothesis_nodes` (sentence limb) | `charges` sentence notes; `case_context.md` |
| 184–203 | Instructions to counsel 1–6 + urgent stay advice | Action tracking → `decision_log`; stay question links to CPA s 257/264 unknown (Source Integration Note line 59 — same item, reconcile: Brief says s 257, Note says s 264 → verify both) | `case_context.md` action list with the "urgent" flag |
| 207–219 | Key documents & concessions (Collins email, contest transcript, Deneka email, CAD "SUBJECT STOP", blank proforma, reading rule) | Each → `evidence_anchors` with the quoted concession text | `evidence_items` (one per document) with fact_asserted = the concession |
| **223–252** | **Tab Index A–T with file paths** | This is the ingest work-list: each Tab = `artefacts` Original; run `evidence-agent ingest --db matter.db --matter R10165672 --source <case-folder>` over the case directory and the tab paths resolve to registered artefacts; pending items (transcript, reasons, QLD records) → `discovery_requests` (outstanding=1) | `evidence_items.source_path` = tab path (R2 keys once uploaded to `EVIDENCE_FILES` bucket); pending items → `case_context.md` |
| 255–263 | Video evidence key timestamps table (09:49 "all good"; 09:32 activation; redaction span; 09:20 lights) | **`evidence_anchors`** — this table is literally the anchors schema: kind="video-timestamp", locator=file+timestamp, quote="what it shows" | `evidence_items` per video file; timestamps → item notes/timeline |
| 266–272 | Procedural matters: transcript urgency, s 257 stay, fresh evidence on residency | `discovery_requests` (transcript) + `decision_log` (fresh-evidence decision pending counsel) | `case_context.md` deadlines |
| 276–277 | Prepared by appellant, self-represented | `artefacts.custody_notes` (authorship) | — |

---

## 6. Conflicts the mapping surfaced (resolve before ingest)

1. **DrugWipe reading rule is stated in opposite terms in two documents.** Integrated Synthesis (lines 72–74): control line only = **POSITIVE**, control+test line = **NEGATIVE** (competitive immunoassay). Brief to Counsel (lines 99–102): control line only = **negative**, control+test = **positive**. These cannot both be right, and the entire Node-5 argument turns on it. Check Tab L (the actual manufacturer instructions) before either version is registered as `fact_asserted`; whichever document is wrong needs a corrective `decision_log` entry. (The methodological-audit document at line 29 sides with the Synthesis/competitive-assay version: "control line = negative" is attributed to Run 1's *missing* device knowledge — verify against the primary source.)
2. **Which officer's BWC was redacted differs between documents.** Causal Nexus (lines 41, 53) says **Deneka's** BWC was redacted and Ferry's starts late at 09:32; the Brief (lines 103–105) says **Deneka's** starts at 09:32 and **Ferry's** (starting 09:25) is the redacted one. The Brief's version is internally consistent with the file names in its Tab Q/R and the timestamps table — treat the Brief as authoritative and correct the Causal Nexus node inputs when seeding `hypothesis_nodes`/`redaction_schedule` (authoriser stays Deneka per the 30/31 Oct email either way).
3. **Deneka email date:** 30 October 2025 (Causal Nexus/Synthesis) vs 31 October 2025 (Brief). Fix from the email artefact itself at ingest.
4. **Stay provision:** CPA s 264 (Source Integration Note) vs s 257 (Brief). Ingest both sections into the authority corpus and let the verification action resolve it.
5. **Fine amount:** $2,500 (SRC-15) vs $2,800 (Brief). The Notice of Order is the primary record; verify against the sentence extract.
6. **Two matter phases, one matter ID.** Integrated Synthesis is pre-hearing (Magistrates'), the Brief is the County Court appeal. Keep one `matters`/matter_id (R10165672) and record posture change; hypothesis confidence changes at conviction → `decision_log` entries dated 15 May 2026.

---

## 7. Authority corpus ingestion queue (worker, from all five documents)

Statutes/instruments the documents cite that must exist in `authority_sources`/`legal_rules` for `authority_links` to resolve:

- **RSA 1986 (Vic)** ss 3, 18(1)(a), 49(1)(bb)/(h), 49(4), 55B/55C, 55D, 55E (all 22 subsections), 57B, 58, 59, 84(1) — version 233 recorded, verify 234
- **Road Safety (General) Regulations 2019** regs 15–18, 23 (V021)
- **Road Safety Drivers Regulations 2019** regs 12, 13(1)(a) *(new — Ground 2)*
- **Evidence Act 2008 (Vic)** ss 55, 56, 57, 76, 79, 97, 98, 101, 135, 137, 138, 139, 141, 189
- **Criminal Procedure Act 2009** ss 41A, 45, 50, 254, 255, 257, 264 *(operative text — currently TOC only)*
- **Charter of Human Rights and Responsibilities Act 2006** ss 13, 20, 21, 24(1), 32(1)
- **Interpretation of Legislation Act 1984** ss 35, 45
- **Case law:** *Jones v Dunkel* (1959) 101 CLR 298 (authority_kind: case)

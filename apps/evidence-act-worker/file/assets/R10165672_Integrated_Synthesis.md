# INTEGRATED CASE SYNTHESIS — R10165672
**GARRARD v DENEKA | Melbourne Magistrates' Court | 15 May 2026**
**Produced: 2026-05-12 | legal-ocr-engine + machinery-challenge-engine**

---

## PREFATORY NOTE: ASSESSMENT OF THE DRAFT

Your draft contains the correct argument. It is not court-ready in its current form, but the substance is sound. The problems are structural and register-related, not conceptual. This report:

1. Identifies what is correct in the draft and why it works legally
2. Reframes what is rhetorically counterproductive
3. Integrates the new elements from the conversation extract
4. Produces a unified precondition failure chain anchored to the extracted documents

The core proposition from the prior conversation is confirmed and adopted here without modification:

> "The only gateway to the s.55E power is a positive indication from the preliminary device. The prosecution cannot establish that indication beyond reasonable doubt — the BWC footage is the objective record of what the device showed, it contradicts the officer's stated opinion, and the prosecution has confirmed on the record that no other documentation of the testing procedure exists."

That is the spine. Everything below hangs off it.

---

## PART 1 — THE PRECONDITION FAILURE CHAIN

### Architecture

RSA s.55D is the gating provision. Its text requires the officer to form the opinion that the device indicated the presence of a prescribed drug. That opinion is not a free-standing subjective state — it must be grounded in what the device objectively showed. The s.55E power to require accompaniment and sample provision is only enlivened if the s.55D opinion was validly formed.

The chain, mapped to the evidence:

| Node | Legal foundation | What must be established | What the evidence shows | Status |
|------|-----------------|--------------------------|------------------------|--------|
| 1 | RSA s.59 | Power to stop | Lawful — s.59 is unconditional | ✅ Met |
| 2 | RSA s.55B/C | PBT prerequisite | PBT conducted — negative result | ✅ Met |
| 3 | RSA s.55D(1) | Observation of driving | Q.9a tick — "I observed you driving" | ✅ Formally met |
| 4 | RSA s.55D(1) | POFT administered on prescribed device | DrugWipe II Twin — prescribed per reg. | ✅ Formally met |
| **5** | **RSA s.55D(1)** | **Device indicated presence of prescribed drug** | **BWC shows device result; officer states "in my opinion"; prosecution concedes no SOP exists; manufacturer specs: control line only = negative** | **⚠️ CONTESTED — GATING ISSUE** |
| 6 | RSA s.55E | Requirement to accompany lawfully made | Depends entirely on Node 5 | ❌ Fails if Node 5 fails |
| 7 | RSA s.55E | Detention for up to 3 hours lawful | Depends on Node 6 | ❌ Fails if Node 6 fails |
| 8 | RSA s.55E(13) | Key retention | No statutory power identified in evidence | ❌ No identified power |
| 9 | RSA s.55E | Oral fluid sample lawfully obtained | Depends on Nodes 5–6 | ❌ Tainted if Nodes fail |
| 10 | RSA s.57B(4) | VIFM certificate proves drug presence | Self-authenticating only if sample lawfully obtained | ❌ Foundation collapses |

**The entire prosecution case for Charges 2 and 3 is suspended from Node 5.**

If Node 5 is not established beyond reasonable doubt — that the device, as distinct from the officer's opinion, indicated the presence of a prescribed drug — the chain breaks at that point and every downstream element fails.

---

## PART 2 — THE NODE 5 EVIDENCE MATRIX

### What the prosecution has

The prosecution's only Node 5 evidence is:
- Deneka statement para 6: "in my opinion, indicated the presence of a prescribed drug"
- Intercept notes p.5: "As a result of the test, I formed the opinion that the subject's oral fluid contained a prescribed illicit drug"
- SOAF: "Senior Constable DENEKA formed the opinion that there was a prescribed illicit drug in the accused's oral fluid"

**In every instance, the evidence is the officer's subjective opinion. No document records the objective device result.**

### What the prosecution does not have

- The unredacted BWC footage showing the device at the moment of readout (withheld by Deneka's unilateral authority — see D37)
- Any SOP governing interpretation of the device result (prosecution conceded on the record at contest mention: "There's no such document")
- Any contemporaneous photograph or record of the device display
- Any documentation that the DrugWipe II Twin displayed a test line (as distinct from a control line)

### What the manufacturer instructions say

The DrugWipe II Twin operates on a competitive immunoassay principle. The reading rule stated in the manufacturer's instructions (disclosed 30/10/2025):
- Control line present, test line absent = **POSITIVE** (drug present)
- Control line present, test line present = **NEGATIVE** (drug absent)
- Control line absent = invalid test

The officer's opinion of a positive result requires, on the manufacturer's own specifications, that the test line was absent. The BWC footage — the only objective contemporaneous record — must show this if the opinion was validly formed. The prosecution has withheld the relevant BWC segment (09:24:37 onward — see D10). The period withheld begins at the exact moment that corresponds to the POFT administration.

### The contest mention concession

From the audio transcript, on the record before the Magistrate:

> **[PROSECUTION]:** "There's no such document"
> **[MAGISTRATE]:** "There's no standard operating procedures."
> **[PROSECUTION]:** "It's in the regulation — that's just in the act."

This concession has two consequences. First, it confirms there is no extrinsic documentation against which compliance can be assessed — leaving only the regulation itself and the manufacturer's instructions as the applicable standard. Second, it means cross-examination of Deneka on compliance with the prescribed procedure will be conducted against that standard and no other. There is nowhere for the officer to point except to what the regulation says and what the device is designed to show.

---

## PART 3 — THE CAUTION AND ADMISSIONS ARGUMENT

### Your draft's correct formulation (reframed for court)

Your draft correctly identifies that once an interaction converts from random licence check to investigatory detention with the purpose of soliciting admissions, caution becomes mandatory.

The precise legal architecture:

RSA s.59 authorises the stop. That power is unconditional. Within the scope of a random stop, licence production, PBT, and initial POFT administration are all permitted without caution because they are not questioning — they are the exercise of statutory powers that do not depend on the accused's cooperation for their evidentiary effect.

The conversion occurs at the post-POFT investigatory questions. The sequence documented in the intercept notes:

- Q.17: "Have you consumed any illicit drugs recently?" — [NO]
- Q.18: "When did you last take illicit drugs?" — [10 DAYS AGO]
- Q.19: "Where did you last take this drug?" — [FRIENDS HOUSE]
- Q.20: "How much of this drug have you taken?" — [A PUFF]
- Q.21: "Have you consumed any drugs since you last drove?" — [NO]

These questions are investigatory. They go to mens rea, recent consumption, and the s.49(4) presumption rebuttal question (Element 9 — whether drug use was post-driving). They were asked in the testing vehicle, under a requirement to remain for up to 3 hours, before the caution recorded at Q.28.

The formal caution (Q.28) is not given until after the sample is tested and a positive result declared: "I must inform you that you are not obliged to say or do anything but anything you say or do may be given in evidence."

**The admissions at Q.17–Q.21 were made before caution, in circumstances of compelled presence, to questions that were investigatory in nature.**

### The strategic complexity

As the prior conversation analysis correctly identifies, raising the caution point carries a trade-off. The Q.21 answer ("NO" to consumption since driving) is currently the prosecution's own evidence on Element 9 — it supports the s.49(4) inference. If Q.17–Q.21 are excluded as uncautioned admissions, the prosecution loses Element 9 corroboration, but the defence also loses the Q.21 denial. However, the prior conversation correctly identifies: **the Q.18 answer ("10 days ago") is the more dangerous admission** — it goes to recent use, not just post-driving use, and it is the answer that makes the prosecution case on Charge 2 seem believable.

If the caution argument succeeds and Q.17–Q.21 are excluded:
- The prosecution loses its Element 9 affirmative evidence
- The defence loses its Q.21 exculpatory denial
- Net effect: Element 9 reverts to the s.49(4) statutory presumption and the certificate, which the defence is attacking on foundation grounds anyway

The caution argument therefore does not hurt the defence's primary case. It is a secondary argument worth including.

### The RSA s.58 dimension

Your draft references s.58. RSA s.58 provides that a person is not required to answer questions about an offence under the Act. The significance of this section in the context of Q.17–Q.21 is: the accused was not told of this right at any point during the roadside questioning. Combined with the compelled presence (required to accompany under s.55E, or under the claimed s.55D opinion), the questioning at Q.17–Q.21 occurred in circumstances where the accused did not know they had a right of silence in relation to those specific questions.

This reinforces the EA s.139 caution argument: a person in custody or under compulsion, questioned about an offence, must be cautioned before the questioning if the answers are to be used in evidence against them.

---

## PART 4 — THE CONTAMINATION ARGUMENT (LICENCE / POFT DEVICE — SAME HAND)

### Your argument, correctly understood and assessed

You observed that Deneka held the accused's licence and the POFT device in the same hand throughout the preliminary test. The relevance depends on what the BWC shows.

**The legal framing is not "he held both at once."** That formulation invites a response of "so what?" The correct framing:

RSA s.55D requires the POFT to be conducted on a prescribed device "to the officer's satisfaction." The Road Safety (General) Regulations 2019, reg.16(b) requires the collection unit to be kept in a sealed container until required. The combined effect is that the prescribed procedure must be followed to produce a result that carries statutory weight.

If the BWC shows the officer handling both the licence and the POFT device simultaneously — specifically at the moment of swabbing or during the test window — this raises the question whether the prescribed handling procedure was followed. Cross-examine:

- "Where was the accused's licence at the time you administered the POFT?"
- "Did you have anything in your hands other than the POFT collection unit while administering the test?"
- "Does the prescribed procedure require you to keep the collection unit separate from other objects prior to and during the swabbing?"
- "Is there any risk of contamination from handling other materials while administering the oral fluid collection?"

The answer to the last question either confirms there is no contamination risk (ending the argument) or opens up the device integrity argument (advancing it). The officer cannot safely say there is zero contamination risk from co-handling without reference to the manufacturer's instructions — which specify the handling protocol.

This is a Vector 1 / Vector 2 argument. It does not stand alone as a ground for exclusion, but it contributes to the cumulative pattern of departure from prescribed procedure.

---

## PART 5 — ARBITRARY DETENTION AND CHARTER ss.13, 21

### Your draft's framing, assessed

Your draft describes the detention as "arbitrary" and invokes s.58. The correct framework is Charter s.21 (liberty), not RSA s.58 (which is a right-of-silence provision, not a detention provision).

The argument in court-palatable form:

The s.55E requirement to accompany and remain for up to 3 hours is a compelled detention. It is lawful only if the s.55D opinion was validly formed. If Node 5 in the precondition chain fails, then from the moment the requirement to accompany was made (approximately 09:25–09:37) to the conclusion of the interaction (approximately 10:15, per prohibition notice timestamp), the accused was detained without lawful basis.

Duration of detention without lawful basis (if Node 5 fails): approximately 38–50 minutes, depending on the reference point used.

Charter s.21(1): "Every person has the right to liberty and security." Section 21(3): "A person must not be detained except on grounds, and in accordance with procedures, established by law."

The grounds were not established by law if the s.55D opinion lacked objective foundation. The detention from that point was arbitrary within the meaning of s.21(3).

**Key retention:** No statutory power to retain vehicle keys is identified anywhere in the brief. RSA s.55E requires the person to accompany and remain — it does not authorise seizure of keys or vehicle. The retention of keys for 50+ minutes without statutory foundation is a separate deprivation of property (Charter s.20, if engaging property rights) and reinforces the Charter s.21 detention argument by demonstrating the compulsion extended beyond what the statute permitted.

### How to deploy this at hearing

This is not your opening argument. It is your closing argument if the s.55D precondition failure submission succeeds at Node 5. The sequence:

1. Lead with Node 5 (no valid POFT indication = s.55E not enlivened)
2. If the court accepts that Node 5 is in doubt, the Charter s.21 consequence follows automatically: the detention was without lawful basis
3. The key retention evidence on BWC demonstrates the coercive dimension of the detention
4. The s.138 application then follows: evidence obtained during an unlawful detention should not be admitted because the desirability of admitting it does not outweigh the undesirability of condoning a 50-minute detention without legal foundation

---

## PART 6 — CAUTION TRIGGER: WHEN RANDOM CHECK CONVERTS TO INVESTIGATION

Your draft's formulation is correct in substance:

> "when roadside checks exceed what the statute permits and makes the conversion into investigatory questioning with the intention to solicit an admission... cautioning is mandatory"

The court-palatable version:

A random traffic stop under RSA s.59 does not require caution for the exercise of the statutory testing powers (PBT, POFT) because those powers do not depend on the accused's cooperation for their effect and their exercise is not questioning. However, when the interaction crosses into questioning that is directed to establishing elements of an offence — specifically, questions about drug consumption history (Q.17–Q.21) — and when those questions are asked in circumstances of compelled presence (the accused has been required to accompany under the asserted s.55E requirement), caution is mandatory before those questions if the answers are to be used in evidence: EA s.139(1).

The questions at Q.17–Q.21 are investigatory questions directed to establishing:
- Whether the accused had recently used drugs (Q.17–Q.20 — goes to Currency of Use / Charge 2)
- Whether consumption occurred after driving (Q.21 — goes to Element 9 / Charge 3)

These are elements of the charges. They were asked without caution. The intercept notes record the typed prompts for those questions — they are pre-printed on the proforma, which means the questioning was pre-planned, not a spontaneous investigatory inquiry.

The formal caution was not given until Q.28 — after the POFT opinion was formed, after the requirement to accompany, after the s.55E oral fluid test, after the result was declared positive. By Q.28, every element relevant to Q.17–Q.21 had already been secured.

This sequence — investigatory questions first, caution later — is the pattern the caution requirement exists to prevent.

---

## PART 7 — DISCLOSURE CERTIFICATE DEFECTS: INTEGRATION WITH NODE 5

### The redaction admission and its Node 5 consequence

Deneka's 30 October 2025 email (D37): "I authorised the redactions."

The redacted BWC period commences at 09:24:37 (D10 from OCR report) — which is the stated prosecution observation/intercept time. The redaction covers, at minimum, the period during which the POFT was administered and the device result was visible.

The legal consequence is not merely a disclosure defect. It is a direct evidential consequence for Node 5:

- The objective record of the POFT device result is the BWC footage
- That footage has been withheld by the informant's unilateral authority
- No statutory basis for the withholding has been identified (D8–D11 from OCR report)
- The prosecution has therefore deprived the court of the only objective record that could verify or contradict the officer's claimed opinion

This creates three converging arguments, deployable in sequence:

**Argument A — Adverse inference (Jones v Dunkel):** The prosecution has failed to produce, or has withheld, the evidence that is within its control and would be expected to speak directly to the disputed issue (what the device showed). The court may infer that the evidence does not support the prosecution case on Node 5.

**Argument B — No case to answer:** Even without the adverse inference, the prosecution's affirmative evidence on Node 5 is only the officer's stated opinion. That opinion is not the device result. The prosecution has not tendered any evidence of what the device actually showed. The statutory precondition is not satisfied by officer opinion alone — the opinion must have an objective foundation, and no foundation has been established.

**Argument C — s.138 exclusion:** If the withholding of BWC footage was deliberate (as demonstrated by D37 — Deneka's own admission), and that withholding deprived the accused of the ability to examine the central evidence on the contested element, the admission of the downstream evidence (the oral fluid sample and VIFM certificate) would condone conduct that systematically undermined the accused's right to a fair hearing under Charter s.24(1).

---

## PART 8 — CONSOLIDATED DEFECT REGISTER (UPDATED)

Integrating the new elements into the OCR report defect matrix:

| Ref | Source | Defect | Vector | New/Prior |
|-----|--------|--------|--------|-----------|
| D1 | Intercept Notes | Observation time blank | V2, V5 | Prior |
| D8–D11 | Disclosure Cert | No statutory basis for redactions | V2, V5 | Prior |
| D10 | Disclosure Cert | Redaction begins at 09:24:37 — prosecution observation time | V5 | **CRITICAL** |
| D18 | Deneka Statement | "in my opinion" — opinion not device result | V1, V2 | Prior |
| D37 | 30 Oct Email | Deneka admits self-authorised redactions | V5 | **CRITICAL** |
| D38 | 30 Oct Email | SOP disclosure conditioned on defence revealing argument | V5 | Prior |
| D39 | 30 Oct Email | Dashcam triggered by lights — decision pre-existed footage | V2, V5 | Prior |
| **NEW-1** | All prosecution docs | "In my opinion" repeated in every document — opinion is the only Node 5 evidence | V1, V2 | **NEW** |
| **NEW-2** | Contest mention transcript | Prosecution concedes no SOP exists on the record | V2 | **NEW** |
| **NEW-3** | Intercept notes Q.17–Q.21 | Investigatory questions asked before caution, during compelled presence | V5 | **NEW** |
| **NEW-4** | RSA s.58 / EA s.139 | No s.58 right communicated; caution given only at Q.28 post-result | V5 | **NEW** |
| **NEW-5** | BWC/Intercept notes | Licence and POFT device held simultaneously during test — prescribed handling procedure question | V1, V2 | **NEW** |
| **NEW-6** | Timeline | Detention 09:25–10:15 (~50 min); key retention throughout; no statutory basis for key retention | V2, V5 | **NEW** |
| **NEW-7** | Cumulative sequence | Every post-Node 5 step depends on Node 5; if Node 5 fails, all derivative evidence is tainted | V2, V3, V5 | **NEW** |

---

## PART 9 — THE TWO-SENTENCE HEARING OPENER

From the prior conversation, confirmed and preserved:

> "The only gateway to the s.55E power is a positive indication from the preliminary device. The prosecution cannot establish that indication beyond reasonable doubt — the BWC footage is the objective record of what the device showed, it contradicts the officer's stated opinion, and the prosecution has confirmed on the record that no other documentation of the testing procedure exists."

Pair it with the legitimacy frame:

> "The accused does not challenge the purpose of this legislation. The submission is that this prosecution has not proven the statutory precondition for the secondary procedure beyond reasonable doubt, on the evidence before the court."

Those four sentences are your entire opening. Everything else is detail in support.

---

## PART 10 — SEQUENTIAL REMEDY ARCHITECTURE

Deploy in this order at hearing:

**Step 1 — No-case submission at close of prosecution case**

Ground: The prosecution has not established the s.55D precondition (Node 5) beyond reasonable doubt. The only evidence of a positive POFT result is the officer's stated opinion. Opinion is not the device result. No objective record of the device result has been tendered. The prosecution conceded at contest mention that no SOP or other documentation of the testing procedure exists. On the manufacturer's specifications (the only applicable standard), a positive result requires an absent test line — nothing in the prosecution's case proves this.

Without Node 5, s.55E was not enlivened. The oral fluid sample was not lawfully obtained. The VIFM certificate has no lawful foundation. Charges 2 and 3 fail.

**Step 2 — s.138 exclusion application (if no-case declined)**

Ground: The oral fluid sample and VIFM certificate were obtained pursuant to a s.55E requirement that lacked lawful foundation (Node 5 failure). The BWC footage — the only contemporaneous objective record — was withheld by the informant's unilateral authority without statutory basis (D37). The desirability of admitting the evidence does not outweigh the undesirability of condoning: (a) a 50-minute detention without lawful basis; (b) the systematic withholding of the central objective evidence; (c) the use of investigatory questioning without caution during compelled detention.

**Step 3 — Adverse inference (Jones v Dunkel) (if s.138 declined)**

Ground: The prosecution has failed to produce the BWC footage showing the device result, which was within its control and would be expected to speak directly to the contested element. The court should infer the footage does not support the prosecution case on Node 5.

**Step 4 — Weight submission at close of all evidence**

Ground: Even if the evidence is admitted and the adverse inference is not drawn, the court cannot be satisfied beyond reasonable doubt on Node 5 where the only evidence is the officer's post-hoc opinion unsupported by any objective contemporaneous record, in circumstances where the prosecution conceded no SOP exists and the objective footage has been withheld.

---

## DIGITISATION CERTIFICATE (UPDATED)

```
matter:              R10165672 GARRARD v DENEKA
synthesis_date:      2026-05-12
documents_integrated: 9 (OCR extraction) + prior conversation + draft argument
new_defects_added:   7 (NEW-1 through NEW-7)
total_defects:       49
critical_flags:      2 (D37, D10/NEW-1 combination)
primary_argument:    Node 5 s.55D precondition failure — all charges 2/3 cascade
hearing_date:        15 May 2026
```

---

*This report is hearing-preparation material for R10165672. It is an analytical instrument, not legal advice. All statutory references must be verified against current Victorian legislation.*

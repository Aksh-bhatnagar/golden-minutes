# Golden Minutes: Knowledge Base (facts the assistant may state)

Last compiled: 15 October 2026 from research sources. Re-check every item marked VERIFY before submission. Behaviour rules are in `golden_minutes_rules.md`. If a question is not covered here, the assistant says it does not have reliable information.

## 1. The helpline: 1930
- 1930 is India's national helpline for reporting online financial fraud. Call as soon as possible after money is lost.
- It is part of the national system for reporting financial cyber fraud, set up in 2021 for immediate reporting.
- Calls are handled by the police of the relevant State or Union Territory.
- A call can help place a hold on the money if it is still traceable. It does not reverse a transfer, and recovery is not guaranteed.
- Do not state the operating hours. Sources disagree.
- Sources: https://www.pib.gov.in/PressReleasePage.aspx?PRID=2290377&reg=48&lang=2 ; https://the420.in/cybercrime-helpline-1930-report-fraud-money-recovery-india/
- Status: sourced. Hours: unknown.

## 2. The official portal
- The official National Cyber Crime Reporting Portal is https://cybercrime.gov.in.
- Source: the portal itself.
- Status: sourced.

## 3. What the helpline typically asks for
- Mobile number of the person reporting; the bank, wallet or app the money left from; the account, wallet or UPI ID; the transaction ID and date; the amount; a short description of what happened; screenshots if available.
- A card number is requested only if card details were used. This assistant never collects it.
- Sources: https://cybercrime.gov.in/UploadMedia/instructions_citizenreportingcyberfrauds.pdf ; https://nicobartimes.com/?p=9349
- Status: sourced. We have not heard a real 1930 call, so the real question order may differ.

## 4. After calling 1930
- The caller receives an SMS with an acknowledgement number. Keep it.
- The caller is expected to submit full details on the official portal using that number. Secondary sources say this should be done within 24 hours.
- Sources: https://the420.in/cybercrime-helpline-1930-report-fraud-money-recovery-india/ ; a Canara Bank advisory (April 2023)
- Status: VERIFY the 24-hour timing and the SMS wording on the portal.

## 5. Contact the bank
- Contact your bank or payment app promptly through official channels (the number on your card, the bank's official app or website). Do not use numbers from messages or search results.
- Status: general safety advice, widely repeated in bank advisories.

## 6. Finding the transaction ID
- For UPI, the transaction reference (UTR or RRN) is typically a 12-digit number. Other payment modes, such as NEFT, RTGS and cards, use other formats and lengths.
- Where to look: the payment details in your payment app's history, the SMS from your bank, or your bank statement.
- Code must not reject a transaction ID that is not 12 digits. For UPI, flag a wrong length as `unclear`. For other modes, accept and mark `unclear`.
- Status: VERIFY the formats and the exact steps in the real payment apps.

## 7. Safety messages
- Never share an OTP, UPI PIN, ATM PIN, password or CVV with anyone, including this assistant.
- Fraudsters sometimes contact victims again, posing as recovery agents or officials. Do not pay anyone who says they can recover your money.
- In digital-arrest scams, callers pose as officials, often on video calls, and keep the victim isolated. Do not send money to anyone who demands it to avoid arrest.
- Sources: https://www.thedailyjagran.com/technology/lost-money-to-an-online-scam-immediately-dial-1930-and-follow-these-3-steps-to-report-financial-fraud-10325427 ; https://www.newsbytesapp.com/news/science/india-s-digital-arrest-scam-causes-4-000cr-losses-in-3-years/story
- Status: sourced as reported modus operandi. Keep the wording as advice, not as claims about specific agencies.

## 8. Other numbers (only when out of scope)
- 112: emergency number for immediate danger.
- 1098: child helpline. 181: women's helpline. 1915: national consumer helpline.
- Status: VERIFY 181, 1098 and 1915 on official sites before showing them.

## 9. Terms
- OTP (ओटीपी), UPI PIN (यूपीआई पिन), transaction ID (ट्रांज़ैक्शन आईडी), UPI ID (यूपीआई आईडी), bank (बैंक), complaint (शिकायत), helpline (हेल्पलाइन), acknowledgement number (पावती संख्या).
- Add other languages only after a native speaker reviews them. Do not machine-translate safety wording without review.

## 10. Never state
Operating hours of 1930; recovery chances or timelines; what a specific bank will do; legal outcomes; that a complaint has been filed by this prototype.

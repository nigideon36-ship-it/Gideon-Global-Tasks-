import {
  EastAfricaCountry,
  formatCurrencyFromKes,
  formatCurrencyFromUsd,
  WITHDRAWAL_THRESHOLD_USD,
} from '../lib/eastAfrica';

export type GuideCategoryKey = 'data-work' | 'finance' | 'marketplace';

export interface GuideSection {
  heading: string;
  body: string[];
  example?: {
    label: string;
    good: string;
    avoid: string;
  };
  checklist: string[];
}

export interface GuideArticle {
  id: string;
  legacyIds?: string[];
  title: string;
  subtitle: string;
  category: string;
  categoryKey: GuideCategoryKey;
  readTime: string;
  author: string;
  authorRole: string;
  date: string;
  openingNote: string;
  sections: GuideSection[];
}

export const getEditorialGuides = (country: EastAfricaCountry): GuideArticle[] => {
  const threshold = formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, country);
  const ppvPerView = formatCurrencyFromKes(5, country);

  return [
    {
      id: 'ai-data-annotation-manual',
      title: 'Labeling East African Street Scenes Without Getting Rejected: Matatus, Boda-Bodas & Glare',
      subtitle:
        'A practical field guide for image labelers handling crowded roundabouts, overlapping motorcycles, and rainy twilight frames.',
      category: 'Computer Vision & Annotation',
      categoryKey: 'data-work',
      readTime: '8 min read',
      author: 'Gideon N.',
      authorRole: 'Platform Founder & Quality Editor',
      date: 'Reviewed November 2026',
      openingNote:
        'Most rejected image-annotation submissions do not fail because a worker missed a giant bus in the middle of the frame. They fail on small, predictable edge cases: a boda-boda rider merged into one box with the passenger behind him, a pedestrian half-hidden behind a roadside kiosk, or a loose box stretched out to cover empty tarmac. Here is how to handle the street scenes you will actually see in our labeling queue.',
      sections: [
        {
          heading: '01. Treat Rider and Motorcycle as One Unit—Unless the Instructions Split Them',
          body: [
            'On Nairobi, Kampala, and Kigali road frames, motorcycles weave directly between larger vehicles and footpaths. Before drawing your first box on a frame, check whether the task prompt treats "motorbike + rider" as a single Road User class or asks for separate Rider and Motorcycle boxes.',
            'When a task combines them, extend the top edge of the box to the top of the rider’s helmet and the bottom edge flush with the front and rear tire rubber. Leave out long afternoon shadows stretched across the tarmac—shadows confuse object width models and pull your box precision down.',
            'For matatus, coasters, and saloon cars parked diagonally along a stage, include side mirrors only when they extend clearly outside the body silhouette, and ignore antennae or loose roof tarpaulins that barely show.'
          ],
          example: {
            label: 'Side-by-Side Frame Check: Roundabout Traffic',
            good: 'Box hugs the rear tire, front mudguard, handlebars, and top of the rider’s helmet with roughly 2–3 pixels of margin.',
            avoid: 'Box includes 40 pixels of asphalt shadow to the left of the motorcycle and merges a nearby pedestrian standing on the curb.'
          },
          checklist: [
            'Zoom to at least 150% before placing boxes on distant vehicles smaller than your thumb.',
            'Never group two adjacent pedestrians walking side-by-side inside a single bounding box.',
            'Label partially hidden vehicles if at least 20% of the body (such as a clear wheel and rear fender) is visible.'
          ]
        },
        {
          heading: '02. Handling Rain, Matatu Headlight Glare & Evening Frames',
          body: [
            'Evening clips recorded during rainy weather in Nairobi or Dar es Salaam look smeared around bright LED headlights. Do not draw boxes around light halos or wet road reflections. Anchor your box edges to solid metallic edges—bumpers, license-plate zones, roof rails, and windshields.',
            'If a roadside pedestrian is wearing dark clothes under poor streetlights, look for silhouette contrast against passing headlights rather than guessing shapes in pure black shadow. When an object is genuinely unrecognizable noise, skip labeling it rather than creating false positives.'
          ],
          checklist: [
            'Keep box edges tightly aligned to physical bumpers and roofs, ignoring headlight bloom.',
            'Double-check class labels before submitting—mistaking a tuk-tuk for a standard sedan triggers automated QA flags.',
            'Pace yourself carefully; steady 90%+ accuracy protects access to higher daily queues.'
          ]
        }
      ]
    },
    {
      id: 'consumer-surveys-guide',
      legacyIds: ['market-research-survey-science'],
      title: 'Passing East African Consumer Surveys: Why Rushing Gets You Flagged',
      subtitle:
        'How researchers filter out rushed or copy-pasted replies, and what thoughtful feedback looks like on mobile-money and retail polls.',
      category: 'Market Research & Surveys',
      categoryKey: 'data-work',
      readTime: '7 min read',
      author: 'East Africa Contributors Desk',
      authorRole: 'Survey Moderation Team',
      date: 'Reviewed November 2026',
      openingNote:
        'Market research companies paying for opinions across Kenya, Uganda, Tanzania, and Rwanda are looking for real shopper habits—not one-word filler. A surprisingly high number of newcomers miss out on rewards not because their answers are "wrong," but because they click through five-minute questionnaires in 35 seconds or copy generic text into comment boxes.',
      sections: [
        {
          heading: '01. Why Speed Traps Catch Genuine Contributors',
          body: [
            'Every survey task records the time spent between opening the prompt and submitting your responses. If a questionnaire has twelve multiple-choice prompts and two open-text questions, a normal human reading at steady speed takes two to four minutes. Submitting in under forty seconds triggers an automatic low-attention warning even if your selections look tidy.',
            'Read attention-check items word for word. Reviewers frequently place a quiet instruction inside a long list—for example, "To show you read carefully, choose Strongly Disagree on this row." Missing just one attention check usually voids the submission.'
          ],
          checklist: [
            'Take time to read every matrix row from left to right—rating scales sometimes flip order halfway down.',
            'Keep demographic details (country, city, occupation range) consistent with your profile.',
            'Never open multiple browser tabs to submit duplicate answers on the same campaign.'
          ]
        },
        {
          heading: '02. Writing Open-Ended Feedback That Actually Helps Product Teams',
          body: [
            'When a banking, telco, or delivery survey asks why you prefer one service over another, two specific sentences carry far more weight than vague praise. Instead of typing "It is very good and fast," mention a concrete detail from real life—for instance, whether agent float availability in your estate drops after 7:00 PM or whether app menus work smoothly on weak 3G bundles.',
            'Exactly one curated task drops each day at 08:00 AM EAT with 100% free access (no Worker Pass required). Task rewards are set dynamically by the sponsoring merchant depending on the task complexity and scope—so showing up on time at 8:00 AM EAT and writing authentic feedback directly determines your earnings.'
          ],
          example: {
            label: 'Open-Ended Prompt: "Why did you choose your primary mobile wallet?"',
            good: 'I mostly use it because nearly every local shop and matatu accepts the till number without extra charges, and reversal support responds reliably when I send to the wrong digit.',
            avoid: 'Good app fast money nice service.'
          },
          checklist: [
            'Write in clear, natural sentences explaining the real reason behind your rating.',
            'Avoid pasting template sentences across different survey topics.',
            'Be honest if you have never used a product—screeners route you cleanly rather than flagging contradiction.'
          ]
        }
      ]
    },
    {
      id: 'receipt-ocr-manual',
      legacyIds: ['receipt-digitization-ocr-guide'],
      title: 'Verifying Thermal Receipts & Invoices: Catching Tax & Total Discrepancies',
      subtitle:
        'Step-by-step habits for keying crumpled supermarket slips, fuel receipts, and eTIMS tax breakdowns accurately.',
      category: 'Document Keying & OCR',
      categoryKey: 'data-work',
      readTime: '7 min read',
      author: 'Data Verification Desk',
      authorRole: 'Document Operations',
      date: 'Reviewed November 2026',
      openingNote:
        'Automated scanners read flat, freshly printed A4 PDFs reliably, yet they struggle badly on folded till slips pulled out of pockets or faded purple-ink fuel receipts. Our document verification tasks pair machine pre-reads with human eyes so small accounting teams and retail tools receive clean numbers.',
      sections: [
        {
          heading: '01. Characters That Almost Always Fool Scanners: 8 vs B, 0 vs O, 5 vs S',
          body: [
            'Thermal receipt printers use dot-matrix patterns that smudge slightly when paper feeds too quickly or sits in sunlight. Automated software regularly swaps the digit 8 for capital B, zero for capital O, and 1 for lowercase l inside merchant reference codes and PINs.',
            'Never blindly accept the pre-filled OCR text box. Compare every digit on the till number, receipt serial, and subtotal against the photo line by line. On Kenyan eTIMS slips, inspect the CU Serial and Invoice Number carefully since letters and digits sit next to each other without spaces.'
          ],
          checklist: [
            'Enter plain numeric figures without currency prefixes (type 1450.00, not KSh 1,450.00) unless the field asks for currency codes.',
            'Verify whether comma separators denote thousands (1,250.00) or decimals depending on the store format.',
            'Look at the bottom line carefully to separate Cash Tendered and Change Given from the actual Invoice Total.'
          ]
        },
        {
          heading: '02. Run a Quick Mental Math Check on Subtotal + VAT Before Submitting',
          body: [
            'Whenever a receipt prints Taxable Amount, VAT (for example 16% in Kenya or 18% in Uganda/Tanzania), and Total Due, add them mentally or with a quick calculator check. If the pre-scanned subtotal plus tax equals 2,340 but the blurry total looks like 2,840, zoom in on the middle digit—chances are a faded crease turned a 3 into an 8.',
            'If a receipt is physically torn across the total line so the digits are missing completely, do not invent numbers to finish the task. Flag the document as unreadable or damaged as instructed in the workspace.'
          ],
          checklist: [
            'Confirm Subtotal + Tax = Grand Total whenever both sub-lines are printed.',
            'Distinguish receipt date formats (DD/MM/YYYY is standard across East Africa, not MM/DD/YYYY).',
            'Flag torn, washed-out, or cropped receipts honestly instead of guessing blurred figures.'
          ]
        }
      ]
    },
    {
      id: 'micropayments-mpesa-momo-guide',
      legacyIds: ['micropayments-mpesa-wise-explained'],
      title: `Understanding the ${threshold} PayPal Cash-Out Threshold & National ID KYC`,
      subtitle:
        'Why PayPal payouts unlock from 150 shillings equivalent, how strict Front & Back National ID verification works per country, and why pool deposits stay separate.',
      category: 'PayPal Payouts & KYC',
      categoryKey: 'finance',
      readTime: '6 min read',
      author: 'Gideon N.',
      authorRole: 'Treasury & Payments Operations',
      date: 'Reviewed November 2026',
      openingNote:
        'Contributors want complete clarity on three questions: when can I withdraw via PayPal, what National ID photos are required for KYC approval, and how are task earnings separated from investment deposits? This handbook explains the exact rules.',
      sections: [
        {
          heading: `01. Why PayPal Minimum Withdrawals Start at ${threshold} & Require Front/Back ID KYC`,
          body: [
            `Withdrawals start at ${threshold} (150 Kenyan Shillings converted accurately across Kenya, Uganda, Tanzania, Rwanda, Burundi, South Sudan, Ethiopia, and Somalia) and are disbursed exclusively via PayPal so payouts arrive cleanly without excessive cross-border transfer overhead.`,
            `To keep the marketplace fraud-free, withdrawals operate under a strict KYC rule: before requesting a PayPal cash-out, you must upload clear photos of BOTH the Front and Back of your country’s official National ID (${country.idDocumentName}) and wait for Platform Owner approval.`
          ],
          checklist: [
            `Upload clear, uncropped Front and Back photos of your ${country.idDocumentName} in the KYC panel.`,
            'Verify your PayPal email address inside your profile and ensure Two-Factor Verification is enabled.',
            'Keep PayPal confirmation transaction IDs whenever funding KES 50+ investment pools or 50% auction escrow deposits.'
          ]
        },
        {
          heading: '02. Separated Wallets & Investment Pools (PayPal Deposit Only)',
          body: [
            'Task earnings sit inside your withdrawable contributor wallet strictly for PayPal cash-outs. Deposit-only KES 50+ Investment Pools and 50% Auction Security Escrow deposits are funded exclusively via PayPal Checkout rather than deducting from your pending task earnings balance.',
            'Treat daily 08:00 AM EAT micro-tasks as supplemental side income—not a guaranteed salary. Each day’s single dropped task carries a reward set by the sponsoring merchant according to task complexity and deliverable requirements.'
          ],
          checklist: [
            'Your earned wallet balance cannot be drained accidentally by pool or auction deposits.',
            'Daily tasks drop strictly once per day at 08:00 AM EAT—keep time so you do not miss today’s release.',
            'Contact +254712727558 or WhatsApp 0785909543 if a PayPal verification or KYC review needs attention.'
          ]
        }
      ]
    },
    {
      id: 'local-auctions-handbook',
      title: 'Buying & Selling Safely in Auctions: Mandatory 50% PayPal Escrow Deposit',
      subtitle:
        'How uploading 50% of the product amount upfront into PayPal Escrow protects both real sellers and buyers if an auction issue occurs.',
      category: 'Product Auctions',
      categoryKey: 'marketplace',
      readTime: '7 min read',
      author: 'Marketplace Moderation Team',
      authorRole: 'Trust & Listings Review',
      date: 'Reviewed November 2026',
      openingNote:
        'Online auctions on real physical goods only build trust when sellers actually ship what they listed and bidders honour real offers. To guarantee trustworthiness, every seller listing a product and every buyer placing a bid or Buy Now order must pay a 50% security escrow deposit via PayPal first.',
      sections: [
        {
          heading: '01. Honest Daylight Photos + 50% PayPal Seller Escrow Deposit',
          body: [
            'Before an auction goes live, the seller submits clear daylight photos of the physical item alongside a 50% security escrow deposit via PayPal Checkout. This proves genuine intent on real items rather than fake bait listings.',
            'State the item’s real condition plainly—battery health, storage size, accessories included, and city for delivery. Once the buyer receives the verified item in good condition, escrow is released smoothly to the seller.'
          ],
          example: {
            label: 'Listing Description Comparison',
            good: 'Used Redmi Note 12 (128GB, black). Screen has zero cracks; slight scuff near USB-C port. 50% PayPal escrow verified. Pickup in Westlands or courier delivery.',
            avoid: 'Clean phone 10/10 brand new serious buyers only pay off-site.'
          },
          checklist: [
            'Upload real photos taken on your own camera rather than stock catalog screenshots.',
            'Complete the 50% PayPal escrow deposit and enter your verified PayPal reference before publishing.',
            'Ship promptly and record handoff receipts so escrow clears cleanly.'
          ]
        },
        {
          heading: '02. 50% Buyer Escrow Deposit & Dispute Compensation',
          body: [
            'First-time bidders and Buy Now buyers also commit a 50% PayPal escrow deposit before locking a bid. Because both sides have verified 50% escrow held under platform oversight, unserious ghost bids and seller non-delivery are eliminated.',
            'If any auction issue occurs—such as an item arriving materially damaged/mismatched or a winning buyer backing out on a real listing—the Platform Owner uses the 50% escrow deposit to compensate the wronged buyer or seller fairly.'
          ],
          checklist: [
            'Complete your 50% PayPal escrow deposit before bidding or clicking Buy Now.',
            'Never send off-platform payments that bypass verified PayPal escrow protection.',
            'Report any shipping or item discrepancy immediately to support with your auction ID.'
          ]
        }
      ]
    },
    {
      id: 'pay-per-view-status-guide',
      title: `Free Pay-Per-View Status Uploads: Earning ${ppvPerView}/View & 24h Auto-Payouts`,
      subtitle: `Upload funny videos or your own photos for free inside the platform, collect ${ppvPerView} per registered member view, and receive automatic wallet settlement after 24 hours.`,
      category: 'Pay-Per-View Statuses',
      categoryKey: 'marketplace',
      readTime: '6 min read',
      author: 'Community Creators Desk',
      authorRole: 'Feed Moderation & Creator Support',
      date: 'Reviewed November 2026',
      openingNote:
        'Everyday comedy clips, street moments, and relatable East African photos already draw huge daily engagement. With our internal Pay-Per-View Status Feed, registered members post short statuses directly inside the platform with zero purchase or pass required, and earn for every fellow member who watches within the 24-hour status window.',
      sections: [
        {
          heading: `01. 100% Free to Upload — ${ppvPerView} Per Registered Customer View`,
          body: [
            `Uploading a funny video, funny meme photo, or your own original photo/video inside Pay-Per-View costs zero shillings—no subscription pass, no deposit, and no external social link requirements.`,
            `Once published, every unique registered member on Gideon Global Tasks who opens your status adds ${ppvPerView} directly to your live 24-hour view tally. Self-views and duplicate views from the same viewer account are filtered automatically so payouts stay fair.`
          ],
          checklist: [
            'Sign in or register for free—no pass upgrade required to upload or watch statuses.',
            'Media stays strictly inside the platform; share funny original videos or photos with clear captions.',
            `Each unique fellow member view adds ${ppvPerView} toward your status balance.`
          ]
        },
        {
          heading: '02. Automatic 24-Hour Status Reading & Wallet Settlement',
          body: [
            'Every uploaded status stays live on a 24-hour status clock visible directly on each card. As soon as the 24-hour window completes, our server automatically reads the final verified view count, multiplies views by 5 shillings per view, and credits the payout straight into your withdrawable wallet.',
            'No manual claim form is required—keep sharing relatable original moments and track both live pending earnings and settled payouts inside the Pay-Per-View tab.'
          ],
          checklist: [
            'Check the countdown timer on each status card to see hours and minutes remaining.',
            'Do not upload stolen spam, abusive media, or empty black frames.',
            'Settled 24-hour earnings combine with task rewards toward the standard cash-out threshold.'
          ]
        }
      ]
    }
  ];
};

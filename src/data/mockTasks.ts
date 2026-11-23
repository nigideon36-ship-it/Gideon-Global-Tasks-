import { Task, LeaderboardUser, MemeItem } from '../types/tasks';
import annotationStreetSample from '../assets/images/annotation_sample_street_1794041822257.jpg';
import receiptSampleScan from '../assets/images/receipt_sample_scan_1794041823242.jpg';

export const INITIAL_TASKS: Task[] = [
  // 1. DATA ANNOTATION
  {
    id: 'task-anno-101',
    title: 'Autonomous Driving CV: Tag Vehicles & Pedestrians',
    category: 'annotation',
    description: 'Draw 2D bounding boxes around all motorized vehicles, pedestrians on crosswalks, and bicycles from the urban intersection camera.',
    reward: 0.65,
    estimatedMinutes: 5,
    difficulty: 'Intermediate',
    spotsRemaining: 18,
    totalSpots: 100,
    requesterName: 'WayVelo AI Labs',
    requesterRating: 4.9,
    requesterVerified: true,
    tags: ['Computer Vision', 'Bounding Box', 'Autonomous Tech'],
    createdAt: '15 mins ago',
    instructions: [
      'Locate the street view camera capture.',
      'Select the corresponding label class (Vehicle, Pedestrian, or Bicycle).',
      'Draw bounding boxes around the subjects, ensuring no essential parts are clipped.',
      'Mark at least 3 distinct objects to pass the quality validation check.'
    ],
    annotationConfig: [
      {
        type: 'bounding-box',
        imageUrl: annotationStreetSample,
        targetLabels: ['Vehicle', 'Pedestrian', 'Bicycle', 'Traffic Sign'],
        expectedCount: 3,
        instructions: 'Label vehicles and crosswalk pedestrians with tight bounding boundaries.'
      }
    ]
  },

  // 2. DATA ENTRY
  {
    id: 'task-entry-201',
    title: 'Apex Tech Retail Receipt Digitization & Extraction',
    category: 'data-entry',
    description: 'Extract store location, date, transaction ID, items sold, and exact numeric figures from high-resolution scanned paper receipts.',
    reward: 0.3077,
    estimatedMinutes: 4,
    difficulty: 'Beginner',
    spotsRemaining: 42,
    totalSpots: 150,
    requesterName: 'LedgerClear FinTech',
    requesterRating: 4.8,
    requesterVerified: true,
    tags: ['Invoice OCR', 'Form Digitizing', 'Accounting'],
    createdAt: '30 mins ago',
    instructions: [
      'Inspect the scanned receipt document on the left viewer.',
      'Fill in the corresponding field values in the entry form.',
      'Ensure currency amounts contain numeric digits only without currency symbols.',
      'Double-check the total amount due against the printed subtotal.'
    ],
    dataEntryConfig: {
      documentUrl: receiptSampleScan,
      documentType: 'receipt',
      fields: [
        {
          key: 'storeName',
          label: 'Store Name',
          type: 'text',
          expectedValue: 'APEX TECH SUPPLIES',
          hint: 'Printed at the top header of the receipt'
        },
        {
          key: 'transactionDate',
          label: 'Transaction Date',
          type: 'text',
          expectedValue: '26 OCT 2023',
          hint: 'Format: DD MMM YYYY (e.g. 26 OCT 2023)'
        },
        {
          key: 'transactionNumber',
          label: 'Transaction ID',
          type: 'text',
          expectedValue: '8900456',
          hint: '7-digit transaction code'
        },
        {
          key: 'itemsSold',
          label: 'Total Items Sold',
          type: 'number',
          expectedValue: '9',
          hint: 'Number printed next to ITEMS SOLD'
        },
        {
          key: 'subtotal',
          label: 'Subtotal Amount',
          type: 'currency',
          expectedValue: '219.43',
          hint: 'Exact printed figure before tax'
        },
        {
          key: 'totalAmount',
          label: 'Total Amount Due',
          type: 'currency',
          expectedValue: '235.33',
          hint: 'Final billed figure'
        },
        {
          key: 'surveyCode',
          label: 'Survey Code',
          type: 'text',
          expectedValue: 'A8F-G2K-J1P',
          hint: 'Code printed at very bottom line'
        }
      ]
    }
  },

  // 3. SURVEY
  {
    id: 'task-surv-301',
    title: 'Global Remote Work & AI Tooling Survey 2026',
    category: 'survey',
    description: 'Share your perspective on how generative AI tools, async communication, and work-from-home policies impact your productivity.',
    reward: 0.55,
    estimatedMinutes: 5,
    difficulty: 'Beginner',
    spotsRemaining: 73,
    totalSpots: 200,
    requesterName: 'Global Workplace Observatory',
    requesterRating: 5.0,
    requesterVerified: true,
    tags: ['Market Research', 'Opinion', 'Tech Trends'],
    createdAt: '1 hour ago',
    instructions: [
      'Answer all 5 questions honestly based on your actual work routine.',
      'Provide concise, constructive reasoning on the open-ended prompt.',
      'Do not use automated bots or VPN switchers.'
    ],
    surveyQuestions: [
      {
        id: 'q1',
        type: 'single-choice',
        question: 'How many days per week do you primarily work remotely or freelance online?',
        options: ['Fully remote (5-7 days)', 'Hybrid (2-4 days remote)', 'Primarily in-office (0-1 day remote)', 'Student / Looking for work'],
        required: true
      },
      {
        id: 'q2',
        type: 'multiple-choice',
        question: 'Which software tools do you use on a daily basis? (Select all that apply)',
        options: ['AI coding / writing assistants', 'Video conferencing (Meet, Zoom)', 'Project trackers (Jira, Linear, Trello)', 'Cloud spreadsheets & docs', 'Messaging apps (Slack, Discord, Telegram)'],
        required: true
      },
      {
        id: 'q3',
        type: 'scale',
        question: 'On a scale from 1 to 10, how significantly has AI increased your weekly work efficiency?',
        scaleMin: 1,
        scaleMax: 10,
        scaleMinLabel: 'No impact / Hindered',
        scaleMaxLabel: 'Game-changer (>50% boost)',
        required: true
      },
      {
        id: 'q4',
        type: 'single-choice',
        question: 'What is your primary concern regarding AI automation in your field?',
        options: ['Job security and displacement', 'Quality/hallucination errors', 'Data privacy and copyright', 'No major concerns / Highly optimistic'],
        required: true
      },
      {
        id: 'q5',
        type: 'text',
        question: 'In 1-2 sentences, what is one micro-task or chore you wish software could automate for you completely?',
        required: true,
        minChars: 25
      }
    ]
  },

  // 4. MEME & CONTENT CREATION
  {
    id: 'task-meme-401',
    title: 'Remote Work & Freelancer Meme Challenge',
    category: 'meme-content',
    description: 'Use the built-in Gideon Meme Studio to generate a humorous, high-engagement meme about client revisions, deadlines, or coding quirks.',
    reward: 0.50,
    estimatedMinutes: 4,
    difficulty: 'Beginner',
    spotsRemaining: 29,
    totalSpots: 80,
    requesterName: 'CreatorBounty Guild',
    requesterRating: 4.9,
    requesterVerified: true,
    tags: ['Meme Studio', 'Creative', 'Viral Content'],
    createdAt: '2 hours ago',
    instructions: [
      'Choose a popular template or upload a custom visual in the Meme Studio.',
      'Write catchy top and bottom captions that resonate with global online earners.',
      'Adjust font styling, alignment, and preview the rendered canvas.',
      'Submit directly to publish on the Gideon Global Meme Feed and earn your bounty!'
    ]
  },

  // 5. WRITING & COPYWRITING
  {
    id: 'task-write-501',
    title: 'Product Copywriting: "HyperCharge 140W Gallium Nitride Hub"',
    category: 'writing',
    description: 'Write an engaging 90–140 word e-commerce product summary highlighting fast charging, compact size, and thermal dissipation.',
    reward: 0.95,
    estimatedMinutes: 8,
    difficulty: 'Intermediate',
    spotsRemaining: 14,
    totalSpots: 50,
    requesterName: 'Voltra Electronics Ltd',
    requesterRating: 4.9,
    requesterVerified: true,
    tags: ['E-Commerce', 'Copywriting', 'SEO'],
    createdAt: '3 hours ago',
    instructions: [
      'Review the product specifications and target customer persona.',
      'Incorporate all 3 required keywords naturally into your paragraph.',
      'Ensure word count is strictly between 90 and 140 words.',
      'Keep the tone confident, modern, and benefit-driven.'
    ],
    writingConfig: {
      prompt: 'Draft an attention-grabbing product description for the "HyperCharge 140W GaN Hub". Emphasize its ability to power laptops, tablets, and phones simultaneously without heating up.',
      targetWordCount: { min: 90, max: 140 },
      mandatoryKeywords: ['Gallium Nitride', 'universal fast charging', 'heat dissipation'],
      tone: 'Professional',
      rubric: [
        'Hook sentence draws attention immediately',
        'Clear statement of benefits over standard silicon chargers',
        'All 3 required keywords included seamlessly'
      ]
    }
  },

  // 6. MICRO TASKS
  {
    id: 'task-micro-601',
    title: 'Rapid A/B Usability Poll: Fintech Dark Mode Button',
    category: 'micro',
    description: 'Quickly evaluate two button styles for a global remittance app and choose which provides superior tap readability.',
    reward: 0.1538,
    estimatedMinutes: 1,
    difficulty: 'Beginner',
    spotsRemaining: 88,
    totalSpots: 250,
    requesterName: 'NeuraPay UI Research',
    requesterRating: 5.0,
    requesterVerified: true,
    tags: ['30 Seconds', 'Instant Pay', 'UI Feedback'],
    createdAt: '10 mins ago',
    instructions: [
      'Review the two design alternatives side by side.',
      'Vote for Option A (High Contrast Emerald) or Option B (Deep Indigo).',
      'Provide a 1-sentence explanation of why it is easier to see on mobile.'
    ],
    microConfig: {
      type: 'ui-audit',
      title: 'Which CTA button has higher clarity on dark mobile screens?',
      steps: [
        'Inspect the contrast ratio on dark OLED screens',
        'Choose your preferred variant',
        'Submit for instant balance credit'
      ],
      options: [
        'Option A: Emerald Green (#10B981) with Black Text',
        'Option B: Deep Indigo (#4F46E5) with Crisp White Text',
        'Both are equally legible'
      ]
    }
  },

  // 7. ANOTHER SURVEY
  {
    id: 'task-surv-302',
    title: 'Cross-Border Money Transfer & PayPal Payout Survey',
    category: 'survey',
    description: 'Provide feedback on how East African freelancers and contributors receive PayPal payments, conversion rates, and cash-out timing.',
    reward: 0.75,
    estimatedMinutes: 6,
    difficulty: 'Intermediate',
    spotsRemaining: 34,
    totalSpots: 120,
    requesterName: 'Fintech Borderless Alliance',
    requesterRating: 4.8,
    requesterVerified: true,
    tags: ['Fintech', 'PayPal Payouts', 'Local Economy'],
    createdAt: '4 hours ago',
    instructions: [
      'Reflect on your personal PayPal and cross-border payout experiences over the past 12 months.',
      'Select realistic conversion ranges experienced.',
      'Complete all questions for instant validation.'
    ],
    surveyQuestions: [
      {
        id: 's2_q1',
        type: 'single-choice',
        question: 'Which PayPal payout schedule works best for receiving online task earnings across East Africa?',
        options: ['Instant PayPal Payout upon KYC Approval', 'Weekly PayPal Consolidated Batch', 'Bi-weekly Global Settlement', 'Monthly High-Volume Transfer'],
        required: true
      },
      {
        id: 's2_q2',
        type: 'scale',
        question: 'How satisfied are you with the average currency conversion rates and processing fees you pay?',
        scaleMin: 1,
        scaleMax: 10,
        scaleMinLabel: 'Very Dissatisfied (Fees >5%)',
        scaleMaxLabel: 'Highly Satisfied (<1% fees)',
        required: true
      },
      {
        id: 's2_q3',
        type: 'single-choice',
        question: 'Would you prefer instant daily micropayments (under 650 shillings) or consolidated weekly batch payouts?',
        options: ['Instant daily payouts (even with small fees)', 'Weekly batch payouts (zero fees)', 'Monthly consolidated payment'],
        required: true
      },
      {
        id: 's2_q4',
        type: 'text',
        question: 'What is the biggest hassle you currently face when cashing out online task earnings?',
        required: true,
        minChars: 20
      }
    ]
  },

  // 8. ANOTHER DATA ANNOTATION
  {
    id: 'task-anno-102',
    title: 'Customer Sentiment & Intent Tagging (5 Conversations)',
    category: 'annotation',
    description: 'Classify tone (Urgent, Satisfied, Frustrated, Inquiring) and detect primary request intent for e-commerce customer dialogues.',
    reward: 0.2692,
    estimatedMinutes: 3,
    difficulty: 'Beginner',
    spotsRemaining: 55,
    totalSpots: 100,
    requesterName: 'Conversa NLP',
    requesterRating: 4.7,
    requesterVerified: true,
    tags: ['NLP', 'Sentiment', 'Text Classification'],
    createdAt: '5 hours ago',
    instructions: [
      'Read the customer dialogue snippet.',
      'Select the dominant emotional sentiment.',
      'Tag the underlying intent (Refund, Tracking, Technical Glitch, Product Query).'
    ],
    annotationConfig: [
      {
        type: 'sentiment',
        sentimentText: "I've been waiting 9 business days for order #49281. The tracking status hasn't moved past 'Carrier Received' in Chicago. I need this package before my daughter's birthday this Saturday, or I will need a full immediate refund!",
        targetLabels: ['Frustrated / Escalated', 'Neutral / Informational', 'Satisfied / Positive'],
        instructions: 'Determine the emotional state and highlight any refund trigger.'
      }
    ]
  },

  // 9. ANOTHER MICRO TASK
  {
    id: 'task-micro-602',
    title: 'Quick Verification: Is this Product Image Authentic?',
    category: 'micro',
    description: 'Inspect a marketplace listing photo to verify if watermarks, AI distortions, or misleading crop artifacts are present.',
    reward: 0.1538,
    estimatedMinutes: 1,
    difficulty: 'Beginner',
    spotsRemaining: 112,
    totalSpots: 300,
    requesterName: 'MarketGuard Trust',
    requesterRating: 4.9,
    requesterVerified: true,
    tags: ['Quick Check', 'Trust & Safety'],
    createdAt: '6 hours ago',
    instructions: [
      'Check the product image quality.',
      'Confirm whether text on packaging is legible and unaltered.',
      'Submit approval or flag as suspicious.'
    ],
    microConfig: {
      type: 'tagging',
      title: 'Inspect packaging text for optical AI artifacts or blur',
      steps: [
        'Check brand typography sharpness',
        'Verify barcode and regulatory icons are standard',
        'Select rating'
      ],
      options: [
        'Clean & Authentic (Real photography)',
        'Suspected AI Generated / Warped Text',
        'Contains Watermark / Copyright Violation'
      ]
    }
  },

  // 10. CREATOR CAMPAIGN: INSTAGRAM & TIKTOK REELS (SOLAR HOME HUB)
  {
    id: 'task-creator-701',
    title: 'Creator Reel Campaign: SunKing Solar Home Hub Pro (IG & TikTok)',
    category: 'creator-campaign',
    description: 'Film and publish a 20–45 second vertical product Reel on Instagram or TikTok demonstrating how the SunKing Solar Home Hub Pro powers home lighting and phone charging.',
    reward: 1.15,
    estimatedMinutes: 15,
    difficulty: 'Intermediate',
    spotsRemaining: 40,
    totalSpots: 100,
    requesterName: 'SunKing East Africa Products',
    requesterRating: 4.9,
    requesterVerified: true,
    tags: ['Instagram', 'TikTok', 'Reel', 'Product Campaign'],
    createdAt: '20 mins ago',
    instructions: [
      'Feature ONLY the SunKing Solar Home Hub Pro product according to the campaign talking points.',
      'Publish a vertical 9:16 Reel or short Video (20–45 seconds) on Instagram or TikTok.',
      'Include the mandatory product hashtags #SunKingEA and #SolarProductDemo in your caption.',
      'Paste your published Reel/Video link and exact post caption in the verification workspace.'
    ],
    creatorCampaignConfig: {
      productName: 'SunKing Solar Home Hub Pro',
      productCategory: 'Clean Energy Consumer Product',
      productTagline: '24/7 bright LED lighting & USB fast phone charging from one compact solar kit.',
      allowedPlatforms: ['Instagram', 'TikTok'],
      allowedFormats: ['reel', 'video'],
      campaignBrief: 'Create an authentic product showcase Reel showing clean solar home lighting and charging a smartphone. Focus exclusively on SunKing Solar Home Hub Pro benefits — do not include unrelated brand promotions.',
      talkingPoints: [
        'Mention zero electricity bill dependency for rural and urban East African homes',
        'Highlight dual USB phone-charging ports and 3 bright LED bulbs included',
        'Show a clear call-to-action directing followers to SunKing authorized shops'
      ],
      requiredHashtags: ['#SunKingEA', '#SolarProductDemo'],
      minDurationSeconds: 20
    }
  },

  // 11. CREATOR CAMPAIGN: TIKTOK, FACEBOOK & INSTAGRAM VIDEO (LIPAQUICK WALLET)
  {
    id: 'task-creator-702',
    title: 'Product Walkthrough Video: LipaQuick Merchant Pay (FB, IG & TikTok)',
    category: 'creator-campaign',
    description: 'Publish a short product explainer video or Reel demonstrating digital checkout receipts for East African small businesses on TikTok, Instagram, or Facebook.',
    reward: 1.25,
    estimatedMinutes: 18,
    difficulty: 'Intermediate',
    spotsRemaining: 35,
    totalSpots: 80,
    requesterName: 'LipaQuick Commerce',
    requesterRating: 5.0,
    requesterVerified: true,
    tags: ['Facebook', 'Instagram', 'TikTok', 'Video', 'Reel'],
    createdAt: '45 mins ago',
    instructions: [
      'Follow the LipaQuick Merchant Pay product script strictly (product-focused content only).',
      'Post your Video or Reel publicly on Facebook, Instagram, or TikTok.',
      'Include #LipaQuickPay and #EABusinessTools in your post caption.',
      'Submit your public Video/Reel link and published caption to unlock your creator payout.'
    ],
    creatorCampaignConfig: {
      productName: 'LipaQuick Merchant Pay App',
      productCategory: 'Merchant Payment Product',
      productTagline: 'Instant checkout receipts and daily sales ledgers for East African shops.',
      allowedPlatforms: ['TikTok', 'Instagram', 'Facebook'],
      allowedFormats: ['video', 'reel'],
      campaignBrief: 'Walk shop owners through how LipaQuick generates instant digital customer receipts and tracks daily sales without manual paper notebooks. Content must highlight the LipaQuick product only.',
      talkingPoints: [
        'Explain instant payment alerts for cashiers and shopkeepers',
        'Highlight automated daily PayPal & digital sales summaries',
        'Keep visuals crisp and strictly focused on the LipaQuick product workflow'
      ],
      requiredHashtags: ['#LipaQuickPay', '#EABusinessTools'],
      minDurationSeconds: 25
    }
  },

  // 12. CREATOR CAMPAIGN: FACEBOOK & WHATSAPP TEXT POST (ZURI BOTANICALS SERUM)
  {
    id: 'task-creator-703',
    title: 'Product Launch Text Post: Zuri Shea & Moringa Serum (FB & WhatsApp)',
    category: 'creator-campaign',
    description: 'Write and publish a high-converting product recommendation text post on Facebook or your WhatsApp Status/Channel introducing Zuri Shea & Moringa Repair Serum.',
    reward: 0.60,
    estimatedMinutes: 8,
    difficulty: 'Beginner',
    spotsRemaining: 64,
    totalSpots: 150,
    requesterName: 'Zuri Botanicals Kenya',
    requesterRating: 4.8,
    requesterVerified: true,
    tags: ['Facebook', 'WhatsApp', 'Text Post', 'Product Launch'],
    createdAt: '1 hour ago',
    instructions: [
      'Craft an original product text post (at least 30 words) following the Zuri Serum key benefits.',
      'Publish ONLY on Facebook or WhatsApp (Status, Business Broadcast, or WhatsApp Channel).',
      'Include the campaign tags #ZuriBotanicals and #GlowWithShea in your post.',
      'Submit your Facebook post URL or WhatsApp Channel link / Status proof screenshot alongside the text posted.'
    ],
    creatorCampaignConfig: {
      productName: 'Zuri Shea & Moringa Repair Serum',
      productCategory: 'Natural Skincare Product',
      productTagline: 'Cold-pressed East African shea & moringa hydration formulated for daily skin barrier care.',
      allowedPlatforms: ['Facebook', 'WhatsApp'],
      allowedFormats: ['text-post'],
      campaignBrief: 'Publish an engaging product story/text post sharing why cold-pressed shea and moringa oil keeps skin hydrated without greasy residue. Promote only the Zuri Serum product.',
      talkingPoints: [
        'Mention 100% cold-pressed Ugandan shea & Kenyan moringa ingredients',
        'Highlight lightweight non-greasy absorption for humid & dry climates',
        'Share pricing availability and direct order call-to-action'
      ],
      requiredHashtags: ['#ZuriBotanicals', '#GlowWithShea'],
      minWordCount: 30
    }
  },

  // 13. CREATOR CAMPAIGN: ALL 4 PLATFORMS BLITZ (VOLTMAX POWERBANK)
  {
    id: 'task-creator-704',
    title: 'Multi-Channel Product Blitz: VoltMax 20K Fast Powerbank (FB, IG, TikTok, WA)',
    category: 'creator-campaign',
    description: 'Create a Reel, Video, or Text Post showcasing the VoltMax 20,000mAh PD Powerbank across Facebook, Instagram, TikTok, or WhatsApp.',
    reward: 1.40,
    estimatedMinutes: 15,
    difficulty: 'Intermediate',
    spotsRemaining: 28,
    totalSpots: 90,
    requesterName: 'VoltMax Accessories EA',
    requesterRating: 4.9,
    requesterVerified: true,
    tags: ['Facebook', 'Instagram', 'TikTok', 'WhatsApp', 'Reel', 'Video', 'Text Post'],
    createdAt: '2 hours ago',
    instructions: [
      'Pick ONE content format (Reel, Video, or detailed Text Post) highlighting the VoltMax 20,000mAh PD Powerbank.',
      'Publish exclusively on Facebook, Instagram, TikTok, or WhatsApp using the product brief.',
      'Include #VoltMax20K and #StayPoweredEA in your post or WhatsApp Status caption.',
      'Verify your published post URL or WhatsApp Status/Channel proof to earn the full merchant reward set for this campaign.'
    ],
    creatorCampaignConfig: {
      productName: 'VoltMax 20,000mAh 65W PD Powerbank',
      productCategory: 'Mobile Electronics Product',
      productTagline: 'Charge phones 4x or power laptops on the move with 65W USB-C Power Delivery.',
      allowedPlatforms: ['Instagram', 'TikTok', 'Facebook', 'WhatsApp'],
      allowedFormats: ['reel', 'video', 'text-post'],
      campaignBrief: 'Show creators, students, and remote workers how VoltMax 20K keeps phones and USB-C laptops running during travel or power outages. Feature the VoltMax Powerbank product exclusively.',
      talkingPoints: [
        '65W USB-C fast charging capable of charging laptops and phones simultaneously',
        '20,000mAh airline-safe high-density battery with LED charge percentage readout',
        'Built-in surge & thermal protection for long battery health'
      ],
      requiredHashtags: ['#VoltMax20K', '#StayPoweredEA'],
      minDurationSeconds: 15,
      minWordCount: 25
    }
  },

  // 14. QUICK DAILY DROP SURVEY
  {
    id: 'task-surv-300',
    title: 'East Africa Quick App Experience Check (3 Questions)',
    category: 'survey',
    description: 'Answer 3 quick questions about global PayPal checkout speed and remote work app reliability in your city.',
    reward: 0.25,
    estimatedMinutes: 2,
    difficulty: 'Beginner',
    spotsRemaining: 140,
    totalSpots: 400,
    requesterName: 'Nairobi UX Labs',
    requesterRating: 4.9,
    requesterVerified: true,
    tags: ['8 AM Daily Drop', 'Quick Survey', 'Mobile UX'],
    createdAt: '5 mins ago',
    instructions: [
      'Answer all 3 questions based on your experience this week.',
      'Only 1 vetted task drops daily at 08:00 AM EAT — reward depends on merchant budget.'
    ],
    surveyQuestions: [
      {
        id: 'f_q1',
        type: 'single-choice',
        question: 'How fast did PayPal international checkout confirm your last online payment?',
        options: ['Instant (< 5 seconds)', 'Under 30 seconds', '1–2 minutes', 'Haven\'t used PayPal checkout yet'],
        required: true
      },
      {
        id: 'f_q2',
        type: 'scale',
        question: 'Rate your mobile internet reliability when catching the 8:00 AM EAT task drop (1-10):',
        scaleMin: 1,
        scaleMax: 10,
        scaleMinLabel: 'Slow / Unstable',
        scaleMaxLabel: 'Very Fast',
        required: true
      },
      {
        id: 'f_q3',
        type: 'text',
        question: 'In one sentence, what improvement would make daily 8:00 AM EAT task drops easier to complete?',
        required: true,
        minChars: 15
      }
    ]
  },

  // 15. TELECOM USAGE SURVEY
  {
    id: 'task-surv-303',
    title: 'Telecom Survey: Mobile Data Bundles & Social Usage Habits',
    category: 'survey',
    description: 'Share how much you spend weekly on mobile bundles and which apps consume most of your work data.',
    reward: 0.45,
    estimatedMinutes: 3,
    difficulty: 'Beginner',
    spotsRemaining: 95,
    totalSpots: 250,
    requesterName: 'EA Telecom Insights',
    requesterRating: 4.8,
    requesterVerified: true,
    tags: ['Telecom', 'Survey', 'Data Bundles'],
    createdAt: '25 mins ago',
    instructions: [
      'Select your primary telecom network and weekly data spending range.',
      'Reward set by EA Telecom Insights merchant budget.'
    ],
    surveyQuestions: [
      {
        id: 'st_q1',
        type: 'single-choice',
        question: 'Which network do you primarily rely on for daily remote tasks?',
        options: ['Safaricom', 'Airtel', 'MTN', 'Vodacom / Halotel / Other'],
        required: true
      },
      {
        id: 'st_q2',
        type: 'single-choice',
        question: 'How often do you buy daily or weekly data bundles?',
        options: ['Daily', 'Every 2-3 days', 'Weekly', 'Monthly Wi-Fi / Fiber'],
        required: true
      },
      {
        id: 'st_q3',
        type: 'text',
        question: 'What matters most when choosing an affordable bundle for online work?',
        required: true,
        minChars: 20
      }
    ]
  },

  // 16. MICRO AUDIT TASK
  {
    id: 'task-micro-603',
    title: 'Micro Audit: Verify PayPal Checkout Clarity & Fee Disclosure',
    category: 'micro',
    description: 'Inspect a simulated merchant PayPal checkout screen and flag unclear hidden fees or missing total currency labels.',
    reward: 0.30,
    estimatedMinutes: 2,
    difficulty: 'Beginner',
    spotsRemaining: 110,
    totalSpots: 300,
    requesterName: 'PayClear Audit EA',
    requesterRating: 4.9,
    requesterVerified: true,
    tags: ['PayPal UX', 'Micro Audit', 'Trust'],
    createdAt: '35 mins ago',
    instructions: [
      'Review the checkout transparency criteria.',
      'Select the option that best matches clear USD & local currency disclosure.'
    ],
    microConfig: {
      type: 'ui-audit',
      title: 'Which PayPal checkout fee breakdown screen is clearest before confirming?',
      steps: [
        'Compare visible USD total & converted local estimate',
        'Verify merchant PayPal recipient email is clearly highlighted',
        'Submit your audit rating'
      ],
      options: [
        'Bold Merchant PayPal Address + Exact USD & Local Equivalent Shown Upfront',
        'Total Fees Hidden Until After Confirmation',
        'Requires Manual Calculator Conversion'
      ]
    }
  },

  // 17. HIGH-VALUE MERCHANT STUDY SURVEY
  {
    id: 'task-surv-304',
    title: 'Merchant Study: East Africa Cross-Border PayPal & Escrow Commerce',
    category: 'survey',
    description: 'In-depth financial study evaluating PayPal payouts, Front/Back ID KYC trust, and 50% escrow-backed product auctions across East Africa.',
    reward: 1.1538,
    estimatedMinutes: 6,
    difficulty: 'Intermediate',
    spotsRemaining: 60,
    totalSpots: 180,
    requesterName: 'Kigali & Nairobi Fintech Council',
    requesterRating: 5.0,
    requesterVerified: true,
    tags: ['High Reward', 'PayPal Escrow', 'East Africa'],
    createdAt: '12 mins ago',
    instructions: [
      'Complete all 4 questions carefully with real-world East Africa context.',
      'Higher merchant-sponsored reward (KES 150 equivalent) reflects study depth.'
    ],
    surveyQuestions: [
      {
        id: 'vip_q1',
        type: 'single-choice',
        question: 'Which feature boosts your trust most when participating in live online product auctions?',
        options: ['Mandatory 50% PayPal Escrow Security Deposit', 'Front & Back National ID KYC on Withdrawals', 'Clear Buyer & Seller Delivery Terms', 'Instant Buy Now Option'],
        required: true
      },
      {
        id: 'vip_q2',
        type: 'multiple-choice',
        question: 'Which digital workflow tools do you rely on weekly?',
        options: ['PayPal International Checkout', 'Pay-Per-View Creator Feed', '8:00 AM EAT Daily Task Drop', 'Verified Micro-Work Portfolio'],
        required: true
      },
      {
        id: 'vip_q3',
        type: 'scale',
        question: 'How valuable is lowering minimum PayPal withdrawals to 150 shillings once KYC is verified (1-10)?',
        scaleMin: 1,
        scaleMax: 10,
        scaleMinLabel: 'Low Impact',
        scaleMaxLabel: 'Essential Improvement',
        required: true
      },
      {
        id: 'vip_q4',
        type: 'text',
        question: 'Describe one verification or escrow rule that gives you confidence when buying or selling online.',
        required: true,
        minChars: 25
      }
    ]
  }
];

export const INITIAL_LEADERBOARD: LeaderboardUser[] = [
  {
    rank: 1,
    name: 'Gideon N.',
    country: 'Kenya',
    countryCode: 'KE',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    tasksCompleted: 489,
    earnings: 1248.60,
    accuracyRate: 99.7,
    tier: 'Diamond'
  },
  {
    rank: 2,
    name: 'Grace Namukasa',
    country: 'Uganda',
    countryCode: 'UG',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80',
    tasksCompleted: 412,
    earnings: 1094.20,
    accuracyRate: 99.2,
    tier: 'Diamond'
  },
  {
    rank: 3,
    name: 'Juma Bakari',
    country: 'Tanzania',
    countryCode: 'TZ',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    tasksCompleted: 385,
    earnings: 968.75,
    accuracyRate: 98.9,
    tier: 'Gold'
  },
  {
    rank: 4,
    name: 'Aline Uwase',
    country: 'Rwanda',
    countryCode: 'RW',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
    tasksCompleted: 341,
    earnings: 892.40,
    accuracyRate: 99.1,
    tier: 'Gold'
  },
  {
    rank: 5,
    name: 'Dawit Bekele',
    country: 'Ethiopia',
    countryCode: 'ET',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    tasksCompleted: 329,
    earnings: 840.10,
    accuracyRate: 98.4,
    tier: 'Gold'
  },
  {
    rank: 6,
    name: 'Clarisse Ndayishimiye',
    country: 'Burundi',
    countryCode: 'BI',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
    tasksCompleted: 298,
    earnings: 785.50,
    accuracyRate: 98.6,
    tier: 'Silver'
  },
  {
    rank: 7,
    name: 'Hassan Farah',
    country: 'Somalia',
    countryCode: 'SO',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80',
    tasksCompleted: 274,
    earnings: 712.30,
    accuracyRate: 98.0,
    tier: 'Silver'
  }
];

export const INITIAL_MEMES: MemeItem[] = [
  {
    id: 'meme-1',
    title: 'When the AI training dataset has 10,000 edge cases',
    author: 'KampalaCoder',
    authorCountry: 'Uganda',
    imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    upvotes: 142,
    tipsEarned: 14.20,
    category: 'AI & Data Annotation',
    createdAt: '2 hours ago'
  },
  {
    id: 'meme-2',
    title: 'Me refreshing Gideon Global Tasks at 07:59 AM EAT for the 8:00 AM daily drop',
    author: 'Kiplagat_Pro',
    authorCountry: 'Kenya',
    imageUrl: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?w=600&auto=format&fit=crop&q=80',
    upvotes: 98,
    tipsEarned: 9.80,
    category: 'Work From Home',
    createdAt: '4 hours ago'
  },
  {
    id: 'meme-3',
    title: 'Client: "It should only take 5 minutes" ... 4 hours later in data entry',
    author: 'BongoDataPro',
    authorCountry: 'Tanzania',
    imageUrl: 'https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=600&auto=format&fit=crop&q=80',
    upvotes: 84,
    tipsEarned: 8.40,
    category: 'Data Entry',
    createdAt: '6 hours ago'
  }
];

import { Task, LeaderboardUser, MemeItem } from '../types/tasks';

export const INITIAL_TASKS: Task[] = [
  // 1. DATA ANNOTATION
  {
    id: 'task-anno-101',
    title: 'Autonomous Driving CV: Tag Vehicles & Pedestrians',
    category: 'annotation',
    description: 'Draw 2D bounding boxes around all motorized vehicles, pedestrians on crosswalks, and bicycles from the urban intersection camera.',
    reward: 4.50,
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
        imageUrl: '/src/assets/images/annotation_sample_street_1794041822257.jpg',
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
    description: 'Extract store location, date, transaction ID, items sold, and exact dollar figures from high-resolution scanned paper receipts.',
    reward: 3.40,
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
      'Ensure currency amounts do not include dollar signs in raw inputs.',
      'Double-check the total amount due against the printed subtotal.'
    ],
    dataEntryConfig: {
      documentUrl: '/src/assets/images/receipt_sample_scan_1794041823242.jpg',
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
          label: 'Subtotal ($)',
          type: 'currency',
          expectedValue: '219.43',
          hint: 'Exact dollar amount before tax'
        },
        {
          key: 'totalAmount',
          label: 'Total Amount Due ($)',
          type: 'currency',
          expectedValue: '235.33',
          hint: 'Final billed charge'
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
    reward: 2.80,
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
    reward: 3.00,
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
    reward: 5.50,
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
    reward: 0.75,
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
    title: 'Cross-Border Money Transfer & Crypto Adoption Survey',
    category: 'survey',
    description: 'Provide feedback on how international freelancers and workers receive payments, transaction fees incurred, and preferred payout methods.',
    reward: 3.20,
    estimatedMinutes: 6,
    difficulty: 'Intermediate',
    spotsRemaining: 34,
    totalSpots: 120,
    requesterName: 'Fintech Borderless Alliance',
    requesterRating: 4.8,
    requesterVerified: true,
    tags: ['Fintech', 'Payouts', 'Global Economy'],
    createdAt: '4 hours ago',
    instructions: [
      'Reflect on your personal payment methods over the past 12 months.',
      'Select realistic fee ranges experienced.',
      'Complete all questions for instant validation.'
    ],
    surveyQuestions: [
      {
        id: 's2_q1',
        type: 'single-choice',
        question: 'Which payment rail do you primarily use to receive global freelance earnings?',
        options: ['PayPal', 'Wise / Direct Local Bank Deposit', 'USDT / Crypto stablecoins', 'Payoneer', 'Bank Wire Transfer'],
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
        question: 'Would you prefer instant daily micropayments (under $5) or consolidated weekly batch payouts?',
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
    reward: 2.25,
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
    reward: 0.60,
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
    name: 'Elena Rostova',
    country: 'Germany',
    countryCode: 'DE',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80',
    tasksCompleted: 412,
    earnings: 1094.20,
    accuracyRate: 99.2,
    tier: 'Diamond'
  },
  {
    rank: 3,
    name: 'Mateo Silva',
    country: 'Brazil',
    countryCode: 'BR',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    tasksCompleted: 385,
    earnings: 968.75,
    accuracyRate: 98.9,
    tier: 'Gold'
  },
  {
    rank: 4,
    name: 'Amina Bello',
    country: 'Nigeria',
    countryCode: 'NG',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
    tasksCompleted: 341,
    earnings: 892.40,
    accuracyRate: 99.1,
    tier: 'Gold'
  },
  {
    rank: 5,
    name: 'Rajesh Sharma',
    country: 'India',
    countryCode: 'IN',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80',
    tasksCompleted: 329,
    earnings: 840.10,
    accuracyRate: 98.4,
    tier: 'Gold'
  },
  {
    rank: 6,
    name: 'Chloe Tremblay',
    country: 'Canada',
    countryCode: 'CA',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80',
    tasksCompleted: 298,
    earnings: 785.50,
    accuracyRate: 98.6,
    tier: 'Silver'
  },
  {
    rank: 7,
    name: 'Aris Santos',
    country: 'Philippines',
    countryCode: 'PH',
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
    author: 'CodeJester',
    authorCountry: 'Nigeria',
    imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    upvotes: 142,
    tipsEarned: 14.20,
    category: 'AI & Data Annotation',
    createdAt: '2 hours ago'
  },
  {
    id: 'meme-2',
    title: 'Me refreshing Gideon Global Tasks at 00:01 for high-paying surveys',
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
    author: 'SammySpreadsheets',
    authorCountry: 'USA',
    imageUrl: 'https://images.unsplash.com/photo-1579202673506-ca3ce28943ef?w=600&auto=format&fit=crop&q=80',
    upvotes: 84,
    tipsEarned: 8.40,
    category: 'Data Entry',
    createdAt: '6 hours ago'
  }
];

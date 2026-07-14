/* ================================================================
   MARKETPLACE DATA — preloaded services / sub-services / countries
   Shared by seller.html (gig setup) and buyers.html (search/filter).
   ================================================================ */

const MP_SERVICES = [
  {
    id: 'web-dev',
    label: 'Web & App Development',
    subs: [
      { id: 'website-development', label: 'Website Development (Custom/Business Websites)' },
      { id: 'wordpress-development', label: 'WordPress Development' },
      { id: 'shopify-development', label: 'Shopify Development (E-commerce Stores)' },
      { id: 'custom-web-apps', label: 'Custom Web Applications' },
      { id: 'mobile-app-development', label: 'Mobile App Development (Android/iOS)' },
      { id: 'api-backend-development', label: 'API & Backend Development' },
      { id: 'ecommerce-development', label: 'E-commerce Website Development' },
      { id: 'landing-page-development', label: 'Landing Page Development' },
      { id: 'website-maintenance', label: 'Website Maintenance & Support' },
      { id: 'bug-fixing-optimization', label: 'Bug Fixing & Code Optimization' },
      { id: 'hosting-domain-setup', label: 'Web Hosting & Domain Setup Assistance' },
    ],
  },
  {
    id: 'software-programming',
    label: 'Software & Programming (Tech Freelance)',
    subs: [
      { id: 'fullstack-development', label: 'Full-Stack Software Development' },
      { id: 'database-design-management', label: 'Database Design & Management' },
      { id: 'desktop-app-development', label: 'Desktop Application Development' },
      { id: 'chatbot-ai-integration', label: 'Chatbot & AI Integration' },
      { id: 'automation-scripting', label: 'Automation & Scripting' },
      { id: 'software-consulting', label: 'System/Software Consulting' },
      { id: 'cloud-devops', label: 'Cloud Deployment & DevOps' },
      { id: 'technical-support-it-consulting', label: 'Technical Support & IT Consulting' },
    ],
  },
  {
    id: 'video-editing',
    label: 'Video Editing',
    subs: [
      { id: 'youtube-editing', label: 'YouTube Video Editing' },
      { id: 'shortform-reels-tiktok', label: 'Short-Form/Reels & TikTok Editing' },
      { id: 'motion-graphics-animation', label: 'Motion Graphics & Animation' },
      { id: 'corporate-promo-editing', label: 'Corporate & Promotional Video Editing' },
      { id: 'wedding-event-editing', label: 'Wedding/Event Video Editing' },
      { id: 'podcast-video-editing', label: 'Podcast Video Editing' },
      { id: 'color-grading-sound-design', label: 'Color Grading & Sound Design' },
      { id: 'video-ads-editing', label: 'Video Ads Editing' },
    ],
  },
  {
    id: 'design',
    label: 'Graphics & Design',
    subs: [
      { id: 'logo-brand-identity', label: 'Logo & Brand Identity Design' },
      { id: 'ui-ux-design', label: 'UI/UX Design' },
      { id: 'social-media-graphics', label: 'Social Media Graphics Design' },
      { id: 'print-design', label: 'Print Design (Flyers, Posters, Business Cards)' },
      { id: 'packaging-design', label: 'Packaging Design' },
      { id: 'illustration-custom-artwork', label: 'Illustration & Custom Artwork' },
      { id: 'presentation-pitch-deck', label: 'Presentation/Pitch Deck Design' },
      { id: 'book-cover-design', label: 'Book Cover Design' },
    ],
  },
  {
    id: 'digital-marketing',
    label: 'Digital Marketing',
    subs: [
      { id: 'seo', label: 'Search Engine Optimization (SEO)' },
      { id: 'social-media-marketing', label: 'Social Media Marketing & Management' },
      { id: 'paid-advertising', label: 'Paid Advertising (Google Ads, Meta Ads/PPC)' },
      { id: 'content-marketing-strategy', label: 'Content Marketing Strategy' },
      { id: 'influencer-marketing', label: 'Influencer Marketing Campaigns' },
      { id: 'brand-strategy-positioning', label: 'Brand Strategy & Online Positioning' },
      { id: 'analytics-performance-reporting', label: 'Analytics & Performance Reporting' },
    ],
  },
  {
    id: 'email-marketing',
    label: 'Email Marketing',
    subs: [
      { id: 'email-campaign-design-copywriting', label: 'Email Campaign Design & Copywriting' },
      { id: 'email-automation-setup', label: 'Email Automation Setup (Mailchimp, Klaviyo, etc.)' },
      { id: 'newsletter-management', label: 'Newsletter Management' },
      { id: 'lead-nurturing-sequences', label: 'Lead Nurturing Sequences' },
      { id: 'list-building-segmentation', label: 'List Building & Segmentation Strategy' },
    ],
  },
  {
    id: 'other-freelance-tech',
    label: 'Other Freelance Tech Services',
    hasPage: false,
    subs: [
      { id: 'copywriting-content-writing', label: 'Copywriting & Content Writing' },
      { id: 'virtual-assistance', label: 'Virtual Assistance' },
      { id: 'data-entry-analysis', label: 'Data Entry & Data Analysis' },
      { id: 'voiceover-audio-editing', label: 'Voice-Over & Audio Editing' },
      { id: 'technical-writing-documentation', label: 'Technical Writing/Documentation' },
    ],
  },
];

function mpGetService(id) { return MP_SERVICES.find(s => s.id === id); }
function mpGetSub(serviceId, subId) {
  const svc = mpGetService(serviceId);
  return svc ? svc.subs.find(s => s.id === subId) : null;
}

const MP_COUNTRIES = [
  "Nigeria","Ghana","Kenya","South Africa","Egypt","United States","United Kingdom","Canada","Australia",
  "Germany","France","Italy","Spain","Netherlands","Belgium","Ireland","Sweden","Norway","Denmark","Finland",
  "Switzerland","Austria","Poland","Portugal","Greece","Turkey","United Arab Emirates","Saudi Arabia","Qatar",
  "India","Pakistan","Bangladesh","China","Japan","South Korea","Singapore","Malaysia","Indonesia","Philippines",
  "Vietnam","Thailand","Brazil","Mexico","Argentina","Chile","Colombia","Peru","Morocco","Algeria","Tunisia",
  "Ethiopia","Tanzania","Uganda","Rwanda","Cameroon","Senegal","Ivory Coast","Zambia","Zimbabwe","Botswana",
  "Namibia","Mozambique","New Zealand","Russia","Ukraine","Israel","Jordan","Lebanon","Iraq","Iran",
  "Sri Lanka","Nepal","Myanmar","Cambodia","Laos","Mongolia","Kazakhstan","Uzbekistan","Other",
].sort((a, b) => a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b));
